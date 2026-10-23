// ══════════════════════════════════════════════════════════════════
// commands.rs — Tauri IPC команды
// ══════════════════════════════════════════════════════════════════
//
// Фасад для фронта: каждая команда принимает аргументы из invoke() и вызывает
// модуль, где живёт процесс (db, pty_manager, export, ssh_keys, ai_local,
// security, app_shell). Типы здесь — зеркало src/types/index.ts.
// Регистрация команд — в lib.rs; TS-обёртки — в src/lib/tauriCommands.ts.
//
// Rust-новичкам:
// - `String` — строка (как string в TS)
// - `Vec<T>` — массив (как Array<T> в TS)
// - `Option<T>` — может быть значение или null (как T | null в TS)
// - `Result<T, E>` — успех или ошибка (как Promise<T> в TS)
// - `serde` — библиотека для JSON сериализации (как JSON.parse/stringify)
// - `#[serde(rename_all = "camelCase")]` — поля в JSON будут camelCase

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

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
    /// Произвольная заметка к подключению
    #[serde(default)]
    pub note: String,
    /// Где хостится сервер (провайдер/дата-центр), необязательно
    #[serde(default)]
    pub hosting: String,
    /// Кнопки быстрых команд (панель под терминалом)
    #[serde(default)]
    pub quick_commands: Vec<QuickCommand>,
    /// Иконка консоли в дереве (ключ набора: "server", "database", ...), пусто — по типу подключения
    #[serde(default)]
    pub icon: String,
    /// Цвет иконки (ключ палитры: "red", "green", ...), пусто — обычный
    #[serde(default)]
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCommand {
    pub id: String,
    pub label: String,
    pub command: String,
    #[serde(default)]
    pub description: String,
    /// Цвет кнопки (ключ палитры: "red", "green", ...), пусто — обычная
    #[serde(default)]
    pub color: String,
    /// Спрашивать подтверждение перед выполнением
    #[serde(default)]
    pub confirm: bool,
    /// Сколько раз команду запускали кнопкой
    #[serde(default)]
    pub run_count: u64,
    /// Сколько символов не пришлось набирать руками (сумма по всем запускам)
    #[serde(default)]
    pub saved_chars: u64,
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

/// Поля проекта из диалога создания / настроек
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFields {
    pub name: String,
    pub icon: String,
    pub color: String,
    pub path: String,
    pub default_shell: String,
}

/// Поля консоли из диалога создания / настроек; не переданные — значения новой консоли
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ConsoleFields {
    pub name: String,
    pub startup_cmd: Option<String>,
    /// "local" | "ssh"
    pub connection_type: String,
    pub ssh_host: String,
    pub ssh_port: i32,
    pub ssh_user: String,
    pub ssh_key_path: String,
    pub ssh_extra_args: String,
    pub ssh_passphrase: String,
    pub ssh_password: String,
    pub note: String,
    pub hosting: String,
    pub icon: String,
    pub color: String,
}

impl Default for ConsoleFields {
    fn default() -> Self {
        Self {
            name: String::new(),
            startup_cmd: None,
            connection_type: "local".to_string(),
            ssh_host: String::new(),
            ssh_port: 22,
            ssh_user: String::new(),
            ssh_key_path: String::new(),
            ssh_extra_args: String::new(),
            ssh_passphrase: String::new(),
            ssh_password: String::new(),
            note: String::new(),
            hosting: String::new(),
            icon: String::new(),
            color: String::new(),
        }
    }
}

/// Одна строка статистики: приращение (при записи) или накопленное значение (при чтении)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStat {
    /// Локальная дата YYYY-MM-DD
    pub day: String,
    /// Локальный час 0..23
    pub hour: i64,
    /// '' — метрика уровня приложения
    #[serde(default)]
    pub console_id: String,
    #[serde(default)]
    pub project_id: String,
    pub metric: String,
    pub value: i64,
}

// ══════════════════════════════════════════════
// Команды: дерево проектов
// ══════════════════════════════════════════════

/// Все воркспейсы с проектами и консолями
#[tauri::command]
pub fn load_workspaces() -> Result<Vec<Workspace>, String> {
    crate::db::load_all_workspaces()
}

#[tauri::command]
pub fn create_workspace(name: String, icon: String, color: String) -> Result<Workspace, String> {
    let workspace = Workspace {
        id: uuid::Uuid::new_v4().to_string(),
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

#[tauri::command]
pub fn update_workspace(id: String, name: String, icon: String, color: String) -> Result<(), String> {
    crate::db::update_workspace_fields(&id, &name, &icon, &color)
}

/// Вместе со всем содержимым
#[tauri::command]
pub fn delete_workspace(id: String) -> Result<(), String> {
    crate::db::delete_workspace_cascade(&id)
}

#[tauri::command]
pub fn create_project(workspace_id: String, fields: ProjectFields) -> Result<Project, String> {
    let project = Project {
        id: uuid::Uuid::new_v4().to_string(),
        workspace_id,
        name: fields.name,
        icon: fields.icon,
        color: fields.color,
        path: fields.path,
        default_shell: fields.default_shell,
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

#[tauri::command]
pub fn update_project(id: String, fields: ProjectFields) -> Result<(), String> {
    crate::db::update_project_fields(&id, &fields)
}

/// Вместе с консолями
#[tauri::command]
pub fn delete_project(id: String) -> Result<(), String> {
    crate::db::delete_project_cascade(&id)
}

/// Дублировать проект со всеми консолями
#[tauri::command]
pub fn clone_project(id: String) -> Result<Project, String> {
    crate::db::clone_project_by_id(&id)
}

#[tauri::command]
pub fn create_console(project_id: String, fields: ConsoleFields) -> Result<ConsoleConfig, String> {
    let console = ConsoleConfig {
        id: uuid::Uuid::new_v4().to_string(),
        project_id,
        name: fields.name,
        shell_override: None,
        cwd_override: None,
        startup_cmd: fields.startup_cmd,
        env_vars: None,
        sort_order: 0,
        is_danger: false,
        danger_label: "PRODUCTION".to_string(),
        connection_type: fields.connection_type,
        ssh_host: fields.ssh_host,
        ssh_port: fields.ssh_port,
        ssh_user: fields.ssh_user,
        ssh_key_path: fields.ssh_key_path,
        ssh_extra_args: fields.ssh_extra_args,
        ssh_passphrase: fields.ssh_passphrase,
        ssh_password: fields.ssh_password,
        note: fields.note,
        hosting: fields.hosting,
        quick_commands: Vec::new(),
        icon: fields.icon,
        color: fields.color,
    };

    crate::db::save_console(&console)?;

    Ok(console)
}

/// Только имя (переименование в дереве)
#[tauri::command]
pub fn update_console(id: String, name: String) -> Result<(), String> {
    crate::db::update_console_name(&id, &name)
}

/// Все поля из диалога настроек консоли
#[tauri::command]
pub fn update_console_config(id: String, fields: ConsoleFields) -> Result<(), String> {
    crate::db::update_console_config_fields(&id, &fields)
}

#[tauri::command]
pub fn delete_console(id: String) -> Result<(), String> {
    crate::db::delete_console_by_id(&id)
}

/// Дублировать консоль (копия с именем "{имя} (copy)")
#[tauri::command]
pub fn clone_console(id: String) -> Result<ConsoleConfig, String> {
    crate::db::clone_console_by_id(&id)
}

#[tauri::command]
pub fn move_console(id: String, target_project_id: String) -> Result<(), String> {
    crate::db::move_console(&id, &target_project_id)
}

/// Заменить список быстрых команд консоли целиком
#[tauri::command]
pub fn set_console_quick_commands(id: String, commands: Vec<QuickCommand>) -> Result<(), String> {
    crate::db::set_console_quick_commands(&id, &commands)
}

/// Учесть запуск быстрой команды (счётчик + «сэкономленные» символы), вернуть обновлённую команду
#[tauri::command]
pub fn record_quick_command_run(console_id: String, command_id: String) -> Result<QuickCommand, String> {
    crate::db::record_quick_command_run(&console_id, &command_id)
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

// ══════════════════════════════════════════════
// Команды: статистика использования
// ══════════════════════════════════════════════

#[tauri::command]
pub fn record_usage_stats(entries: Vec<UsageStat>) -> Result<(), String> {
    crate::db::record_usage_stats(&entries)
}

#[tauri::command]
pub fn get_usage_stats(since_day: String) -> Result<Vec<UsageStat>, String> {
    crate::db::get_usage_stats(&since_day)
}

#[tauri::command]
pub fn clear_usage_stats() -> Result<(), String> {
    crate::db::clear_usage_stats()
}

// ══════════════════════════════════════════════
// Команды: SSH-ключи (локальный аудит, к серверам не подключаемся)
// ══════════════════════════════════════════════

// async — не в главном потоке: ssh-add и чтение файлов не должны подвешивать окно

/// Скан ~/.ssh, ~/.ssh/config и ssh-agent; `extra_paths` — ключи из консолей
#[tauri::command]
pub async fn scan_ssh_keys(extra_paths: Vec<String>) -> crate::ssh_keys::SshKeysReport {
    crate::ssh_keys::scan(&extra_paths)
}

/// Сведения об одном ключе — подсказка под полем ключа в форме консоли
#[tauri::command]
pub async fn inspect_ssh_key(path: String) -> crate::ssh_keys::SshKeyFile {
    crate::ssh_keys::inspect(&path)
}

/// chmod 600 на приватный ключ / 700 на ~/.ssh
#[tauri::command]
pub fn fix_ssh_permissions(path: String) -> Result<(), String> {
    crate::ssh_keys::fix_permissions(&path)
}

/// Новый ED25519-ключ в ~/.ssh (шифрование passphrase через bcrypt-pbkdf — около секунды)
#[tauri::command]
pub async fn generate_ssh_key(name: String, comment: String, passphrase: String) -> Result<crate::ssh_keys::SshKeyFile, String> {
    crate::ssh_keys::generate(&name, &comment, &passphrase)
}

// ══════════════════════════════════════════════
// Команды: PTY (терминал)
// ══════════════════════════════════════════════

/// Запустить терминал консоли; возвращает id сессии для write/resize/kill
#[tauri::command]
pub fn spawn_pty(request: crate::pty_manager::SpawnRequest) -> Result<u32, String> {
    crate::pty_manager::spawn(request)
}

/// Ввод пользователя
#[tauri::command]
pub fn write_to_pty(pty_id: u32, data: String) -> Result<(), String> {
    crate::pty_manager::write(pty_id, data)
}

#[tauri::command]
pub fn resize_pty(pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    crate::pty_manager::resize(pty_id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(pty_id: u32) -> Result<(), String> {
    crate::pty_manager::kill(pty_id)
}

// ══════════════════════════════════════════════
// Команды: Wiki
// ══════════════════════════════════════════════

/// Страницы узла дерева (или глобальные)
#[tauri::command]
pub fn load_wiki_pages(parent_type: String, parent_id: String) -> Result<Vec<WikiPage>, String> {
    crate::db::load_wiki_pages(&parent_type, &parent_id)
}

/// Создать или обновить
#[tauri::command]
pub fn save_wiki_page(page: WikiPage) -> Result<(), String> {
    crate::db::upsert_wiki_page(&page)
}

#[tauri::command]
pub fn delete_wiki_page(id: String) -> Result<(), String> {
    crate::db::delete_wiki_page_by_id(&id)
}

/// Полнотекстовый поиск
#[tauri::command]
pub fn search_wiki(query: String) -> Result<Vec<WikiPage>, String> {
    crate::db::search_wiki_fts(&query)
}

// ══════════════════════════════════════════════
// Команды: настройки и пароль на вход
// ══════════════════════════════════════════════

/// Все настройки, кроме служебных
#[tauri::command]
pub fn get_settings() -> Result<HashMap<String, String>, String> {
    crate::db::get_all_settings()
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), String> {
    // security.* меняются только через set_password (с проверкой текущего)
    if key.starts_with(crate::security::PREFIX) {
        return Err(format!("Key {key} is read-only"));
    }

    crate::db::set_setting_value(&key, &value)
}

#[tauri::command]
pub fn get_db_info() -> DbInfo {
    crate::db::get_db_info_data()
}

#[tauri::command]
pub fn is_password_set() -> bool {
    crate::security::is_set()
}

#[tauri::command]
pub fn verify_password(password: String) -> Result<bool, String> {
    crate::security::verify(&password)
}

/// Установка / смена / снятие (пустой `new_password`) пароля
#[tauri::command]
pub fn set_password(current: Option<String>, new_password: String) -> Result<(), String> {
    crate::security::set_password(current, &new_password)
}

// ══════════════════════════════════════════════
// Команды: AI чат-сессии
// ══════════════════════════════════════════════

#[tauri::command]
pub fn create_ai_session(title: String, provider: String, model: String) -> Result<AiSession, String> {
    crate::db::create_ai_session(&uuid::Uuid::new_v4().to_string(), &title, &provider, &model)
}

/// Список сессий без сообщений
#[tauri::command]
pub fn load_ai_sessions() -> Result<Vec<AiSession>, String> {
    crate::db::load_ai_sessions()
}

#[tauri::command]
pub fn rename_ai_session(id: String, title: String) -> Result<(), String> {
    crate::db::rename_ai_session(&id, &title)
}

/// Вместе с сообщениями
#[tauri::command]
pub fn delete_ai_session(id: String) -> Result<(), String> {
    crate::db::delete_ai_session(&id)
}

#[tauri::command]
pub fn load_ai_messages(session_id: String) -> Result<Vec<AiMessage>, String> {
    crate::db::load_ai_messages(&session_id)
}

#[tauri::command]
pub fn save_ai_message(id: String, session_id: String, role: String, content: String) -> Result<AiMessage, String> {
    crate::db::save_ai_message(&id, &session_id, &role, &content)
}

/// Финальный текст после стриминга
#[tauri::command]
pub fn update_ai_message(id: String, content: String) -> Result<(), String> {
    crate::db::update_ai_message_content(&id, &content)
}

/// Удалить все сообщения сессии
#[tauri::command]
pub fn clear_ai_session(session_id: String) -> Result<(), String> {
    crate::db::clear_ai_session_messages(&session_id)
}

// ══════════════════════════════════════════════
// Команды: локальный AI-движок (Claude Code CLI)
// ══════════════════════════════════════════════

/// Путь к бинарю `claude` или null
#[tauri::command]
pub fn ai_detect_bin() -> Option<String> {
    crate::ai_local::detect_bin()
}

/// Путь + `--version`. Токены не расходуются.
#[tauri::command]
pub fn ai_check(bin: Option<String>) -> Result<String, String> {
    crate::ai_local::check(bin)
}

/// Возвращается сразу — ответ приходит событиями `ai://chunk`, `ai://done`,
/// `ai://error` с полем `sessionId`
#[tauri::command]
pub fn ai_run(app: tauri::AppHandle, request: crate::ai_local::RunRequest) -> Result<(), String> {
    crate::ai_local::run(app, request)
}

/// Прервать генерацию: убивает процесс сессии
#[tauri::command]
pub fn ai_cancel(session_id: String) -> Result<(), String> {
    crate::ai_local::cancel(&session_id)
}

// ══════════════════════════════════════════════
// Команды: экспорт/импорт
// ══════════════════════════════════════════════

/// Записать текстовый файл по пути (публичный экспорт списка серверов в .md)
#[tauri::command]
pub fn save_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, content).map_err(|e| e.to_string())
}

/// Экспорт в зашифрованный .dchub; `workspace_ids` пусто — все воркспейсы
#[tauri::command]
pub fn export_data(
    file_path: String,
    sections: crate::export::Sections,
    user_password: Option<String>,
    workspace_ids: Option<Vec<String>>,
) -> Result<(), String> {
    crate::export::export_to_file(&file_path, sections, user_password.as_deref(), workspace_ids.as_deref())
}

/// Расшифровать файл и вернуть превью (без применения к БД)
#[tauri::command]
pub fn preview_import(file_path: String, user_password: Option<String>) -> Result<crate::export::ImportPreview, String> {
    crate::export::preview_file(&file_path, user_password.as_deref())
}

#[tauri::command]
pub fn apply_import(
    file_path: String,
    user_password: Option<String>,
    sections: crate::export::Sections,
    mode: crate::export::ImportMode,
) -> Result<(), String> {
    crate::export::import_file(&file_path, user_password.as_deref(), sections, mode)
}

// ══════════════════════════════════════════════
// Команды: приложение (выход, автозапуск, язык трея)
// ══════════════════════════════════════════════

/// Завершить приложение (после подтверждения во фронте)
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Ответ «Нет» в диалоге выхода
#[tauri::command]
pub fn reset_quit_dialog() {
    crate::app_shell::reset_quit_dialog();
}

/// Надписи трея и меню приложения на новом языке интерфейса
#[tauri::command]
pub fn update_tray_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    crate::app_shell::set_language(&app, &lang);

    Ok(())
}

/// Автозапуск при входе в систему
#[tauri::command]
pub fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    app.autolaunch().enable().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    app.autolaunch().disable().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_autostart_status(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}
