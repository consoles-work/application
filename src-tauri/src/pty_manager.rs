// ══════════════════════════════════════════════════════════════════
// pty_manager.rs — терминальные сессии консолей
// ══════════════════════════════════════════════════════════════════
//
// Держит живые терминалы; вызывается вкладками терминала через IPC.
//
// spawn — открыть терминал консоли:
//  1. Ключ с passphrase кладём в ssh-agent заранее — иначе ssh спросит
//     passphrase прямо в терминале.
//  2. Запускаем шелл консоли или шелл ОС по умолчанию. Команда с аргументами
//     (`ssh user@host`) идёт через `sh -c`.
//  3. Окружение: UTF-8-локаль и тип терминала, если консоль их не задала, —
//     приложение из Dock локаль не наследует, и кириллица ломается.
//     Переменные консоли — поверх.
//  4. Пароль сервера ssh получает не из терминала, а через askpass.
//  5. Вывод пересылается на фронт фоновым потоком; многобайтовый символ на
//     границе чтения не режется. Процесс завершился — сессия удаляется,
//     фронт получает событие о выходе.
//  Исход: а) id сессии; б) PTY не открылся или шелл не запустился —
//  ошибка, фронт печатает её в терминале красным.
//
// write / resize / kill — по id сессии; сессии нет — ошибка, фронт её глотает
// (вкладка уже закрывается).
//
// Askpass-скрипты с секретом лежат в /tmp с правами 700: ключевой удаляется
// сразу после ssh-add, парольный остаётся — ssh читает его при каждом входе.

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

/// Шаг 2: размер до первого resize с фронта
const INITIAL_SIZE: PtySize = PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 };

/// Шаг 5: размер одного чтения из PTY
const READ_CHUNK: usize = 4096;

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

// Для событий на фронт из фонового потока
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

static SESSIONS: OnceLock<Sessions> = OnceLock::new();

/// Что запускать в терминале — собирает фронт по настройкам консоли
#[derive(Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SpawnRequest {
    /// Пусто — шелл ОС по умолчанию
    pub shell: String,
    pub cwd: String,
    pub env_vars: HashMap<String, String>,
    pub ssh_key_path: String,
    pub ssh_passphrase: String,
    pub ssh_password: String,
}

type Sessions = Arc<Mutex<HashMap<u32, PtySession>>>;

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
}

/// Payload события pty-output
#[derive(Clone, serde::Serialize)]
struct PtyOutput {
    pty_id: u32,
    data: String,
}

// ══════════════════════════════════════════════
// Публичный API
// ══════════════════════════════════════════════

/// Вызывается один раз при старте приложения (setup в main.rs / lib.rs)
pub fn init(app_handle: AppHandle) {
    APP_HANDLE.set(app_handle).expect("AppHandle already initialized");

    if SESSIONS.set(Arc::new(Mutex::new(HashMap::new()))).is_err() {
        panic!("PTY manager already initialized");
    }

    println!("PTY manager initialized");
}

pub fn spawn(req: SpawnRequest) -> Result<u32, String> {
    // 1. Ключ с passphrase — в ssh-agent заранее.
    if !req.ssh_passphrase.is_empty() {
        add_key_to_agent(&req.ssh_key_path, &req.ssh_passphrase);
    }

    // 2. PTY и команда консоли.
    let pair = native_pty_system().openpty(INITIAL_SIZE).map_err(|e| e.to_string())?;

    let shell = if req.shell.is_empty() { default_shell() } else { req.shell };

    let mut cmd = shell_command(&shell);

    if !req.cwd.is_empty() {
        cmd.cwd(&req.cwd);
    }

    // 3. Окружение: недостающее из локали и TERM, затем переменные консоли.
    for (key, value) in env_defaults(&req.env_vars) {
        cmd.env(key, value);
    }

    for (key, value) in &req.env_vars {
        cmd.env(key, value);
    }

    // 4. Пароль сервера — через askpass. DISPLAY нужен ssh на Linux; macOS его игнорирует.
    if !req.ssh_password.is_empty() {
        let askpass_path = format!("/tmp/.consoleswork_pw_{}", std::process::id());

        if write_askpass(&askpass_path, &req.ssh_password) {
            cmd.env("SSH_ASKPASS", &askpass_path);
            cmd.env("SSH_ASKPASS_REQUIRE", "force");

            if !req.env_vars.contains_key("DISPLAY") {
                cmd.env("DISPLAY", "dummy");
            }
        }
    }

    // 5. Запуск; сессия регистрируется до потока вывода, чтобы мгновенно
    // завершившийся процесс не оставил её в карте навсегда.
    pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);

    sessions()
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, PtySession { writer, master: pair.master });

    std::thread::spawn(move || forward_output(id, reader));

    println!("PTY session {} started: shell={}", id, shell);

    Ok(id)
}

/// Ввод пользователя → PTY
pub fn write(pty_id: u32, data: String) -> Result<(), String> {
    let mut map = sessions().lock().map_err(|e| e.to_string())?;

    let Some(session) = map.get_mut(&pty_id) else {
        return Err(not_found(pty_id));
    };

    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())
}

pub fn resize(pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let map = sessions().lock().map_err(|e| e.to_string())?;

    let Some(session) = map.get(&pty_id) else {
        return Err(not_found(pty_id));
    };

    session
        .master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

/// Закрыть сессию: master освобождается, и шелл получает SIGHUP
pub fn kill(pty_id: u32) -> Result<(), String> {
    let removed = sessions().lock().map_err(|e| e.to_string())?.remove(&pty_id);

    if removed.is_none() {
        return Err(not_found(pty_id));
    }

    println!("PTY session {} killed", pty_id);

    Ok(())
}

// ══════════════════════════════════════════════
// Детали
// ══════════════════════════════════════════════

/// Шаг 1: добавить ключ в ssh-agent; не вышло — ssh спросит passphrase сам
fn add_key_to_agent(key_path: &str, passphrase: &str) {
    if key_path.is_empty() {
        return;
    }

    let askpass_path = format!("/tmp/.consoleswork_askpass_{}", std::process::id());

    if !write_askpass(&askpass_path, passphrase) {
        return;
    }

    // Результат не важен: при неудаче ssh просто спросит passphrase в терминале
    let _ = std::process::Command::new("ssh-add")
        .arg(key_path)
        .env("SSH_ASKPASS", &askpass_path)
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env("DISPLAY", "dummy") // нужно для Linux; macOS игнорирует
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    // Секрет не должен оставаться на диске; файла нет — тем лучше
    let _ = std::fs::remove_file(&askpass_path);
}

/// Шаги 1 и 4: скрипт, который печатает секрет для ssh / ssh-add. false — не записался.
fn write_askpass(path: &str, secret: &str) -> bool {
    // Секрет в одинарных кавычках: ' внутри экранируется как '\''
    let script = format!("#!/bin/sh\necho '{}'\n", secret.replace('\'', r"'\''"));

    if std::fs::write(path, script).is_err() {
        return false;
    }

    make_owner_only(path);

    true
}

#[cfg(unix)]
fn make_owner_only(path: &str) {
    use std::os::unix::fs::PermissionsExt;

    // Не вышло — скрипт всё равно исполняемый не будет, ssh вернётся к вопросу в терминале
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700));
}

#[cfg(not(unix))]
fn make_owner_only(_path: &str) {}

/// Шаг 2: шелл ОС, если у консоли и проекта свой не задан
fn default_shell() -> String {
    match std::env::consts::OS {
        "windows" => "powershell.exe".to_string(),
        "macos"   => "/bin/zsh".to_string(),
        _         => std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()),
    }
}

/// Шаг 2: команда с пробелами («ssh -i key user@host») — через sh -c, чтобы разобрались аргументы
fn shell_command(shell: &str) -> CommandBuilder {
    if !shell.contains(' ') {
        return CommandBuilder::new(shell);
    }

    let mut cmd = CommandBuilder::new("sh");

    cmd.args(["-c", shell]);

    cmd
}

/// Шаг 3: LANG, LC_CTYPE и TERM, которых нет в переменных консоли.
/// LANG из системы берём, только если он сам UTF-8: при LANG=C/POSIX/en_US
/// утилиты (ls, git, mc) выводят '?' вместо не-ASCII.
fn env_defaults(env_vars: &HashMap<String, String>) -> Vec<(&'static str, String)> {
    let system_utf8_lang = std::env::var("LANG").ok().filter(|v| {
        let v = v.to_ascii_lowercase();

        v.contains("utf-8") || v.contains("utf8")
    });

    let defaults = [
        ("LANG", system_utf8_lang.unwrap_or_else(|| "en_US.UTF-8".to_string())),
        ("LC_CTYPE", std::env::var("LC_CTYPE").unwrap_or_else(|_| "UTF-8".to_string())),
        ("TERM", "xterm-256color".to_string()),
    ];

    defaults.into_iter().filter(|(key, _)| !env_vars.contains_key(*key)).collect()
}

/// Шаг 5: пересылать вывод на фронт, пока процесс жив; затем убрать сессию и сообщить о выходе
fn forward_output(id: u32, mut reader: Box<dyn Read + Send>) {
    let app = app_handle();

    let emit = |data: String| {
        app.emit("pty-output", PtyOutput { pty_id: id, data }).ok();
    };

    let mut buf = [0u8; READ_CHUNK];

    // Незавершённый UTF-8-хвост, перенесённый с предыдущего чтения
    let mut pending: Vec<u8> = Vec::with_capacity(READ_CHUNK + 4);

    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) | Err(_) => break, // PTY закрыт
            Ok(n) => n,
        };

        pending.extend_from_slice(&buf[..n]);

        let data = drain_utf8(&mut pending);

        if !data.is_empty() {
            emit(data);
        }
    }

    // Хвост, который так и не дождался продолжения, — отдаём как есть
    if !pending.is_empty() {
        emit(String::from_utf8_lossy(&pending).into_owned());
    }

    if let Ok(mut map) = sessions().lock() {
        map.remove(&id);
    }

    app.emit("pty-exit", id).ok();
}

/// Шаг 5: достаёт из буфера всё, что уже является валидным UTF-8, оставляя
/// незавершённый хвост (макс. 3 байта) до следующего чтения.
///
/// Без этого многобайтовый символ, разрезанный границей чтения PTY,
/// превращался бы в `U+FFFD` (`�`) — те самые «вопросики» в выводе.
fn drain_utf8(pending: &mut Vec<u8>) -> String {
    let mut out = String::new();

    loop {
        let err = match std::str::from_utf8(pending) {
            Ok(s) => {
                out.push_str(s);
                pending.clear();
                return out;
            }
            Err(e) => e,
        };

        let valid = err.valid_up_to();

        // SAFETY: from_utf8 подтвердил валидность префикса [..valid]
        out.push_str(unsafe { std::str::from_utf8_unchecked(&pending[..valid]) });

        // Последовательность оборвана концом буфера — ждём продолжения
        let Some(bad_len) = err.error_len() else {
            pending.drain(..valid);
            return out;
        };

        // Действительно битые байты (не UTF-8 вообще) — заменяем и идём дальше
        out.push('\u{FFFD}');
        pending.drain(..valid + bad_len);
    }
}

fn not_found(pty_id: u32) -> String {
    format!("PTY session {} not found", pty_id)
}

fn sessions() -> &'static Sessions {
    SESSIONS.get().expect("PTY manager not initialized")
}

fn app_handle() -> &'static AppHandle {
    APP_HANDLE.get().expect("AppHandle not initialized")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drain_utf8_keeps_cut_char_for_next_read() {
        let bytes = "ая".as_bytes();
        let mut pending = bytes[..3].to_vec(); // «а» + первый байт «я»

        assert_eq!(drain_utf8(&mut pending), "а");
        assert_eq!(pending, bytes[2..3]);

        pending.extend_from_slice(&bytes[3..]);

        assert_eq!(drain_utf8(&mut pending), "я");
        assert!(pending.is_empty());
    }

    #[test]
    fn drain_utf8_replaces_broken_bytes() {
        let mut pending = vec![b'a', 0xFF, b'b'];

        assert_eq!(drain_utf8(&mut pending), "a\u{FFFD}b");
        assert!(pending.is_empty());
    }

    #[test]
    fn env_defaults_skip_console_overrides() {
        let mut env = HashMap::new();

        env.insert("TERM".to_string(), "vt100".to_string());

        let keys: Vec<&str> = env_defaults(&env).into_iter().map(|(k, _)| k).collect();

        assert_eq!(keys, ["LANG", "LC_CTYPE"]);
    }

    #[test]
    fn shell_with_args_goes_through_sh() {
        let argv = shell_command("ssh user@host").get_argv().clone();

        assert_eq!(argv, ["sh", "-c", "ssh user@host"]);
    }
}
