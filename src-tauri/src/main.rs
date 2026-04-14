// ══════════════════════════════════════════════════════════════════
// main.rs — Точка входа Tauri-приложения
// ══════════════════════════════════════════════════════════════════
//
// Это файл, с которого начинается Rust-часть приложения.
// Если ты никогда не видел Rust — вот ключевые моменты:
//
// 1. `use` — это как `import` в JS/TS
// 2. `fn` — объявление функции (function)
// 3. `let` — объявление переменной (но по умолчанию immutable!)
//    `let mut` — mutable переменная
// 4. `->` после аргументов — тип возвращаемого значения
// 5. `Result<T, E>` — либо успех (Ok(T)), либо ошибка (Err(E))
//    это как try/catch, но встроенный в систему типов
// 6. `?` в конце выражения — "если ошибка, верни её наверх"
//    (сокращение для match Ok/Err)

// Подключаем наши модули (файлы в этой же папке)
mod commands;  // src/commands.rs — обработчики IPC-вызовов из JS
mod db;        // src/db.rs — работа с SQLite
mod pty_manager; // src/pty_manager.rs — управление терминальными сессиями
mod export;    // src/export.rs — экспорт/импорт .dchub

// Подключаем публичные функции из модуля commands
use commands::*;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

#[allow(dead_code)]
pub static QUIT_DIALOG_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// ── Главная функция ──
// #[cfg_attr(...)] — это макрос (аннотация). Здесь он говорит:
// "на мобильных платформах сделай эту функцию доступной из библиотеки"
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri::Builder — паттерн "строитель" (builder pattern)
    // Каждый .method() добавляет конфигурацию и возвращает builder обратно
    tauri::Builder::default()
        // Подключаем плагины
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))

        // Инициализация при старте приложения
        .setup(|app| {
            // Инициализируем базу данных SQLite
            db::init()?;

            // Инициализируем менеджер PTY-сессий
            pty_manager::init(app.handle().clone());

            // ── Системный трей (надписи берём из языка пользователя) ──
            let lang = db::get_setting_str("ui.language", "ru");
            let (show_label, quit_label) = tray_labels(&lang);
            let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &sep, &quit_item])?;

            TrayIconBuilder::with_id("main_tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            println!("✅ consoles.work started successfully");
            Ok(())
        })

        // Регистрируем команды, которые можно вызывать из JavaScript
        // через invoke("имя_команды", { аргументы })
        .invoke_handler(tauri::generate_handler![
            // Дерево проектов
            load_workspaces,
            create_workspace,
            update_workspace,
            delete_workspace,
            create_project,
            update_project,
            delete_project,
            create_console,
            update_console,
            update_console_config,
            delete_console,

            // PTY (терминал)
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty,

            // Wiki
            load_wiki_pages,
            save_wiki_page,
            delete_wiki_page,
            search_wiki,

            // Утилиты
            set_node_danger,
            set_node_expanded,

            // Клонирование
            clone_console,
            clone_project,

            // Настройки
            get_settings,
            set_setting,
            get_db_info,
            quit_app,
            reset_quit_dialog,

            // AI чат-сессии
            create_ai_session,
            load_ai_sessions,
            rename_ai_session,
            delete_ai_session,
            load_ai_messages,
            save_ai_message,
            update_ai_message,
            clear_ai_session,

            // Экспорт/импорт
            export_data,
            preview_import,
            apply_import,

            // Перемещение консоли
            move_console,

            // Автозапуск
            enable_autostart,
            disable_autostart,
            get_autostart_status,

            // Локализация трея
            update_tray_language,
        ])

        // Перехватываем закрытие окна
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let close_to_tray = db::get_setting_bool("ui.closeToTray", true);
                if close_to_tray {
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })

        // Запускаем приложение
        // .expect() — если произошла ошибка, завершить программу с сообщением
        .run(tauri::generate_context!())
        .expect("error while running consoles.work");
}

// ── Точка входа ──
// Для десктопа — обычный main()
fn main() {
    run();
}
