// ══════════════════════════════════════════════════════════════════
// security.rs — пароль на вход в приложение
// ══════════════════════════════════════════════════════════════════
//
// Экран блокировки (LockScreen) и настройки пароля.
//
// set_password — установить, сменить или снять:
//  1. Пароль уже задан — нужен верный текущий, иначе отказ.
//  2. Пустой новый пароль снимает защиту; иначе сохраняется хеш нового.
// verify — «нет» и когда пароль не совпал, и когда он не задан; ошибка —
// только если сохранённый хеш испорчен.
//
// Пароль в БД не хранится: только необратимый Argon2id-хеш со случайной солью.
// Сама БД при этом зашифрована SQLCipher. Пароль — пока только UI-гейт: ключ БД
// от него не зависит (PLAN.md, этап 19).
//
// Ключи `security.*` закрыты от фронта: настройки их не отдают и не пишут,
// экспорт/импорт их не переносит.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

use crate::db;

/// Префикс служебных ключей, недоступных фронту напрямую
pub const PREFIX: &str = "security.";

/// Хеш в виде PHC-строки; пусто — пароль не задан
const KEY: &str = "security.passwordHash";

/// Задан ли пароль на вход
pub fn is_set() -> bool {
    !stored_hash().is_empty()
}

/// Проверка пароля. `false` — не задан или не совпал; `Err` — испорчен хеш
pub fn verify(password: &str) -> Result<bool, String> {
    let stored = stored_hash();

    if stored.is_empty() {
        return Ok(false);
    }

    let parsed = PasswordHash::new(&stored).map_err(|e| format!("Разбор хеша: {e}"))?;

    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

/// Установить, сменить или снять пароль (пустой `new_password`)
pub fn set_password(current: Option<String>, new_password: &str) -> Result<(), String> {
    // 1. Текущий пароль. Пустая строка — заведомо не пароль: пустой не сохраняется.
    if is_set() && !verify(current.as_deref().unwrap_or_default())? {
        return Err("Текущий пароль неверный".into());
    }

    // 2. Снять или сохранить новый.
    let stored = if new_password.is_empty() { String::new() } else { hash(new_password)? };

    db::set_setting_value(KEY, &stored)
}

/// Хешируем пароль Argon2id с новой случайной солью → PHC-строка
fn hash(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);

    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Argon2: {e}"))
}

fn stored_hash() -> String {
    db::get_setting_str(KEY, "")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_roundtrip() {
        let h = hash("s3cret").unwrap();

        assert!(h.starts_with("$argon2id"));

        let parsed = PasswordHash::new(&h).unwrap();

        assert!(Argon2::default().verify_password(b"s3cret", &parsed).is_ok());
        assert!(Argon2::default().verify_password(b"wrong", &parsed).is_err());
        assert_ne!(h, hash("s3cret").unwrap());
    }
}
