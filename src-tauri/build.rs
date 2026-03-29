fn main() {
    // Читаем .env файл из корня проекта (на уровень выше src-tauri/).
    // Это позволяет задать DB_ENCRYPTION_KEY в .env не экспортируя его вручную.
    // Формат: KEY=value (строки с # игнорируются)
    if let Ok(content) = std::fs::read_to_string("../.env") {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if let Some((k, v)) = line.split_once('=') {
                let k = k.trim();
                let v = v.trim().trim_matches('"').trim_matches('\'');
                // Не перезаписываем если уже задана в окружении
                if std::env::var(k).is_err() {
                    std::env::set_var(k, v);
                }
            }
        }
    }

    // DB_ENCRYPTION_KEY встраивается в бинарник при компиляции.
    // В рантайме переменная не нужна — ключ уже внутри .app/.exe.
    let key = std::env::var("DB_ENCRYPTION_KEY")
        .unwrap_or_else(|_| "devconsole-hub-dev-key-not-for-production-change-me".to_string());
    println!("cargo:rustc-env=DB_ENCRYPTION_KEY={}", key);
    tauri_build::build();
}
