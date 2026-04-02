// ══════════════════════════════════════════════════════════════════
// commands.rs — Tauri IPC команды
// ══════════════════════════════════════════════════════════════════
//
// Каждая функция с #[tauri::command] — это "ручка" (endpoint),
// которую можно вызвать из TypeScript через:
//   invoke("имя_функции", { аргументы })
//
// Rust-новичкам:
// - `String` — строка (как string в TS)
// - `Vec<T>` — массив (как Array<T> в TS)
// - `Option<T>` — может быть значение или null (как T | null в TS)
// - `Result<T, E>` — успех или ошибка (как Promise<T> в TS)
// - `serde` — библиотека для JSON сериализации (как JSON.parse/stringify)
// - `#[serde(rename_all = "camelCase")]` — поля в JSON будут camelCase

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Типы данных (зеркало TypeScript типов) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSession {
    pub id: String,
    pub title: String,
    pub provider: String,
    pub model: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub sort_order: i32,
    pub is_expanded: bool,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub path: String,
    pub default_shell: String,
    pub env_vars: HashMap<String, String>,
    pub sort_order: i32,
    pub is_expanded: bool,
    pub is_danger: bool,
    pub danger_label: String,
    pub consoles: Vec<ConsoleConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleConfig {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub shell_override: Option<String>,
    pub cwd_override: Option<String>,
    pub startup_cmd: Option<String>,
    pub env_vars: Option<HashMap<String, String>>,
    pub sort_order: i32,
    pub is_danger: bool,
    pub danger_label: String,
    // Параметры подключения
    pub connection_type: String,   // "local" | "ssh"
    pub ssh_host: String,
    pub ssh_port: i32,
    pub ssh_user: String,
    pub ssh_key_path: String,
    pub ssh_extra_args: String,
    pub ssh_passphrase: String,
    pub ssh_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    pub dir_path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiPage {
    pub id: String,
    pub parent_type: String,
    pub parent_id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

// ══════════════════════════════════════════════
// Команды: Дерево проектов
// ══════════════════════════════════════════════

/// Загрузить все workspaces с проектами и консолями
#[tauri::command]
pub fn load_workspaces() -> Result<Vec<Workspace>, String> {
    // TODO: загрузить из SQLite через db::load_all_workspaces()
    // Пока возвращаем пустой массив — фронт использует демо-данные
    crate::db::load_all_workspaces()
}

/// Создать новый workspace
#[tauri::command]
pub fn create_workspace(name: String, icon: String, color: String) -> Result<Workspace, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let workspace = Workspace {
        id: id.clone(),
        name,
        icon,
        color,
        sort_order: 0,
        is_expanded: true,
        projects: Vec::new(),
    };

    crate::db::save_workspace(&workspace)?;
    Ok(workspace)
}

/// Обновить workspace
#[tauri::command]
pub fn update_workspace(id: String, name: String, icon: String, color: String) -> Result<(), String> {
    crate::db::update_workspace_fields(&id, &name, &icon, &color)
}

/// Удалить workspace и всё его содержимое
#[tauri::command]
pub fn delete_workspace(id: String) -> Result<(), String> {
    crate::db::delete_workspace_cascade(&id)
}

/// Создать проект внутри workspace
#[tauri::command]
pub fn create_project(
    workspace_id: String,
    name: String,
    icon: String,
    color: String,
    path: String,
    default_shell: String,
) -> Result<Project, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let project = Project {
        id: id.clone(),
        workspace_id,
        name,
        icon,
        color,
        path,
        default_shell,
        env_vars: HashMap::new(),
        sort_order: 0,
        is_expanded: true,
        is_danger: false,
        danger_label: "PRODUCTION".to_string(),
        consoles: Vec::new(),
    };

    crate::db::save_project(&project)?;
    Ok(project)
}

/// Обновить проект
#[tauri::command]
pub fn update_project(id: String, name: String, icon: String, color: String, path: String, default_shell: String) -> Result<(), String> {
    crate::db::update_project_fields(&id, &name, &icon, &color, &path, &default_shell)
}

/// Удалить проект
#[tauri::command]
pub fn delete_project(id: String) -> Result<(), String> {
    crate::db::delete_project_cascade(&id)
}

/// Создать консоль внутри проекта
#[tauri::command]
pub fn create_console(
    project_id: String,
    name: String,
    startup_cmd: Option<String>,
    connection_type: Option<String>,
    ssh_host: Option<String>,
    ssh_port: Option<i32>,
    ssh_user: Option<String>,
    ssh_key_path: Option<String>,
    ssh_extra_args: Option<String>,
    ssh_passphrase: Option<String>,
    ssh_password: Option<String>,
) -> Result<ConsoleConfig, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let console = ConsoleConfig {
        id: id.clone(),
        project_id,
        name,
        shell_override: None,
        cwd_override: None,
        startup_cmd,
        env_vars: None,
        sort_order: 0,
        is_danger: false,
        danger_label: "PRODUCTION".to_string(),
        connection_type: connection_type.unwrap_or_else(|| "local".to_string()),
        ssh_host: ssh_host.unwrap_or_default(),
        ssh_port: ssh_port.unwrap_or(22),
        ssh_user: ssh_user.unwrap_or_default(),
        ssh_key_path: ssh_key_path.unwrap_or_default(),
        ssh_extra_args: ssh_extra_args.unwrap_or_default(),
        ssh_passphrase: ssh_passphrase.unwrap_or_default(),
        ssh_password: ssh_password.unwrap_or_default(),
    };

    crate::db::save_console(&console)?;
    Ok(console)
}

/// Обновить имя консоли (используется при inline-rename)
#[tauri::command]
pub fn update_console(id: String, name: String) -> Result<(), String> {
    crate::db::update_console_name(&id, &name)
}

/// Обновить полную конфигурацию консоли (подключение, startup и т.д.)
#[tauri::command]
pub fn update_console_config(
    id: String,
    name: String,
    startup_cmd: Option<String>,
    connection_type: String,
    ssh_host: String,
    ssh_port: i32,
    ssh_user: String,
    ssh_key_path: String,
    ssh_extra_args: String,
    ssh_passphrase: String,
    ssh_password: String,
) -> Result<(), String> {
    crate::db::update_console_config_fields(
        &id, &name, startup_cmd.as_deref(),
        &connection_type, &ssh_host, ssh_port,
        &ssh_user, &ssh_key_path, &ssh_extra_args,
        &ssh_passphrase, &ssh_password,
    )
}

/// Удалить консоль
#[tauri::command]
pub fn delete_console(id: String) -> Result<(), String> {
    crate::db::delete_console_by_id(&id)
}

// ══════════════════════════════════════════════
// Команды: PTY (терминал)
// ══════════════════════════════════════════════

/// Запустить новую терминальную сессию
/// Возвращает числовой ID сессии для дальнейших операций
#[tauri::command]
pub fn spawn_pty(
    shell: String,
    cwd: String,
    env_vars: HashMap<String, String>,
    ssh_key_path: Option<String>,
    ssh_passphrase: Option<String>,
    ssh_password: Option<String>,
) -> Result<u32, String> {
    crate::pty_manager::spawn(
        shell, cwd, env_vars,
        ssh_key_path.unwrap_or_default(),
        ssh_passphrase.unwrap_or_default(),
        ssh_password.unwrap_or_default(),
    )
}

/// Отправить данные (ввод пользователя) в терминал
#[tauri::command]
pub fn write_to_pty(pty_id: u32, data: String) -> Result<(), String> {
    crate::pty_manager::write(pty_id, data)
}

/// Изменить размер терминала
#[tauri::command]
pub fn resize_pty(pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    crate::pty_manager::resize(pty_id, cols, rows)
}

/// Убить терминальную сессию
#[tauri::command]
pub fn kill_pty(pty_id: u32) -> Result<(), String> {
    crate::pty_manager::kill(pty_id)
}

// ══════════════════════════════════════════════
// Команды: Wiki
// ══════════════════════════════════════════════

/// Загрузить wiki-страницы для конкретного узла дерева
#[tauri::command]
pub fn load_wiki_pages(parent_type: String, parent_id: String) -> Result<Vec<WikiPage>, String> {
    crate::db::load_wiki_pages(&parent_type, &parent_id)
}

/// Сохранить wiki-страницу (создать или обновить)
#[tauri::command]
pub fn save_wiki_page(page: WikiPage) -> Result<(), String> {
    crate::db::upsert_wiki_page(&page)
}

/// Удалить wiki-страницу
#[tauri::command]
pub fn delete_wiki_page(id: String) -> Result<(), String> {
    crate::db::delete_wiki_page_by_id(&id)
}

/// Полнотекстовый поиск по wiki
#[tauri::command]
pub fn search_wiki(query: String) -> Result<Vec<WikiPage>, String> {
    crate::db::search_wiki_fts(&query)
}

/// Установить/снять пометку "опасно" для проекта или консоли
#[tauri::command]
pub fn set_node_danger(id: String, node_type: String, is_danger: bool, danger_label: String) -> Result<(), String> {
    crate::db::update_node_danger(&id, &node_type, is_danger, &danger_label)
}

/// Сохранить состояние раскрытия узла дерева (workspace или project)
#[tauri::command]
pub fn set_node_expanded(id: String, node_type: String, is_expanded: bool) -> Result<(), String> {
    crate::db::set_node_expanded(&id, &node_type, is_expanded)
}

/// Дублировать консоль (копия с именем "{имя} (copy)")
#[tauri::command]
pub fn clone_console(id: String) -> Result<ConsoleConfig, String> {
    crate::db::clone_console_by_id(&id)
}

/// Дублировать проект со всеми консолями
#[tauri::command]
pub fn clone_project(id: String) -> Result<Project, String> {
    crate::db::clone_project_by_id(&id)
}

// ══════════════════════════════════════════════
// Команды: Настройки
// ══════════════════════════════════════════════

/// Загрузить все настройки приложения
#[tauri::command]
pub fn get_settings() -> Result<std::collections::HashMap<String, String>, String> {
    crate::db::get_all_settings()
}

/// Сохранить одну настройку
#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), String> {
    crate::db::set_setting_value(&key, &value)
}

/// Получить информацию о файле базы данных
#[tauri::command]
pub fn get_db_info() -> DbInfo {
    crate::db::get_db_info_data()
}

/// Завершить приложение (вызывается после подтверждения пользователем)
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Сбросить флаг активного диалога выхода (вызывается при ответе "Нет")
#[tauri::command]
pub fn reset_quit_dialog() {
    crate::QUIT_DIALOG_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
}

// ══════════════════════════════════════════════
// Команды: AI чат-сессии
// ══════════════════════════════════════════════

/// Создать новую AI чат-сессию
#[tauri::command]
pub fn create_ai_session(title: String, provider: String, model: String) -> Result<AiSession, String> {
    let id = uuid::Uuid::new_v4().to_string();
    crate::db::create_ai_session(&id, &title, &provider, &model)
}

/// Загрузить список всех AI сессий (без сообщений)
#[tauri::command]
pub fn load_ai_sessions() -> Result<Vec<AiSession>, String> {
    crate::db::load_ai_sessions()
}

/// Переименовать AI сессию
#[tauri::command]
pub fn rename_ai_session(id: String, title: String) -> Result<(), String> {
    crate::db::rename_ai_session(&id, &title)
}

/// Удалить AI сессию и все её сообщения
#[tauri::command]
pub fn delete_ai_session(id: String) -> Result<(), String> {
    crate::db::delete_ai_session(&id)
}

/// Загрузить историю сообщений сессии
#[tauri::command]
pub fn load_ai_messages(session_id: String) -> Result<Vec<AiMessage>, String> {
    crate::db::load_ai_messages(&session_id)
}

/// Сохранить сообщение в сессию
#[tauri::command]
pub fn save_ai_message(id: String, session_id: String, role: String, content: String) -> Result<AiMessage, String> {
    crate::db::save_ai_message(&id, &session_id, &role, &content)
}

/// Обновить содержимое сообщения (для финализации стриминга)
#[tauri::command]
pub fn update_ai_message(id: String, content: String) -> Result<(), String> {
    crate::db::update_ai_message_content(&id, &content)
}

/// Очистить все сообщения сессии
#[tauri::command]
pub fn clear_ai_session(session_id: String) -> Result<(), String> {
    crate::db::clear_ai_session_messages(&session_id)
}

// ══════════════════════════════════════════════
// Команды: Экспорт/импорт
// ══════════════════════════════════════════════

/// Экспортировать данные в зашифрованный .dchub файл (пишет файл по пути)
#[tauri::command]
pub fn export_data(
    file_path: String,
    include_tree: bool,
    include_wiki: bool,
    include_ai: bool,
    user_password: Option<String>,
) -> Result<(), String> {
    let payload = crate::export::build_export_payload(include_tree, include_wiki, include_ai)?;
    let json = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    let encrypted = crate::export::encrypt_export(&json, user_password.as_deref())?;
    std::fs::write(&file_path, &encrypted).map_err(|e| format!("Ошибка записи файла: {e}"))
}

/// Расшифровать файл и вернуть превью (без применения к БД)
#[tauri::command]
pub fn preview_import(
    file_path: String,
    user_password: Option<String>,
) -> Result<crate::export::ImportPreview, String> {
    let has_password = user_password.as_ref().map(|p| !p.is_empty()).unwrap_or(false);
    let file_bytes = std::fs::read(&file_path).map_err(|e| format!("Ошибка чтения файла: {e}"))?;
    let decrypted = crate::export::decrypt_export(&file_bytes, user_password.as_deref())?;
    crate::export::parse_preview(&decrypted, has_password)
}

/// Применить импорт к базе данных
#[tauri::command]
pub fn apply_import(
    file_path: String,
    user_password: Option<String>,
    include_tree: bool,
    include_wiki: bool,
    include_ai: bool,
    mode: String,
) -> Result<(), String> {
    let file_bytes = std::fs::read(&file_path).map_err(|e| format!("Ошибка чтения файла: {e}"))?;
    let decrypted = crate::export::decrypt_export(&file_bytes, user_password.as_deref())?;
    crate::export::apply_import(&decrypted, include_tree, include_wiki, include_ai, &mode)
}
