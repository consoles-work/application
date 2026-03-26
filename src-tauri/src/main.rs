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

// Подключаем публичные функции из модуля commands
use commands::*;

// ── Главная функция ──
// #[cfg_attr(...)] — это макрос (аннотация). Здесь он говорит:
// "на мобильных платформах сделай эту функцию доступной из библиотеки"
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri::Builder — паттерн "строитель" (builder pattern)
    // Каждый .method() добавляет конфигурацию и возвращает builder обратно
    tauri::Builder::default()
        // Подключаем плагин для запуска внешних процессов
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())

        // Инициализация при старте приложения
        .setup(|app| {
            // Инициализируем базу данных SQLite
            // `?` — если db::init() вернёт ошибку, setup тоже вернёт ошибку
            db::init()?;

            // Инициализируем менеджер PTY-сессий
            pty_manager::init(app.handle().clone());

            println!("✅ DevConsole Hub started successfully");
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
        ])

        // Запускаем приложение
        // .expect() — если произошла ошибка, завершить программу с сообщением
        .run(tauri::generate_context!())
        .expect("error while running DevConsole Hub");
}

// ── Точка входа ──
// Для десктопа — обычный main()
fn main() {
    run();
}
