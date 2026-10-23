// ══════════════════════════════════════════════════════════════════
// db.rs — SQLite база данных
// ══════════════════════════════════════════════════════════════════
//
// Всё, что приложение хранит: дерево (воркспейсы → проекты → консоли), wiki,
// AI-чаты, настройки, статистику. Файл зашифрован SQLCipher; вызывается
// командами из commands.rs, экспортом и движками.
//
// init — при старте приложения:
//  1. Открываем файл и сразу задаём ключ — SQLCipher требует, чтобы ключ был
//     первой командой.
//  2. Файл не расшифровался — это старая незашифрованная БД: откладываем её
//     рядом с суффиксом .plaintext_backup и создаём новую, пустую.
//  3. WAL и внешние ключи (без них не работает каскадное удаление).
//  4. Таблицы, затем миграции: к старым БД добавляются новые колонки консоли
//     («колонка уже есть» — не ошибка).
//  5. Статистика старше окна хранения удаляется.
//
// Общие правила:
//  - удаление воркспейса/проекта/AI-чата каскадом удаляет всё вложенное;
//  - JSON-колонки (переменные окружения, теги, быстрые команды) с битым JSON
//    читаются как пустые, строка, которая не разобралась, в списке пропускается —
//    одна испорченная запись не должна прятать остальные;
//  - настройки `security.*` наружу не отдаются (хеш пароля — только security.rs).
//
// Rust-новичкам:
// - `static` — глобальная переменная (живёт всё время работы программы)
// - `Mutex` — "замок", гарантирует что только один поток работает с БД
// - `Once` — выполнить код ровно один раз (для инициализации)
// - `unwrap()` — "я уверен что ошибки нет" (паникует если есть)
//   В продакшне лучше использовать `?` для проброса ошибок
// - `map_err(|e| e.to_string())` — конвертация ошибки в строку
//   (Tauri требует String для ошибок в командах)

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};

use rusqlite::{params, Connection, Params, Row};

use crate::commands::{
    AiMessage, AiSession, ConsoleConfig, ConsoleFields, DbInfo, Project, ProjectFields, QuickCommand, UsageStat,
    WikiPage, Workspace,
};

/// Ключ шифрования БД — встроен в бинарник при компиляции (build.rs).
/// Задать до сборки: export DB_ENCRYPTION_KEY="random-64-char-string"
const DB_KEY: &str = env!("DB_ENCRYPTION_KEY");

/// Шаг 5 init: сколько дней статистики держим — окно «месяц» = 30 дней, считая сегодня (+1 про запас)
const USAGE_KEEP_DAYS: i64 = 31;

/// Колонки консоли — в том же порядке, что читает `console_from_row`
const CONSOLE_COLUMNS: &str = "id, project_id, name, shell_override, cwd_override, startup_cmd, env_vars, sort_order, is_danger, danger_label, connection_type, ssh_host, ssh_port, ssh_user, ssh_key_path, ssh_extra_args, ssh_passphrase, ssh_password, note, hosting, quick_commands, icon, color";

/// Колонки проекта — в том же порядке, что читает `project_from_row`
const PROJECT_COLUMNS: &str = "id, workspace_id, name, icon, color, path, default_shell, env_vars, sort_order, is_expanded, is_danger, danger_label";

/// Колонки wiki-страницы — в том же порядке, что читает `wiki_from_row`
const WIKI_COLUMNS: &str = "id, parent_type, parent_id, title, content, tags, pinned, created_at, updated_at";

/// Шаг 4 init
const SCHEMA: &str = "
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
        ssh_passphrase  TEXT NOT NULL DEFAULT '',
        ssh_password    TEXT NOT NULL DEFAULT '',
        ssh_key_path    TEXT NOT NULL DEFAULT '',
        ssh_extra_args  TEXT NOT NULL DEFAULT '',
        note            TEXT NOT NULL DEFAULT '',
        hosting         TEXT NOT NULL DEFAULT '',
        quick_commands  TEXT NOT NULL DEFAULT '[]',
        icon            TEXT NOT NULL DEFAULT '',
        color           TEXT NOT NULL DEFAULT ''
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

    -- AI чат-сессии
    CREATE TABLE IF NOT EXISTS ai_sessions (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL DEFAULT 'Новый чат',
        provider   TEXT NOT NULL DEFAULT 'openai',
        model      TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- AI сообщения (привязаны к сессии)
    CREATE TABLE IF NOT EXISTS ai_messages (
        id         TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id);

    -- Статистика использования: агрегаты по (день, час, консоль, метрика).
    -- console_id = '' — метрики уровня приложения. project_id — проект консоли
    -- на момент записи (время остаётся за проектом, даже если консоль перенесли).
    -- Без внешних ключей: удалённые консоли/проекты не стирают историю.
    CREATE TABLE IF NOT EXISTS usage_stats (
        day        TEXT NOT NULL,
        hour       INTEGER NOT NULL,
        console_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL DEFAULT '',
        metric     TEXT NOT NULL,
        value      INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, hour, console_id, metric)
    );
";

/// Шаг 4 init: колонки, появившиеся после первых версий. Ошибка «duplicate column name» — колонка уже есть.
const MIGRATIONS: &[&str] = &[
    "ALTER TABLE consoles ADD COLUMN note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE consoles ADD COLUMN hosting TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE consoles ADD COLUMN quick_commands TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE consoles ADD COLUMN icon TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE consoles ADD COLUMN color TEXT NOT NULL DEFAULT ''",
];

static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

// ══════════════════════════════════════════════
// Инициализация
// ══════════════════════════════════════════════

pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    let path = db_path();

    println!("📂 Database path: {:?}", path);

    // 1–2. Открыть с ключом; старую незашифрованную БД — в сторону.
    let conn = match open_encrypted(&path)? {
        Some(conn) => conn,
        None => {
            let backup_path = path.with_extension("db.plaintext_backup");

            std::fs::rename(&path, &backup_path)?;

            println!("⚠️  Old plain-text DB moved to: {:?}, creating new encrypted database", backup_path);

            open_encrypted(&path)?.ok_or("new encrypted database is not readable")?
        }
    };

    // 3. Режим журнала и внешние ключи.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // 4. Схема и миграции.
    conn.execute_batch(SCHEMA)?;

    for migration in MIGRATIONS {
        conn.execute(migration, []).ok();
    }

    // 5. Старая статистика.
    prune_usage_stats(&conn);

    DB.set(Mutex::new(conn)).map_err(|_| "Database already initialized")?;

    println!("✅ Database initialized (encrypted)");

    Ok(())
}

pub fn get_db_info_data() -> DbInfo {
    let path = db_path();

    let meta = std::fs::metadata(&path).ok();

    let created_at = meta
        .as_ref()
        .and_then(|m| m.created().ok())
        .map(|t| chrono::DateTime::<chrono::Local>::from(t).format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_else(|| "—".to_string());

    DbInfo {
        path: path.to_string_lossy().to_string(),
        dir_path: path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        size_bytes: meta.map(|m| m.len()).unwrap_or(0),
        created_at,
    }
}

// ══════════════════════════════════════════════
// Дерево: воркспейсы, проекты, консоли
// ══════════════════════════════════════════════

pub fn load_all_workspaces() -> Result<Vec<Workspace>, String> {
    let db = conn()?;

    let mut workspaces = query_all(
        &db,
        "SELECT id, name, icon, color, sort_order, is_expanded FROM workspaces ORDER BY sort_order",
        [],
        |row| {
            Ok(Workspace {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
                is_expanded: row.get::<_, i32>(5)? != 0,
                projects: Vec::new(),
            })
        },
    )?;

    for ws in &mut workspaces {
        ws.projects = query_all(
            &db,
            &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE workspace_id = ?1 ORDER BY sort_order"),
            params![ws.id],
            project_from_row,
        )?;

        for proj in &mut ws.projects {
            proj.consoles = load_consoles(&db, &proj.id)?;
        }
    }

    Ok(workspaces)
}

pub fn save_workspace(ws: &Workspace) -> Result<(), String> {
    execute(
        "INSERT OR REPLACE INTO workspaces (id, name, icon, color, sort_order, is_expanded) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ws.id, ws.name, ws.icon, ws.color, ws.sort_order, ws.is_expanded as i32],
    )
}

pub fn update_workspace_fields(id: &str, name: &str, icon: &str, color: &str) -> Result<(), String> {
    execute(
        "UPDATE workspaces SET name = ?2, icon = ?3, color = ?4 WHERE id = ?1",
        params![id, name, icon, color],
    )
}

/// Вместе с проектами и консолями (каскад)
pub fn delete_workspace_cascade(id: &str) -> Result<(), String> {
    execute("DELETE FROM workspaces WHERE id = ?1", params![id])
}

/// Имена всех воркспейсов — импорт по ним решает, нужен ли суффикс
pub fn get_workspace_names() -> Result<HashSet<String>, String> {
    let names = query_all(&*conn()?, "SELECT name FROM workspaces", [], |row| row.get(0))?;

    Ok(names.into_iter().collect())
}

/// Вместе с проектами и консолями (каскад)
pub fn delete_all_workspaces() -> Result<(), String> {
    execute("DELETE FROM workspaces", [])
}

pub fn save_project(proj: &Project) -> Result<(), String> {
    write_project(&*conn()?, proj)
}

pub fn update_project_fields(id: &str, fields: &ProjectFields) -> Result<(), String> {
    execute(
        "UPDATE projects SET name = ?2, icon = ?3, color = ?4, path = ?5, default_shell = ?6 WHERE id = ?1",
        params![id, fields.name, fields.icon, fields.color, fields.path, fields.default_shell],
    )
}

/// Вместе с консолями (каскад)
pub fn delete_project_cascade(id: &str) -> Result<(), String> {
    execute("DELETE FROM projects WHERE id = ?1", params![id])
}

/// Копия проекта «<имя> (copy)» со всеми консолями — новые id
pub fn clone_project_by_id(id: &str) -> Result<Project, String> {
    let db = conn()?;

    let original = db
        .query_row(&format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"), params![id], project_from_row)
        .map_err(|e| e.to_string())?;

    let new_id = uuid::Uuid::new_v4().to_string();

    let consoles: Vec<ConsoleConfig> = load_consoles(&db, id)?
        .into_iter()
        .map(|con| ConsoleConfig { id: uuid::Uuid::new_v4().to_string(), project_id: new_id.clone(), ..con })
        .collect();

    let copy = Project { id: new_id, name: format!("{} (copy)", original.name), consoles, ..original };

    write_project(&db, &copy)?;

    for con in &copy.consoles {
        write_console(&db, con)?;
    }

    Ok(copy)
}

pub fn save_console(con: &ConsoleConfig) -> Result<(), String> {
    write_console(&*conn()?, con)
}

pub fn update_console_name(id: &str, name: &str) -> Result<(), String> {
    execute("UPDATE consoles SET name = ?2 WHERE id = ?1", params![id, name])
}

/// Поля из диалога настроек консоли
pub fn update_console_config_fields(id: &str, f: &ConsoleFields) -> Result<(), String> {
    execute(
        "UPDATE consoles SET name = ?2, startup_cmd = ?3, connection_type = ?4, ssh_host = ?5, ssh_port = ?6, ssh_user = ?7, ssh_key_path = ?8, ssh_extra_args = ?9, ssh_passphrase = ?10, ssh_password = ?11, note = ?12, hosting = ?13, icon = ?14, color = ?15 WHERE id = ?1",
        params![id, f.name, f.startup_cmd, f.connection_type, f.ssh_host, f.ssh_port, f.ssh_user, f.ssh_key_path, f.ssh_extra_args, f.ssh_passphrase, f.ssh_password, f.note, f.hosting, f.icon, f.color],
    )
}

pub fn delete_console_by_id(id: &str) -> Result<(), String> {
    execute("DELETE FROM consoles WHERE id = ?1", params![id])
}

pub fn move_console(id: &str, target_project_id: &str) -> Result<(), String> {
    execute("UPDATE consoles SET project_id = ?1 WHERE id = ?2", params![target_project_id, id])
}

/// Копия консоли «<имя> (copy)» в том же проекте
pub fn clone_console_by_id(id: &str) -> Result<ConsoleConfig, String> {
    let db = conn()?;

    let original = db
        .query_row(&format!("SELECT {CONSOLE_COLUMNS} FROM consoles WHERE id = ?1"), params![id], console_from_row)
        .map_err(|e| e.to_string())?;

    let copy = ConsoleConfig {
        id: uuid::Uuid::new_v4().to_string(),
        name: format!("{} (copy)", original.name),
        ..original
    };

    write_console(&db, &copy)?;

    Ok(copy)
}

pub fn set_console_quick_commands(id: &str, commands: &[QuickCommand]) -> Result<(), String> {
    let json = serde_json::to_string(commands).map_err(|e| e.to_string())?;

    execute("UPDATE consoles SET quick_commands = ?2 WHERE id = ?1", params![id, json])
}

/// +1 запуск быстрой команды. Read-modify-write под общим замком БД — без гонок между вкладками.
/// Символы — по тексту команды на момент запуска, +1 за Enter (та же формула в TerminalPanel.tsx).
pub fn record_quick_command_run(console_id: &str, command_id: &str) -> Result<QuickCommand, String> {
    let db = conn()?;

    let json: String = db
        .query_row("SELECT quick_commands FROM consoles WHERE id = ?1", params![console_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let mut commands: Vec<QuickCommand> = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    let cmd = commands
        .iter_mut()
        .find(|c| c.id == command_id)
        .ok_or_else(|| format!("quick command {command_id} not found"))?;

    cmd.run_count += 1;
    cmd.saved_chars += cmd.command.chars().count() as u64 + 1;

    let updated = cmd.clone();

    let json = serde_json::to_string(&commands).map_err(|e| e.to_string())?;

    db.execute("UPDATE consoles SET quick_commands = ?2 WHERE id = ?1", params![console_id, json])
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

/// Свёрнут/раскрыт; у консоли этого признака нет — молча ничего
pub fn set_node_expanded(id: &str, node_type: &str, is_expanded: bool) -> Result<(), String> {
    let table = match node_type {
        "workspace" => "workspaces",
        "project" => "projects",
        _ => return Ok(()),
    };

    execute(&format!("UPDATE {table} SET is_expanded = ?2 WHERE id = ?1"), params![id, is_expanded as i32])
}

/// Пометка «опасно» — есть у проекта и консоли
pub fn update_node_danger(id: &str, node_type: &str, is_danger: bool, danger_label: &str) -> Result<(), String> {
    let table = match node_type {
        "project" => "projects",
        "console" => "consoles",
        _ => return Err("Unknown node type".to_string()),
    };

    execute(
        &format!("UPDATE {table} SET is_danger = ?2, danger_label = ?3 WHERE id = ?1"),
        params![id, is_danger as i32, danger_label],
    )
}

// ══════════════════════════════════════════════
// Wiki
// ══════════════════════════════════════════════

/// Страницы узла: закреплённые сверху, затем свежие
pub fn load_wiki_pages(parent_type: &str, parent_id: &str) -> Result<Vec<WikiPage>, String> {
    query_all(
        &*conn()?,
        &format!("SELECT {WIKI_COLUMNS} FROM wiki_pages WHERE parent_type = ?1 AND parent_id = ?2 ORDER BY pinned DESC, updated_at DESC"),
        params![parent_type, parent_id],
        wiki_from_row,
    )
}

/// Все страницы — для экспорта
pub fn load_all_wiki_pages() -> Result<Vec<WikiPage>, String> {
    query_all(&*conn()?, &format!("SELECT {WIKI_COLUMNS} FROM wiki_pages ORDER BY created_at"), [], wiki_from_row)
}

/// До 50 лучших совпадений полнотекстового поиска
pub fn search_wiki_fts(query: &str) -> Result<Vec<WikiPage>, String> {
    let columns = WIKI_COLUMNS.split(", ").map(|c| format!("wp.{c}")).collect::<Vec<_>>().join(", ");

    query_all(
        &*conn()?,
        &format!("SELECT {columns} FROM wiki_pages wp JOIN wiki_fts ON wp.rowid = wiki_fts.rowid WHERE wiki_fts MATCH ?1 ORDER BY rank LIMIT 50"),
        params![query],
        wiki_from_row,
    )
}

/// Создать или обновить страницу и её запись в индексе поиска
pub fn upsert_wiki_page(page: &WikiPage) -> Result<(), String> {
    let db = conn()?;

    let tags_json = serde_json::to_string(&page.tags).unwrap_or_default();

    db.execute(
        &format!("INSERT OR REPLACE INTO wiki_pages ({WIKI_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"),
        params![page.id, page.parent_type, page.parent_id, page.title, page.content, tags_json, page.pinned as i32, page.created_at, page.updated_at],
    )
    .map_err(|e| e.to_string())?;

    db.execute(
        "INSERT OR REPLACE INTO wiki_fts(rowid, title, content, tags) SELECT rowid, title, content, tags FROM wiki_pages WHERE id = ?1",
        params![page.id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_wiki_page_by_id(id: &str) -> Result<(), String> {
    execute("DELETE FROM wiki_pages WHERE id = ?1", params![id])
}

pub fn delete_all_wiki_pages() -> Result<(), String> {
    execute("DELETE FROM wiki_pages", [])
}

// ══════════════════════════════════════════════
// Настройки
// ══════════════════════════════════════════════

/// Все настройки, кроме служебных `security.*` (хеш пароля не уходит
/// ни на фронт, ни в экспорт)
pub fn get_all_settings() -> Result<HashMap<String, String>, String> {
    let pairs = query_all(
        &*conn()?,
        "SELECT key, value FROM settings WHERE key NOT LIKE 'security.%'",
        [],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    )?;

    Ok(pairs.into_iter().collect())
}

/// Нет настройки или БД недоступна — `default`
pub fn get_setting_str(key: &str, default: &str) -> String {
    setting(key).unwrap_or_else(|| default.to_string())
}

/// "true" / "1" — да; нет настройки или БД недоступна — `default`
pub fn get_setting_bool(key: &str, default: bool) -> bool {
    setting(key).map_or(default, |v| v == "true" || v == "1")
}

pub fn set_setting_value(key: &str, value: &str) -> Result<(), String> {
    execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)", params![key, value])
}

// ══════════════════════════════════════════════
// AI-чаты
// ══════════════════════════════════════════════

pub fn create_ai_session(id: &str, title: &str, provider: &str, model: &str) -> Result<AiSession, String> {
    let now = now_local("%Y-%m-%dT%H:%M:%S");

    execute(
        "INSERT INTO ai_sessions (id, title, provider, model, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, title, provider, model, now],
    )?;

    Ok(AiSession {
        id: id.to_string(),
        title: title.to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Свежие сверху
pub fn load_ai_sessions() -> Result<Vec<AiSession>, String> {
    query_all(
        &*conn()?,
        "SELECT id, title, provider, model, created_at, updated_at FROM ai_sessions ORDER BY updated_at DESC",
        [],
        |row| {
            Ok(AiSession {
                id: row.get(0)?,
                title: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
}

pub fn rename_ai_session(id: &str, title: &str) -> Result<(), String> {
    execute(
        "UPDATE ai_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now_local("%Y-%m-%dT%H:%M:%S"), id],
    )
}

/// Вместе с сообщениями (каскад)
pub fn delete_ai_session(id: &str) -> Result<(), String> {
    execute("DELETE FROM ai_sessions WHERE id = ?1", params![id])
}

/// Вместе с сообщениями (каскад)
pub fn delete_all_ai_sessions() -> Result<(), String> {
    execute("DELETE FROM ai_sessions", [])
}

/// В порядке написания
pub fn load_ai_messages(session_id: &str) -> Result<Vec<AiMessage>, String> {
    query_all(
        &*conn()?,
        "SELECT id, session_id, role, content, created_at FROM ai_messages WHERE session_id = ?1 ORDER BY created_at ASC",
        params![session_id],
        |row| {
            Ok(AiMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    )
}

/// Сообщение + сессия поднимается наверх списка (updated_at)
pub fn save_ai_message(id: &str, session_id: &str, role: &str, content: &str) -> Result<AiMessage, String> {
    let db = conn()?;

    // Миллисекунды: сообщения одной секунды должны сортироваться в порядке записи
    let now = now_local("%Y-%m-%dT%H:%M:%S%.3f");

    db.execute(
        "INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, session_id, role, content, now],
    )
    .map_err(|e| e.to_string())?;

    db.execute("UPDATE ai_sessions SET updated_at = ?1 WHERE id = ?2", params![now, session_id])
        .map_err(|e| e.to_string())?;

    Ok(AiMessage {
        id: id.to_string(),
        session_id: session_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        created_at: now,
    })
}

/// Финальный текст после стриминга
pub fn update_ai_message_content(id: &str, content: &str) -> Result<(), String> {
    execute("UPDATE ai_messages SET content = ?1 WHERE id = ?2", params![content, id])
}

pub fn clear_ai_session_messages(session_id: &str) -> Result<(), String> {
    execute("DELETE FROM ai_messages WHERE session_id = ?1", params![session_id])
}

// ══════════════════════════════════════════════
// Статистика использования
// ══════════════════════════════════════════════

/// Пакетная запись приращений: value += value для каждой строки, одной транзакцией
pub fn record_usage_stats(entries: &[UsageStat]) -> Result<(), String> {
    let mut db = conn()?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO usage_stats (day, hour, console_id, project_id, metric, value)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(day, hour, console_id, metric) DO UPDATE SET value = value + excluded.value",
            )
            .map_err(|e| e.to_string())?;

        for e in entries.iter().filter(|e| is_valid_usage(e)) {
            stmt.execute(params![e.day, e.hour, e.console_id, e.project_id, e.metric, e.value])
                .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())
}

/// Все строки начиная с дня `since_day` (YYYY-MM-DD) — агрегирует фронт
pub fn get_usage_stats(since_day: &str) -> Result<Vec<UsageStat>, String> {
    let db = conn()?;

    prune_usage_stats(&db);

    query_all(
        &db,
        "SELECT day, hour, console_id, project_id, metric, value FROM usage_stats WHERE day >= ?1",
        params![since_day],
        |row| {
            Ok(UsageStat {
                day: row.get(0)?,
                hour: row.get(1)?,
                console_id: row.get(2)?,
                project_id: row.get(3)?,
                metric: row.get(4)?,
                value: row.get(5)?,
            })
        },
    )
}

pub fn clear_usage_stats() -> Result<(), String> {
    execute("DELETE FROM usage_stats", [])
}

// ══════════════════════════════════════════════
// Детали
// ══════════════════════════════════════════════

/// Шаги 1–2 init: Some — файл открыт и расшифрован (или создан); None — это не наш зашифрованный файл
fn open_encrypted(path: &Path) -> Result<Option<Connection>, rusqlite::Error> {
    let conn = Connection::open(path)?;

    // SQLCipher: ключ ОБЯЗАН быть первым PRAGMA до любых других операций
    conn.execute_batch(&format!("PRAGMA key='{}';", DB_KEY))?;

    // На незашифрованном (или чужом) файле первый же запрос падает
    let readable = conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)).is_ok();

    Ok(readable.then_some(conn))
}

/// Шаг 5 init. Не вышло — статистика просто полежит дольше.
fn prune_usage_stats(db: &Connection) {
    db.execute(
        "DELETE FROM usage_stats WHERE day < date('now', 'localtime', ?1)",
        params![format!("-{USAGE_KEEP_DAYS} days")],
    )
    .ok();
}

/// Мусор с фронта не пишем: день строго YYYY-MM-DD, час 0..23, приращение > 0
fn is_valid_usage(e: &UsageStat) -> bool {
    e.day.len() == 10 && (0..24).contains(&e.hour) && e.value > 0 && !e.metric.is_empty()
}

fn load_consoles(db: &Connection, project_id: &str) -> Result<Vec<ConsoleConfig>, String> {
    query_all(
        db,
        &format!("SELECT {CONSOLE_COLUMNS} FROM consoles WHERE project_id = ?1 ORDER BY sort_order"),
        params![project_id],
        console_from_row,
    )
}

/// INSERT OR REPLACE проекта (без консолей)
fn write_project(db: &Connection, proj: &Project) -> Result<(), String> {
    let env_json = serde_json::to_string(&proj.env_vars).unwrap_or_default();

    db.execute(
        &format!("INSERT OR REPLACE INTO projects ({PROJECT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"),
        params![proj.id, proj.workspace_id, proj.name, proj.icon, proj.color, proj.path, proj.default_shell, env_json, proj.sort_order, proj.is_expanded as i32, proj.is_danger as i32, proj.danger_label],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// INSERT OR REPLACE консоли со всеми полями
fn write_console(db: &Connection, con: &ConsoleConfig) -> Result<(), String> {
    let env_json = con.env_vars.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());

    let quick_json = serde_json::to_string(&con.quick_commands).unwrap_or_else(|_| "[]".to_string());

    db.execute(
        &format!("INSERT OR REPLACE INTO consoles ({CONSOLE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)"),
        params![con.id, con.project_id, con.name, con.shell_override, con.cwd_override, con.startup_cmd, env_json, con.sort_order, con.is_danger as i32, con.danger_label, con.connection_type, con.ssh_host, con.ssh_port, con.ssh_user, con.ssh_key_path, con.ssh_extra_args, con.ssh_passphrase, con.ssh_password, con.note, con.hosting, quick_json, con.icon, con.color],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn project_from_row(row: &Row) -> rusqlite::Result<Project> {
    let env_json: String = row.get(7)?;

    Ok(Project {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        name: row.get(2)?,
        icon: row.get(3)?,
        color: row.get(4)?,
        path: row.get(5)?,
        default_shell: row.get(6)?,
        env_vars: serde_json::from_str(&env_json).unwrap_or_default(),
        sort_order: row.get(8)?,
        is_expanded: row.get::<_, i32>(9)? != 0,
        is_danger: row.get::<_, i32>(10)? != 0,
        danger_label: row.get(11)?,
        consoles: Vec::new(),
    })
}

/// Колонки, добавленные миграциями, в старых строках могут быть NULL — читаем как значения по умолчанию
fn console_from_row(row: &Row) -> rusqlite::Result<ConsoleConfig> {
    let text = |i: usize| -> rusqlite::Result<String> { Ok(row.get::<_, Option<String>>(i)?.unwrap_or_default()) };

    let env_vars = row.get::<_, Option<String>>(6)?.and_then(|s| serde_json::from_str(&s).ok());

    let quick_commands = row
        .get::<_, Option<String>>(20)?
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

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
        ssh_host: text(11)?,
        ssh_port: row.get::<_, Option<i32>>(12)?.unwrap_or(22),
        ssh_user: text(13)?,
        ssh_key_path: text(14)?,
        ssh_extra_args: text(15)?,
        ssh_passphrase: text(16)?,
        ssh_password: text(17)?,
        note: text(18)?,
        hosting: text(19)?,
        quick_commands,
        icon: text(21)?,
        color: text(22)?,
    })
}

fn wiki_from_row(row: &Row) -> rusqlite::Result<WikiPage> {
    let tags_json: String = row.get(5)?;

    Ok(WikiPage {
        id: row.get(0)?,
        parent_type: row.get(1)?,
        parent_id: row.get(2)?,
        title: row.get(3)?,
        content: row.get(4)?,
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        pinned: row.get::<_, i32>(6)? != 0,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

/// Выполнить запрос и собрать строки; строку, которая не разобралась, пропускаем
fn query_all<T>(
    db: &Connection,
    sql: &str,
    params: impl Params,
    map: impl FnMut(&Row) -> rusqlite::Result<T>,
) -> Result<Vec<T>, String> {
    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;

    let rows: Vec<T> = stmt.query_map(params, map).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(rows)
}

/// Одна команда без результата
fn execute(sql: &str, params: impl Params) -> Result<(), String> {
    conn()?.execute(sql, params).map_err(|e| e.to_string())?;

    Ok(())
}

/// Значение настройки; None — нет такой или БД недоступна
fn setting(key: &str) -> Option<String> {
    let db = get_db().lock().ok()?;

    db.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0)).ok()
}

fn conn() -> Result<MutexGuard<'static, Connection>, String> {
    get_db().lock().map_err(|e| e.to_string())
}

fn get_db() -> &'static Mutex<Connection> {
    DB.get().expect("Database not initialized. Call db::init() first.")
}

fn now_local(format: &str) -> String {
    chrono::Local::now().format(format).to_string()
}

/// Файл БД; папка создаётся при первом обращении
fn db_path() -> PathBuf {
    // dirs::data_dir() возвращает:
    //   macOS:   ~/Library/Application Support/
    //   Linux:   ~/.local/share/
    //   Windows: C:\Users\<User>\AppData\Roaming\
    let dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("consoles-work");

    // Не создалась — Connection::open ниже вернёт понятную ошибку
    std::fs::create_dir_all(&dir).ok();

    dir.join("data.db")
}
