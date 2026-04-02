// lib.rs — нужен для Tauri 2.0 (библиотечная точка входа)
// Просто реэкспортирует run() из main.rs
// v2 — добавлена команда set_node_danger

mod commands;
mod db;
mod pty_manager;
mod export;

use commands::*;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

static QUIT_DIALOG_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            db::init()?;
            pty_manager::init(app.handle().clone());
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
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if QUIT_DIALOG_ACTIVE.swap(true, Ordering::SeqCst) {
                    return;
                }
                let app = window.app_handle().clone();
                std::thread::spawn(move || {
                    let confirmed = app
                        .dialog()
                        .message("Are you sure you want to quit?")
                        .title("Quit")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::OkCancel)
                        .blocking_show();
                    QUIT_DIALOG_ACTIVE.store(false, Ordering::SeqCst);
                    if confirmed {
                        app.exit(0);
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running consoles.work");
}
