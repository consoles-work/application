# Отчёт Trivy: devconsole-hub (после исправлений)

Дата сканирования: 2026-10-30  
Инструмент: Trivy, целей проверено: 3

## Сводка

Уровни — все находки; «Крит.+выс. с фиксом» — то, что закрывается обновлением.

| Цель | Тип | ОС | Крит. | Выс. | Средн. | Низк. | Крит.+выс. с фиксом | Секреты | Конфиг |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `docker` | конфиги | — | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `devconsole-hub` | файлы | — | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `devconsole-hub-linux-builder` | образ | ubuntu 22.04 | 18 | 519 | 2261 | 1226 | 3 | 0 | 0 |
| **Итого** |  |  | **18** | **519** | **2262** | **1226** | **3** | **0** | **2** |

## Что чинить в первую очередь

Повторный скан после исправлений (до — `report-before.md`). Критичных и высоких с фиксом в приложении — 0 (было 3), в сборщике — 3 (было 24), ошибок Dockerfile — 2 (было 4).

1. **Приложение — делать нечего.** Остался `glib` 0.18.5 (средн., только Linux): тянется `tauri → tray-icon → gtk`, свежий Tauri 2.12.x по-прежнему на gtk-rs 0.18 — закроется с переходом Tauri на новую gtk-rs. Принято.
2. **Сборщик: `undici` 6.29.0 внутри npm 11.21.1** (3 высоких, в т.ч. обход проверки сертификата) — фикс 6.29.1 ещё не попал ни в один npm 11. Перепроверить при следующем прогоне: пересборка образа подтянет новый `npm@11` сама. До тех пор npm в сборщике ходит только в registry.npmjs.org по `package-lock.json` с проверкой integrity.
3. **Сборщик: `linux-libc-dev`, `libsoup` и др. без фикса** — пакеты Ubuntu 22.04, исправления нет; в пользовательские пакеты заголовки ядра не попадают. Принято.
4. **Dockerfile: root (DS-0002), нет HEALTHCHECK (DS-0026)** — одноразовый контейнер сборки. Принято.

## Ошибки конфигурации (Dockerfile)

| Цель | Файл | ID | Уровень | Проблема | Как исправить |
|---|---|---|---|---|---|
| `docker` | `Dockerfile.linux` | DS-0002 | высок. | Image user should not be 'root' | Add 'USER <non root user name>' line to the Dockerfile |
| `docker` | `Dockerfile.linux` | DS-0026 | низк. | No HEALTHCHECK defined | Add HEALTHCHECK instruction in Dockerfile |

## Разбор по целям

### `docker`

- Тип: конфиги
- Ошибок конфигурации: 2 (детали в разделе выше)

### `devconsole-hub`

- Тип: файлы
- Уязвимостей всего: 1 (есть исправление: 1)
- По уровням: крит. 0, выс. 0, средн. 1, низк. 0

Критичных и высоких нет.

Пакеты с наибольшим числом находок:

- `glib`: 1 — обновить `0.18.5` → `0.20.0`

### `devconsole-hub-linux-builder`

- Тип: образ, ОС: ubuntu 22.04
- Уязвимостей всего: 4024 (есть исправление: 6)
- По уровням: крит. 18, выс. 519, средн. 2261, низк. 1226

Критичные и высокие с исправлением:

| Уровень | Файл | Пакет | Установлено | Исправлено в | CVE | Суть |
|---|---|---|---|---|---|---|
| высок. | `Node.js` | `undici` | `6.29.0` | `6.29.1, 7.30.1, 8.12.2` | [CVE-2026-109383](https://avd.aquasec.com/nvd/cve-2026-109383) | undici: undici: Certificate validation bypass via dropped TLS options in Agent |
| высок. | `Node.js` | `undici` | `6.29.0` | `6.29.1, 7.30.1, 8.12.2` | [CVE-2026-109869](https://avd.aquasec.com/nvd/cve-2026-109869) | undici: undici: Denial of Service via unhandled stream error on excessive content encodings |
| высок. | `Node.js` | `undici` | `6.29.0` | `6.29.1, 7.30.1, 8.12.2` | [CVE-2026-87018](https://avd.aquasec.com/nvd/cve-2026-87018) | undici: undici: Denial of Service via TLS renegotiation with mismatched certificate |

Критичные и высокие без исправления (крит./выс.): `linux-libc-dev` 18/516

Пакеты с наибольшим числом находок:

- `linux-libc-dev`: 3520
- `gir1.2-soup-3.0`: 58
- `libsoup-3.0-0`: 58
- `libsoup-3.0-common`: 58
- `libsoup-3.0-dev`: 58
- `libsoup2.4-1`: 22
- `libsoup2.4-common`: 22
- `binutils`: 8

## Как воспроизвести

```bash
# только lock-файлы, с доступным исправлением
trivy fs --scanners vuln --ignore-unfixed --skip-dirs node_modules --skip-dirs src-tauri/target .
# Rust-крейты по базе RustSec (если установлен cargo-audit)
cd src-tauri && cargo audit
```

Сырые JSON-результаты лежат рядом с этим отчётом в каталоге `raw/`.
