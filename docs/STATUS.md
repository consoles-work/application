# DevConsole Hub — Статус проекта

> Последнее обновление: 2026-03-29 (Этап 10.8 — баг-фиксы AI панели)

---

## Что реально готово и работает

### Инфраструктура
- Tauri 2.0 проект компилируется и запускается
- Все npm-зависимости установлены (xterm.js, TipTap, lowlight, lucide-react, plugin-dialog)
- Cargo.toml: rusqlite, portable-pty, uuid, dirs, chrono, tauri-plugin-dialog
- Tailwind настроен через CSS-переменные (10 тем, динамическая смена)
- Capabilities: core:default, event listen/unlisten/emit, shell:open, dialog

### Frontend (React + TypeScript)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src/types/index.ts` | ✅ Готово | Все интерфейсы: WikiPage (camelCase), isDanger/dangerLabel, SSH-поля, AppSettings |
| `src/stores/appStore.ts` | ✅ Готово | CRUD + Toast + Wiki + Settings + AI сессии (`aiSessions[]`, `activeAiSessionId`, CRUD-экшены) |
| `src/lib/tauriCommands.ts` | ✅ Готово | Все IPC-обёртки: дерево, PTY, wiki, clone, settings, AI сессии (8 функций) |
| `src/types/index.ts` | ✅ Готово | Добавлены `AiSession`, `AiMessage` |
| `src/lib/themes.ts` | ✅ Готово | 10 тем с UI-цветами и полной xterm-палитрой, resolveThemeId, applyTheme |
| `src/components/Layout.tsx` | ✅ Готово | Трёхпанельный layout с resizable сплиттерами + кнопка Settings в titlebar |
| `src/components/TreePanel.tsx` | ✅ Готово | Дерево + раскрытие по клику на строку + контекстное меню + inline rename (F2) + danger/ssh badge + клонирование + поиск по дереву |
| `src/components/TerminalPanel.tsx` | ✅ Готово | xterm.js + PTY + danger-баннер + SSH + startup + динамические настройки; убрана дублирующая Bot-кнопка из таббара; индикатор-точка при выделении текста |
| `src/components/WikiPanel.tsx` | ✅ Готово | TipTap редактор + привязка к узлу + автосохранение debounce + теги + поиск по wiki (FTS5) |
| `src/components/WikiToolbar.tsx` | ✅ Готово | H1/H2/H3, Bold/Italic/Code, списки, TaskList, CodeBlock, HR, Undo/Redo |
| `src/components/CommandPalette.tsx` | ✅ Готово | Fuzzy-поиск по дереву, ↑↓/Enter/Esc, danger badge |
| `src/components/SettingsDialog.tsx` | ✅ Готово | 3 вкладки: Данные (БД-инфо), Терминал (шрифт/размер/scrollback/курсор), Интерфейс (10 тем + random, язык-заготовка) |
| `src/components/Toast.tsx` | ✅ Готово | Success/error/info, автоисчезновение 3 сек |
| `src/components/ContextMenu.tsx` | ✅ Готово | Workspace/Project/Console меню + danger-пометка + клонирование + подтверждение удаления (ask) |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | ✅ Готово | Имя + emoji + цвет |
| `src/components/dialogs/CreateProjectDialog.tsx` | ✅ Готово | Имя + Browse + shell + emoji + цвет + danger-чекбокс |
| `src/components/dialogs/CreateConsoleDialog.tsx` | ✅ Готово | Имя + Local/SSH + все SSH-поля + Browse для ключа + textarea startup + danger-чекбокс |
| `src/components/dialogs/EditConsoleDialog.tsx` | ✅ Готово | Редактирование существующей консоли |
| `src/App.tsx` | ✅ Готово | Загрузка данных + настроек + применение темы при старте; восстановление видимости панелей из SQLite; Cmd+B/\\/P/, |
| `src/styles/globals.css` | ✅ Готово | CSS-переменные для 10 тем + xterm.js + TipTap стили |

### Backend (Rust)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/main.rs` | ✅ Готово | 33 IPC-команды (включая 8 AI-сессий) |
| `src-tauri/src/lib.rs` | ✅ Готово | Дубликат для мобильных/библиотечной сборки — синхронизирован с main.rs |
| `src-tauri/src/commands.rs` | ✅ Готово | CRUD дерева, PTY, wiki, danger, clone, settings; `AiSession`/`AiMessage` структуры + 8 команд |
| `src-tauri/src/db.rs` | ✅ Готово | Полный CRUD + FTS5 + клонирование + settings + SQLCipher (AES-256) + таблицы `ai_sessions`/`ai_messages` + CRUD AI-сессий |
| `src-tauri/src/pty_manager.rs` | ✅ Готово | portable-pty: spawn/write/resize/kill; `sh -c` для команд с пробелами; явная установка `LANG`/`LC_CTYPE`/`TERM` для поддержки UTF-8 (кириллица) |
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
| AI панель: локализация (zh/fr/kk) | Низкий | ru/en добавлены; остальные — fallback |
| OS Keychain для API-ключей | Низкий | Сейчас в зашифрованной SQLite |
| Горячие клавиши (Cmd+T/W/Tab/1-9/Delete) | Средний | Post-MVP |
| `GlobalSearch.tsx` (Cmd+Shift+K) | Средний | Глобальный модал поиска с подсветкой |
| Wiki: блоки кода с кнопками | Низкий | TipTap NodeView: "Копировать" + "Вставить в терминал" |
| Drag-and-drop в дереве | Отменено | — |

### Post-MVP
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод в несколько консолей)
- Snippets / быстрые команды
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git, Docker

---

## История изменений

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
| SSH-подключение | 100% |
| Wiki / TipTap (редактор + теги + поиск) | 100% |
| Настройки (Settings + темы) | 100% |
| Система тем (10 тем + random) | 100% |
| Шифрование БД (SQLCipher + compile-time key) | 100% |
| AI панель (OpenAI + Anthropic, стриминг, сессии в SQLite) | 95% (Ollama, drag-and-drop позиции — Post-MVP) |
| Поиск и навигация (дерево + wiki) | 85% (GlobalSearch-модал отсутствует) |
| Локализация | 70% (ru/en полностью; zh/fr/kk — без AI-ключей) |
| Post-MVP функции | 0% |

**Общая готовность: ~97%** (MVP + AI с персистентной историей)
