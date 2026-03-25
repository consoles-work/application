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
    path: String,
    default_shell: String,
) -> Result<Project, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let project = Project {
        id: id.clone(),
        workspace_id,
        name,
        icon: "📁".to_string(),
        color: "#58a6ff".to_string(),
        path,
        default_shell,
        env_vars: HashMap::new(),
        sort_order: 0,
        is_expanded: true,
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
    };

    crate::db::save_console(&console)?;
    Ok(console)
}

/// Обновить консоль
#[tauri::command]
pub fn update_console(id: String, name: String) -> Result<(), String> {
    crate::db::update_console_name(&id, &name)
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
) -> Result<u32, String> {
    crate::pty_manager::spawn(shell, cwd, env_vars)
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
