// ══════════════════════════════════════════════════════════════════
// export.rs — шифрованный экспорт/импорт данных (.dchub)
// ══════════════════════════════════════════════════════════════════
//
// Формат файла .dchub:
//   [6 байт]  DCHUB1  — magic + версия
//   [1 байт]  flags   — 0x01 = защищён паролем пользователя
//   [32 байта] salt   — для PBKDF2
//   [12 байт] nonce   — для AES-256-GCM
//   [4 байта] len     — длина зашифрованных данных (LE u32)
//   [N байт]  ciphertext — AES-256-GCM(payload_json)
//
// Ключ: PBKDF2-HMAC-SHA256(APP_SECRET [+ ':' + user_password], salt, 100000)
// Payload: JSON с полем "_verify": "dchub-v1-ok" для валидации при импорте

use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit},
};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};

use crate::commands::{Workspace, WikiPage, AiSession, AiMessage};

// Внутренний секрет приложения (не секретный от reverse-engineering,
// но защищает файл от случайного открытия другими программами)
const APP_SECRET: &[u8] = b"devconsole-hub-v1-app-2024";
const MAGIC: &[u8] = b"DCHUB1";
const PBKDF2_ITERATIONS: u32 = 100_000;
const VERIFY_VALUE: &str = "dchub-v1-ok";

// ── Структуры экспортного payload ──────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub _verify: String,
    pub exported_at: String,
    pub tree: Vec<Workspace>,
    pub wiki: Vec<WikiPage>,
    pub ai: Vec<AiSessionExport>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiSessionExport {
    pub session: AiSession,
    pub messages: Vec<AiMessage>,
}

// Превью для ImportDialog
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub exported_at: String,
    pub workspace_count: usize,
    pub project_count: usize,
    pub console_count: usize,
    pub wiki_count: usize,
    pub ai_session_count: usize,
    pub ai_message_count: usize,
    pub has_password: bool,
}

// ── Шифрование ──────────────────────────────────────────────────

/// Зашифровать payload и упаковать в .dchub формат
pub fn encrypt_export(payload: &[u8], user_password: Option<&str>) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);

    let password_material = build_password_material(user_password);
    let key_bytes = derive_key(&password_material, &salt);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes));
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|e| format!("Encryption error: {e}"))?;

    let flags: u8 = match user_password {
        Some(p) if !p.is_empty() => 0x01,
        _ => 0x00,
    };

    let mut out = Vec::with_capacity(6 + 1 + 32 + 12 + 4 + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.push(flags);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    let len = ciphertext.len() as u32;
    out.extend_from_slice(&len.to_le_bytes());
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Расшифровать .dchub файл и вернуть payload bytes
pub fn decrypt_export(data: &[u8], user_password: Option<&str>) -> Result<Vec<u8>, String> {
    // Минимальный размер: magic(6) + flags(1) + salt(32) + nonce(12) + len(4) = 55
    if data.len() < 55 {
        return Err("Файл повреждён или имеет неверный формат".to_string());
    }
    if &data[0..6] != MAGIC {
        return Err("Не является файлом .dchub".to_string());
    }

    let flags = data[6];
    let has_user_pw = (flags & 0x01) != 0;

    if has_user_pw && user_password.map(|p| p.is_empty()).unwrap_or(true) {
        return Err("Файл защищён паролем".to_string());
    }

    let salt = &data[7..39];
    let nonce_bytes = &data[39..51];
    let len = u32::from_le_bytes([data[51], data[52], data[53], data[54]]) as usize;

    if data.len() < 55 + len {
        return Err("Файл обрезан или повреждён".to_string());
    }
    let ciphertext = &data[55..55 + len];

    let password_material = build_password_material(user_password);
    let key_bytes = derive_key(&password_material, salt);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes));
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Неверный пароль или файл повреждён".to_string())
}

// ── Вспомогательные функции ─────────────────────────────────────

fn build_password_material(user_password: Option<&str>) -> Vec<u8> {
    let mut pw = APP_SECRET.to_vec();
    if let Some(user_pw) = user_password {
        if !user_pw.is_empty() {
            pw.push(b':');
            pw.extend_from_slice(user_pw.as_bytes());
        }
    }
    pw
}

fn derive_key(password: &[u8], salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password, salt, PBKDF2_ITERATIONS, &mut key);
    key
}

// ── Сборка ExportPayload ────────────────────────────────────────

pub fn build_export_payload(
    include_tree: bool,
    include_wiki: bool,
    include_ai: bool,
) -> Result<ExportPayload, String> {
    let now = chrono::Utc::now().to_rfc3339();

    let tree = if include_tree {
        crate::db::load_all_workspaces()?
    } else {
        Vec::new()
    };

    let wiki = if include_wiki {
        crate::db::load_all_wiki_pages()?
    } else {
        Vec::new()
    };

    let ai = if include_ai {
        let sessions = crate::db::load_ai_sessions()?;
        let mut result = Vec::new();
        for session in sessions {
            let messages = crate::db::load_ai_messages(&session.id)?;
            result.push(AiSessionExport { session, messages });
        }
        result
    } else {
        Vec::new()
    };

    Ok(ExportPayload {
        _verify: VERIFY_VALUE.to_string(),
        exported_at: now,
        tree,
        wiki,
        ai,
    })
}

/// Разобрать payload и вернуть превью (без применения к БД)
pub fn parse_preview(payload_bytes: &[u8], has_password: bool) -> Result<ImportPreview, String> {
    let payload: ExportPayload = serde_json::from_slice(payload_bytes)
        .map_err(|e| format!("Ошибка разбора файла: {e}"))?;

    if payload._verify != VERIFY_VALUE {
        return Err("Файл повреждён: неверная верификационная фраза".to_string());
    }

    let project_count: usize = payload.tree.iter().map(|ws| ws.projects.len()).sum();
    let console_count: usize = payload.tree.iter()
        .flat_map(|ws| &ws.projects)
        .map(|p| p.consoles.len())
        .sum();
    let ai_message_count: usize = payload.ai.iter().map(|s| s.messages.len()).sum();

    Ok(ImportPreview {
        exported_at: payload.exported_at,
        workspace_count: payload.tree.len(),
        project_count,
        console_count,
        wiki_count: payload.wiki.len(),
        ai_session_count: payload.ai.len(),
        ai_message_count,
        has_password,
    })
}

/// Применить импорт к БД
/// mode: "merge" (добавить с суффиксом при конфликте) | "replace" (заменить всё)
pub fn apply_import(
    payload_bytes: &[u8],
    include_tree: bool,
    include_wiki: bool,
    include_ai: bool,
    mode: &str,
) -> Result<(), String> {
    let payload: ExportPayload = serde_json::from_slice(payload_bytes)
        .map_err(|e| format!("Ошибка разбора файла: {e}"))?;

    if payload._verify != VERIFY_VALUE {
        return Err("Файл повреждён: неверная верификационная фраза".to_string());
    }

    if mode == "replace" {
        if include_tree { crate::db::delete_all_workspaces()?; }
        if include_wiki { crate::db::delete_all_wiki_pages()?; }
        if include_ai { crate::db::delete_all_ai_sessions()?; }
    }

    if include_tree {
        let existing_names = crate::db::get_workspace_names()?;
        for mut ws in payload.tree {
            // Разрешаем конфликт имён — добавляем суффикс
            if mode == "merge" && existing_names.contains(&ws.name) {
                ws.name = format!("{} (import)", ws.name);
            }
            // Генерируем новые ID чтобы не было коллизий с существующими записями
            let new_ws_id = uuid::Uuid::new_v4().to_string();
            ws.id = new_ws_id.clone();
            crate::db::save_workspace(&ws)?;

            for mut proj in ws.projects {
                let new_proj_id = uuid::Uuid::new_v4().to_string();
                proj.id = new_proj_id.clone();
                proj.workspace_id = new_ws_id.clone();
                crate::db::save_project(&proj)?;

                for mut con in proj.consoles {
                    con.id = uuid::Uuid::new_v4().to_string();
                    con.project_id = new_proj_id.clone();
                    crate::db::save_console(&con)?;
                }
            }
        }
    }

    if include_wiki {
        // Wiki привязана к дереву, но мы не можем перепривязать (parent_id неизвестен после re-ID)
        // Импортируем только глобальные wiki-страницы (parent_type = "global")
        for mut page in payload.wiki {
            if page.parent_type == "global" {
                page.id = uuid::Uuid::new_v4().to_string();
                crate::db::upsert_wiki_page(&page)?;
            }
            // Остальные (привязанные к конкретным workspace/project/console) игнорируем
            // так как ID изменились при импорте
        }
    }

    if include_ai {
        for export_session in payload.ai {
            let mut session = export_session.session;
            let new_session_id = uuid::Uuid::new_v4().to_string();
            session.id = new_session_id.clone();
            crate::db::create_ai_session(&session.id, &session.title, &session.provider, &session.model)?;

            for mut msg in export_session.messages {
                msg.id = uuid::Uuid::new_v4().to_string();
                msg.session_id = new_session_id.clone();
                crate::db::save_ai_message(&msg.id, &msg.session_id, &msg.role, &msg.content)?;
            }
        }
    }

    Ok(())
}
