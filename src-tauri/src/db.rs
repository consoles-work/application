// ══════════════════════════════════════════════════════════════════
// db.rs — SQLite база данных
// ══════════════════════════════════════════════════════════════════
//
// Rust-новичкам:
// - `static` — глобальная переменная (живёт всё время работы программы)
// - `Mutex` — "замок", гарантирует что только один поток работает с БД
// - `Once` — выполнить код ровно один раз (для инициализации)
// - `unwrap()` — "я уверен что ошибки нет" (паникует если есть)
//   В продакшне лучше использовать `?` для проброса ошибок
// - `map_err(|e| e.to_string())` — конвертация ошибки в строку
//   (Tauri требует String для ошибок в командах)

use rusqlite::{Connection, params};
use std::sync::Mutex;
use std::collections::HashMap;

use crate::commands::{Workspace, Project, ConsoleConfig, WikiPage, DbInfo};

// Глобальное подключение к БД, защищённое Mutex
// lazy_static нам не нужен — используем std::sync::OnceLock
static DB: std::sync::OnceLock<Mutex<Connection>> = std::sync::OnceLock::new();

/// Получить ссылку на подключение к БД
fn get_db() -> &'static Mutex<Connection> {
    DB.get().expect("Database not initialized. Call db::init() first.")
}

/// Путь к файлу базы данных
fn db_path() -> std::path::PathBuf {
    // dirs::data_dir() возвращает:
    //   macOS:   ~/Library/Application Support/
    //   Linux:   ~/.local/share/
    //   Windows: C:\Users\<User>\AppData\Roaming\
    let mut path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    path.push("devconsole-hub");

    // Создаём директорию если не существует
    std::fs::create_dir_all(&path).ok();

    path.push("data.db");
    path
}

// ══════════════════════════════════════════════
// Инициализация
// ══════════════════════════════════════════════

/// Инициализация БД: создание таблиц
/// Вызывается один раз при старте приложения из main.rs
pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    let path = db_path();
    println!("📂 Database path: {:?}", path);

    let conn = Connection::open(&path)?;

    // Включаем WAL mode и foreign keys
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // ── Создание таблиц ──
    conn.execute_batch("
        -- Workspaces (верхний уровень группировки)
        CREATE TABLE IF NOT EXISTS workspaces (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            icon        TEXT NOT NULL DEFAULT '📁',
            color       TEXT NOT NULL DEFAULT '#58a6ff',
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_expanded INTEGER NOT NULL DEFAULT 1
        );

        -- Projects (внутри workspace)
        CREATE TABLE IF NOT EXISTS projects (
            id            TEXT PRIMARY KEY,
            workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name          TEXT NOT NULL,
            icon          TEXT NOT NULL DEFAULT '📁',
            color         TEXT NOT NULL DEFAULT '#58a6ff',
            path          TEXT NOT NULL DEFAULT '',
            default_shell TEXT NOT NULL DEFAULT 'bash',
            env_vars      TEXT NOT NULL DEFAULT '{}',
            sort_order    INTEGER NOT NULL DEFAULT 0,
            is_expanded   INTEGER NOT NULL DEFAULT 1,
            is_danger     INTEGER NOT NULL DEFAULT 0,
            danger_label  TEXT NOT NULL DEFAULT 'PRODUCTION'
        );

        -- Consoles (внутри project)
        CREATE TABLE IF NOT EXISTS consoles (
            id              TEXT PRIMARY KEY,
            project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name            TEXT NOT NULL,
            shell_override  TEXT,
            cwd_override    TEXT,
            startup_cmd     TEXT,
            env_vars        TEXT,
            sort_order      INTEGER NOT NULL DEFAULT 0,
            is_danger       INTEGER NOT NULL DEFAULT 0,
            danger_label    TEXT NOT NULL DEFAULT 'PRODUCTION',
            connection_type TEXT NOT NULL DEFAULT 'local',
            ssh_host        TEXT NOT NULL DEFAULT '',
            ssh_port        INTEGER NOT NULL DEFAULT 22,
            ssh_user        TEXT NOT NULL DEFAULT '',
            ssh_key_path    TEXT NOT NULL DEFAULT '',
            ssh_extra_args  TEXT NOT NULL DEFAULT ''
        );

        -- Wiki pages (привязаны к любому узлу)
        CREATE TABLE IF NOT EXISTS wiki_pages (
            id          TEXT PRIMARY KEY,
            parent_type TEXT NOT NULL,
            parent_id   TEXT NOT NULL,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL DEFAULT '',
            tags        TEXT NOT NULL DEFAULT '[]',
            pinned      INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        -- Полнотекстовый поиск по wiki
        CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
            title, content, tags,
            content='wiki_pages',
            content_rowid='rowid'
        );

        -- Индексы
        CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_consoles_project ON consoles(project_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_parent ON wiki_pages(parent_type, parent_id);

        -- Настройки приложения
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ")?;

    // Миграция для существующих БД — добавляем столбцы если их ещё нет
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN is_danger INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN danger_label TEXT NOT NULL DEFAULT 'PRODUCTION'", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN is_danger INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN danger_label TEXT NOT NULL DEFAULT 'PRODUCTION'", []);
    // Миграция v3: SSH-подключение
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'local'", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN ssh_host TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN ssh_port INTEGER NOT NULL DEFAULT 22", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN ssh_user TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN ssh_key_path TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE consoles ADD COLUMN ssh_extra_args TEXT NOT NULL DEFAULT ''", []);

    // Сохраняем подключение в глобальную переменную
    DB.set(Mutex::new(conn))
        .map_err(|_| "Database already initialized")?;

    println!("✅ Database initialized");
    Ok(())
}

// ══════════════════════════════════════════════
// CRUD: Workspaces
// ══════════════════════════════════════════════

pub fn load_all_workspaces() -> Result<Vec<Workspace>, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;

    // Загружаем workspaces
    let mut stmt = db.prepare("SELECT id, name, icon, color, sort_order, is_expanded FROM workspaces ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let workspaces: Vec<Workspace> = stmt.query_map([], |row| {
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            sort_order: row.get(4)?,
            is_expanded: row.get::<_, i32>(5)? != 0,
            projects: Vec::new(), // заполним ниже
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    // Для каждого workspace загружаем проекты
    let mut result = workspaces;
    for ws in &mut result {
        ws.projects = load_projects_for_workspace(&db, &ws.id)?;
    }

    Ok(result)
}

fn load_projects_for_workspace(db: &Connection, workspace_id: &str) -> Result<Vec<Project>, String> {
    let mut stmt = db.prepare(
        "SELECT id, workspace_id, name, icon, color, path, default_shell, env_vars, sort_order, is_expanded, is_danger, danger_label FROM projects WHERE workspace_id = ?1 ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;

    let projects: Vec<Project> = stmt.query_map(params![workspace_id], |row| {
        let env_str: String = row.get(7)?;
        let env_vars: HashMap<String, String> = serde_json::from_str(&env_str).unwrap_or_default();
        Ok(Project {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            name: row.get(2)?,
            icon: row.get(3)?,
            color: row.get(4)?,
            path: row.get(5)?,
            default_shell: row.get(6)?,
            env_vars,
            sort_order: row.get(8)?,
            is_expanded: row.get::<_, i32>(9)? != 0,
            is_danger: row.get::<_, i32>(10)? != 0,
            danger_label: row.get(11)?,
            consoles: Vec::new(),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let mut result = projects;
    for proj in &mut result {
        proj.consoles = load_consoles_for_project(db, &proj.id)?;
    }

    Ok(result)
}

fn load_consoles_for_project(db: &Connection, project_id: &str) -> Result<Vec<ConsoleConfig>, String> {
    let mut stmt = db.prepare(
        "SELECT id, project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args FROM consoles WHERE project_id = ?1 ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;

    let consoles = stmt.query_map(params![project_id], |row| {
        let env_str: Option<String> = row.get(6)?;
        let env_vars: Option<HashMap<String, String>> = env_str
            .and_then(|s| serde_json::from_str(&s).ok());
        Ok(ConsoleConfig {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            shell_override: row.get(3)?,
            cwd_override: row.get(4)?,
            startup_cmd: row.get(5)?,
            env_vars,
            sort_order: row.get(7)?,
            is_danger: row.get::<_, i32>(8)? != 0,
            danger_label: row.get(9)?,
            connection_type: row.get::<_, Option<String>>(10)?.unwrap_or_else(|| "local".to_string()),
            ssh_host: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            ssh_port: row.get::<_, Option<i32>>(12)?.unwrap_or(22),
            ssh_user: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
            ssh_key_path: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
            ssh_extra_args: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(consoles)
}

pub fn save_workspace(ws: &Workspace) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO workspaces (id, name, icon, color, sort_order, is_expanded) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ws.id, ws.name, ws.icon, ws.color, ws.sort_order, ws.is_expanded as i32],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_workspace_fields(id: &str, name: &str, icon: &str, color: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE workspaces SET name = ?2, icon = ?3, color = ?4 WHERE id = ?1",
        params![id, name, icon, color],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_workspace_cascade(id: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    // ON DELETE CASCADE позаботится о projects и consoles
    db.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════
// CRUD: Projects
// ══════════════════════════════════════════════

pub fn save_project(proj: &Project) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let env_json = serde_json::to_string(&proj.env_vars).unwrap_or_default();
    db.execute(
        "INSERT OR REPLACE INTO projects (id, workspace_id, name, icon, color, path, default_shell, env_vars, sort_order, is_expanded, is_danger, danger_label) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![proj.id, proj.workspace_id, proj.name, proj.icon, proj.color, proj.path, proj.default_shell, env_json, proj.sort_order, proj.is_expanded as i32, proj.is_danger as i32, proj.danger_label],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_project_fields(id: &str, name: &str, icon: &str, color: &str, path: &str, default_shell: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE projects SET name = ?2, icon = ?3, color = ?4, path = ?5, default_shell = ?6 WHERE id = ?1",
        params![id, name, icon, color, path, default_shell],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_project_cascade(id: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════
// CRUD: Consoles
// ══════════════════════════════════════════════

pub fn save_console(con: &ConsoleConfig) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let env_json = con.env_vars.as_ref()
        .map(|e| serde_json::to_string(e).unwrap_or_default());
    db.execute(
        "INSERT OR REPLACE INTO consoles (id, project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![con.id, con.project_id, con.name, con.shell_override, con.cwd_override, con.startup_cmd, env_json, con.sort_order, con.is_danger as i32, con.danger_label, con.connection_type, con.ssh_host, con.ssh_port, con.ssh_user, con.ssh_key_path, con.ssh_extra_args],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_console_name(id: &str, name: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE consoles SET name = ?2 WHERE id = ?1",
        params![id, name],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_console_config_fields(
    id: &str,
    name: &str,
    startup_cmd: Option<&str>,
    connection_type: &str,
    ssh_host: &str,
    ssh_port: i32,
    ssh_user: &str,
    ssh_key_path: &str,
    ssh_extra_args: &str,
) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE consoles SET name = ?2, startup_cmd = ?3, connection_type = ?4, ssh_host = ?5, ssh_port = ?6, ssh_user = ?7, ssh_key_path = ?8, ssh_extra_args = ?9 WHERE id = ?1",
        params![id, name, startup_cmd, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_console_by_id(id: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM consoles WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════
// CRUD: Wiki
// ══════════════════════════════════════════════

pub fn load_wiki_pages(parent_type: &str, parent_id: &str) -> Result<Vec<WikiPage>, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare(
        "SELECT id, parent_type, parent_id, title, content, tags, pinned, created_at, updated_at FROM wiki_pages WHERE parent_type = ?1 AND parent_id = ?2 ORDER BY pinned DESC, updated_at DESC"
    ).map_err(|e| e.to_string())?;

    let pages = stmt.query_map(params![parent_type, parent_id], |row| {
        let tags_str: String = row.get(5)?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        Ok(WikiPage {
            id: row.get(0)?,
            parent_type: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            content: row.get(4)?,
            tags,
            pinned: row.get::<_, i32>(6)? != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(pages)
}

pub fn upsert_wiki_page(page: &WikiPage) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&page.tags).unwrap_or_default();
    db.execute(
        "INSERT OR REPLACE INTO wiki_pages (id, parent_type, parent_id, title, content, tags, pinned, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![page.id, page.parent_type, page.parent_id, page.title, page.content, tags_json, page.pinned as i32, page.created_at, page.updated_at],
    ).map_err(|e| e.to_string())?;

    // Обновляем FTS индекс
    db.execute(
        "INSERT OR REPLACE INTO wiki_fts(rowid, title, content, tags) SELECT rowid, title, content, tags FROM wiki_pages WHERE id = ?1",
        params![page.id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_wiki_page_by_id(id: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM wiki_pages WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_node_danger(id: &str, node_type: &str, is_danger: bool, danger_label: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    match node_type {
        "project" => db.execute(
            "UPDATE projects SET is_danger = ?2, danger_label = ?3 WHERE id = ?1",
            params![id, is_danger as i32, danger_label],
        ),
        "console" => db.execute(
            "UPDATE consoles SET is_danger = ?2, danger_label = ?3 WHERE id = ?1",
            params![id, is_danger as i32, danger_label],
        ),
        _ => return Err("Unknown node type".to_string()),
    }.map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════
// Клонирование
// ══════════════════════════════════════════════

pub fn clone_console_by_id(id: &str) -> Result<ConsoleConfig, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args FROM consoles WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    let con = stmt.query_row(params![id], |row| {
        let env_str: Option<String> = row.get(5)?;
        let env_vars: Option<HashMap<String, String>> = env_str
            .and_then(|s| serde_json::from_str(&s).ok());
        Ok(ConsoleConfig {
            id: String::new(),
            project_id: row.get(0)?,
            name: row.get(1)?,
            shell_override: row.get(2)?,
            cwd_override: row.get(3)?,
            startup_cmd: row.get(4)?,
            env_vars,
            sort_order: row.get(6)?,
            is_danger: row.get::<_, i32>(7)? != 0,
            danger_label: row.get(8)?,
            connection_type: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "local".to_string()),
            ssh_host: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            ssh_port: row.get::<_, Option<i32>>(11)?.unwrap_or(22),
            ssh_user: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
            ssh_key_path: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
            ssh_extra_args: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;

    let new_name = format!("{} (copy)", con.name);
    let new_con = ConsoleConfig {
        id: uuid::Uuid::new_v4().to_string(),
        name: new_name,
        ..con
    };

    let env_json = new_con.env_vars.as_ref()
        .map(|e| serde_json::to_string(e).unwrap_or_default());
    db.execute(
        "INSERT INTO consoles (id, project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![new_con.id, new_con.project_id, new_con.name, new_con.shell_override, new_con.cwd_override, new_con.startup_cmd, env_json, new_con.sort_order, new_con.is_danger as i32, new_con.danger_label, new_con.connection_type, new_con.ssh_host, new_con.ssh_port, new_con.ssh_user, new_con.ssh_key_path, new_con.ssh_extra_args],
    ).map_err(|e| e.to_string())?;

    Ok(new_con)
}

pub fn clone_project_by_id(id: &str) -> Result<Project, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT workspace_id, name, icon, color, path, default_shell, env_vars, sort_order, is_expanded, is_danger, danger_label FROM projects WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    let proj = stmt.query_row(params![id], |row| {
        let env_str: String = row.get(6)?;
        let env_vars: HashMap<String, String> = serde_json::from_str(&env_str).unwrap_or_default();
        Ok(Project {
            id: String::new(),
            workspace_id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            path: row.get(4)?,
            default_shell: row.get(5)?,
            env_vars,
            sort_order: row.get(7)?,
            is_expanded: row.get::<_, i32>(8)? != 0,
            is_danger: row.get::<_, i32>(9)? != 0,
            danger_label: row.get(10)?,
            consoles: Vec::new(),
        })
    }).map_err(|e| e.to_string())?;

    let original_consoles = load_consoles_for_project(&db, id)?;
    let new_id = uuid::Uuid::new_v4().to_string();
    let new_name = format!("{} (copy)", proj.name);
    let new_proj = Project {
        id: new_id.clone(),
        name: new_name,
        consoles: Vec::new(),
        ..proj
    };

    let env_json = serde_json::to_string(&new_proj.env_vars).unwrap_or_default();
    db.execute(
        "INSERT INTO projects (id, workspace_id, name, icon, color, path, default_shell, env_vars, sort_order, is_expanded, is_danger, danger_label) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![new_proj.id, new_proj.workspace_id, new_proj.name, new_proj.icon, new_proj.color, new_proj.path, new_proj.default_shell, env_json, new_proj.sort_order, new_proj.is_expanded as i32, new_proj.is_danger as i32, new_proj.danger_label],
    ).map_err(|e| e.to_string())?;

    let mut new_consoles = Vec::new();
    for con in original_consoles {
        let con_env_json = con.env_vars.as_ref()
            .map(|e| serde_json::to_string(e).unwrap_or_default());
        let new_con = ConsoleConfig {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: new_id.clone(),
            ..con
        };
        db.execute(
            "INSERT INTO consoles (id, project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![new_con.id, new_con.project_id, new_con.name, new_con.shell_override, new_con.cwd_override, new_con.startup_cmd, con_env_json, new_con.sort_order, new_con.is_danger as i32, new_con.danger_label, new_con.connection_type, new_con.ssh_host, new_con.ssh_port, new_con.ssh_user, new_con.ssh_key_path, new_con.ssh_extra_args],
        ).map_err(|e| e.to_string())?;
        new_consoles.push(new_con);
    }

    Ok(Project { consoles: new_consoles, ..new_proj })
}

// ══════════════════════════════════════════════
// CRUD: Settings
// ══════════════════════════════════════════════

pub fn get_all_settings() -> Result<HashMap<String, String>, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let map: HashMap<String, String> = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(map)
}

pub fn set_setting_value(key: &str, value: &str) -> Result<(), String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_db_info_data() -> DbInfo {
    let path = db_path();
    let path_str = path.to_string_lossy().to_string();
    let dir_path = path.parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let created_at = std::fs::metadata(&path)
        .and_then(|m| m.created())
        .map(|t| {
            let dt: chrono::DateTime<chrono::Local> = t.into();
            dt.format("%Y-%m-%d %H:%M").to_string()
        })
        .unwrap_or_else(|_| "—".to_string());
    DbInfo { path: path_str, dir_path, size_bytes, created_at }
}

pub fn search_wiki_fts(query: &str) -> Result<Vec<WikiPage>, String> {
    let db = get_db().lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare(
        "SELECT wp.id, wp.parent_type, wp.parent_id, wp.title, wp.content, wp.tags, wp.pinned, wp.created_at, wp.updated_at FROM wiki_pages wp JOIN wiki_fts ON wp.rowid = wiki_fts.rowid WHERE wiki_fts MATCH ?1 ORDER BY rank LIMIT 50"
    ).map_err(|e| e.to_string())?;

    let pages = stmt.query_map(params![query], |row| {
        let tags_str: String = row.get(5)?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        Ok(WikiPage {
            id: row.get(0)?,
            parent_type: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            content: row.get(4)?,
            tags,
            pinned: row.get::<_, i32>(6)? != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(pages)
}
