// lib.rs — нужен для Tauri 2.0 (библиотечная точка входа)
// Просто реэкспортирует run() из main.rs

mod commands;
mod db;
mod pty_manager;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            db::init()?;
            pty_manager::init(app.handle().clone());
            println!("✅ DevConsole Hub started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_workspaces,
            create_workspace,
            update_workspace,
            delete_workspace,
            create_project,
            delete_project,
            create_console,
            delete_console,
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
            load_wiki_pages,
            save_wiki_page,
            delete_wiki_page,
            search_wiki,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DevConsole Hub");
}
