// ══════════════════════════════════════════════════════════════════
// security.rs — пароль на вход в приложение
// ══════════════════════════════════════════════════════════════════
//
// Пароль в БД не хранится в открытом виде: держим только необратимый
// Argon2id-хеш (PHC-строка со случайной солью) в таблице settings под ключом
// `security.passwordHash`. Сама БД при этом зашифрована SQLCipher.
// Пустое значение / отсутствие ключа == пароль не задан (вход сразу).
//
// Ключи `security.*` закрыты от фронта: get_all_settings их не отдаёт,
// set_setting их не пишет, экспорт/импорт их не переносит (см. db.rs).

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

use crate::db;

/// Префикс служебных ключей, недоступных фронту напрямую
pub const PREFIX: &str = "security.";
const KEY: &str = "security.passwordHash";

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

/// Задан ли пароль на вход
pub fn is_set() -> bool {
    !stored_hash().is_empty()
}

/// Проверка пароля. `false` — не задан или не совпал; `Err` — испорчен хеш
pub fn verify(password: &str) -> Result<bool, String> {
    let h = stored_hash();
    if h.is_empty() {
        return Ok(false);
    }
    let parsed = PasswordHash::new(&h).map_err(|e| format!("Разбор хеша: {e}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Установка / смена / снятие пароля:
/// - если пароль уже задан, требуется верный `current`;
/// - пустой `new_password` снимает защиту;
/// - иначе сохраняем свежий хеш.
pub fn set_password(current: Option<String>, new_password: &str) -> Result<(), String> {
    if is_set() {
        let ok = match &current {
            Some(c) => verify(c)?,
            None => false,
        };
        if !ok {
            return Err("Текущий пароль неверный".into());
        }
    }
    if new_password.is_empty() {
        db::set_setting_value(KEY, "")
    } else {
        db::set_setting_value(KEY, &hash(new_password)?)
    }
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
