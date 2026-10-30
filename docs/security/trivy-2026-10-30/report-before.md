# Отчёт Trivy: devconsole-hub

Дата сканирования: 2026-10-30  
Инструмент: Trivy, целей проверено: 3

## Сводка

Уровни — все находки; «Крит.+выс. с фиксом» — то, что закрывается обновлением.

| Цель | Тип | ОС | Крит. | Выс. | Средн. | Низк. | Крит.+выс. с фиксом | Секреты | Конфиг |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `docker` | конфиги | — | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| `devconsole-hub` | файлы | — | 0 | 3 | 3 | 2 | 3 | 0 | 0 |
| `devconsole-hub-linux-builder` | образ | ubuntu 22.04 | 19 | 539 | 2278 | 1234 | 24 | 0 | 0 |
| **Итого** |  |  | **19** | **542** | **2281** | **1236** | **27** | **0** | **4** |

## Что чинить в первую очередь

1. **Обновить ProseMirror и markdown-it в пределах semver** — `npm update prosemirror-view markdown-it`: `prosemirror-view` 1.41.7 → 1.42.3 закроет XSS при вставке в wiki (CVE-2026-104847, высок.) — самое важное, wiki получает вставку из чужого текста, а XSS в WebView Tauri — это доступ к IPC-командам приложения; `markdown-it` 14.3.1 → 14.3.3 закроет 2 высоких + 1 низкую (DoS разбора). Оба пакета — транзитивные через `@tiptap/pm`, диапазоны уже позволяют, `overrides.markdown-it: ^14.3.0` в `package.json` не мешает.
2. **Rust-крейты без смены `Cargo.toml`** — `cargo update -p rand@0.8.5 --precise 0.8.6` (наша прямая зависимость; unsound только с кастомным логгером через `rand::rng()`, у нас не используется — низк.) и `cargo update -p serde_with` → 3.21 (через `tauri-utils`, паника на пустых map при сериализации — средн.). После — `cargo test`.
3. **Принять (до перехода на TipTap 3):** `@tiptap/core` 2.27.2 — `mergeAttributes()` и ключ `__proto__` (средн.), исправлено только в 3.x — это миграция редактора, отдельный этап. **Принять до обновления Tauri:** `glib` 0.18.5 (средн., только Linux, тянется `tauri → tray-icon → gtk`; фикс в 0.20 — это смена gtk-rs внутри Tauri, не наша зависимость).
4. **Сборщик Linux (`devconsole-hub-linux-builder`) — в пользовательские пакеты не попадает:** 24 крит.+выс. с фиксом — почти все в глобальном npm из Node 20 (`tar`, `minimatch`, `glob`, `cross-spawn` внутри самого npm) и `libbrotli` из Ubuntu. Закрывается пересборкой с `apt-get upgrade` и Node LTS новее 20 в `docker/Dockerfile.linux`; ~3500 находок `linux-libc-dev` (заголовки ядра) без фикса — шум для сборочного образа, принять. `ubuntu:22.04` → `24.04` поднимет базовую WebKitGTK/glibc, с которой линкуются `.deb`/`.AppImage`, — менять только вместе с проверкой Linux-сборки на целевых дистрибутивах.
5. **Misconfig Dockerfile:** `--no-install-recommends` (DS-0029) — добавить, уменьшит образ и число пакетов с CVE; `USER root` (DS-0002) и нет `HEALTHCHECK` (DS-0026) — для одноразового сборщика принять.

## Ошибки конфигурации (Dockerfile)

| Цель | Файл | ID | Уровень | Проблема | Как исправить |
|---|---|---|---|---|---|
| `docker` | `Dockerfile.linux` | DS-0002 | высок. | Image user should not be 'root' | Add 'USER <non root user name>' line to the Dockerfile |
| `docker` | `Dockerfile.linux` | DS-0029 | высок. | 'apt-get' missing '--no-install-recommends' | Add '--no-install-recommends' flag to 'apt-get' |
| `docker` | `Dockerfile.linux` | DS-0029 | высок. | 'apt-get' missing '--no-install-recommends' | Add '--no-install-recommends' flag to 'apt-get' |
| `docker` | `Dockerfile.linux` | DS-0026 | низк. | No HEALTHCHECK defined | Add HEALTHCHECK instruction in Dockerfile |

## Разбор по целям

### `docker`

- Тип: конфиги
- Ошибок конфигурации: 4 (детали в разделе выше)

### `devconsole-hub`

- Тип: файлы
- Уязвимостей всего: 8 (есть исправление: 8)
- По уровням: крит. 0, выс. 3, средн. 3, низк. 2

Критичные и высокие с исправлением:

| Уровень | Файл | Пакет | Установлено | Исправлено в | CVE | Суть |
|---|---|---|---|---|---|---|
| высок. | `package-lock.json` | `markdown-it` | `14.3.1` | `14.3.3, 15.0.3` | [CVE-2026-111758](https://avd.aquasec.com/nvd/cve-2026-111758) | markdown-it: markdown-it: Denial of Service via unclosed link reference definitions |
| высок. | `package-lock.json` | `markdown-it` | `14.3.1` | `15.0.2, 14.3.2` | [CVE-2026-111759](https://avd.aquasec.com/nvd/cve-2026-111759) | markdown-it: markdown-it: Denial of Service via mismatched quote parsing |
| высок. | `package-lock.json` | `prosemirror-view` | `1.41.7` | `1.42.3` | [CVE-2026-104847](https://avd.aquasec.com/nvd/cve-2026-104847) | ProseMirror has a XSS vulnerability in prosemirror-view's paste handling |

Пакеты с наибольшим числом находок:

- `markdown-it`: 3 — обновить `14.3.1` → `14.3.3, 15.0.3`
- `@tiptap/core`: 1 — обновить `2.27.2` → `3.30.4`
- `prosemirror-view`: 1 — обновить `1.41.7` → `1.42.3`
- `glib`: 1 — обновить `0.18.5` → `0.20.0`
- `rand`: 1 — обновить `0.8.5` → `0.9.3, 0.10.1, 0.8.6`
- `serde_with`: 1 — обновить `3.18.0` → `3.21.0`

### `devconsole-hub-linux-builder`

- Тип: образ, ОС: ubuntu 22.04
- Уязвимостей всего: 4070 (есть исправление: 41)
- По уровням: крит. 19, выс. 539, средн. 2278, низк. 1234

Критичные и высокие с исправлением:

| Уровень | Файл | Пакет | Установлено | Исправлено в | CVE | Суть |
|---|---|---|---|---|---|---|
| критич. | `Node.js` | `tar` | `6.2.1` | `7.5.19` | [CVE-2026-59873](https://avd.aquasec.com/nvd/cve-2026-59873) | tar: node-tar: Denial of Service via crafted gzip bomb |
| высок. | `Node.js` | `brace-expansion` | `2.0.1` | `5.0.10, 3.0.7, 2.1.5, 1.1.19` | [CVE-2026-102276](https://avd.aquasec.com/nvd/cve-2026-102276) | brace-expansion: brace-expansion: Denial of Service via stack exhaustion from crafted brace patterns |
| высок. | `Node.js` | `brace-expansion` | `2.0.1` | `5.0.11, 3.0.8, 2.1.6, 1.1.20` | [CVE-2026-102278](https://avd.aquasec.com/nvd/cve-2026-102278) | brace-expansion: brace-expansion: Denial of Service via uncontrolled recursion in nested brace patt… |
| высок. | `Node.js` | `brace-expansion` | `2.0.1` | `5.0.7, 1.1.16, 2.1.2` | [CVE-2026-13149](https://avd.aquasec.com/nvd/cve-2026-13149) | brace-expansion: Brace-expansion: Denial of Service due to exponential-time complexity |
| высок. | `Node.js` | `brace-expansion` | `2.0.1` | `5.0.8, 3.0.3, 2.1.3, 1.1.17` | [CVE-2026-14257](https://avd.aquasec.com/nvd/cve-2026-14257) | brace-expansion: Brace-expansion: Denial of Service via memory exhaustion in expand() function |
| высок. | `Node.js` | `brace-expansion` | `2.0.1` | `1.1.18, 2.1.4, 3.0.6, 5.0.9` | [CVE-2026-69152](https://avd.aquasec.com/nvd/cve-2026-69152) | brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation |
| высок. | `Node.js` | `cross-spawn` | `7.0.3` | `7.0.5, 6.0.6` | [CVE-2024-21538](https://avd.aquasec.com/nvd/cve-2024-21538) | cross-spawn: regular expression denial of service |
| высок. | `Node.js` | `glob` | `10.4.2` | `11.1.0, 10.5.0` | [CVE-2025-64756](https://avd.aquasec.com/nvd/cve-2025-64756) | glob: glob: Command Injection Vulnerability via Malicious Filenames |
| высок. | `Node.js` | `ip-address` | `9.0.5` | `10.3.1` | [CVE-2026-69192](https://avd.aquasec.com/nvd/cve-2026-69192) | ip-address: ip-address: Inconsistent IP address parsing leads to Server-Side Request Forgery (SSRF)… |
| высок. | `devconsole-hub-linux-builder (ubuntu 22.04)` | `libbrotli-dev` | `1.0.9-2build6` | `1.0.9-2ubuntu0.1` | [CVE-2026-111497](https://avd.aquasec.com/nvd/cve-2026-111497) | brotli: Out-of-Bounds Write in Google Brotli Decoder |
| высок. | `devconsole-hub-linux-builder (ubuntu 22.04)` | `libbrotli1` | `1.0.9-2build6` | `1.0.9-2ubuntu0.1` | [CVE-2026-111497](https://avd.aquasec.com/nvd/cve-2026-111497) | brotli: Out-of-Bounds Write in Google Brotli Decoder |
| высок. | `Node.js` | `minimatch` | `9.0.5` | `10.2.1, 9.0.6, 8.0.5, 7.4.7, 6.2.1, 5.1.7, 4.2.4, 3.1.3` | [CVE-2026-26996](https://avd.aquasec.com/nvd/cve-2026-26996) | minimatch: minimatch: Denial of Service via specially crafted glob patterns |
| высок. | `Node.js` | `minimatch` | `9.0.5` | `10.2.3, 9.0.7, 8.0.6, 7.4.8, 6.2.2, 5.1.8, 4.2.5, 3.1.3` | [CVE-2026-27903](https://avd.aquasec.com/nvd/cve-2026-27903) | minimatch: minimatch: Denial of Service due to unbounded recursive backtracking via crafted glob pa… |
| высок. | `Node.js` | `minimatch` | `9.0.5` | `10.2.3, 9.0.7, 8.0.6, 7.4.8, 6.2.2, 5.1.8, 4.2.5, 3.1.4` | [CVE-2026-27904](https://avd.aquasec.com/nvd/cve-2026-27904) | minimatch: Minimatch: Denial of Service via catastrophic backtracking in glob expressions |
| высок. | `Node.js` | `pacote` | `18.0.6` | `21.5.1` | [CVE-2026-9496](https://avd.aquasec.com/nvd/cve-2026-9496) | pacote: Pacote: Denial of Service via crafted spec.rawSpec value in addGitSha function |
| высок. | `Node.js` | `sigstore` | `2.3.1` | `4.1.1` | [CVE-2026-48815](https://avd.aquasec.com/nvd/cve-2026-48815) | sigstore: Sigstore: Unauthorized certificates accepted due to ignored `certificateOIDs` verificatio… |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.3` | [CVE-2026-23745](https://avd.aquasec.com/nvd/cve-2026-23745) | node-tar: tar: node-tar: Arbitrary file overwrite and symlink poisoning via unsanitized linkpaths i… |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.4` | [CVE-2026-23950](https://avd.aquasec.com/nvd/cve-2026-23950) | node-tar: tar: node-tar: Arbitrary file overwrite via Unicode path collision race condition |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.7` | [CVE-2026-24842](https://avd.aquasec.com/nvd/cve-2026-24842) | node-tar: tar: node-tar: Arbitrary file creation via path traversal bypass in hardlink security che… |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.8` | [CVE-2026-26960](https://avd.aquasec.com/nvd/cve-2026-26960) | node-tar: node-tar: Arbitrary file read/write via malicious archive hardlink creation |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.10` | [CVE-2026-29786](https://avd.aquasec.com/nvd/cve-2026-29786) | node-tar: hardlink path traversal via drive-relative linkpath |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.11` | [CVE-2026-31802](https://avd.aquasec.com/nvd/cve-2026-31802) | tar: tar: File overwrite via drive-relative symlink traversal |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.18` | [CVE-2026-59874](https://avd.aquasec.com/nvd/cve-2026-59874) | tar: Node-tar: Denial of Service via malformed tar archive header |
| высок. | `Node.js` | `tar` | `6.2.1` | `7.5.21` | [CVE-2026-73566](https://avd.aquasec.com/nvd/cve-2026-73566) | tar: node-tar: Denial of Service via crafted long-path tar archive |

Критичные и высокие без исправления (крит./выс.): `linux-libc-dev` 18/516

Пакеты с наибольшим числом находок:

- `linux-libc-dev`: 3520
- `gir1.2-soup-3.0`: 58
- `libsoup-3.0-0`: 58
- `libsoup-3.0-common`: 58
- `libsoup-3.0-dev`: 58
- `libsoup2.4-1`: 22
- `libsoup2.4-common`: 22
- `tar`: 14 — обновить `6.2.1` → `7.5.19`

## Как воспроизвести

```bash
# только lock-файлы, с доступным исправлением
trivy fs --scanners vuln --ignore-unfixed --skip-dirs node_modules --skip-dirs src-tauri/target .
# Rust-крейты по базе RustSec (если установлен cargo-audit)
cd src-tauri && cargo audit
```

Сырые JSON-результаты лежат рядом с этим отчётом в каталоге `raw/`.
