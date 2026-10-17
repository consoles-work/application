// lib.rs — нужен для Tauri 2.0 (библиотечная точка входа)
// v2 — добавлена команда set_node_danger

mod commands;
mod db;
mod pty_manager;
mod export;
mod ai_local;
mod security;

use commands::*;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

pub static QUIT_DIALOG_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Должен быть первым плагином: второй экземпляр завершается сразу,
        // а уже запущенный показывает и фокусирует своё окно
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        // Размер, положение и «развёрнутость» окна переживают перезапуск.
        // VISIBLE не восстанавливаем: окно, спрятанное в трей, иначе стартовало бы невидимым
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .setup(|app| {
            db::init()?;
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
                    "quit" => confirm_quit(app),
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

            // Меню приложения: Cmd+Q через подтверждение выхода
            install_app_menu(app.handle(), &lang)?;
            app.on_menu_event(|app, event| {
                if event.id() == "app_quit" {
                    confirm_quit(app);
                }
            });

            println!("✅ consoles.work started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            set_console_quick_commands,
            record_quick_command_run,

            // Статистика использования
            record_usage_stats,
            get_usage_stats,
            clear_usage_stats,
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
            load_wiki_pages,
            save_wiki_page,
            delete_wiki_page,
            search_wiki,
            set_node_danger,
            set_node_expanded,
            clone_console,
            clone_project,
            get_settings,
            set_setting,
            is_password_set,
            verify_password,
            set_password,
            get_db_info,
            quit_app,
            reset_quit_dialog,
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
            export_data,
            save_text_file,
            preview_import,
            apply_import,
            move_console,
            enable_autostart,
            disable_autostart,
            get_autostart_status,
            update_tray_language,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let close_to_tray = db::get_setting_bool("ui.closeToTray", true);
                if close_to_tray {
                    let _ = window.hide();
                } else {
                    confirm_quit(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running consoles.work")
        // macOS: повторный запуск из «Программ»/Dock шлёт Reopen уже запущенному
        // процессу (single-instance не срабатывает) — показываем окно из трея
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                if let Some(w) = _app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        });
}
