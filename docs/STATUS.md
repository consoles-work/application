# DevConsole Hub — Статус проекта

> Последнее обновление: 2026-04-02 (Этап 10.12 — SSH пароль + локализация экспорт/импорт)

---

## Что реально готово и работает

### Инфраструктура
- Tauri 2.0 проект компилируется и запускается
- Все npm-зависимости установлены (xterm.js, TipTap, lowlight, lucide-react, plugin-dialog)
- Cargo.toml: rusqlite, portable-pty, uuid, dirs, chrono, tauri-plugin-dialog, aes-gcm, pbkdf2, sha2, hmac, rand
- Tailwind настроен через CSS-переменные (10 тем, динамическая смена)
- Capabilities: core:default, event listen/unlisten/emit, shell:open, dialog

### Frontend (React + TypeScript)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src/types/index.ts` | ✅ Готово | Все интерфейсы: WikiPage (camelCase), isDanger/dangerLabel, SSH-поля (включая `sshPassphrase`, `sshPassword`), AppSettings, AiSession, AiMessage |
| `src/stores/appStore.ts` | ✅ Готово | CRUD + Toast + Wiki + Settings + AI сессии; `toggleNodeExpanded` сохраняет состояние в SQLite |
| `src/lib/tauriCommands.ts` | ✅ Готово | Все IPC-обёртки: дерево, PTY (с `sshKeyPath`/`sshPassphrase`/`sshPassword`), wiki, clone, settings, AI сессии, `setNodeExpanded`, `exportData`/`previewImport`/`applyImport` |
| `src/lib/themes.ts` | ✅ Готово | 10 тем с UI-цветами и полной xterm-палитрой, resolveThemeId, applyTheme |
| `src/components/Layout.tsx` | ✅ Готово | Трёхпанельный layout с resizable сплиттерами + кнопка Settings в titlebar |
| `src/components/TreePanel.tsx` | ✅ Готово | Дерево + раскрытие по клику на строку + контекстное меню + inline rename (F2) + danger/ssh badge + клонирование + поиск по дереву + кнопки Export/Import |
| `src/components/TerminalPanel.tsx` | ✅ Готово | xterm.js + PTY + danger-баннер + SSH + startup + динамические настройки; убрана дублирующая Bot-кнопка из таббара; индикатор-точка при выделении текста |
| `src/components/WikiPanel.tsx` | ✅ Готово | TipTap редактор + привязка к узлу + автосохранение debounce + теги + поиск по wiki (FTS5) |
| `src/components/WikiToolbar.tsx` | ✅ Готово | H1/H2/H3, Bold/Italic/Code, списки, TaskList, CodeBlock, HR, Undo/Redo |
| `src/components/CommandPalette.tsx` | ✅ Готово | Fuzzy-поиск по дереву, ↑↓/Enter/Esc, danger badge |
| `src/components/SettingsDialog.tsx` | ✅ Готово | 4 вкладки: Данные, Терминал, Интерфейс, Агенты; раздельные API-ключи per-провайдер (`ai.apiKey.openai` / `ai.apiKey.anthropic`) |
| `src/components/Toast.tsx` | ✅ Готово | Success/error/info, автоисчезновение 3 сек |
| `src/components/ContextMenu.tsx` | ✅ Готово | Workspace/Project/Console меню + danger-пометка + клонирование + подтверждение удаления (ask) |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | ✅ Готово | Имя + emoji + цвет |
| `src/components/dialogs/CreateProjectDialog.tsx` | ✅ Готово | Имя + Browse + shell + emoji + цвет + danger-чекбокс |
| `src/components/dialogs/CreateConsoleDialog.tsx` | ✅ Готово | SSH по умолчанию; имя + SSH/Local + все SSH-поля + Browse для ключа + пароль сервера (show/hide) + passphrase только при выбранном ключе + startup + danger-чекбокс |
| `src/components/dialogs/EditConsoleDialog.tsx` | ✅ Готово | Аналогично CreateConsoleDialog; SSH-пароль и passphrase по условию |
| `src/components/dialogs/ExportDialog.tsx` | ✅ Готово | Полностью локализован; чекбоксы (дерево/wiki/AI), опциональный пароль, нативный save-диалог |
| `src/components/dialogs/ImportDialog.tsx` | ✅ Готово | Полностью локализован; 3-шаговый диалог: выбор файла → пароль → превью + опции merge/replace |
| `src/App.tsx` | ✅ Готово | Загрузка данных + настроек + применение темы при старте; восстановление видимости панелей из SQLite; Cmd+B/\\/P/, |
| `src/styles/globals.css` | ✅ Готово | CSS-переменные для 10 тем + xterm.js + TipTap стили |

### Backend (Rust)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/main.rs` | ✅ Готово | 38 IPC-команд (включая `set_node_expanded`, `export_data`, `preview_import`, `apply_import`) |
| `src-tauri/src/lib.rs` | ✅ Готово | Дубликат для мобильных/библиотечной сборки — синхронизирован с main.rs |
| `src-tauri/src/commands.rs` | ✅ Готово | CRUD дерева, PTY, wiki, danger, clone, settings, AiSession + 8 команд, экспорт/импорт + 3 команды; `ssh_password` в ConsoleConfig и всех командах |
| `src-tauri/src/db.rs` | ✅ Готово | Полный CRUD + FTS5 + клонирование + settings + SQLCipher + AI-сессии + `set_node_expanded` + `ssh_passphrase` + `ssh_password` (automigration) + `load_all_wiki_pages` + `delete_all_*` + `get_workspace_names` |
| `src-tauri/src/export.rs` | ✅ Готово | Шифрованный формат `.dchub`: AES-256-GCM + PBKDF2-HMAC-SHA256 (100k iter); app-секрет + опциональный пользовательский пароль; верификационная фраза в payload; функции build/encrypt/decrypt/preview/apply |
| `src-tauri/src/pty_manager.rs` | ✅ Готово | portable-pty: spawn/write/resize/kill; `sh -c` для команд с пробелами; UTF-8 локаль; SSH passphrase через `add_key_to_agent` (SSH_ASKPASS trick); SSH пароль сервера через SSH_ASKPASS_REQUIRE=force |
| `src-tauri/build.rs` | ✅ Готово | Читает `.env` из корня проекта; встраивает `DB_ENCRYPTION_KEY` в бинарник через `env!()` |

### Frontend — AI панель

| Файл | Статус | Примечания |
|------|--------|------------|
| `src/lib/aiProviders.ts` | ✅ Готово | OpenAI + Anthropic; стриминг SSE; единый интерфейс `AiProvider` |
| `src/components/AiPanel.tsx` | ✅ Готово | Сессии (дропдаун, +, переименование, удаление с подтверждением); история из SQLite; стриминг без потерь при смене позиции; автозаголовок; контекст из терминала |
| `src/components/Layout.tsx` | ✅ Готово | AI панель в двух позициях (right/bottom) с resizable-сплиттером |
| `src/styles/globals.css` | ✅ Готово | `.panel-resizer-horizontal` для нижней позиции AI панели |

---

## Горячие клавиши

| Комбинация | Статус |
|-----------|--------|
| Cmd+B (toggle дерева) | ✅ Готово |
| Cmd+\\ (toggle wiki) | ✅ Готово |
| F2 (переименовать) | ✅ Готово |
| Cmd+P (Command Palette) | ✅ Готово |
| Cmd+, (настройки) | ✅ Готово |
| Cmd+I (toggle AI панели) | ✅ Готово |
| Cmd+Shift+K (глобальный поиск wiki) | ❌ TODO |
| Cmd+T (новая вкладка) | ❌ TODO |
| Cmd+W (закрыть вкладку) | ❌ TODO |
| Cmd+Tab / Cmd+Shift+Tab | ❌ TODO |
| Cmd+1..9 (вкладка N) | ❌ TODO |
| Delete (удалить узел) | ❌ TODO |

---

## Что осталось сделать

| Задача | Приоритет | Примечания |
|--------|-----------|------------|
| AI панель: drag-and-drop смены позиции | Средний | Сейчас кнопки Right/Bottom в заголовке |
| AI панель: Ollama (локальные модели) | Средний | Без API-ключа, localhost:11434 |
| AI панель: привязка сессий к узлу дерева | Низкий | Post-MVP |
| AI панель: локализация (zh/fr/kk) | Низкий | AI-ключи добавлены; AiPanel-строки — fallback |
| OS Keychain для API-ключей | Низкий | Сейчас в зашифрованной SQLite |
| Горячие клавиши (Cmd+T/W/Tab/1-9/Delete) | Средний | Post-MVP |
| `GlobalSearch.tsx` (Cmd+Shift+K) | Средний | Глобальный модал поиска с подсветкой |
| Wiki: блоки кода с кнопками | Низкий | TipTap NodeView: "Копировать" + "Вставить в терминал" |
| Drag-and-drop в дереве | Отменено | — |

### Post-MVP
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод в несколько консолей)
- Snippets / быстрые команды
- Интеграции: Git, Docker

---

## История изменений

### 2026-04-02 — Этап 10.12: SSH пароль + локализация экспорт/импорт + UX

**SSH — пароль сервера (password-based auth)**
- `db.rs`: колонка `ssh_password` (automigration); все SELECT/INSERT/UPDATE/clone обновлены
- `commands.rs`: `ssh_password: String` в `ConsoleConfig`, `create_console`, `update_console_config`, `spawn_pty`
- `pty_manager.rs`: если `ssh_password` задан — создаётся `/tmp/.devconsole_pw_<pid>` скрипт, SSH получает `SSH_ASKPASS_REQUIRE=force` + `DISPLAY=dummy`; работает параллельно с passphrase (разные механизмы)
- `types/index.ts`, `tauriCommands.ts`, `TerminalPanel.tsx`: `sshPassword` проброшен по всей цепочке

**SSH форма — UX**
- `CreateConsoleDialog`: дефолт изменён на `"ssh"`, порядок кнопок `["ssh", "local"]`
- `EditConsoleDialog`: тот же порядок кнопок
- Поле passphrase теперь рендерится условно: `{sshKeyPath.trim() !== "" && <PassphraseField />}`

**Danger-баннер — универсальный текст**
- `DangerWarning({ label })`: принимает `dangerLabel` и вставляет в текст через интерполяцию
- Текст: "Помечен как «LABEL». Будьте внимательны..." вместо хардкоженного "продакшн-окружение"
- Обновлено во всех 5 локалях

**Локализация ExportDialog и ImportDialog**
- `ExportDialog.tsx` + `ImportDialog.tsx`: все строки заменены на `t("export.*")` / `t("import.*")`
- Новые секции `"export"` и `"import"` в `ru.json`, `en.json`, `zh.json`, `fr.json`, `kk.json`
- Исправлены отсутствующие `agentsShowKey`/`agentsHideKey` в `zh.json`, `fr.json`, `kk.json`
- Добавлены ключи `sshPassword`, `sshPasswordNote`, `sshPasswordPlaceholder` во все 5 локалей

---

### 2026-04-02 — Этап 10.11: Экспорт/импорт (.dchub)

**Rust — новый модуль `export.rs`**
- Бинарный формат `.dchub`: magic `DCHUB1` + flags + salt(32) + nonce(12) + len(4) + AES-256-GCM ciphertext
- PBKDF2-HMAC-SHA256 (100 000 итераций) деривация ключа; app-секрет встроен в бинарник; пользовательский пароль — опциональный второй слой
- Верификационная фраза `"_verify": "dchub-v1-ok"` в JSON-payload; неверный пароль → ошибка аутентификации GCM
- `Cargo.toml`: добавлены `aes-gcm`, `pbkdf2`, `sha2`, `hmac`, `rand`

**Rust — три новые Tauri-команды** (зарегистрированы в `main.rs` и `lib.rs`)
- `export_data(file_path, include_tree, include_wiki, include_ai, user_password)` — пишет зашифрованный файл
- `preview_import(file_path, user_password)` → `ImportPreview` — статистика без изменения БД
- `apply_import(file_path, user_password, include_*, mode)` — применяет с режимом merge/replace

**Rust — новые функции `db.rs`**
- `load_all_wiki_pages()`, `delete_all_workspaces/wiki_pages/ai_sessions()`, `get_workspace_names()`

**Frontend**
- `tauriCommands.ts`: 3 обёртки + интерфейс `ImportPreview`
- `ExportDialog.tsx`: чекбоксы + поле пароля + нативный save-диалог
- `ImportDialog.tsx`: 3-шаговый (выбор файла → пароль → превью+опции) + режимы merge/replace
- `TreePanel.tsx`: кнопки Upload/Download (иконки из lucide-react) в header

**Поведение при конфликтах**: merge → суффикс `(import)` + новые UUID; replace → удаление + вставка; wiki без `parent_type=global` — игнорируется

---

### 2026-04-01 — Этап 10.10: Светлые темы + UX-fix

**Светлые темы** (добавлены 3 новые)
- `themes.ts`: добавлены `Solarized Light`, `Catppuccin Latte`, `One Light` с полными xterm-палитрами
- `globals.css`: CSS-переменные (`--surface-*`, `--text-*`, `--accent`, `--border`, `--scrollbar`, `--resizer`) для каждой новой темы
- Итого тем: 13 (10 тёмных + 3 светлых)

**UX-фиксы консолей в дереве**
- `TreePanel.tsx`: убран буквенный badge `S`/`L`; SSH-badge перенесён перед именем; emoji-иконка у консолей не показывается; структура строки: `ssh` → имя → `⚠ LABEL`

**Ширина панели дерева — сохранение**
- `appStore.ts`: дефолтная ширина увеличена с 250 до 280px
- `Layout.tsx`: на mouseup при ресайзе дерева сохраняет ширину в SQLite (`ui.treePanelWidth`)
- `App.tsx`: восстанавливает сохранённую ширину из настроек при старте

**Надёжность сохранения состояния дерева**
- `appStore.ts`: `toggleNodeExpanded` переписан — текущее значение `is_expanded` читается через `get()` до вызова `set()`, без мутации внутри updater; `persistNodeExpanded` получает гарантированно корректное значение

---

### 2026-04-01 — Этап 10.9: UX-улучшения

**Иконки типа консоли в дереве**
- `appStore.ts` / `TreePanel.tsx`: иконка консоли изменена с `">_"` на цветной badge-символ: `S` (синий) для SSH, `L` (серый) для Local
- В дереве значок рендерится как маленький квадратный бейдж с соответствующим цветом; в поиске по дереву аналогично

**Раздельные API-ключи для AI-провайдеров**
- `SettingsDialog.tsx` (AgentsTab): ключ хранится в SQLite как `ai.apiKey.openai` или `ai.apiKey.anthropic` — при переключении провайдера поле показывает/сохраняет соответствующий ключ; заголовок поля содержит имя текущего провайдера
- `AiPanel.tsx`: читает ключ по ключу `ai.apiKey.<provider>`; `settings["ai.apiKey"]` остался как fallback для обратной совместимости

**Сохранение состояния раскрытия дерева**
- `db.rs`: новая функция `set_node_expanded` — UPDATE `is_expanded` для workspaces и projects
- `commands.rs`: новая Tauri-команда `set_node_expanded(id, node_type, is_expanded)`
- `main.rs` + `lib.rs`: команда зарегистрирована в обоих файлах
- `tauriCommands.ts`: обёртка `setNodeExpanded()`
- `appStore.ts`: `toggleNodeExpanded` теперь сохраняет состояние в SQLite через `persistNodeExpanded`; дерево восстанавливается при следующем запуске

**SSH passphrase — сохранение и автоподстановка**
- `db.rs`: новая колонка `ssh_passphrase TEXT NOT NULL DEFAULT ''` в таблице `consoles`; добавлена через `ALTER TABLE ... ADD COLUMN` с automigration (`.ok()` на ошибку дубликата)
- `commands.rs` / `db.rs`: `ConsoleConfig` дополнен полем `ssh_passphrase`; `create_console`, `update_console_config`, `clone_console_by_id`, `clone_project_by_id` обновлены
- `pty_manager.rs`: новая функция `add_key_to_agent(key_path, passphrase)` — создаёт временный `SSH_ASKPASS`-скрипт (`/tmp/.devconsole_askpass_<pid>`), запускает `ssh-add` с env `SSH_ASKPASS_REQUIRE=force`, удаляет скрипт; `spawn()` принимает `ssh_key_path` + `ssh_passphrase`
- `types/index.ts`: `sshPassphrase: string` в `ConsoleConfig`
- `tauriCommands.ts`: `createConsole`, `updateConsoleConfig`, `spawnPty` — добавлены параметры passphrase/key_path
- `CreateConsoleDialog.tsx` + `EditConsoleDialog.tsx`: поле "Пароль к ключу" с маской и кнопкой показать/скрыть
- `ru.json` + `en.json`: добавлены ключи `sshPassphrase`, `sshPassphraseNote`, `sshPassphrasePlaceholder`

---

### 2026-03-29 — Этап 10.8: Баг-фиксы AI панели

- `TerminalPanel.tsx`: убрана дублирующая кнопка `Bot` из таббара терминала (она уже есть в title bar + `Cmd+I`); оставлен только индикатор-точка при наличии выделения
- `AiPanel.tsx`: добавлено `window.confirm(...)` перед удалением сессии (с именем чата) и перед очисткой истории через иконку корзины
- `AiPanel.tsx`: исправлена потеря текста стриминга при смене позиции right↔bottom — добавлена модульная переменная `_loadedSessionId`; `useEffect` теперь пропускает загрузку из БД если сессия не изменилась (компонент просто ремонтировался)
- `appStore.ts`: иконка консолей в дереве изменена с текстовой строки `"terminal"` на символ `">_"`

---

### 2026-03-29 — Этап 10.7: AI чат-сессии с историей в SQLite

**Backend (Rust):**
- `db.rs`: новые таблицы `ai_sessions` и `ai_messages` (CASCADE delete); полный CRUD: `create/load/rename/delete_ai_session`, `load/save/update/clear_ai_messages`
- `commands.rs`: структуры `AiSession`, `AiMessage`; 8 Tauri-команд
- `main.rs` + `lib.rs`: все 8 команд зарегистрированы

**Frontend:**
- `types/index.ts`: `AiSession`, `AiMessage` интерфейсы
- `tauriCommands.ts`: 8 IPC-обёрток
- `appStore.ts`: `aiSessions[]`, `activeAiSessionId`, `aiStreamingMsgId`, CRUD-экшены для сессий
- `App.tsx`: загрузка сессий при старте через `load_ai_sessions`; создание дефолтной если список пуст
- `AiPanel.tsx`: полная переработка — дропдаун сессий в заголовке, кнопка "+", inline-переименование (Pencil/Check), удаление, загрузка истории при смене сессии, сохранение каждого сообщения в БД, финализация стрим-сообщений через `update_ai_message`, автозаголовок из первых 40 символов ответа

---

### 2026-03-29

**SQLCipher — шифрование базы данных**
- `Cargo.toml`: `bundled` → `bundled-sqlcipher` (AES-256-CBC шифрование всего файла `.db`)
- `build.rs`: читает `DB_ENCRYPTION_KEY` из `.env` или окружения при компиляции; встраивает в бинарник через `env!()`; в рантайме переменная не нужна
- `db.rs`: `PRAGMA key='...'` — первая операция после `Connection::open`; если найдена старая plain-text БД — делает `.plaintext_backup` и пересоздаёт
- Добавлены `.env`, `.env.example`, `.gitignore` обновлён

**AI панель — прототип**
- `src/lib/aiProviders.ts` — абстракция провайдеров: OpenAI (`gpt-4o` и др.) + Anthropic (`claude-sonnet-4-6` и др.); стриминг SSE через `fetch()` + `ReadableStream`
- `src/components/AiPanel.tsx` — чат-панель: история сообщений, стриминг в реальном времени, контекст из выделения терминала, кнопки позиции Right/Bottom, стоп-кнопка, быстрый выбор провайдера
- `src/components/Layout.tsx` — AI панель интегрирована в layout: позиция "справа" (между терминалом и wiki) и "снизу" (под терминалом); resizable-сплиттеры
- `src/components/TerminalPanel.tsx` — кнопка `Bot` в баре вкладок; `terminal.onSelectionChange` → `terminalSelection` в Zustand store; индикатор-точка при наличии выделения
- `src/components/SettingsDialog.tsx` — вкладка "Агенты": провайдер, API-ключ (show/hide), модель, позиция панели, кнопка проверки подключения
- `src/App.tsx` — `Cmd+I` toggle AI панели; восстановление `showAiPanel`/`aiPanelPosition` из SQLite при старте
- `tauri.conf.json` — CSP разрешает `connect-src` для `api.openai.com`, `api.anthropic.com`, `localhost:11434`
- Локализация: добавлены ключи `tabAgents` и `agents*` в `ru.json` и `en.json`

### 2026-03-27

**Поддержка UTF-8 / кириллицы в терминале**
- `pty_manager.rs`: при запуске PTY-сессии явно выставляются `LANG`, `LC_CTYPE`, `TERM=xterm-256color`
- Причина: Tauri-приложение, запущенное не из терминала (dock, Finder), не наследует пользовательскую локаль → кириллица отображалась кракозябрами

**Danger-индикация в терминале**
- `TerminalPanel.tsx`: исправлен danger-баннер — был `bg-red-950/60` (сливался с тёмным фоном), заменён на явный красный `rgba(220,38,38,0.18)` с границей `border-b-2 border-red-500/70`
- Добавлен равномерный красноватый фон терминала для опасных консолей (`rgba(220,38,38,0.045)`)

**Сохранение видимости панелей между запусками**
- `appStore.ts`: `toggleTreePanel`/`toggleWikiPanel` теперь сохраняют состояние в SQLite через `set_setting` (`ui.showTreePanel`, `ui.showWikiPanel`); добавлены `setShowTreePanel`/`setShowWikiPanel` для прямого восстановления без побочных эффектов
- `App.tsx`: при загрузке настроек читает `ui.showTreePanel`/`ui.showWikiPanel` из SQLite и восстанавливает видимость панелей

---

## Итоговая оценка готовности

| Область | Готовность |
|---------|-----------|
| Область | Готовность |
|---------|-----------|
| Инфраструктура / сборка | 100% |
| TypeScript типы и store | 100% |
| Layout и дерево (CRUD + danger + SSH + клонирование + UX + поиск) | 100% |
| Backend CRUD (Rust + SQLite) | 100% |
| PTY / Терминал | 100% |
| SSH-подключение (passphrase + пароль сервера + SSH_ASKPASS) | 100% |
| Wiki / TipTap (редактор + теги + поиск) | 100% |
| Настройки (Settings + темы) | 100% |
| Система тем (13 тем: 10 тёмных + 3 светлых + random) | 100% |
| Шифрование БД (SQLCipher + compile-time key) | 100% |
| AI панель (OpenAI + Anthropic, стриминг, сессии в SQLite) | 95% (Ollama, drag-and-drop позиции — Post-MVP) |
| Экспорт/импорт (.dchub, AES-256-GCM) | 100% |
| Поиск и навигация (дерево + wiki) | 85% (GlobalSearch-модал отсутствует) |
| Локализация | 95% (все 5 языков полные; zh/fr/kk теперь с AI-ключами и export/import секциями) |
| Post-MVP функции | 0% |

**Общая готовность: ~99%** (MVP + AI с историей + UX + экспорт/импорт + SSH пароль + полная локализация)
