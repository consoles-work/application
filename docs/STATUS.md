# DevConsole Hub — Статус проекта

> Последнее обновление: 2026-06-25 (Этап 17 — контекстное меню терминала по ПКМ + восстановление залипших ANSI-цветов)

---

## Что реально готово и работает

### Инфраструктура
- Tauri 2.0 проект компилируется и запускается
- Все npm-зависимости установлены (xterm.js, TipTap, lowlight, lucide-react, plugin-dialog)
- Cargo.toml: rusqlite, portable-pty, uuid, dirs, chrono, tauri-plugin-dialog, aes-gcm, pbkdf2, sha2, hmac, rand, **tauri-plugin-autostart**
- `tauri` feature: `tray-icon` (системный трей)
- Tailwind настроен через CSS-переменные (13 тем, динамическая смена)
- Capabilities: core:default, event listen/unlisten/emit, shell:open, dialog, **core:tray:default**, **autostart:allow-***

### Frontend (React + TypeScript)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src/types/index.ts` | ✅ Готово | Все интерфейсы: WikiPage (camelCase), isDanger/dangerLabel, SSH-поля (включая `sshPassphrase`, `sshPassword`), AppSettings, AiSession, AiMessage; **`reconnectKey` в `TerminalSession`** |
| `src/stores/appStore.ts` | ✅ Готово | CRUD + Toast + Wiki + Settings + AI сессии; `toggleNodeExpanded` сохраняет состояние; **`moveConsoleToProject`**; **`reconnectSession`** |
| `src/lib/tauriCommands.ts` | ✅ Готово | Все IPC-обёртки: дерево, PTY, wiki, clone, settings, AI сессии, `setNodeExpanded`, `exportData`/`previewImport`/`applyImport`, **`moveConsole`**, **`enableAutostart`/`disableAutostart`/`getAutostartStatus`** |
| `src/lib/themes.ts` | ✅ Готово | 13 тем (10 тёмных + 3 светлых) с UI-цветами и полной xterm-палитрой, resolveThemeId, applyTheme |
| `src/components/Layout.tsx` | ✅ Готово | Четырёхпанельный layout с resizable сплиттерами + кнопка Settings в titlebar |
| `src/components/TreePanel.tsx` | ✅ Готово | Дерево + раскрытие + контекстное меню + inline rename (F2) + danger/ssh badge + клонирование + поиск + кнопки Export/Import + **drag-and-drop консолей (mouse-event, ghost-портал, подтверждение)** |
| `src/components/TerminalPanel.tsx` | ✅ Готово | xterm.js + PTY + danger-баннер + SSH + startup + динамические настройки; индикатор-точка при выделении; `reconnectKey` в key-пропе; повторные fit() на 100ms/400ms при открытии и 200ms при смене вкладки; **контекстное меню по ПКМ (`TerminalContextMenu`): Копировать / Вставить / Выделить всё / Очистить строку / Очистить экран / Сбросить терминал; горячие клавиши Cmd+C/Cmd+V; буфер через `navigator.clipboard`** |
| `src/components/WikiPanel.tsx` | ✅ Готово | TipTap редактор + привязка к узлу + автосохранение debounce + теги + поиск по wiki (FTS5) |
| `src/components/WikiToolbar.tsx` | ✅ Готово | H1/H2/H3, Bold/Italic/Code, списки, TaskList, CodeBlock, HR, Undo/Redo |
| `src/components/CommandPalette.tsx` | ✅ Готово | Fuzzy-поиск по дереву, ↑↓/Enter/Esc, danger badge |
| `src/components/SettingsDialog.tsx` | ✅ Готово | 4 вкладки: Данные, Терминал, Интерфейс, Агенты; раздельные API-ключи per-провайдер; **автозапуск (чекбокс); поведение при закрытии (трей / завершить)** |
| `src/components/Toast.tsx` | ✅ Готово | Success/error/info, автоисчезновение 3 сек |
| `src/components/ContextMenu.tsx` | ✅ Готово | Workspace/Project/Console меню + клонирование + подтверждение удаления; **danger-пометка для console убрана** (перенесена в EditConsoleDialog); **пункт "Переподключить" для консолей с открытой сессией** |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | ✅ Готово | Имя + emoji + цвет |
| `src/components/dialogs/CreateProjectDialog.tsx` | ✅ Готово | Имя + Browse + shell + emoji + цвет + danger-чекбокс |
| `src/components/dialogs/CreateConsoleDialog.tsx` | ✅ Готово | SSH по умолчанию; имя + SSH/Local + все SSH-поля + Browse для ключа + пароль сервера (show/hide) + passphrase только при выбранном ключе + startup + danger-чекбокс |
| `src/components/dialogs/EditConsoleDialog.tsx` | ✅ Готово | Полностью аналогично CreateConsoleDialog; **добавлены danger-поля** (чекбокс + метка); вызывает `setNodeDanger` после `updateConsoleConfig` |
| `src/components/dialogs/ExportDialog.tsx` | ✅ Готово | Полностью локализован; чекбоксы воркспейсов для выборочного экспорта; чекбоксы wiki/AI/**настройки**; опциональный пароль |
| `src/components/dialogs/ImportDialog.tsx` | ✅ Готово | Полностью локализован; 3-шаговый: выбор файла → пароль → превью + опции merge/replace; **чекбокс применения настроек** (если файл содержит) |
| `src/App.tsx` | ✅ Готово | Загрузка данных + настроек + применение темы при старте; восстановление видимости панелей; Cmd+B/\\/P/I/,; **глобальный запрет нативного contextmenu** |
| `src/styles/globals.css` | ✅ Готово | CSS-переменные для 13 тем + xterm.js + TipTap стили |

### Backend (Rust)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/main.rs` | ✅ Готово | ~45 IPC-команд; **трей** (`TrayIconBuilder`); **`CloseRequested`** читает `ui.closeToTray` — hide или exit; **autostart-плагин** подключён |
| `src-tauri/src/lib.rs` | ✅ Готово | Синхронизирован с main.rs (мобильная/библиотечная сборка) |
| `src-tauri/src/commands.rs` | ✅ Готово | CRUD дерева, PTY, wiki, danger, clone, settings, AI (8 команд), экспорт/импорт (3 команды), **`move_console`**, **`enable_autostart`/`disable_autostart`/`get_autostart_status`** |
| `src-tauri/src/db.rs` | ✅ Готово | Полный CRUD + FTS5 + клонирование + settings + SQLCipher + AI-сессии + `set_node_expanded` + `ssh_passphrase` + `ssh_password` + `move_console` + **`get_setting_bool`** + `load_all_wiki_pages` + `delete_all_*` + `get_workspace_names` |
| `src-tauri/src/export.rs` | ✅ Готово | Формат `.dchub`: AES-256-GCM + PBKDF2 (100k iter); `workspace_ids` фильтр; верификационная фраза; **экспорт/импорт настроек**; **исправлен импорт wiki** (id_map для перепривязки страниц) |
| `src-tauri/src/pty_manager.rs` | ✅ Готово | portable-pty: spawn/write/resize/kill; UTF-8 локаль; SSH passphrase через `add_key_to_agent`; SSH пароль сервера через SSH_ASKPASS_REQUIRE=force |
| `src-tauri/build.rs` | ✅ Готово | Читает `.env`; встраивает `DB_ENCRYPTION_KEY` в бинарник через `env!()` |

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
| Cmd+Shift+K (глобальный поиск wiki) | ✅ Готово |
| Cmd+T (новая вкладка для выбранной консоли) | ✅ Готово |
| Cmd+W (закрыть вкладку) | ✅ Готово |
| Cmd+Tab / Cmd+Shift+Tab | ✅ Готово |
| Cmd+1..9 (вкладка N) | ✅ Готово |
| Delete (удалить узел) | ❌ TODO (Post-MVP) |

---

## Что осталось сделать

| Задача | Приоритет | Примечания |
|--------|-----------|------------|
| AI панель: привязка сессий к узлу дерева | Низкий | Post-MVP |
| OS Keychain для API-ключей | Низкий | Сейчас в зашифрованной SQLite |
| Горячие клавиши: Delete (удалить узел) | Низкий | Post-MVP |
| Wiki: блоки кода с кнопками | Низкий | TipTap NodeView: "Копировать" + "Вставить в терминал" |
| macOS Code Signing + Notarization | Низкий | Требует Apple Developer сертификат; инструкция в PLAN.md §12.3 |

### Post-MVP
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод в несколько консолей)
- Snippets / быстрые команды
- Интеграции: Git, Docker

---

## История изменений

### 2026-06-25 — Этап 17: Контекстное меню терминала + восстановление цветов

**Контекстное меню по ПКМ в терминале**
- `TerminalPanel.tsx`: новый компонент `TerminalContextMenu` (через `createPortal`, в стиле `ContextMenu.tsx`)
- `TerminalView`: обработчик `onContextMenu` на контейнере открывает меню по координатам курсора; локальное состояние `ctxMenu`
- Пункты меню:
  - **Копировать** — выделение → буфер (`navigator.clipboard.writeText`); неактивен без выделения
  - **Вставить** — буфер → PTY (`navigator.clipboard.readText` → `writeToPty`)
  - **Выделить всё** — `term.selectAll()`
  - **Очистить строку** — шлёт `Ctrl+E`+`Ctrl+U` (`\x05\x15`), чистит всю строку ввода независимо от позиции курсора
  - **Очистить экран** — `term.clear()` (оставляет текущее приглашение)
  - **Сбросить терминал** — `term.reset()` + `Ctrl+L` (`\x0c`) шеллу + повторный `fit()`
- Горячая клавиша **Cmd+C** (при выделении) через `attachCustomKeyEventHandler` (только `metaKey`, чтобы не перехватывать `Ctrl+C`/SIGINT). Копирование — `navigator.clipboard.writeText`
- **Вставка Cmd/Ctrl+V НЕ перехватывается** — её обрабатывает сам xterm через системное событие `paste` (с поддержкой bracketed-paste). Ручной `readText→writeToPty` убран: он давал двойную вставку (xterm вставлял ещё раз) и провоцировал системную плашку «paste» в WKWebView
- Вставка из контекстного меню — `navigator.clipboard.readText()` → `term.paste(text)` (один проход, корректный bracketed-paste)
- Глобальный `preventDefault` на `contextmenu` в `App.tsx` не мешает: он лишь блокирует нативное меню WebKit, React-обработчик `onContextMenu` срабатывает штатно
- Локализация на 5 языков: секция `terminalContextMenu` (copy/paste/selectAll/clearLine/clearScreen/reset)

**Восстановление залипших ANSI/SGR-цветов**
- Проблема: команда выводит escape для цвета и не сбрасывает его (`\x1b[0m`) или прерывается — приглашение шелла и дальнейший вывод наследуют «грязный» цвет (вплоть до невидимого текста)
- Решение в меню: **Очистить экран** и **Сбросить терминал** — `term.reset()` сбрасывает внутреннее состояние xterm (включая залипший SGR), затем `Ctrl+L` заставляет шелл перерисовать чистое приглашение

---

### 2026-04-13 — Этап 16: UX-фиксы

**Переподключение консоли**
- `types/index.ts`: добавлено поле `reconnectKey?: number` в `TerminalSession`
- `stores/appStore.ts`: новое действие `reconnectSession(sessionId)` — инкрементирует `reconnectKey`
- `TerminalPanel.tsx`: `key` компонента `TerminalView` теперь `${session.id}-${reconnectKey}` — при инкременте React пересоздаёт компонент, PTY корректно завершается через cleanup
- `ContextMenu.tsx`: пункт "Переподключить" (↺) в меню консоли — показывается только если сессия уже открыта
- `TreePanel.tsx`: обработчик `handleReconnectConsole` — вызывает `reconnectSession` + `setActiveSession`
- Локализация на 5 языков: `contextMenu.reconnectConsole`

**Убран нативный contextmenu WebKit ("Reload" при ПКМ на пустом месте)**
- `App.tsx`: глобальный `document.addEventListener("contextmenu", e => e.preventDefault())` — блокирует нативное меню WebKit/браузера во всём приложении

**Фикс размера терминала при первом открытии**
- `TerminalPanel.tsx`: после `term.open()` + `fitAddon.fit()` добавлены повторные вызовы через 100ms и 400ms — WebKit в Tauri вычисляет финальные размеры с задержкой
- Также добавлен второй `fit()` через 200ms при переключении на активную вкладку (`isActive` effect)

---

### 2026-04-07 — Этап 15: Исправления экспорта/импорта + настройки

**Исправлен импорт wiki-страниц (баг с перепривязкой ID)**
- `export.rs` → `apply_import()`: при импорте дерева теперь строится `HashMap<old_id, new_id>` для всех workspace/project/console
- Wiki-страницы с `parent_type != "global"`: `parent_id` заменяется на новый через маппинг; если родитель не найден — страница пропускается
- Wiki-страницы с `parent_type = "global"`: импортируются без изменений (как и раньше)
- Если `include_tree = false`: страницы сохраняются с оригинальным `parent_id` (merge в ту же БД)
- Прежде импортировались только глобальные страницы — теперь все

**Подтверждён корректный импорт AI-чатов**
- `apply_import()` правильно назначает новые UUID сессиям и сообщениям, корректно связывает через `session_id`

**Экспорт/импорт настроек приложения**
- `ExportPayload`: новое поле `settings: HashMap<String, String>` (с `#[serde(default)]` для обратной совместимости)
- `ImportPreview`: новое поле `settings_count: usize`
- `build_export_payload(include_settings: bool)`: если флаг — собирает все настройки через `get_all_settings()`
- `apply_import(include_settings: bool)`: если флаг — применяет каждый key-value через `set_setting_value()`
- `export_data` и `apply_import` Tauri-команды: новый параметр `include_settings`
- `tauriCommands.ts`: `ImportPreview.settingsCount`, обновлены сигнатуры `exportData` / `applyImport`
- `ExportDialog.tsx`: чекбокс «Настройки приложения» (по умолчанию выключен)
- `ImportDialog.tsx`: строка статистики «Настроек: N» + чекбокс «Применить настройки» (только если файл содержит настройки)
- Локализация: ключи `export.includeSettings`, `import.statsSettings`, `import.includeSettings` во все 5 локалей

---

### 2026-04-07 — Этапы 14 + 11: Локализация трея, GlobalSearch, Ollama, горячие клавиши, полная локализация

**Локализация системного трея (Этап 14)**
- `db.rs`: новая функция `get_setting_str(key, default) → String`
- `commands.rs`: функция `tray_labels(lang) → (&str, &str)` с переводами на 5 языков; команда `update_tray_language`
- `main.rs` + `lib.rs`: при старте читается `ui.language` из SQLite → правильные надписи трея с первого запуска; добавлен явный ID `"main_tray"` для `TrayIconBuilder`; команда зарегистрирована в обоих файлах
- `tauriCommands.ts`: обёртка `updateTrayLanguage(lang)`
- `SettingsDialog.tsx`: вызов `updateTrayLanguage(lang)` при смене языка (рядом с `i18n.changeLanguage`)

**Полная локализация вкладки "Агенты" (11.A)**
- `zh.json`, `fr.json`, `kk.json`: добавлены `agentsProvider`, `agentsApiKey`, `agentsModel`, `agentsPanelPosition`, `agentsPositionRight`, `agentsPositionBottom`, `agentsTestConnection`, `agentsTestSuccess`, `agentsTestError`

**GlobalSearch — поиск по wiki (11.B)**
- `GlobalSearch.tsx`: новый компонент — модал Cmd+Shift+K, debounce 300ms → `searchWiki()`, результаты с тегами и типом контекста, клавиатурная навигация, при выборе переключает узел дерева + ставит нужную страницу активной
- `App.tsx`: хоткей `Cmd+Shift+K`, рендер `{showGlobalSearch && <GlobalSearch ... />}`
- 5 локалей: секция `globalSearch` с 9 ключами

**Горячие клавиши вкладок терминала (11.C)**
- `App.tsx`: `Cmd+W` (закрыть вкладку), `Cmd+Tab/Shift+Tab` (след/пред вкладка), `Cmd+1-9` (вкладка N), `Cmd+T` (новая сессия для выбранной консоли)
- Все читают стейт через `useAppStore.getState()` без stale closure

**Ollama — локальные модели (11.D)**
- `aiProviders.ts`: `OllamaProvider` с OpenAI-совместимым API (`localhost:11434/v1/chat/completions`); тип `ProviderId` расширен до `"openai" | "anthropic" | "ollama"`
- `SettingsDialog.tsx` (`AgentsTab`): при выборе Ollama — API-ключ скрыт, динамический fetch моделей из `localhost:11434/api/tags`, loading/error состояния, test connection через `/api/tags`
- 5 локалей: ключи `agentsOllamaNote`, `agentsOllamaLoading`, `agentsOllamaNoModels`, `agentsOllamaFetchError`, `agentsTestTesting`

---

### 2026-04-07 — Этап 13: Drag-and-drop + выборочный экспорт + danger в EditConsole

**Drag-and-drop консолей между проектами (13.3)**
- `db.rs`: новая функция `move_console(id, target_project_id)` — `UPDATE consoles SET project_id = ?`
- `commands.rs`: Tauri-команда `move_console`; зарегистрирована в `main.rs` и `lib.rs`
- `tauriCommands.ts`: обёртка `moveConsole(id, targetProjectId)`
- `appStore.ts`: экшен `moveConsoleToProject` — удаляет консоль из старого проекта, вставляет в новый
- `TreePanel.tsx`: **mouse-event DnD** (HTML5 DnD API не работает в Tauri WebKit):
  - `onMouseDown` → `window.addEventListener("mousemove"/"mouseup")`; drag активируется после сдвига ≥ 6px
  - Ghost-лейбл через `createPortal(document.body)` следует за курсором; показывает имя консоли и имя проекта-цели
  - Hit-test по `querySelectorAll("[data-nodetype='project']")` + `getBoundingClientRect`
  - Подсветка проекта-цели: `ring-accent + bg-accent/5`
  - При отпускании — нативный `ask()` с подтверждением, затем `moveConsole` + toast
  - Ключевой баг (исправлен): дроп-хендлер вызывается ДО очистки `draggingConsoleRef.current`
- Локализация: `moveConfirm`, `moveConfirmTitle`, `toastConsoleMoved`, `toastMoveError` во все 5 локалей

**Выборочный экспорт по воркспейсам (13.1)**
- `export.rs`: `build_export_payload` принимает `workspace_ids: Option<&[String]>` — при None экспортирует все
- `commands.rs`: `export_data` — новый параметр `workspace_ids: Option<Vec<String>>`; обновлён в `main.rs` и `lib.rs`
- `tauriCommands.ts`: `exportData(..., workspaceIds?: string[])`
- `ExportDialog.tsx`: когда `includeTree = true` — показывает список воркспейсов с чекбоксами; если все выбраны — передаёт `undefined`; если часть — передаёт массив ID; кнопка заблокирована если ничего не выбрано
- Локализация: ключи `export.selectWorkspaces`, `export.noWorkspaces` во все 5 локалей

**Danger-метка в EditConsoleDialog (13.2)**
- `EditConsoleDialog.tsx`: добавлены `isDanger`/`dangerLabel` state из `ConsoleConfig`; секция danger (чекбокс + поле метки); при сохранении вызывает `setNodeDanger` + обновляет store
- `ContextMenu.tsx`: убран пункт "Пометить/Снять пометку" для console; danger-пометка полностью переходит в диалог настроек
- `TreePanel.tsx`: убрана передача `onToggleDanger` в ContextMenu для console

---

### 2026-04-07 — Этап 12: Системный трей + автозапуск (macOS)

**Автозапуск (12.1)**
- `Cargo.toml`: `tauri-plugin-autostart = "2"`
- `main.rs` / `lib.rs`: `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))` — создаёт/удаляет `~/Library/LaunchAgents/com.devconsole-hub.plist`
- `commands.rs`: три команды — `enable_autostart`, `disable_autostart`, `get_autostart_status`; зарегистрированы в обоих файлах
- `capabilities/default.json`: `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled`
- `tauriCommands.ts`: обёртки `enableAutostart`, `disableAutostart`, `getAutostartStatus`
- `SettingsDialog.tsx`: чекбокс "Запускать при входе в систему" в InterfaceTab; при изменении сразу вызывает команду
- Локализация: `autostart`, `autostartNote`, `autostartError` во все 5 локалей

**Системный трей (12.2)**
- `Cargo.toml`: `tauri = { features = ["tray-icon"] }`
- `main.rs`: `TrayIconBuilder::new()` в `setup()` — иконка `icon.png`, контекстное меню: "Открыть DevConsole Hub" + сепаратор + "Выход"
- Клик по иконке трея → `window.show() + set_focus()`; "Выход" → `app.exit(0)`
- `CloseRequested`: заменён старый диалог подтверждения — теперь читает `get_setting_bool("ui.closeToTray", true)`; если true → `window.hide()`, если false → `app.exit(0)`
- `capabilities/default.json`: `core:tray:default`
- `SettingsDialog.tsx` (InterfaceTab): переключатель "При закрытии окна" — "Свернуть в трей" / "Завершить программу"; пишет `ui.closeToTray` через `set_setting`
- Локализация: `closeBehavior`, `closeToTray`, `closeAndQuit` во все 5 локалей

---

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
| AI панель (OpenAI + Anthropic + Ollama, стриминг, сессии в SQLite) | 98% (drag-and-drop позиции — Post-MVP) |
| Экспорт/импорт (.dchub, AES-256-GCM) | 100% |
| Поиск и навигация (дерево + wiki + GlobalSearch Cmd+Shift+K) | 100% |
| Локализация | 100% (все 5 языков полные; вкладка Агенты, GlobalSearch, Ollama — везде) |
| Post-MVP функции | 0% |

**Общая готовность: ~99.5%** (MVP + AI (OpenAI/Anthropic/Ollama) + GlobalSearch + горячие клавиши вкладок + локализация трея + полная локализация 5 языков)
