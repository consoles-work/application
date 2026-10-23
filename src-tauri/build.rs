// Сборка: ключ шифрования БД встраивается в бинарник.
//  1. Переменные из ../.env подхватываются, если их нет в окружении, — ключ
//     можно держать в .env и не экспортировать руками.
//  2. DB_ENCRYPTION_KEY → константа db.rs. Нет ключа — dev-ключ (только для
//     разработки: релиз с ним открывается любой копией приложения).
//     В рантайме переменная не нужна — ключ уже внутри .app/.exe.

fn main() {
    // 1. .env (KEY=value, строки с # пропускаются).
    let env_file = std::fs::read_to_string("../.env").unwrap_or_default();

    for (key, value) in env_file.lines().filter_map(parse_env_line) {
        if std::env::var(key).is_err() {
            std::env::set_var(key, value);
        }
    }

    // 2. Ключ.
    let key = std::env::var("DB_ENCRYPTION_KEY")
        .unwrap_or_else(|_| "devconsole-hub-dev-key-not-for-production-change-me".to_string());

    println!("cargo:rustc-env=DB_ENCRYPTION_KEY={}", key);

    tauri_build::build();
}

/// Строка .env → (ключ, значение без кавычек); пустые строки и комментарии — None
fn parse_env_line(line: &str) -> Option<(&str, &str)> {
    let line = line.trim();

    if line.is_empty() || line.starts_with('#') {
        return None;
    }

    let (key, value) = line.split_once('=')?;

    Some((key.trim(), value.trim().trim_matches('"').trim_matches('\'')))
}
