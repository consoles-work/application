// ══════════════════════════════════════════════════════════════════
// ai_local.rs — локальный движок: Claude Code CLI как подпроцесс
// ══════════════════════════════════════════════════════════════════
//
// В отличие от провайдеров OpenAI/Anthropic/Ollama (обычный fetch из фронта),
// здесь модель поднимается БЕЗ API-ключа: используется уже установленный
// бинарь `claude` и подписка пользователя. Вызов в headless-режиме:
//
//   claude -p --output-format stream-json --verbose --include-partial-messages
//          --strict-mcp-config --tools "" --model <alias> [--append-system-prompt <persona>]
//
// Промпт (история чата целиком) передаётся через stdin — он бывает большим.
// Вывод — поток newline-delimited JSON: берём текстовые дельты (text_delta)
// и финальный `result`. Чтобы диалог был «чистым» и безопасным:
//   • --strict-mcp-config без --mcp-config → внешние MCP-серверы не подключаются;
//   • --tools "" → модели недоступны инструменты (ответ строго по тексту);
//   • cwd = temp → CLI не читает проекты пользователя.
//
// Результат стримится во фронт событиями ai://chunk|done|error. В БД здесь
// ничего не пишется: историю ведёт AiPanel теми же save/updateAiMessage,
// что и для API-провайдеров — иначе сообщение сохранилось бы дважды.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db;

// ── Payload'ы событий ──
// camelCase обязателен: фронт читает payload.sessionId и молча отбросит
// все чанки, если поле приедет как session_id.

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

// ── Реестр запущенных процессов (для отмены) ──

static RUNNING: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Child>> {
    RUNNING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register(id: &str, child: Child) {
    if let Ok(mut m) = registry().lock() {
        m.insert(id.to_string(), child);
    }
}

/// Снимает процесс из реестра и дожидается его завершения.
fn unregister_wait(id: &str) -> Option<ExitStatus> {
    let child = { registry().lock().ok()?.remove(id) };
    child.and_then(|mut c| c.wait().ok())
}

/// Убивает процесс сессии (если запущен). Реестр чистит читающий поток по EOF.
pub fn cancel(session_id: &str) -> Result<(), String> {
    if let Ok(mut m) = registry().lock() {
        if let Some(child) = m.get_mut(session_id) {
            let _ = child.kill();
        }
    }
    Ok(())
}

// ── Поиск бинаря claude ──

/// Ищет бинарь: сохранённый путь → типичные места → login-shell PATH.
/// GUI-процесс не наследует shell-PATH (та же причина, по которой
/// pty_manager.rs явно выставляет локаль), поэтому одного `which` мало.
pub fn detect_bin() -> Option<String> {
    let saved = db::get_setting_str("ai.claudeBin", "");
    if !saved.is_empty() && std::path::Path::new(&saved).exists() {
        return Some(saved);
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".local/bin/claude"));
        candidates.push(home.join(".claude/local/claude"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/claude"));
    candidates.push(PathBuf::from("/usr/local/bin/claude"));
    for c in candidates {
        if c.exists() {
            return Some(c.to_string_lossy().to_string());
        }
    }
    // login-shell — чтобы получить пользовательский PATH
    if let Ok(out) = Command::new("zsh").args(["-lic", "command -v claude"]).output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && std::path::Path::new(&p).exists() {
                return Some(p);
            }
        }
    }
    None
}

/// Возвращает путь к бинарю: явный → сохранённый → автодетект.
fn resolve_bin(explicit: Option<String>) -> Result<String, String> {
    if let Some(b) = explicit {
        if !b.trim().is_empty() {
            return Ok(b);
        }
    }
    let saved = db::get_setting_str("ai.claudeBin", "");
    if !saved.is_empty() && std::path::Path::new(&saved).exists() {
        return Ok(saved);
    }
    detect_bin()
        .ok_or_else(|| "Не найден бинарь claude. Укажите путь в «Настройки → Агенты».".to_string())
}

/// Быстрая проверка: бинарь запускается и отдаёт версию (без расхода токенов).
pub fn check(bin: Option<String>) -> Result<String, String> {
    let bin = resolve_bin(bin)?;
    let out = Command::new(&bin)
        .arg("--version")
        .output()
        .map_err(|e| format!("Не удалось запустить {bin}: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "claude завершился с ошибкой: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(format!(
        "{}  —  {}",
        bin,
        String::from_utf8_lossy(&out.stdout).trim()
    ))
}

// ── Запуск и стриминг ──

/// Спавнит claude и стримит вывод событиями. Возвращается сразу — работа
/// идёт в фоновом потоке, как и чтение PTY.
pub fn run(
    app: AppHandle,
    session_id: String,
    model: String,
    system: String,
    prompt: String,
) -> Result<(), String> {
    let bin = resolve_bin(None)?;
    let model = if model.trim().is_empty() {
        "sonnet".to_string()
    } else {
        model
    };

    let mut cmd = Command::new(&bin);
    cmd.arg("-p")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--include-partial-messages")
        .arg("--strict-mcp-config") // без внешних MCP-серверов
        .arg("--tools")
        .arg("") // без инструментов — ответ строго по тексту
        .arg("--model")
        .arg(&model);
    if !system.trim().is_empty() {
        cmd.arg("--append-system-prompt").arg(&system);
    }
    cmd.current_dir(std::env::temp_dir()) // нейтральный cwd — не читать проекты
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Не удалось запустить claude: {e}"))?;

    // Промпт — через stdin. drop закрывает его и CLI начинает работу.
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(prompt.as_bytes());
    }
    let stdout = child.stdout.take().ok_or("нет stdout у claude")?;
    let stderr = child.stderr.take();

    register(&session_id, child);

    // stderr — в отдельный буфер, чтобы было что показать при ошибке.
    let err_buf = Arc::new(Mutex::new(String::new()));
    if let Some(stderr) = stderr {
        let err_buf = err_buf.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(mut b) = err_buf.lock() {
                    b.push_str(&line);
                    b.push('\n');
                }
            }
        });
    }

    let sid = session_id.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut full = String::new();
        let mut final_text: Option<String> = None;
        let mut is_error = false;

        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else {
                continue;
            };
            match v.get("type").and_then(|t| t.as_str()) {
                Some("stream_event") => {
                    let ev = v.get("event");
                    let et = ev.and_then(|e| e.get("type")).and_then(|t| t.as_str());
                    if et == Some("content_block_delta") {
                        let d = ev.and_then(|e| e.get("delta"));
                        let is_text = d.and_then(|d| d.get("type")).and_then(|t| t.as_str())
                            == Some("text_delta");
                        if is_text {
                            if let Some(text) =
                                d.and_then(|d| d.get("text")).and_then(|t| t.as_str())
                            {
                                full.push_str(text);
                                let _ = app.emit(
                                    "ai://chunk",
                                    ChunkPayload {
                                        session_id: sid.clone(),
                                        text: text.to_string(),
                                    },
                                );
                            }
                        }
                    }
                }
                Some("result") => {
                    is_error = v.get("is_error").and_then(|b| b.as_bool()).unwrap_or(false);
                    if let Some(r) = v.get("result").and_then(|r| r.as_str()) {
                        final_text = Some(r.to_string());
                    }
                }
                _ => {}
            }
        }

        // Процесс завершился (или был убит) → снять из реестра, дождаться.
        let status = unregister_wait(&sid);
        let killed = status.map(|s| !s.success()).unwrap_or(false);
        // Финальный текст берём из `result`, а не из накопленного буфера:
        // ai://done может опередить отрисовку последнего чанка во фронте.
        let content = final_text.unwrap_or_else(|| full.clone());

        // Ошибка без всякого текста — отдаём ai://error со stderr.
        if is_error && content.trim().is_empty() {
            let msg = err_buf.lock().ok().map(|b| b.clone()).unwrap_or_default();
            let msg = if msg.trim().is_empty() {
                "claude вернул ошибку".to_string()
            } else {
                msg
            };
            let _ = app.emit(
                "ai://error",
                ErrorPayload {
                    session_id: sid.clone(),
                    message: msg,
                },
            );
            return;
        }

        // Отмена даёт ненулевой exit status; частичный ответ всё равно отдаём.
        let _ = app.emit(
            "ai://done",
            DonePayload {
                session_id: sid,
                content,
                ok: !killed && !is_error,
            },
        );
    });

    Ok(())
}
