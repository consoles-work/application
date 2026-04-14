# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # установить JS-зависимости
npm run tauri dev        # dev-режим (hot reload фронта + перекомпиляция Rust)
npm run tauri build      # сборка продакшн-бинарника под текущую ОС
npm run dev              # только фронтенд в браузере (без Tauri, для UI-разработки)
npm run build            # сборка фронтенда без Tauri
```

Первый `npm run tauri dev` занимает 3-5 минут (Cargo компилирует зависимости), последующие — 5-10 секунд.

Для продакшн-сборки нужен ключ шифрования БД:
```bash
export DB_ENCRYPTION_KEY="$(openssl rand -hex 32)"
npm run tauri build
```

## Архитектура

Приложение Tauri 2.0: четырёхпанельный GUI (дерево проектов / терминал / AI-ассистент / wiki).

### IPC-мост Rust ↔ TypeScript

Весь backend — это Rust-функции с `#[tauri::command]`. Вызов со стороны фронта:
```ts
// src/lib/tauriCommands.ts — единственное место для invoke()
invoke("rust_command_name", { camelCaseArgs })
```
Rust-функции объявлены в `src-tauri/src/commands.rs`, зарегистрированы **в двух файлах** через `tauri::generate_handler![]`:
- `src-tauri/src/main.rs` — используется при `npm run tauri dev` (десктоп)
- `src-tauri/src/lib.rs` — используется при сборке под мобильные платформы

**ВАЖНО: при добавлении новой команды нужно прописать её в ОБОИХ файлах**, иначе в рантайме будет ошибка `command X not found`. Аргументы автоматически конвертируются через serde: Rust использует `snake_case`, TypeScript — `camelCase` (директива `#[serde(rename_all = "camelCase")]`).

### Слой данных

- **SQLCipher** (`src-tauri/src/db.rs`) — зашифрованная SQLite (AES-256-CBC). Файл БД: `~/Library/Application Support/devconsole-hub/data.db` (macOS). Глобальное соединение через `OnceLock<Mutex<Connection>>`. WAL-режим включён.
- Ключ шифрования встраивается в бинарник при компиляции через `build.rs` (читает `DB_ENCRYPTION_KEY` из env). В рантайме переменная не нужна.
- Иерархия: `workspaces` → `projects` → `consoles` с каскадным удалением (`ON DELETE CASCADE`). Wiki-страницы (`wiki_pages`) прикрепляются к любому уровню через `parent_type` + `parent_id`. FTS5-таблица `wiki_fts` для полнотекстового поиска.
- AI-сессии: таблицы `ai_sessions` и `ai_messages` (CASCADE delete).
- Настройки: таблица `settings` (key-value), ключи вида `ui.theme`, `terminal.fontSize`, `ai.provider`, `ai.apiKey.openai` и т.д.
- `env_vars` и `tags` хранятся как JSON-строки, десериализуются при чтении.

### PTY-менеджер

`src-tauri/src/pty_manager.rs` — реализован на `portable-pty`. `spawn()` запускает PTY-процесс, фоновый Rust-поток читает вывод и шлёт на фронт через `app.emit("pty-output", ...)`. Фронт пишет через `invoke("write_to_pty", ...)`, размер через `resize_pty`, завершение через `kill_pty`.

При запуске PTY явно выставляются `LANG`, `LC_CTYPE`, `TERM=xterm-256color` — Tauri-приложение, запущенное не из терминала, не наследует локаль пользователя.

SSH passphrase автоподставляется через `ssh-add` с `SSH_ASKPASS_REQUIRE=force` (временный скрипт `/tmp/.devconsole_askpass_<pid>`). SSH пароль сервера — через `SSH_ASKPASS_REQUIRE=force` + `DISPLAY=dummy` (временный скрипт `/tmp/.devconsole_pw_<pid>`).

### Экспорт/импорт

`src-tauri/src/export.rs` — бинарный формат `.dchub`: magic `DCHUB1` + flags + salt(32) + nonce(12) + len(4) + AES-256-GCM ciphertext. Шифрование через compile-time app-секрет + опциональный пользовательский пароль (PBKDF2-HMAC-SHA256, 100k итераций). Три Tauri-команды: `export_data`, `preview_import`, `apply_import`. Payload содержит: дерево (workspace/project/console), wiki-страницы (все типы, при импорте перепривязываются через `old_id → new_id` маппинг), AI-сессии с сообщениями, настройки (опционально). `#[serde(default)]` на поле `settings` обеспечивает обратную совместимость со старыми файлами.

### Frontend

- **Zustand store** (`src/stores/appStore.ts`) — единственный источник истины для UI. Держит дерево `workspaces[]`, список `sessions[]` (runtime), `currentWikiPages[]`, `aiSessions[]`, `terminalSelection`, состояние панелей.
- `getFlatTree()` в store разворачивает вложенную иерархию в плоский массив `TreeNode[]` для рендера `TreePanel`.
- **Компоненты**:
  - `Layout.tsx` — четыре панели + resizable-сплиттеры + titlebar
  - `TreePanel.tsx`, `TerminalPanel.tsx`, `WikiPanel.tsx`, `AiPanel.tsx` — независимые панели
  - `WikiToolbar.tsx` — тулбар TipTap
  - `CommandPalette.tsx` — поиск по дереву (Cmd+P)
  - `SettingsDialog.tsx` — 4 вкладки: Данные / Терминал / Интерфейс / Агенты
  - `ExportDialog.tsx`, `ImportDialog.tsx` — экспорт/импорт `.dchub`
  - `ContextMenu.tsx`, `Toast.tsx`, диалоги создания/редактирования
- **Wiki-редактор**: TipTap (ProseMirror). Контент хранится как TipTap JSON. Привязка к выбранному узлу или "global". Автосохранение debounce 1000ms.
- **Терминал**: xterm.js (`@xterm/xterm`) подключён к PTY-бэкенду через события Tauri.
- **AI-панель**: `AiPanel.tsx` — чат с историей в SQLite, стриминг SSE, позиция right/bottom (resizable). Провайдеры: OpenAI, Anthropic (`src/lib/aiProviders.ts`). API-ключи хранятся в зашифрованной SQLite как `ai.apiKey.openai` / `ai.apiKey.anthropic`.
- **Локализация**: i18next, 5 языков (ru/en/zh/fr/kk), файлы `src/locales/*.json`.
- **Темы**: 13 тем (10 тёмных + 3 светлых), CSS-переменные, мгновенная смена. Функции в `src/lib/themes.ts`.

### Важные особенности IPC (camelCase)

`#[serde(rename_all = "camelCase")]` на Rust-структурах означает, что **все поля в JSON между Rust и TypeScript используют camelCase**. TypeScript-интерфейсы для типов, которые передаются как структуры целиком (например `ConsoleConfig`, `WikiPage`), должны использовать camelCase: `parentType`, `parentId`, `startupCmd`, `sshKeyPath`, `sshPassphrase`, `sshPassword` и т.д. Ошибки десериализации в `.catch(() => {})` молча проглатываются — это опасно, проверяй поля при добавлении новых команд.

### Трей и автозапуск (macOS)

- **Системный трей**: `tauri-plugin` tray-icon (feature `tray-icon` в `Cargo.toml`). `TrayIconBuilder` создаётся в `setup()` в `main.rs`. Меню: "Открыть" + "Выход".
- **CloseRequested**: читает настройку `ui.closeToTray` (bool) через `get_setting_bool()` в `db.rs`. Если `true` — `window.hide()`, если `false` — `app.exit(0)`.
- **Автозапуск**: `tauri-plugin-autostart`, `MacosLauncher::LaunchAgent`. Команды: `enable_autostart`, `disable_autostart`, `get_autostart_status`. Настройка в Settings → Интерфейс.
- Capability: `core:tray:default`, `autostart:allow-*` в `capabilities/default.json`.

### Drag-and-drop в TreePanel

HTML5 DnD API **не работает в Tauri WebKit** — используется mouse-event подход:
- `onMouseDown` → `window.addEventListener("mousemove"/"mouseup")` для глобального трекинга
- Drag активируется после сдвига ≥ 6px
- Hit-test цели: `querySelectorAll("[data-nodetype='project']")` + `getBoundingClientRect`
- Ghost-лейбл через `createPortal(document.body)` с `pointerEvents: none`
- **Критично:** дроп-хендлер нужно вызывать ДО очистки `draggingConsoleRef.current`, иначе хендлер получит `null`

### Текущее состояние

MVP завершён полностью. Все панели рабочие. PTY, SSH (key + passphrase + password), wiki, AI-чат (OpenAI + Anthropic + Ollama, история в SQLite), экспорт/импорт (.dchub, AES-256-GCM, выборочный по воркспейсам, wiki с корректной перепривязкой ID, AI-чаты, настройки приложения), drag-and-drop консолей между проектами, системный трей, автозапуск, 13 тем, 5 языков локализации, шифрование БД (SQLCipher) — всё реализовано.

### Чеклист добавления новой Tauri-команды

1. Объявить функцию с `#[tauri::command]` в `src-tauri/src/commands.rs`
2. Добавить вспомогательную функцию в `src-tauri/src/db.rs` (если нужна БД)
3. Зарегистрировать в `src-tauri/src/main.rs` → `invoke_handler![]`
4. Зарегистрировать в `src-tauri/src/lib.rs` → `invoke_handler![]`
5. Добавить TypeScript-обёртку в `src/lib/tauriCommands.ts`

### Файловая структура (ключевые файлы)

```
src/                              — Frontend (TypeScript + React)
  App.tsx                         — корневой компонент, горячие клавиши
  stores/appStore.ts              — Zustand store
  lib/
    tauriCommands.ts              — ВСЕ invoke()-вызовы (единственное место)
    themes.ts                     — 13 тем UI + xterm-палитры
    i18n.ts                       — локализация (i18next)
    aiProviders.ts                — OpenAI + Anthropic, стриминг SSE
  components/
    Layout.tsx                    — 4 панели + resizable-сплиттеры
    TreePanel.tsx                 — дерево + поиск + Export/Import кнопки
    TerminalPanel.tsx             — xterm.js + PTY + danger-баннер + SSH
    WikiPanel.tsx                 — TipTap + теги + FTS5-поиск
    AiPanel.tsx                   — AI-чат, сессии, стриминг, позиции right/bottom
    SettingsDialog.tsx            — 4 вкладки настроек
    ExportDialog.tsx / ImportDialog.tsx
    CommandPalette.tsx, ContextMenu.tsx, Toast.tsx
    dialogs/                      — Create/Edit диалоги
  types/index.ts                  — TypeScript-интерфейсы (зеркало Rust-структур)
  locales/ru.json en.json zh.json fr.json kk.json
  styles/globals.css              — CSS-переменные тем

src-tauri/src/                    — Backend (Rust)
  main.rs                         — точка входа, регистрация команд (десктоп), ~38 команд
  lib.rs                          — то же для мобильных платформ (синхронизирован с main.rs)
  commands.rs                     — #[tauri::command] функции + Rust-структуры
  db.rs                           — SQLite CRUD через rusqlite (SQLCipher)
  pty_manager.rs                  — PTY-сессии (portable-pty), SSH passphrase/password
  export.rs                       — экспорт/импорт .dchub (AES-256-GCM)

src-tauri/
  build.rs                        — встраивает DB_ENCRYPTION_KEY в бинарник
  tauri.conf.json                 — конфигурация Tauri (CSP: api.openai.com, api.anthropic.com)
  Cargo.toml                      — rusqlite (bundled-sqlcipher), portable-pty, aes-gcm, pbkdf2, ...
  .env / .env.example             — DB_ENCRYPTION_KEY (в .gitignore)
```

### Горячие клавиши

- `Cmd/Ctrl+B` — показать/скрыть панель дерева
- `Cmd/Ctrl+\` — показать/скрыть wiki-панель
- `Cmd/Ctrl+I` — показать/скрыть AI-панель
- `Cmd/Ctrl+P` — CommandPalette (поиск по дереву)
- `Cmd/Ctrl+,` — окно настроек (Settings)
- `F2` — переименовать выбранный узел