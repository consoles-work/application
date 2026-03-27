// ══════════════════════════════════════════════════════════════════
// pty_manager.rs — Менеджер терминальных сессий (PTY)
// ══════════════════════════════════════════════════════════════════
//
// Архитектура:
// 1. Frontend (xterm.js) ← Tauri event "pty-output" ← фоновый поток читает из PTY
// 2. Frontend (xterm.js) → invoke("write_to_pty") → Rust пишет в PTY

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::AppHandle;
use tauri::Emitter;

// Счётчик для генерации уникальных ID сессий
static NEXT_ID: AtomicU32 = AtomicU32::new(1);

// Глобальный AppHandle для отправки событий на фронтенд
static APP_HANDLE: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

// Хранилище активных PTY-сессий
static SESSIONS: std::sync::OnceLock<Arc<Mutex<HashMap<u32, PtySession>>>> =
    std::sync::OnceLock::new();

/// Payload события pty-output, отправляемого на фронтенд
#[derive(Clone, serde::Serialize)]
struct PtyOutput {
    pty_id: u32,
    data: String,
}

/// Одна PTY-сессия
struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

fn get_sessions() -> &'static Arc<Mutex<HashMap<u32, PtySession>>> {
    SESSIONS.get().expect("PTY manager not initialized")
}

fn get_app_handle() -> &'static AppHandle {
    APP_HANDLE.get().expect("AppHandle not initialized")
}

// ══════════════════════════════════════════════
// Публичный API
// ══════════════════════════════════════════════

/// Инициализация менеджера (вызывается из lib.rs при старте)
pub fn init(app_handle: AppHandle) {
    APP_HANDLE.set(app_handle).expect("AppHandle already initialized");
    if SESSIONS.set(Arc::new(Mutex::new(HashMap::new()))).is_err() {
        panic!("PTY manager already initialized");
    }
    println!("PTY manager initialized");
}

/// Определить шелл по умолчанию для текущей ОС
fn default_shell() -> String {
    match std::env::consts::OS {
        "windows" => "powershell.exe".to_string(),
        "macos"   => "/bin/zsh".to_string(),
        _         => std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()),
    }
}

/// Запустить новую PTY-сессию
pub fn spawn(
    shell: String,
    cwd: String,
    env_vars: HashMap<String, String>,
) -> Result<u32, String> {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);

    let pty_system = native_pty_system();

    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    // Выбираем шелл: переданный аргумент или системный по умолчанию
    let shell_cmd = if shell.is_empty() { default_shell() } else { shell };

    // Если команда содержит пробелы (например, "ssh user@host" или "ssh -i key user@host")
    // запускаем через sh -c, чтобы корректно разобрать аргументы
    let mut cmd = if shell_cmd.contains(' ') {
        let mut c = CommandBuilder::new("sh");
        c.args(["-c", &shell_cmd]);
        c
    } else {
        CommandBuilder::new(&shell_cmd)
    };
    if !cwd.is_empty() {
        cmd.cwd(&cwd);
    }

    // Гарантируем UTF-8 локаль: если Tauri запущен не из терминала,
    // переменные LANG/LC_CTYPE могут отсутствовать → кириллица показывается кракозябрами.
    // Сначала берём значение из системного окружения, иначе ставим UTF-8 по умолчанию.
    if !env_vars.contains_key("LANG") {
        let lang = std::env::var("LANG").unwrap_or_else(|_| "en_US.UTF-8".to_string());
        cmd.env("LANG", lang);
    }
    if !env_vars.contains_key("LC_CTYPE") {
        let lc_ctype = std::env::var("LC_CTYPE").unwrap_or_else(|_| "UTF-8".to_string());
        cmd.env("LC_CTYPE", lc_ctype);
    }
    if !env_vars.contains_key("TERM") {
        cmd.env("TERM", "xterm-256color");
    }

    for (key, value) in &env_vars {
        cmd.env(key, value);
    }

    // Запускаем процесс в PTY
    pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    // Получаем reader для чтения вывода и writer для ввода
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Фоновый поток: читаем вывод PTY и шлём на фронтенд
    let app_handle = get_app_handle().clone();
    let sessions = get_sessions().clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // PTY закрыт
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app_handle.emit("pty-output", PtyOutput { pty_id: id, data }).ok();
                }
                Err(_) => break,
            }
        }
        // PTY завершился — убираем сессию
        if let Ok(mut map) = sessions.lock() {
            map.remove(&id);
        }
        app_handle.emit("pty-exit", id).ok();
    });

    let session = PtySession {
        writer,
        master: pair.master,
    };

    let sessions = get_sessions();
    let mut map = sessions.lock().map_err(|e| e.to_string())?;
    map.insert(id, session);

    println!("PTY session {} started: shell={}", id, shell_cmd);
    Ok(id)
}

/// Отправить данные (ввод пользователя) в PTY
pub fn write(pty_id: u32, data: String) -> Result<(), String> {
    let sessions = get_sessions();
    let mut map = sessions.lock().map_err(|e| e.to_string())?;

    if let Some(session) = map.get_mut(&pty_id) {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}

/// Изменить размер PTY
pub fn resize(pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = get_sessions();
    let map = sessions.lock().map_err(|e| e.to_string())?;

    if let Some(session) = map.get(&pty_id) {
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}

/// Убить PTY-сессию
pub fn kill(pty_id: u32) -> Result<(), String> {
    let sessions = get_sessions();
    let mut map = sessions.lock().map_err(|e| e.to_string())?;

    if map.remove(&pty_id).is_some() {
        println!("PTY session {} killed", pty_id);
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}