// ══════════════════════════════════════════════════════════════════
// lib.rs — сборка приложения: модули, плагины, команды
// ══════════════════════════════════════════════════════════════════
//
// Единственная точка сборки: десктоп (main.rs) и мобильные платформы
// вызывают run(). Новая Tauri-команда регистрируется только здесь.
//
// run:
//  1. Плагины. Single-instance — первым: второй экземпляр завершается сразу,
//     а уже запущенный показывает своё окно.
//  2. При старте: БД, менеджер терминалов, трей и меню приложения.
//     БД не открылась — приложение не запускается.
//  3. Команды для фронта.
//  4. Закрытие окна и события ОС — в app_shell.

mod ai_local;
mod app_shell;
mod commands;
mod db;
mod export;
mod pty_manager;
mod security;
mod ssh_keys;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 1. Плагины.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| app_shell::show_main_window(app)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        // Размер, положение и «развёрнутость» окна переживают перезапуск.
        // VISIBLE не восстанавливаем: окно, спрятанное в трей, иначе стартовало бы невидимым
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all() - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        // 2. Старт.
        .setup(|app| {
            db::init()?;

            pty_manager::init(app.handle().clone());

            app_shell::install(app.handle())?;

            println!("✅ consoles.work started successfully");

            Ok(())
        })
        // 3. Команды — invoke("имя_команды", { аргументы }) из src/lib/tauriCommands.ts.
        .invoke_handler(tauri::generate_handler![
            // Дерево проектов
            load_workspaces,
            create_workspace,
            update_workspace,
            delete_workspace,
            create_project,
            update_project,
            delete_project,
            clone_project,
            create_console,
            update_console,
            update_console_config,
            delete_console,
            clone_console,
            move_console,
            set_console_quick_commands,
            record_quick_command_run,
            set_node_danger,
            set_node_expanded,

            // Статистика использования
            record_usage_stats,
            get_usage_stats,
            clear_usage_stats,

            // SSH-ключи
            scan_ssh_keys,
            inspect_ssh_key,
            fix_ssh_permissions,
            generate_ssh_key,

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

            // Настройки и пароль на вход
            get_settings,
            set_setting,
            get_db_info,
            is_password_set,
            verify_password,
            set_password,

            // AI чат-сессии
            create_ai_session,
            load_ai_sessions,
            rename_ai_session,
            delete_ai_session,
            load_ai_messages,
            save_ai_message,
            update_ai_message,
            clear_ai_session,

            // Локальный AI-движок (claude CLI)
            ai_detect_bin,
            ai_check,
            ai_run,
            ai_cancel,

            // Экспорт/импорт
            save_text_file,
            export_data,
            preview_import,
            apply_import,

            // Приложение
            quit_app,
            reset_quit_dialog,
            update_tray_language,
            enable_autostart,
            disable_autostart,
            get_autostart_status,
        ])
        // 4. Окно и ОС.
        .on_window_event(app_shell::on_window_event)
        .build(tauri::generate_context!())
        .expect("error while running consoles.work")
        .run(app_shell::on_run_event);
}
