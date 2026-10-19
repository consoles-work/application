// ══════════════════════════════════════════════════════════════════
// ssh_keys.rs — раздел «SSH-ключи»: инвентаризация и аудит
// ══════════════════════════════════════════════════════════════════
//
// Только локальное чтение: ~/.ssh, файлы ключей из консолей и IdentityFile,
// ~/.ssh/config (+ Include), `ssh-add -l`. К серверам не подключаемся.
//
// Запись — только по явному действию пользователя:
//   - fix_permissions — chmod 600 на файл ключа / 700 на ~/.ssh;
//   - generate — новый ED25519 в ~/.ssh (существующие файлы не трогаем).
//
// Разбор ключей — крейтом `ssh-key`, без ssh-keygen: не нужен внешний процесс,
// а passphrase нового ключа не попадает в аргументы процесса (видны в `ps`).

use serde::Serialize;
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

// Приватные ключи и .pub — маленькие файлы; всё, что больше, ключом не считаем
const MAX_KEY_FILE: u64 = 64 * 1024;
// Глубина вложенных Include в ~/.ssh/config (у OpenSSH — 16)
const MAX_INCLUDE_DEPTH: usize = 8;
// Имена ключей, которые ssh пробует сам, если IdentityFile не задан
const DEFAULT_IDENTITIES: &[&str] = &["id_rsa", "id_ecdsa", "id_ecdsa_sk", "id_ed25519", "id_ed25519_sk", "id_dsa"];
// Файлы в ~/.ssh, которые точно не ключи
const NOT_KEYS: &[&str] = &["config", "known_hosts", "known_hosts.old", "authorized_keys", "authorized_keys2", "environment", "rc"];

// ── Типы (зеркало src/types/index.ts) ──

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyFile {
    /// Абсолютный путь к приватному ключу (без `.pub`) — идентификатор ключа
    pub path: String,
    /// Тот же путь с `~` вместо домашней папки
    pub display_path: String,
    pub name: String,
    pub private_exists: bool,
    pub public_exists: bool,
    pub in_ssh_dir: bool,
    /// "ED25519" | "RSA" | "ECDSA" | "DSA" | "ED25519-SK" | "ECDSA-SK" | "" (не распознан)
    pub key_type: String,
    pub bits: u32,
    /// "SHA256:…", пусто — если ни публичный, ни приватный ключ не разобрались
    pub fingerprint: String,
    pub comment: String,
    /// Строка публичного ключа в формате OpenSSH (для копирования)
    pub public_key: String,
    /// Зашифрован ли приватный ключ passphrase; None — нет приватного или формат неизвестен
    pub encrypted: Option<bool>,
    /// "openssh" | "pem" | "pkcs8" | "unknown" | "" (нет приватного)
    pub private_format: String,
    pub agent_loaded: bool,
    /// Рядом лежит сертификат `<имя>-cert.pub`
    pub has_certificate: bool,
    /// Права приватного ключа (unix, младшие 9 бит)
    pub mode: Option<u32>,
    /// Время изменения файла, секунды unix
    pub modified: Option<i64>,
    /// Визуальный отпечаток в раскладке `ssh-keygen -lv`
    pub randomart: String,
    /// Что не удалось прочитать или разобрать
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigHost {
    /// Шаблоны строки `Host` (или текст условия `Match`)
    pub patterns: Vec<String>,
    /// Блок до первого Host/Match — действует на все хосты
    pub is_global: bool,
    pub is_match: bool,
    /// Файл (с `~`) и строка, где начинается блок
    pub file: String,
    pub line: u32,
    pub host_name: String,
    pub user: String,
    pub port: String,
    /// IdentityFile как написано и раскрытый абсолютный путь (пусто — есть %-токены)
    pub identity_files: Vec<SshConfigIdentity>,
    /// Значение ForwardAgent как написано (yes / no / путь к сокету), пусто — не задано
    pub forward_agent: String,
    pub strict_host_key_checking: String,
    pub user_known_hosts_file: String,
    pub identities_only: String,
    pub password_authentication: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigIdentity {
    pub raw: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshKeysReport {
    pub home: String,
    pub ssh_dir: String,
    pub ssh_dir_exists: bool,
    pub ssh_dir_mode: Option<u32>,
    pub keys: Vec<SshKeyFile>,
    pub config_path: String,
    pub config_exists: bool,
    pub config_hosts: Vec<SshConfigHost>,
    /// "ok" | "empty" (агент есть, ключей нет) | "unavailable" (нет агента / нет ssh-add)
    pub agent_status: String,
    pub agent_fingerprints: Vec<String>,
    /// Ключи по умолчанию (id_*), которые реально лежат в ~/.ssh — абсолютные пути
    pub default_identities: Vec<String>,
}

// ── Пути ──

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

fn ssh_dir() -> PathBuf {
    home_dir().join(".ssh")
}

/// `~` / `~/x` / `%d/x` → абсолютный путь. Относительный путь считаем от домашней папки.
pub fn expand_path(raw: &str) -> PathBuf {
    let home = home_dir();
    let raw = raw.trim();
    let rest = if raw == "~" || raw == "%d" {
        return home;
    } else if let Some(r) = raw.strip_prefix("~/").or_else(|| raw.strip_prefix("%d/")) {
        r
    } else {
        raw
    };
    let p = Path::new(rest);
    if p.is_absolute() { p.to_path_buf() } else { home.join(p) }
}

fn display_path(p: &Path) -> String {
    let home = home_dir();
    match p.strip_prefix(&home) {
        Ok(rel) if rel.as_os_str().is_empty() => "~".to_string(),
        Ok(rel) => format!("~/{}", rel.display()),
        Err(_) => p.display().to_string(),
    }
}

/// Путь к приватному ключу по любому из пары: `x.pub` → `x`
fn private_of(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_suffix(".pub") {
        Some(base) => PathBuf::from(base),
        None => p.to_path_buf(),
    }
}

fn with_suffix(p: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", p.to_string_lossy(), suffix))
}

#[cfg(unix)]
fn file_mode(meta: &std::fs::Metadata) -> Option<u32> {
    use std::os::unix::fs::PermissionsExt;
    Some(meta.permissions().mode() & 0o777)
}

#[cfg(not(unix))]
fn file_mode(_meta: &std::fs::Metadata) -> Option<u32> {
    None
}

fn read_small(p: &Path) -> Option<String> {
    let meta = std::fs::metadata(p).ok()?;
    if !meta.is_file() || meta.len() > MAX_KEY_FILE {
        return None;
    }
    std::fs::read_to_string(p).ok()
}

// ── Ключ: тип, длина, отпечаток, randomart ──

/// Длина числа в битах по его байтам (big-endian, ведущие нули не считаются)
fn bits_of(bytes: &[u8]) -> u32 {
    match bytes.iter().position(|&b| b != 0) {
        Some(i) => ((bytes.len() - i) as u32) * 8 - bytes[i].leading_zeros(),
        None => 0,
    }
}

/// Строка SSH-протокола: u32 длина + байты
fn ssh_string<'a>(buf: &'a [u8], pos: &mut usize) -> Option<&'a [u8]> {
    let len = u32::from_be_bytes(buf.get(*pos..*pos + 4)?.try_into().ok()?) as usize;
    let s = buf.get(*pos + 4..*pos + 4 + len)?;
    *pos += 4 + len;
    Some(s)
}

/// Тип и длина ключа по блобу публичного ключа (тот же, что в .pub после base64)
fn type_and_bits(blob: &[u8]) -> (String, u32) {
    let mut pos = 0;
    let Some(alg) = ssh_string(blob, &mut pos) else { return (String::new(), 0) };
    let alg = String::from_utf8_lossy(alg);
    match alg.as_ref() {
        "ssh-ed25519" => ("ED25519".into(), 256),
        "sk-ssh-ed25519@openssh.com" => ("ED25519-SK".into(), 256),
        "sk-ecdsa-sha2-nistp256@openssh.com" => ("ECDSA-SK".into(), 256),
        "ecdsa-sha2-nistp256" => ("ECDSA".into(), 256),
        "ecdsa-sha2-nistp384" => ("ECDSA".into(), 384),
        "ecdsa-sha2-nistp521" => ("ECDSA".into(), 521),
        // RSA: e, n; DSA: p, q, g, y — длина ключа = длина n / p
        "ssh-rsa" => {
            let _e = ssh_string(blob, &mut pos);
            ("RSA".into(), ssh_string(blob, &mut pos).map(bits_of).unwrap_or(0))
        }
        "ssh-dss" => ("DSA".into(), ssh_string(blob, &mut pos).map(bits_of).unwrap_or(0)),
        other => (other.to_ascii_uppercase(), 0),
    }
}

fn fill_from_blob(key: &mut SshKeyFile, blob: &[u8]) {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(blob);
    let (t, b) = type_and_bits(blob);
    key.key_type = t;
    key.bits = b;
    // Отпечаток OpenSSH — base64 без '=' в конце
    key.fingerprint = format!("SHA256:{}", b64_encode(&hash).trim_end_matches('='));
    key.randomart = randomart(&hash, &key.key_type, key.bits);
    if key.public_key.is_empty() {
        let mut pos = 0;
        let alg = ssh_string(blob, &mut pos).map(|a| String::from_utf8_lossy(a).into_owned()).unwrap_or_default();
        key.public_key = format!("{} {}", alg, b64_encode(blob));
        if !key.comment.is_empty() {
            key.public_key = format!("{} {}", key.public_key, key.comment);
        }
    }
}

/// Drunken Bishop из OpenSSH `sshkey.c` (`fingerprint_randomart`): поле 17×9,
/// слон ходит по диагонали по парам бит отпечатка, S — старт, E — финиш.
fn randomart(fp: &[u8], key_type: &str, bits: u32) -> String {
    const W: usize = 17;
    const H: usize = 9;
    const CHARS: &[u8] = b" .o+=*BOX@%&#/^SE";
    let len = (CHARS.len() - 1) as u8; // 16
    let mut field = [[0u8; H]; W];
    let (mut x, mut y) = (W / 2, H / 2);
    for &byte in fp {
        let mut b = byte;
        for _ in 0..4 {
            x = if b & 1 != 0 { (x + 1).min(W - 1) } else { x.saturating_sub(1) };
            y = if b & 2 != 0 { (y + 1).min(H - 1) } else { y.saturating_sub(1) };
            if field[x][y] < len - 2 {
                field[x][y] += 1;
            }
            b >>= 2;
        }
    }
    field[W / 2][H / 2] = len - 1;
    field[x][y] = len;

    let border = |label: &str| {
        let pad = W.saturating_sub(label.len());
        let left = pad / 2;
        format!("+{}{}{}+", "-".repeat(left), label, "-".repeat(pad - left))
    };
    let title = if bits > 0 { format!("[{} {}]", key_type, bits) } else { format!("[{}]", key_type) };
    let mut out = vec![border(&title)];
    for row in 0..H {
        let line: String = (0..W).map(|col| CHARS[field[col][row].min(len) as usize] as char).collect();
        out.push(format!("|{}|", line));
    }
    out.push(border("[SHA256]"));
    out.join("\n")
}

// ── base64 (свой, чтобы не тянуть крейт ради двух функций) ──

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn b64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |acc, (i, &b)| acc | (b as u32) << (16 - 8 * i));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

fn b64_decode(s: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut n) = (0u32, 0u32);
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => continue,
        };
        acc = (acc << 6) | v as u32;
        n += 6;
        if n >= 8 {
            n -= 8;
            out.push((acc >> n) as u8);
        }
    }
    out
}

// ── Приватный ключ: формат и шифрование по заголовку ──

/// Заголовок `openssh-key-v1`: шифр ("none" — без passphrase) и блоб публичного ключа.
/// Публичная часть в этом формате не шифруется — отпечаток есть и без `.pub`.
fn openssh_header(text: &str) -> Option<(String, Vec<u8>)> {
    let body: String = text.lines().filter(|l| !l.starts_with("-----")).collect();
    let raw = b64_decode(&body);
    let rest = raw.strip_prefix(&b"openssh-key-v1\0"[..])?;
    let mut pos = 0;
    let cipher = String::from_utf8_lossy(ssh_string(rest, &mut pos)?).into_owned();
    let _kdf = ssh_string(rest, &mut pos)?;
    let _kdf_options = ssh_string(rest, &mut pos)?;
    pos += 4; // число ключей, у OpenSSH всегда 1
    let blob = ssh_string(rest, &mut pos)?.to_vec();
    Some((cipher, blob))
}

/// Формат приватного ключа и признак шифрования. None — файл не похож на приватный ключ.
fn private_info(text: &str) -> Option<(&'static str, Option<bool>)> {
    let head = text.lines().find(|l| !l.trim().is_empty())?.trim();
    if head == "-----BEGIN OPENSSH PRIVATE KEY-----" {
        let enc = openssh_header(text).map(|(c, _)| c != "none");
        return Some(("openssh", enc));
    }
    if head == "-----BEGIN ENCRYPTED PRIVATE KEY-----" {
        return Some(("pkcs8", Some(true)));
    }
    if head == "-----BEGIN PRIVATE KEY-----" {
        return Some(("pkcs8", Some(false)));
    }
    if head.starts_with("-----BEGIN ") && head.ends_with(" PRIVATE KEY-----") {
        // Традиционный PEM (RSA / EC / DSA): шифрование — в заголовке Proc-Type
        let enc = text.lines().take(4).any(|l| l.starts_with("Proc-Type:") && l.contains("ENCRYPTED"));
        return Some(("pem", Some(enc)));
    }
    if head.starts_with("PuTTY-User-Key-File") {
        let enc = text.lines().any(|l| l.starts_with("Encryption:") && !l.contains("none"));
        return Some(("unknown", Some(enc)));
    }
    None
}

fn looks_like_private_key(p: &Path) -> bool {
    read_small(p).map(|t| private_info(&t).is_some()).unwrap_or(false)
}

/// Собрать сведения о ключе по пути к приватному ключу или к `.pub`
pub fn inspect_path(raw: &str, agent: &HashSet<String>) -> SshKeyFile {
    let private = private_of(&expand_path(raw));
    let public = with_suffix(&private, ".pub");
    let mut key = SshKeyFile {
        path: private.to_string_lossy().into_owned(),
        display_path: display_path(&private),
        name: private.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        in_ssh_dir: private.parent() == Some(ssh_dir().as_path()),
        has_certificate: with_suffix(&private, "-cert.pub").is_file(),
        ..Default::default()
    };
    let mut errors: Vec<String> = Vec::new();

    // Приватный ключ: формат, шифрование, права
    if let Ok(meta) = std::fs::metadata(&private) {
        if meta.is_file() {
            key.private_exists = true;
            key.mode = file_mode(&meta);
            key.modified = meta.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);
            match read_small(&private) {
                Some(text) => match private_info(&text) {
                    Some((format, enc)) => {
                        key.private_format = format.into();
                        key.encrypted = enc;
                        if format == "openssh" {
                            if let Some((_, blob)) = openssh_header(&text) {
                                fill_from_blob(&mut key, &blob);
                            }
                        }
                    }
                    None => {
                        key.private_format = "unknown".into();
                        errors.push("not a private key".into());
                    }
                },
                None => {
                    key.private_format = "unknown".into();
                    errors.push("private key unreadable".into());
                }
            }
        }
    }

    // Публичный ключ: тип, отпечаток, комментарий (комментарий из .pub важнее)
    if let Some(text) = read_small(&public) {
        key.public_exists = true;
        // Формат .pub: `<алгоритм> <base64-блоб> [комментарий]`
        let line = text.lines().find(|l| !l.trim().is_empty() && !l.starts_with('#')).unwrap_or("").trim();
        let mut parts = line.splitn(3, char::is_whitespace);
        let (_alg, b64, comment) = (parts.next(), parts.next().unwrap_or(""), parts.next().unwrap_or("").trim());
        let blob = b64_decode(b64);
        if blob.is_empty() || type_and_bits(&blob).0.is_empty() {
            errors.push("public key format not recognized".into());
        } else {
            key.comment = comment.to_string();
            key.public_key = line.to_string();
            fill_from_blob(&mut key, &blob);
        }
        if key.modified.is_none() {
            key.modified = std::fs::metadata(&public).ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);
        }
    }

    key.agent_loaded = !key.fingerprint.is_empty() && agent.contains(&key.fingerprint);
    key.error = errors.join("; ");
    key
}

// ── ssh-agent ──

fn agent_fingerprints() -> (String, HashSet<String>) {
    let out = std::process::Command::new("ssh-add")
        .args(["-l", "-E", "sha256"])
        .stdin(std::process::Stdio::null())
        .output();
    match out {
        // 0 — есть ключи, 1 — агент есть, ключей нет, 2 — агента нет
        Ok(o) if o.status.success() => {
            let set = String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| l.split_whitespace().nth(1))
                .filter(|f| f.starts_with("SHA256:"))
                .map(String::from)
                .collect();
            ("ok".into(), set)
        }
        Ok(o) if o.status.code() == Some(1) => ("empty".into(), HashSet::new()),
        _ => ("unavailable".into(), HashSet::new()),
    }
}

// ── ~/.ssh/config ──

/// Разбить строку конфига на ключевое слово и аргументы (`Key value`, `Key=value`, кавычки)
fn split_directive(line: &str) -> Option<(String, Vec<String>)> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let split = line.find(|c: char| c.is_whitespace() || c == '=')?;
    let keyword = line[..split].to_ascii_lowercase();
    let rest = line[split..].trim_start_matches(|c: char| c.is_whitespace() || c == '=');
    let mut args = Vec::new();
    let mut cur = String::new();
    let mut quoted = false;
    for c in rest.chars() {
        match c {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !cur.is_empty() {
                    args.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        args.push(cur);
    }
    Some((keyword, args))
}

/// Простой glob для Include: `*` и `?` только в последнем компоненте пути
fn glob_files(pattern: &Path) -> Vec<PathBuf> {
    let name = pattern.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    if !name.contains('*') && !name.contains('?') {
        return vec![pattern.to_path_buf()];
    }
    let dir = pattern.parent().unwrap_or(Path::new("/"));
    let mut found: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).collect())
        .unwrap_or_default();
    found.retain(|p| p.is_file() && p.file_name().map(|n| wildcard(&name, &n.to_string_lossy())).unwrap_or(false));
    found.sort();
    found
}

fn wildcard(pat: &str, s: &str) -> bool {
    let (p, s): (Vec<char>, Vec<char>) = (pat.chars().collect(), s.chars().collect());
    let (mut pi, mut si, mut star, mut mark) = (0, 0, None, 0);
    while si < s.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == s[si]) {
            pi += 1;
            si += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = si;
            pi += 1;
        } else if let Some(st) = star {
            pi = st + 1;
            mark += 1;
            si = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

fn parse_config_file(path: &Path, depth: usize, seen: &mut HashSet<PathBuf>, hosts: &mut Vec<SshConfigHost>) {
    if depth > MAX_INCLUDE_DEPTH || !seen.insert(path.to_path_buf()) {
        return;
    }
    let Ok(text) = std::fs::read_to_string(path) else { return };
    let file = display_path(path);
    for (i, line) in text.lines().enumerate() {
        let Some((kw, args)) = split_directive(line) else { continue };
        let first = args.first().cloned().unwrap_or_default();
        match kw.as_str() {
            "host" | "match" => hosts.push(SshConfigHost {
                patterns: if kw == "host" { args.clone() } else { vec![args.join(" ")] },
                is_match: kw == "match",
                file: file.clone(),
                line: i as u32 + 1,
                ..Default::default()
            }),
            "include" => {
                for a in &args {
                    // Относительный Include — от ~/.ssh
                    let p = if a.starts_with('~') || a.starts_with('/') { expand_path(a) } else { ssh_dir().join(a) };
                    for f in glob_files(&p) {
                        parse_config_file(&f, depth + 1, seen, hosts);
                    }
                }
            }
            _ => {
                if hosts.is_empty() {
                    hosts.push(SshConfigHost {
                        patterns: vec!["*".into()],
                        is_global: true,
                        file: file.clone(),
                        line: i as u32 + 1,
                        ..Default::default()
                    });
                }
                let h = hosts.last_mut().unwrap();
                // Для однозначных директив ssh берёт первое значение — так же и здесь
                let set_once = |field: &mut String| {
                    if field.is_empty() {
                        *field = first.clone();
                    }
                };
                match kw.as_str() {
                    "hostname" => set_once(&mut h.host_name),
                    "user" => set_once(&mut h.user),
                    "port" => set_once(&mut h.port),
                    "forwardagent" => set_once(&mut h.forward_agent),
                    "stricthostkeychecking" => set_once(&mut h.strict_host_key_checking),
                    "userknownhostsfile" => set_once(&mut h.user_known_hosts_file),
                    "identitiesonly" => set_once(&mut h.identities_only),
                    "passwordauthentication" => set_once(&mut h.password_authentication),
                    "identityfile" => {
                        // %h, %r и прочие токены зависят от хоста — путь не раскрываем
                        let resolvable = !first.contains('%') || first.starts_with("%d/");
                        let path = if resolvable { expand_path(&first) } else { PathBuf::new() };
                        h.identity_files.push(SshConfigIdentity {
                            exists: resolvable && path.is_file(),
                            path: if resolvable { path.to_string_lossy().into_owned() } else { String::new() },
                            raw: first.clone(),
                        });
                    }
                    _ => {}
                }
            }
        }
    }
}

// ── Отчёт целиком ──

/// Скан: все ключи из ~/.ssh + переданные пути (ключи консолей) + IdentityFile из конфига
pub fn scan(extra_paths: &[String]) -> SshKeysReport {
    let home = home_dir();
    let dir = ssh_dir();
    let (agent_status, agent) = agent_fingerprints();

    let config_path = dir.join("config");
    let mut config_hosts = Vec::new();
    parse_config_file(&config_path, 0, &mut HashSet::new(), &mut config_hosts);

    // Кандидаты: пары в ~/.ssh, затем ключи консолей и конфига. Порядок сохраняем, дубли — нет.
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&dir) {
        let mut names: Vec<PathBuf> = rd.filter_map(|e| e.ok()).map(|e| e.path()).collect();
        names.sort();
        for p in names {
            let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if NOT_KEYS.contains(&name.as_str()) || name.starts_with('.') || name.ends_with("-cert.pub") || !p.is_file() {
                continue;
            }
            if name.ends_with(".pub") || looks_like_private_key(&p) {
                candidates.push(private_of(&p));
            }
        }
    }
    for raw in extra_paths.iter().filter(|r| !r.trim().is_empty()) {
        candidates.push(private_of(&expand_path(raw)));
    }
    for h in &config_hosts {
        for id in h.identity_files.iter().filter(|id| !id.path.is_empty()) {
            candidates.push(PathBuf::from(&id.path));
        }
    }

    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut keys = Vec::new();
    for p in candidates {
        if seen.insert(p.clone()) {
            keys.push(inspect_path(&p.to_string_lossy(), &agent));
        }
    }

    let default_identities = DEFAULT_IDENTITIES
        .iter()
        .map(|n| dir.join(n))
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
        .collect();

    let dir_meta = std::fs::metadata(&dir).ok();
    let mut agent_fps: Vec<String> = agent.into_iter().collect();
    agent_fps.sort();
    SshKeysReport {
        home: home.to_string_lossy().into_owned(),
        ssh_dir: display_path(&dir),
        ssh_dir_exists: dir_meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
        ssh_dir_mode: dir_meta.as_ref().and_then(file_mode),
        keys,
        config_path: display_path(&config_path),
        config_exists: config_path.is_file(),
        config_hosts,
        agent_status,
        agent_fingerprints: agent_fps,
        default_identities,
    }
}

pub fn inspect(path: &str) -> SshKeyFile {
    let (_, agent) = agent_fingerprints();
    inspect_path(path, &agent)
}

// ── Действия ──

/// chmod 600 на приватный ключ или 700 на ~/.ssh
pub fn fix_permissions(raw: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let target = expand_path(raw);
        let (path, mode) = if target == ssh_dir() {
            (target, 0o700)
        } else {
            let private = private_of(&target);
            let text = read_small(&private).ok_or("key file not found")?;
            if private_info(&text).is_none() {
                return Err("not a private key".into());
            }
            (private, 0o600)
        };
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode)).map_err(|e| e.to_string())
    }
    #[cfg(not(unix))]
    {
        let _ = raw;
        Err("not supported on this platform".into())
    }
}

/// Создать ED25519-ключ `~/.ssh/<name>` (+ `.pub`). Существующие файлы не перезаписываются.
pub fn generate(name: &str, comment: &str, passphrase: &str) -> Result<SshKeyFile, String> {
    let name = name.trim();
    let valid = !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('.')
        && !name.ends_with(".pub")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '@'));
    if !valid {
        return Err("invalid key name".into());
    }
    let dir = ssh_dir();
    let private = dir.join(name);
    let public = with_suffix(&private, ".pub");
    if private.exists() || public.exists() {
        return Err("key file already exists".into());
    }

    let mut rng = rand::rngs::OsRng;
    let mut key = PrivateKey::random(&mut rng, Algorithm::Ed25519).map_err(|e| e.to_string())?;
    key.set_comment(comment.trim());
    let key = if passphrase.is_empty() { key } else { key.encrypt(&mut rng, passphrase).map_err(|e| e.to_string())? };
    let private_text = key.to_openssh(LineEnding::LF).map_err(|e| e.to_string())?;
    let public_text = key.public_key().to_openssh().map_err(|e| e.to_string())?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
        }
    }
    write_new(&private, private_text.as_bytes(), 0o600)?;
    if let Err(e) = write_new(&public, format!("{}\n", public_text).as_bytes(), 0o644) {
        let _ = std::fs::remove_file(&private);
        return Err(e);
    }
    Ok(inspect(&private.to_string_lossy()))
}

/// Записать новый файл сразу с нужными правами (create_new — не затираем чужое)
fn write_new(path: &Path, data: &[u8], mode: u32) -> Result<(), String> {
    use std::io::Write;
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(mode);
    }
    #[cfg(not(unix))]
    let _ = mode;
    let mut f = opts.open(path).map_err(|e| e.to_string())?;
    f.write_all(data).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn randomart_layout_matches_openssh() {
        let art = randomart(&[0u8; 32], "ED25519", 256);
        let lines: Vec<&str> = art.lines().collect();
        assert_eq!(lines.len(), 11);
        assert_eq!(lines[0], "+--[ED25519 256]--+");
        assert_eq!(lines[10], "+----[SHA256]-----+");
        assert!(lines[1..10].iter().all(|l| l.chars().count() == 19));
    }

    #[test]
    fn private_header_detection() {
        assert_eq!(private_info("-----BEGIN PRIVATE KEY-----\nAAA"), Some(("pkcs8", Some(false))));
        assert_eq!(private_info("-----BEGIN ENCRYPTED PRIVATE KEY-----\n"), Some(("pkcs8", Some(true))));
        assert_eq!(
            private_info("-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: x\n"),
            Some(("pem", Some(true)))
        );
        assert_eq!(private_info("-----BEGIN RSA PRIVATE KEY-----\nMIIE\n"), Some(("pem", Some(false))));
        assert_eq!(private_info("ssh-ed25519 AAAA"), None);
    }

    #[test]
    fn generated_key_roundtrip() {
        let mut rng = rand::rngs::OsRng;
        let mut key = PrivateKey::random(&mut rng, Algorithm::Ed25519).unwrap();
        key.set_comment("test@host");
        let plain = key.to_openssh(LineEnding::LF).unwrap();
        assert_eq!(private_info(&plain), Some(("openssh", Some(false))));
        let enc = key.encrypt(&mut rng, "secret").unwrap().to_openssh(LineEnding::LF).unwrap();
        assert_eq!(private_info(&enc), Some(("openssh", Some(true))));
        // Публичная часть зашифрованного ключа читается без passphrase, отпечаток — как у ssh-key
        let mut parsed = SshKeyFile::default();
        fill_from_blob(&mut parsed, &openssh_header(&enc).unwrap().1);
        assert_eq!(parsed.fingerprint, key.fingerprint(ssh_key::HashAlg::Sha256).to_string());
        assert_eq!(parsed.key_type, "ED25519");
        assert!(key.public_key().to_openssh().unwrap().ends_with(" test@host"));
    }

    #[test]
    fn config_directives() {
        assert_eq!(split_directive("  HostName=example.com"), Some(("hostname".into(), vec!["example.com".into()])));
        assert_eq!(
            split_directive("IdentityFile \"~/My Keys/id\""),
            Some(("identityfile".into(), vec!["~/My Keys/id".into()]))
        );
        assert_eq!(split_directive("# comment"), None);
        assert!(wildcard("*.conf", "a.conf"));
        assert!(!wildcard("*.conf", "a.cfg"));
    }

    #[test]
    fn bits_and_base64() {
        assert_eq!(bits_of(&[0x00, 0x01, 0x00]), 9);
        assert_eq!(b64_encode(b"ab"), "YWI=");
        assert_eq!(b64_decode("YWI="), b"ab");
    }
}



