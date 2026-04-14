// lib.rs — нужен для Tauri 2.0 (библиотечная точка входа)
// v2 — добавлена команда set_node_danger

mod commands;
mod db;
mod pty_manager;
mod export;

use commands::*;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

#[allow(dead_code)]
pub static QUIT_DIALOG_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
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
            export_data,
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
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running consoles.work");
}
