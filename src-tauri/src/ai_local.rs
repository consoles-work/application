// ══════════════════════════════════════════════════════════════════
// ai_local.rs — локальный движок: Claude Code CLI как подпроцесс
// ══════════════════════════════════════════════════════════════════
//
// AI-чат без API-ключа: используется уже установленный `claude` и подписка
// пользователя. Провайдеры OpenAI/Anthropic/Ollama работают иначе — обычным
// fetch из фронта. Вызывается из AiPanel.
//
// run — ответ модели на историю чата:
//  1. Бинарь: путь из настроек или автопоиск. Не нашли — ошибка с подсказкой,
//     где указать путь.
//  2. CLI в headless-режиме, диалог «чистый» и безопасный: без внешних
//     MCP-серверов, без инструментов (ответ строго по тексту), в нейтральной
//     папке — проекты пользователя не читаются. История чата — через stdin:
//     она бывает большой.
//  3. Процесс запоминается для отмены; stderr копится, чтобы было что показать
//     при ошибке.
//  4. Фоновый поток читает поток JSON: текстовые дельты сразу уходят во фронт,
//     финальный результат запоминается.
//  5. Конец: а) ошибка без всякого текста — событие ошибки с stderr; б) иначе —
//     событие «готово» с финальным текстом и признаком успеха. Отмена и ошибка
//     дают «не успех», но частичный ответ всё равно отдаётся.
//  Возвращается сразу после запуска — ответ приходит событиями.
//
// cancel — убить процесс сессии; запись о нём снимает читающий поток.
// detect_bin — сохранённый путь → типичные места → PATH из login-shell.
// check — бинарь отвечает версией; токены не тратятся.
//
// В БД здесь ничего не пишется: историю ведёт AiPanel так же, как для
// API-провайдеров, — иначе сообщение сохранилось бы дважды.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::db;

/// Шаг 2: модель, если в чате не выбрана
const DEFAULT_MODEL: &str = "sonnet";

/// Запущенные процессы по id чат-сессии — для отмены
static RUNNING: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub session_id: String,
    /// Псевдоним модели CLI; пусто — DEFAULT_MODEL
    pub model: String,
    /// Персона — добавляется к системному промпту CLI; пусто — без неё
    pub system: String,
    /// История чата целиком
    pub prompt: String,
}

// Payload'ы событий. camelCase обязателен: фронт читает payload.sessionId и
// молча отбросит все чанки, если поле приедет как session_id.

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChunkPayload {
    session_id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DonePayload {
    session_id: String,
    content: String,
    ok: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    session_id: String,
    message: String,
}

/// Шаг 4: что значит строка вывода `--output-format stream-json`
#[derive(Debug, PartialEq)]
enum StreamLine {
    TextDelta(String),
    Result { text: Option<String>, is_error: bool },
    Other,
}

// ══════════════════════════════════════════════
// Сценарии
// ══════════════════════════════════════════════

pub fn run(app: AppHandle, req: RunRequest) -> Result<(), String> {
    // 1. Бинарь.
    let bin = resolve_bin(None)?;

    // 2. Запуск.
    let model = if req.model.trim().is_empty() { DEFAULT_MODEL } else { req.model.as_str() };

    let mut cmd = Command::new(&bin);

    cmd.args(["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"])
        .arg("--strict-mcp-config") // без --mcp-config: внешние MCP-серверы не подключаются
        .args(["--tools", ""]) // без инструментов — ответ строго по тексту
        .args(["--model", model]);

    if !req.system.trim().is_empty() {
        cmd.args(["--append-system-prompt", &req.system]);
    }

    cmd.current_dir(std::env::temp_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Не удалось запустить claude: {e}"))?;

    // drop закрывает stdin — по EOF CLI начинает работу. Не записалось — CLI
    // ответит на пустой промпт или упадёт, это придёт событием ошибки.
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(req.prompt.as_bytes());
    }

    // 3. Регистрация для отмены и сбор stderr.
    let stdout = child.stdout.take().ok_or("нет stdout у claude")?;
    let stderr = child.stderr.take();

    if let Ok(mut running) = registry().lock() {
        running.insert(req.session_id.clone(), child);
    }

    let stderr_text = Arc::new(Mutex::new(String::new()));

    if let Some(stderr) = stderr {
        let stderr_text = stderr_text.clone();

        std::thread::spawn(move || collect_lines(stderr, &stderr_text));
    }

    // 4–5. Стриминг и итог — в фоне.
    std::thread::spawn(move || stream_answer(&app, &req.session_id, stdout, &stderr_text));

    Ok(())
}

pub fn cancel(session_id: &str) -> Result<(), String> {
    let Ok(mut running) = registry().lock() else { return Ok(()) };

    // Процесс мог уже завершиться — тогда и убивать нечего
    if let Some(child) = running.get_mut(session_id) {
        let _ = child.kill();
    }

    Ok(())
}

/// GUI-процесс не наследует PATH из shell (та же причина, по которой
/// pty_manager.rs явно выставляет локаль), поэтому одного `which` мало.
pub fn detect_bin() -> Option<String> {
    let saved = db::get_setting_str("ai.claudeBin", "");

    if !saved.is_empty() && Path::new(&saved).exists() {
        return Some(saved);
    }

    let home_candidates = dirs::home_dir()
        .map(|home| vec![home.join(".local/bin/claude"), home.join(".claude/local/claude")])
        .unwrap_or_default();

    let system_candidates = [PathBuf::from("/opt/homebrew/bin/claude"), PathBuf::from("/usr/local/bin/claude")];

    let found = home_candidates.into_iter().chain(system_candidates).find(|c| c.exists());

    if let Some(path) = found {
        return Some(path.to_string_lossy().to_string());
    }

    // login-shell — чтобы получить пользовательский PATH
    let out = Command::new("zsh").args(["-lic", "command -v claude"]).output().ok()?;

    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();

    (out.status.success() && !path.is_empty() && Path::new(&path).exists()).then_some(path)
}

pub fn check(bin: Option<String>) -> Result<String, String> {
    let bin = resolve_bin(bin)?;

    let out = Command::new(&bin).arg("--version").output().map_err(|e| format!("Не удалось запустить {bin}: {e}"))?;

    if !out.status.success() {
        return Err(format!("claude завершился с ошибкой: {}", String::from_utf8_lossy(&out.stderr)));
    }

    Ok(format!("{}  —  {}", bin, String::from_utf8_lossy(&out.stdout).trim()))
}

// ══════════════════════════════════════════════
// Детали
// ══════════════════════════════════════════════

/// Шаг 1: явный путь → сохранённый → автопоиск
fn resolve_bin(explicit: Option<String>) -> Result<String, String> {
    explicit
        .filter(|b| !b.trim().is_empty())
        .or_else(detect_bin)
        .ok_or_else(|| "Не найден бинарь claude. Укажите путь в «Настройки → Агенты».".to_string())
}

/// Шаги 4–5: читать ответ до конца процесса, отдать фронту итог
fn stream_answer(app: &AppHandle, session_id: &str, stdout: ChildStdout, stderr_text: &Mutex<String>) {
    // 4. Поток JSON.
    let mut streamed = String::new();
    let mut final_text: Option<String> = None;
    let mut is_error = false;

    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        match parse_stream_line(&line) {
            StreamLine::TextDelta(text) => {
                streamed.push_str(&text);

                let _ = app.emit("ai://chunk", ChunkPayload { session_id: session_id.to_string(), text });
            }
            StreamLine::Result { text, is_error: err } => {
                is_error = err;
                final_text = text.or(final_text);
            }
            StreamLine::Other => {}
        }
    }

    // 5. Итог. Процесс завершился (или убит) — снять с учёта и дождаться;
    // отмена даёт ненулевой код выхода.
    let finished_ok = finish(session_id);

    // Финальный текст — из result, а не из накопленного: ai://done может
    // опередить отрисовку последнего чанка во фронте.
    let content = final_text.unwrap_or(streamed);

    if is_error && content.trim().is_empty() {
        let stderr = stderr_text.lock().map(|s| s.clone()).unwrap_or_default();

        let message = if stderr.trim().is_empty() { "claude вернул ошибку".to_string() } else { stderr };

        let _ = app.emit("ai://error", ErrorPayload { session_id: session_id.to_string(), message });

        return;
    }

    let ok = finished_ok && !is_error;

    let _ = app.emit("ai://done", DonePayload { session_id: session_id.to_string(), content, ok });
}

/// Шаг 4: строка stream-json → текстовая дельта / итог / прочее
fn parse_stream_line(line: &str) -> StreamLine {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { return StreamLine::Other };

    let str_at = |path: &str| v.pointer(path).and_then(|t| t.as_str());

    match str_at("/type") {
        Some("stream_event")
            if str_at("/event/type") == Some("content_block_delta")
                && str_at("/event/delta/type") == Some("text_delta") =>
        {
            str_at("/event/delta/text").map_or(StreamLine::Other, |t| StreamLine::TextDelta(t.to_string()))
        }
        Some("result") => StreamLine::Result {
            text: str_at("/result").map(String::from),
            is_error: v.get("is_error").and_then(|b| b.as_bool()).unwrap_or(false),
        },
        _ => StreamLine::Other,
    }
}

/// Шаг 5: снять процесс с учёта и дождаться; true — завершился успешно или статус неизвестен
fn finish(session_id: &str) -> bool {
    let child = registry().lock().ok().and_then(|mut running| running.remove(session_id));

    let status = child.and_then(|mut c| c.wait().ok());

    status.is_none_or(|s| s.success())
}

/// Шаг 3: копить строки stderr — показать при ошибке без ответа
fn collect_lines(stream: impl Read, into: &Mutex<String>) {
    for line in BufReader::new(stream).lines().map_while(Result::ok) {
        if let Ok(mut text) = into.lock() {
            text.push_str(&line);
            text.push('\n');
        }
    }
}

fn registry() -> &'static Mutex<HashMap<String, Child>> {
    RUNNING.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_lines() {
        let delta = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}}"#;
        let thinking = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"…"}}}"#;
        let result = r#"{"type":"result","is_error":false,"result":"Hi there"}"#;

        assert_eq!(parse_stream_line(delta), StreamLine::TextDelta("Hi".into()));
        assert_eq!(parse_stream_line(thinking), StreamLine::Other);
        assert_eq!(parse_stream_line(result), StreamLine::Result { text: Some("Hi there".into()), is_error: false });
        assert_eq!(parse_stream_line("not json"), StreamLine::Other);
    }
}
