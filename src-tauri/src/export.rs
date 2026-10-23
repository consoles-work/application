// ══════════════════════════════════════════════════════════════════
// export.rs — шифрованный экспорт/импорт данных (.dchub)
// ══════════════════════════════════════════════════════════════════
//
// Перенос данных между установками; вызывается диалогами «Экспорт» и «Импорт».
//
// export_to_file — сохранить выбранное в файл:
//  1. Собираем разделы: дерево (все воркспейсы или выбранные), wiki — все
//     страницы, AI-чаты с сообщениями, настройки приложения.
//  2. Шифруем: ключ из секрета приложения и, если задан, пароля пользователя.
//     Флаг пароля пишется в заголовок — импорт по нему понимает, что спросить пароль.
//  3. Пишем файл.
//
// preview_file — что внутри, без записи в БД:
//  1. Читаем и расшифровываем. Исходы: а) не .dchub или обрезан; б) файл под
//     паролем, а пароль не дан — диалог импорта по тексту этой ошибки
//     переходит к вводу пароля; в) неверный пароль; г) счётчики для превью.
//
// import_file — применить:
//  1. Расшифровываем, как в превью.
//  2. Режим «заменить» — сначала удаляем выбранные разделы (настройки не
//     удаляются, а перезаписываются).
//  3. Дерево — с новыми id, чтобы не столкнуться с существующими записями; в
//     режиме «добавить» одноимённый воркспейс получает суффикс «(import)».
//  4. Wiki: глобальные страницы — как есть; страницы узлов — к новым id узлов,
//     страница узла, которого нет в файле, пропускается. Дерево не
//     импортировали — страницы остаются на старых id (работает при импорте в ту же БД).
//  5. AI-чаты — новыми сессиями.
//  6. Настройки — поверх текущих, кроме пароля на вход: чужой пароль не подхватываем.
//  Транзакции нет: ошибка на середине оставляет уже записанное.
//
// Формат файла (менять только с новой версией MAGIC — старые файлы должны читаться):
//   [6 байт]   DCHUB1  — magic + версия
//   [1 байт]   flags   — 0x01 = защищён паролем пользователя
//   [32 байта] salt    — для PBKDF2
//   [12 байт]  nonce   — для AES-256-GCM
//   [4 байта]  len     — длина зашифрованных данных (LE u32)
//   [N байт]   ciphertext — AES-256-GCM(payload_json)
// Ключ: PBKDF2-HMAC-SHA256(APP_SECRET [+ ':' + user_password], salt, 100000)
// Payload: JSON с полем "_verify" — отличает верную расшифровку от мусора.

use std::collections::HashMap;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::commands::{AiMessage, AiSession, WikiPage, Workspace};

// Внутренний секрет приложения (не секретный от reverse-engineering,
// но защищает файл от случайного открытия другими программами)
const APP_SECRET: &[u8] = b"consoles-work-v1-app-2026";
const MAGIC: &[u8] = b"DCHUB1";
const PBKDF2_ITERATIONS: u32 = 100_000;
const VERIFY_VALUE: &str = "dchub-v1-ok";

const FLAG_USER_PASSWORD: u8 = 0x01;
const SALT_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = MAGIC.len() + 1 + SALT_LEN + NONCE_LEN + 4;

/// Шаг «б» превью: по этому тексту ImportDialog переходит к вводу пароля
const ERR_PASSWORD_REQUIRED: &str = "Файл защищён паролем";

// ── Типы ──

/// Какие разделы экспортировать / импортировать
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sections {
    pub tree: bool,
    pub wiki: bool,
    pub ai: bool,
    pub settings: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportMode {
    /// Добавить к существующему, одноимённые воркспейсы — с суффиксом
    Merge,
    /// Удалить выбранные разделы и записать из файла
    Replace,
}

// Поля snake_case — это формат файла, не IPC: не переименовывать
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub _verify: String,
    pub exported_at: String,
    pub tree: Vec<Workspace>,
    pub wiki: Vec<WikiPage>,
    pub ai: Vec<AiSessionExport>,
    #[serde(default)]
    pub settings: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiSessionExport {
    pub session: AiSession,
    pub messages: Vec<AiMessage>,
}

/// Превью для ImportDialog
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
    pub settings_count: usize,
    pub has_password: bool,
}

// ══════════════════════════════════════════════
// Сценарии
// ══════════════════════════════════════════════

/// `workspace_ids` пусто или None — все воркспейсы
pub fn export_to_file(
    path: &str,
    sections: Sections,
    user_password: Option<&str>,
    workspace_ids: Option<&[String]>,
) -> Result<(), String> {
    // 1. Разделы.
    let tree = if sections.tree {
        let all = crate::db::load_all_workspaces()?;

        match workspace_ids {
            Some(ids) if !ids.is_empty() => all.into_iter().filter(|ws| ids.contains(&ws.id)).collect(),
            _ => all,
        }
    } else {
        Vec::new()
    };

    let wiki = if sections.wiki { crate::db::load_all_wiki_pages()? } else { Vec::new() };

    let ai = if sections.ai {
        crate::db::load_ai_sessions()?
            .into_iter()
            .map(|session| {
                let messages = crate::db::load_ai_messages(&session.id)?;

                Ok(AiSessionExport { session, messages })
            })
            .collect::<Result<Vec<_>, String>>()?
    } else {
        Vec::new()
    };

    let settings = if sections.settings { crate::db::get_all_settings()? } else { HashMap::new() };

    let payload = ExportPayload {
        _verify: VERIFY_VALUE.to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        tree,
        wiki,
        ai,
        settings,
    };

    // 2. Шифрование.
    let json = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;

    let encrypted = encrypt(&json, non_empty(user_password))?;

    // 3. Файл.
    std::fs::write(path, encrypted).map_err(|e| format!("Ошибка записи файла: {e}"))
}

pub fn preview_file(path: &str, user_password: Option<&str>) -> Result<ImportPreview, String> {
    // 1. Расшифровка.
    let password = non_empty(user_password);

    let payload = read_payload(path, password)?;

    // г) Счётчики.
    let projects = payload.tree.iter().flat_map(|ws| &ws.projects);

    Ok(ImportPreview {
        exported_at: payload.exported_at.clone(),
        workspace_count: payload.tree.len(),
        project_count: projects.clone().count(),
        console_count: projects.map(|p| p.consoles.len()).sum(),
        wiki_count: payload.wiki.len(),
        ai_session_count: payload.ai.len(),
        ai_message_count: payload.ai.iter().map(|s| s.messages.len()).sum(),
        settings_count: payload.settings.len(),
        has_password: password.is_some(),
    })
}

pub fn import_file(
    path: &str,
    user_password: Option<&str>,
    sections: Sections,
    mode: ImportMode,
) -> Result<(), String> {
    // 1. Расшифровка.
    let payload = read_payload(path, non_empty(user_password))?;

    // 2. «Заменить» — очистить выбранные разделы.
    if mode == ImportMode::Replace {
        clear_sections(sections)?;
    }

    // 3. Дерево с новыми id: старый id → новый, для перепривязки wiki.
    let id_map = if sections.tree { import_tree(payload.tree, mode)? } else { HashMap::new() };

    // 4. Wiki.
    if sections.wiki {
        for mut page in payload.wiki {
            let Some(parent_id) = wiki_parent(&page, sections.tree, &id_map) else {
                continue;
            };

            page.id = uuid::Uuid::new_v4().to_string();
            page.parent_id = parent_id;

            crate::db::upsert_wiki_page(&page)?;
        }
    }

    // 5. AI-чаты.
    if sections.ai {
        for AiSessionExport { session, messages } in payload.ai {
            let session_id = uuid::Uuid::new_v4().to_string();

            crate::db::create_ai_session(&session_id, &session.title, &session.provider, &session.model)?;

            for msg in messages {
                crate::db::save_ai_message(&uuid::Uuid::new_v4().to_string(), &session_id, &msg.role, &msg.content)?;
            }
        }
    }

    // 6. Настройки, кроме пароля на вход.
    if sections.settings {
        for (key, value) in payload.settings.iter().filter(|(key, _)| !key.starts_with(crate::security::PREFIX)) {
            crate::db::set_setting_value(key, value)?;
        }
    }

    Ok(())
}

// ══════════════════════════════════════════════
// Детали
// ══════════════════════════════════════════════

/// Пустой пароль из диалога — то же, что без пароля
fn non_empty(password: Option<&str>) -> Option<&str> {
    password.filter(|p| !p.is_empty())
}

/// Шаг 1 превью и импорта: прочитать, расшифровать и проверить файл
fn read_payload(path: &str, user_password: Option<&str>) -> Result<ExportPayload, String> {
    let file = std::fs::read(path).map_err(|e| format!("Ошибка чтения файла: {e}"))?;

    let json = decrypt(&file, user_password)?;

    let payload: ExportPayload =
        serde_json::from_slice(&json).map_err(|e| format!("Ошибка разбора файла: {e}"))?;

    if payload._verify != VERIFY_VALUE {
        return Err("Файл повреждён: неверная верификационная фраза".to_string());
    }

    Ok(payload)
}

/// Шаг 2 экспорта: payload → байты файла .dchub
fn encrypt(payload: &[u8], user_password: Option<&str>) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];

    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let ciphertext = cipher(user_password, &salt)
        .encrypt(Nonce::from_slice(&nonce), payload)
        .map_err(|e| format!("Encryption error: {e}"))?;

    let flags = if user_password.is_some() { FLAG_USER_PASSWORD } else { 0 };

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());

    out.extend_from_slice(MAGIC);
    out.push(flags);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&(ciphertext.len() as u32).to_le_bytes());
    out.extend_from_slice(&ciphertext);

    Ok(out)
}

/// Шаг 1 превью: байты файла → payload; исходы «а»–«в»
fn decrypt(data: &[u8], user_password: Option<&str>) -> Result<Vec<u8>, String> {
    if data.len() < HEADER_LEN {
        return Err("Файл повреждён или имеет неверный формат".to_string());
    }

    let (magic, rest) = data.split_at(MAGIC.len());
    let (flags, rest) = (rest[0], &rest[1..]);
    let (salt, rest) = rest.split_at(SALT_LEN);
    let (nonce, rest) = rest.split_at(NONCE_LEN);
    let (len, ciphertext) = rest.split_at(4);

    if magic != MAGIC {
        return Err("Не является файлом .dchub".to_string());
    }

    if flags & FLAG_USER_PASSWORD != 0 && user_password.is_none() {
        return Err(ERR_PASSWORD_REQUIRED.to_string());
    }

    let len = u32::from_le_bytes([len[0], len[1], len[2], len[3]]) as usize;

    let Some(ciphertext) = ciphertext.get(..len) else {
        return Err("Файл обрезан или повреждён".to_string());
    };

    cipher(user_password, salt)
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "Неверный пароль или файл повреждён".to_string())
}

/// AES-256-GCM с ключом из секрета приложения и пароля пользователя
fn cipher(user_password: Option<&str>, salt: &[u8]) -> Aes256Gcm {
    let mut material = APP_SECRET.to_vec();

    if let Some(password) = user_password {
        material.push(b':');
        material.extend_from_slice(password.as_bytes());
    }

    let mut key = [0u8; 32];

    pbkdf2_hmac::<Sha256>(&material, salt, PBKDF2_ITERATIONS, &mut key);

    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key))
}

/// Шаг 2 импорта: удалить выбранные разделы (настройки не удаляются — перезаписываются)
fn clear_sections(sections: Sections) -> Result<(), String> {
    if sections.tree {
        crate::db::delete_all_workspaces()?;
    }

    if sections.wiki {
        crate::db::delete_all_wiki_pages()?;
    }

    if sections.ai {
        crate::db::delete_all_ai_sessions()?;
    }

    Ok(())
}

/// Шаг 3 импорта: записать дерево с новыми id; вернуть карту «старый id → новый»
fn import_tree(tree: Vec<Workspace>, mode: ImportMode) -> Result<HashMap<String, String>, String> {
    let existing_names = crate::db::get_workspace_names()?;

    let mut id_map = HashMap::new();

    // Воркспейсы, затем их проекты, затем консоли — родитель всегда записан раньше
    let mut projects = Vec::new();

    for mut ws in tree {
        if mode == ImportMode::Merge && existing_names.contains(&ws.name) {
            ws.name = format!("{} (import)", ws.name);
        }

        let ws_id = assign_new_id(&mut ws.id, &mut id_map);

        crate::db::save_workspace(&ws)?;

        projects.extend(ws.projects.into_iter().map(|p| (ws_id.clone(), p)));
    }

    let mut consoles = Vec::new();

    for (ws_id, mut proj) in projects {
        proj.workspace_id = ws_id;

        let proj_id = assign_new_id(&mut proj.id, &mut id_map);

        crate::db::save_project(&proj)?;

        consoles.extend(proj.consoles.into_iter().map(|c| (proj_id.clone(), c)));
    }

    for (proj_id, mut con) in consoles {
        con.project_id = proj_id;

        assign_new_id(&mut con.id, &mut id_map);

        crate::db::save_console(&con)?;
    }

    Ok(id_map)
}

/// Шаг 3 импорта: дать узлу новый id, запомнить старый → новый; вернуть новый
fn assign_new_id(id: &mut String, id_map: &mut HashMap<String, String>) -> String {
    let new_id = uuid::Uuid::new_v4().to_string();

    id_map.insert(std::mem::replace(id, new_id.clone()), new_id.clone());

    new_id
}

/// Шаг 4 импорта: к какому узлу привязать страницу; None — узла нет в файле, страница пропускается
fn wiki_parent(page: &WikiPage, tree_imported: bool, id_map: &HashMap<String, String>) -> Option<String> {
    if page.parent_type == "global" || !tree_imported {
        return Some(page.parent_id.clone());
    }

    id_map.get(&page.parent_id).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_with_and_without_password() {
        for password in [None, Some("secret")] {
            let file = encrypt(b"payload", password).unwrap();

            assert_eq!(decrypt(&file, password).unwrap(), b"payload");
        }
    }

    #[test]
    fn password_protected_file_asks_for_password() {
        let file = encrypt(b"payload", Some("secret")).unwrap();

        assert_eq!(decrypt(&file, None).unwrap_err(), ERR_PASSWORD_REQUIRED);
        assert!(decrypt(&file, Some("wrong")).is_err());
    }

    #[test]
    fn truncated_file_is_rejected() {
        let file = encrypt(b"payload", None).unwrap();

        assert!(decrypt(&file[..file.len() - 1], None).is_err());
        assert!(decrypt(&file[..HEADER_LEN - 1], None).is_err());
    }
}
