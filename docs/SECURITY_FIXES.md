# Безопасность: журнал проверок и исправлений

Проверка — скилл `.claude/skills/trivy-scan` (Trivy через `docker compose`). Отчёты — `docs/security/trivy-<дата>/report.md`.

> Последнее обновление: 2026-10-30

## Сводка

Критичные и высокие с доступным исправлением (в скобках — всего крит./выс.).

| Цель | 2026-10-30, до | 2026-10-30, после |
|---|---|---|
| Rust-крейты (`src-tauri/Cargo.lock`) | 0 (0/0); средн. 2, низк. 1 | 0 (0/0); средн. 1 (`glib`) |
| npm (`package-lock.json`) | 3 (0/3); средн. 1, низк. 1 | 0; `npm audit` с dev — 0 |
| Секреты в файлах проекта | 0 | 0 |
| Образ сборщика `devconsole-hub-linux-builder` | 24 (19/539) | 3 (18/519) |
| `docker/Dockerfile.linux` (misconfig) | 4 | 2 |

## Исправлено

### 2026-10-30

- **`prosemirror-view` 1.41.7 → 1.42.8** — CVE-2026-104847 (высок.), XSS при вставке в редактор wiki; XSS в WebView Tauri даёт доступ к IPC-командам приложения.
- **`markdown-it` 14.3.1 → 14.3.3, затем убран из дерева** — CVE-2026-111758/-111759 (высок.), CVE-2026-111766 (низк.), DoS разбора. В TipTap 3 `@tiptap/pm` больше не тянет `prosemirror-markdown`.
- **TipTap 2.27.2 → 3.32.2** — GHSA-cp6q-959q-f8rh (`@tiptap/core`, средн., `mergeAttributes()` и `__proto__`). Пакеты: `@tiptap/{core,pm,react,starter-kit,extensions,extension-list,extension-code-block-lowlight}`; Link теперь из StarterKit, Placeholder — из `@tiptap/extensions`, списки задач — из `@tiptap/extension-list`. В коде: тулбар подписан на `useEditorState`; загрузка страницы — `setContent(…, { emitUpdate: false })` (в v3 по умолчанию `true` — открытие страницы считалось бы правкой); подчёркивание StarterKit 3 отключено (в тулбаре его нет).
- **`rand` 0.8.5 → 0.8.6, `serde_with` 3.18 → 3.24** — GHSA-cq8v-f236-94qc (низк.), GHSA-7gcf-g7xr-8hxj (средн.); `cargo update`, без правки `Cargo.toml`.
- **npm dev-зависимости** — `npm audit fix` без `--force`: `vite` 6.4.5, `browserslist` 4.29.5, `source-map-js` 1.2.2, `postcss-selector-parser`, `baseline-browser-mapping`.
- **Сборщик Linux** (`docker/Dockerfile.linux`): `apt-get upgrade` (закрыл `libbrotli` и др.), `--no-install-recommends` + явный `ca-certificates` (DS-0029), Node 20 → 24 LTS и `npm install -g npm@11` (закрыли `tar`, `minimatch`, `glob`, `cross-spawn`, `brace-expansion`, `sigstore`, `pacote`, `ip-address`). Ubuntu 22.04 оставлена — от неё зависят glibc/WebKitGTK пакетов.

## Принято

- **`glib` 0.18.5** — GHSA-wrw7-89jp-8q8g (средн., unsound итератор). Только Linux, тянется `tauri → tray-icon → libappindicator → gtk`; фикс в 0.20 требует обновления gtk-rs внутри Tauri — на 2026-10-30 свежий Tauri 2.12.x всё ещё на 0.18.
- **Сборщик: `linux-libc-dev`** (~3500 находок, 18/516 крит./выс., без фикса) — заголовки ядра в сборочном образе, в пакеты не попадают.
- **Сборщик: DS-0002 (root), DS-0026 (нет HEALTHCHECK)** — одноразовый контейнер сборки.
- **Сборщик: `undici` 6.29.0 в npm 11.21.1** — CVE-2026-109383, -109869, -87018 (высок.). Фикс 6.29.1 ещё не вошёл в npm 11; перепроверять при каждом прогоне — пересборка образа подтянет новый `npm@11`.

## План

- П1. Перепроверить `undici` в npm сборщика — пересобрать образ, когда выйдет npm 11 с undici ≥ 6.29.1.
- П2. `glib` — при обновлении Tauri проверить `cargo tree -i glib`.
- П3. Прогнать полную Linux-сборку (`scripts/build-linux.sh`) на новом образе и проверить пакеты — после `--no-install-recommends` и Node 24 не проверялась.
