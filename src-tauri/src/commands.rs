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
    note: Option<String>,
    hosting: Option<String>,
    icon: Option<String>,
    color: Option<String>,
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
        note: note.unwrap_or_default(),
        hosting: hosting.unwrap_or_default(),
        quick_commands: Vec::new(),
        icon: icon.unwrap_or_default(),
        color: color.unwrap_or_default(),
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
    note: Option<String>,
    hosting: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    crate::db::update_console_config_fields(
        &id, &name, startup_cmd.as_deref(),
        &connection_type, &ssh_host, ssh_port,
        &ssh_user, &ssh_key_path, &ssh_extra_args,
        &ssh_passphrase, &ssh_password,
        note.as_deref().unwrap_or_default(),
        hosting.as_deref().unwrap_or_default(),
        icon.as_deref().unwrap_or_default(),
        color.as_deref().unwrap_or_default(),
    )
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

// ══════════════════════════════════════════════
// Команды: статистика использования
// ══════════════════════════════════════════════

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
    // security.* меняются только через set_password (с проверкой текущего)
    if key.starts_with(crate::security::PREFIX) {
        return Err(format!("Key {key} is read-only"));
    }
    crate::db::set_setting_value(&key, &value)
}

// ══════════════════════════════════════════════
// Команды: Пароль на вход
// ══════════════════════════════════════════════

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

/// Записать текстовый файл по пути (публичный экспорт списка серверов в .md)
#[tauri::command]
pub fn save_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, content).map_err(|e| e.to_string())
}

/// Экспортировать данные в зашифрованный .dchub файл (пишет файл по пути)
#[tauri::command]
pub fn export_data(
    file_path: String,
    include_tree: bool,
    include_wiki: bool,
    include_ai: bool,
    include_settings: bool,
    user_password: Option<String>,
    workspace_ids: Option<Vec<String>>,
) -> Result<(), String> {
    let payload = crate::export::build_export_payload(
        include_tree,
        include_wiki,
        include_ai,
        include_settings,
        workspace_ids.as_deref(),
    )?;
    let json = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    let encrypted = crate::export::encrypt_export(&json, user_password.as_deref())?;
    std::fs::write(&file_path, &encrypted).map_err(|e| format!("Ошибка записи файла: {e}"))
}

/// Переместить консоль в другой проект
#[tauri::command]
pub fn move_console(id: String, target_project_id: String) -> Result<(), String> {
    crate::db::move_console(&id, &target_project_id)
}

/// Включить автозапуск при входе в систему
#[tauri::command]
pub fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().enable().map_err(|e| e.to_string())
}

/// Отключить автозапуск
#[tauri::command]
pub fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().disable().map_err(|e| e.to_string())
}

/// Получить текущий статус автозапуска
#[tauri::command]
pub fn get_autostart_status(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
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
    include_settings: bool,
    mode: String,
) -> Result<(), String> {
    let file_bytes = std::fs::read(&file_path).map_err(|e| format!("Ошибка чтения файла: {e}"))?;
    let decrypted = crate::export::decrypt_export(&file_bytes, user_password.as_deref())?;
    crate::export::apply_import(&decrypted, include_tree, include_wiki, include_ai, include_settings, &mode)
}

// ── Локализация трея ──

/// Возвращает локализованные надписи меню трея для заданного языка.
/// Используется как при старте (main.rs / lib.rs), так и в команде update_tray_language.
pub fn tray_labels(lang: &str) -> (&'static str, &'static str) {
    match lang {
        "en" => ("Open Consoles.work", "Quit"),
        "zh" => ("打开 Consoles.work", "退出"),
        "fr" => ("Ouvrir Consoles.work", "Quitter"),
        "kk" => ("Consoles.work ашу", "Шығу"),
        _    => ("Открыть Consoles.work", "Выход"),
    }
}

// ── Подтверждение выхода ──

/// Надписи диалога выхода: (заголовок, текст, «выйти», «отмена»)
fn quit_dialog_labels(lang: &str) -> (&'static str, &'static str, &'static str, &'static str) {
    match lang {
        "en" => ("Quit", "Are you sure you want to quit?\nAll open terminal sessions will be closed.", "Quit", "Cancel"),
        "zh" => ("退出", "确定要退出吗？\n所有打开的终端会话都将关闭。", "退出", "取消"),
        "fr" => ("Quitter", "Voulez-vous vraiment quitter ?\nToutes les sessions de terminal ouvertes seront fermées.", "Quitter", "Annuler"),
        "kk" => ("Шығу", "Шығуға сенімдісіз бе?\nБарлық ашық терминал сессиялары жабылады.", "Шығу", "Болдырмау"),
        _    => ("Выход", "Вы уверены, что хотите выйти?\nВсе открытые терминальные сессии будут закрыты.", "Выйти", "Отмена"),
    }
}

/// Спросить подтверждение и завершить приложение при согласии.
/// Единая точка для всех путей выхода: трей, Cmd+Q, закрытие окна без трея.
pub fn confirm_quit(app: &tauri::AppHandle) {
    use std::sync::atomic::Ordering;
    use tauri::Manager;
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    // Диалог уже на экране — второй не открываем
    if crate::QUIT_DIALOG_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }

    let (title, text, yes, no) = quit_dialog_labels(&crate::db::get_setting_str("ui.language", "ru"));
    let mut dialog = app.dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(yes.to_string(), no.to_string()));

    // Окно могло быть спрятано в трей — показываем, чтобы диалог было к чему привязать
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        dialog = dialog.parent(&w);
    }

    let handle = app.clone();
    dialog.show(move |confirmed| {
        if confirmed {
            handle.exit(0);
        } else {
            crate::QUIT_DIALOG_ACTIVE.store(false, Ordering::SeqCst);
        }
    });
}

/// macOS: штатный пункт «Quit» (Cmd+Q) из меню по умолчанию завершает процесс
/// напрямую, минуя приложение. Заменяем его своим пунктом с тем же
/// сочетанием клавиш, который идёт через confirm_quit.
pub fn install_app_menu(app: &tauri::AppHandle, lang: &str) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        use tauri::menu::{Menu, MenuItem, MenuItemKind};
        let (_, quit_label) = tray_labels(lang);
        let menu = Menu::default(app)?;
        if let Some(MenuItemKind::Submenu(app_submenu)) = menu.items()?.into_iter().next() {
            // Последний пункт подменю приложения — PredefinedMenuItem::quit
            if let Some(last) = app_submenu.items()?.last() {
                app_submenu.remove(last)?;
            }
            app_submenu.append(&MenuItem::with_id(app, "app_quit", quit_label, true, Some("CmdOrCtrl+Q"))?)?;
        }
        app.set_menu(menu)?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, lang);
    Ok(())
}

/// Обновить надписи меню системного трея при смене языка интерфейса.
#[tauri::command]
pub fn update_tray_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let (show_label, quit_label) = tray_labels(&lang);
    if let Some(tray) = app.tray_by_id("main_tray") {
        if let (Ok(show_item), Ok(sep), Ok(quit_item)) = (
            MenuItem::with_id(&app, "show", show_label, true, None::<&str>),
            PredefinedMenuItem::separator(&app),
            MenuItem::with_id(&app, "quit", quit_label, true, None::<&str>),
        ) {
            if let Ok(menu) = Menu::with_items(&app, &[&show_item, &sep, &quit_item]) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
    let _ = install_app_menu(&app, &lang);
    Ok(())
}

// ══════════════════════════════════════════════
// Команды: локальный AI-движок (Claude Code CLI)
// ══════════════════════════════════════════════

/// Найти бинарь `claude` в системе. Возвращает путь или null.
#[tauri::command]
pub fn ai_detect_bin() -> Option<String> {
    crate::ai_local::detect_bin()
}

/// Проверить бинарь: путь + `--version`. Токены не расходуются.
#[tauri::command]
pub fn ai_check(bin: Option<String>) -> Result<String, String> {
    crate::ai_local::check(bin)
}

/// Запустить генерацию. Возвращается сразу — ответ приходит событиями
/// `ai://chunk`, `ai://done`, `ai://error` с полем `sessionId`.
#[tauri::command]
pub fn ai_run(
    app: tauri::AppHandle,
    session_id: String,
    model: String,
    system: String,
    prompt: String,
) -> Result<(), String> {
    crate::ai_local::run(app, session_id, model, system, prompt)
}

/// Прервать генерацию: убивает процесс сессии.
#[tauri::command]
pub fn ai_cancel(session_id: String) -> Result<(), String> {
    crate::ai_local::cancel(&session_id)
}
