# DevConsole Hub — План разработки

> Последнее обновление: 2026-03-29

---

## Этап 1: Рабочий терминал — ВЫПОЛНЕН

### 1.1 db.rs: PRAGMA foreign_keys — ВЫПОЛНЕНО
### 1.2 lib.rs + main.rs: AppHandle глобально — ВЫПОЛНЕНО
### 1.3 pty_manager.rs: реальный PTY — ВЫПОЛНЕНО
- portable-pty: spawn/write/resize/kill
- фоновый поток с emit "pty-output"
- автоопределение шелла по ОС
- исправлен запуск команд с пробелами (ssh и т.д.) через `sh -c`
### 1.4 TerminalPanel.tsx: xterm.js — ВЫПОЛНЕНО
- Terminal + FitAddon, ResizeObserver
- подписка на pty-output, ввод через writeToPty
- startup commands, корректный lifecycle (скрыть/показать, не пересоздавать)
### Дополнительно
- Capabilities: core:event listen/unlisten/emit
- CSS xterm.js подключён

---

## Этап 2: Дерево проектов — ВЫПОЛНЕН

### 2.1 Загрузка данных из SQLite — ВЫПОЛНЕНО
- App.tsx: loadAllWorkspaces() вместо демо-данных
### 2.2 Toast-уведомления — ВЫПОЛНЕНО
- Toast.tsx: success/error/info, 3 сек автоисчезновение
- showToast/removeToast в Zustand store
### 2.3 Контекстное меню — ВЫПОЛНЕНО
- ContextMenu.tsx: портал в body, позиция по клику, Escape/клик вне
- Workspace: добавить проект, переименовать, удалить
- Project: добавить консоль, дублировать, открыть в VS Code/Finder, переименовать, удалить
- Console: запустить, настройки подключения, дублировать, переименовать, удалить
- Подтверждение удаления через нативный ask() для всех типов узлов
### 2.4 Диалоги создания — ВЫПОЛНЕНО
- CreateWorkspaceDialog: имя, emoji, цвет
- CreateProjectDialog: имя, Browse (plugin-dialog), shell, emoji, цвет
- CreateConsoleDialog: имя, тип подключения, SSH-поля, startup команды
### 2.5 Inline rename — ВЫПОЛНЕНО
- F2 или двойной клик → input в строке дерева
- Enter = сохранить через Rust + store, Escape = отмена
### 2.6 Новые Rust-команды — ВЫПОЛНЕНО
- update_project, update_console, update_console_config в commands.rs + db.rs
- tauri-plugin-dialog подключён в Rust и capabilities
### 2.7 UX-улучшения дерева — ВЫПОЛНЕНО
- Иконки раскрытия: ChevronRight/ChevronDown
- Клик по строке workspace/project раскрывает/сворачивает (не только по иконке)
- SSH badge (синий) для SSH-консолей
### 2.8 Пометка "Опасный узел" — ВЫПОЛНЕНО
- Поля is_danger + danger_label в projects и consoles (SQLite + Rust)
- Красный badge ⚠ PRODUCTION в дереве
- Контекстное меню: "Пометить как опасный..." / "Снять пометку"

### Остаток Этапа 2
- Drag-and-drop (перетаскивание) — ОТМЕНЕНО, не нужно

---

## Этап 3: Wiki — TipTap редактор — ВЫПОЛНЕН

### 3.1 Подключить TipTap в WikiPanel.tsx — ВЫПОЛНЕНО
- TipTap с StarterKit, CodeBlockLowlight, Placeholder, TaskList, TaskItem
- Контент сохраняется как TipTap JSON
### 3.2 WikiToolbar.tsx — ВЫПОЛНЕНО
- H1/H2/H3, Bold/Italic/Code, BulletList/OrderedList/TaskList, CodeBlock, HR, Undo/Redo
- Иконки из lucide-react
### 3.3 Контекстная привязка к дереву — ВЫПОЛНЕНО
- selectedNode=null → global wiki (parentType="global", parentId="global")
- selectedNode=workspace/project/console → привязка к узлу
- Список страниц (выпадающий), переключение, кнопка "Новая страница"
### 3.4 Автосохранение — ВЫПОЛНЕНО
- debounce 1000ms → saveWikiPage() → Rust upsert
- Сохранение при размонтировании компонента
- Исправлен баг camelCase/snake_case: WikiPage поля теперь parentType/parentId/createdAt/updatedAt
- Исправлен stale closure в TipTap onUpdate (activePageRef)
### 3.5 Теги — ВЫПОЛНЕНО
- Ввод через Enter/запятую, пилюли с удалением
- Сохраняются в WikiPage.tags
### 3.6 Блоки кода — кнопки действий — ОТЛОЖЕНО
- Требует TipTap NodeView (Post-MVP)

---

## Этап 4: Поиск и навигация — ВЫПОЛНЕН

### 4.1 CommandPalette.tsx (Cmd+P) — ВЫПОЛНЕНО
- Модал по центру, fuzzy-поиск (подстрока) по именам узлов
- Результаты с типом (WS/PRJ/CON), иконкой, danger-badge
- Клавиши: Escape закрыть, стрелки навигация, Enter перейти
- Открытие сессии при выборе консоли

### 4.2 Поиск по дереву в TreePanel — ВЫПОЛНЕНО
- Иконка 🔍 в header TreePanel открывает поле ввода
- Поиск по всем узлам (включая свёрнутые), подстрока по имени
- Результаты: имя, тип (WS/PRJ/CON), breadcrumb-путь
- Клик → выбор узла / открытие сессии; Escape → выход

### 4.3 Поиск по wiki в WikiPanel — ВЫПОЛНЕНО
- Иконка 🔍 в header WikiPanel открывает поле ввода
- FTS5 поиск через `searchWiki(query)`, debounce 300ms
- Результаты: заголовок страницы, тип контекста, теги
- Клик → загружает контекст, открывает страницу, закрывает поиск

### 4.4 GlobalSearch.tsx (Cmd+Shift+K) — Post-MVP
- Глобальный модал поиска с preview и подсветкой совпадений

---

## Этап 5: Настройки и UX-polish — ЧАСТИЧНО ВЫПОЛНЕН

### 5.1 Горячие клавиши — ЧАСТИЧНО ВЫПОЛНЕНО
Работают: Cmd+B, Cmd+\, F2, Cmd+P, Cmd+,
Осталось (Post-MVP):
- Cmd+Shift+K → GlobalSearch
- Cmd+T → новая вкладка
- Cmd+W → закрыть активную вкладку
- Cmd+Tab / Cmd+Shift+Tab → переключение вкладок
- Cmd+1..9 → вкладка N
- Delete → удалить выбранный узел

### 5.2 Settings (Cmd+,) — ВЫПОЛНЕНО
- Компонент: `src/components/SettingsDialog.tsx`
- Кнопка "Settings" в titlebar
- Вкладка "Данные": путь к БД, "Показать в Finder", "Скопировать путь", размер, дата создания
- Вкладка "Терминал": шрифт (4 варианта), размер (12–20px), scrollback (1k–50k), курсор
- Вкладка "Интерфейс": выбор темы (10 тем + случайная), заготовка языка
- Настройки сохраняются в SQLite `settings (key, value)`, загружаются при старте

### 5.3 Drag-and-drop — ОТМЕНЕНО

### 5.4 UX-улучшения — ВЫПОЛНЕНО
- Подтверждение закрытия вкладки через нативный ask()
- Подтверждение удаления узлов (workspace / project / console) через ask()
- Danger-пометка: баннер + красный градиент в терминале, индикатор в табе
- Danger-пометка при создании проекта/консоли (чекбокс в диалоге)

---

## Этап 6: Конфигурация подключения консоли — ВЫПОЛНЕН

### 6.1 Типы подключения — ВЫПОЛНЕНО
- `connection_type`: `"local"` (шелл) или `"ssh"` (удалённый сервер)
- Поля: `ssh_host`, `ssh_port` (default 22), `ssh_user`, `ssh_key_path`, `ssh_extra_args`
- При открытии SSH-консоли PTY автоматически запускает: `ssh [-p port] [-i key] [extra] user@host`

### 6.2 Startup-команды — ВЫПОЛНЕНО
- Поле `startup_cmd` многострочное (textarea)
- Каждая строка = отдельная команда, выполняется последовательно с задержкой 400ms
- Работает и для local, и для SSH

### 6.3 Backend (Rust + SQLite) — ВЫПОЛНЕНО
- Новые колонки в таблице `consoles`: `connection_type`, `ssh_*`
- Автомиграция для существующих БД
- Команда `update_console_config`

### 6.4 Frontend — ВЫПОЛНЕНО
- `CreateConsoleDialog` — переключатель Local/SSH, все SSH-поля, Browse для ключа
- `EditConsoleDialog` — редактирование через контекстное меню "Настройки подключения..."
- SSH badge (синий) в дереве

---

## Этап 7: Клонирование и настройки — ВЫПОЛНЕН

### 7.1 Клонирование консоли — ВЫПОЛНЕНО
- Контекстное меню консоли → "Дублировать консоль"
- Копия с именем `{имя} (copy)`, новый UUID, тот же project
- Копирует все поля: connection_type, SSH-параметры, startup_cmd, is_danger, danger_label
- Backend: `clone_console(id)` → db.rs + commands.rs + main.rs + lib.rs
- Frontend: `onCloneConsole` в ContextMenu, обработчик ищет проект через workspaces (обход camelCase-мисматча)

### 7.2 Клонирование проекта — ВЫПОЛНЕНО
- Контекстное меню проекта → "Дублировать проект"
- Копия с именем `{имя} (copy)` + все консоли с новыми UUID
- Backend: `clone_project(id)` — транзакция: INSERT project + INSERT все consoles
- Frontend: `onCloneProject`, ищет workspace через workspaces

### 7.3 Окно настроек — ВЫПОЛНЕНО (см. 5.2)

### 7.4 Система тем — ВЫПОЛНЕНО
- 10 тем: GitHub Dark, GitHub Light, Dracula, Monokai, Nord, Solarized Dark, Tokyo Night, Catppuccin, One Dark, Gruvbox Dark
- Режим "Случайная" — каждый запуск новая тема из 10
- CSS-переменные на `[data-theme="X"]` — мгновенная смена без перезагрузки
- Tailwind использует CSS-переменные для всех цветов UI
- xterm.js: каждая тема имеет полную 16-цветную ANSI-палитру, применяется при смене темы
- Настройка сохраняется в SQLite, применяется при старте

---

## Этап 8: Локализация — ВЫПОЛНЕН

### 8.1 Выбор библиотеки — ВЫПОЛНЕНО
- `i18next` + `react-i18next`
- Файлы переводов: `src/locales/ru.json`, `src/locales/en.json`
- Конфиг: `src/lib/i18n.ts` (bundled, без HTTP — совместимо с Tauri)

### 8.2 Что переводится — ВЫПОЛНЕНО
- Все UI-строки: кнопки, placeholder-ы, toast-сообщения, заголовки диалогов
- Контекстные меню, тулбары, хинты, пустые состояния
- Компоненты: Layout, TreePanel, ContextMenu, TerminalPanel, WikiPanel, WikiToolbar,
  CommandPalette, SettingsDialog, все диалоги создания/редактирования

### 8.3 Что НЕ переводится — ВЫПОЛНЕНО
- Данные пользователя (имена воркспейсов, консолей, wiki-контент)
- Технические идентификаторы (ssh, local, bash, zsh, Local, SSH)

### 8.4 Переключение языка — ВЫПОЛНЕНО
- Settings → "Интерфейс" → кнопки ru / en / zh / fr / kk
- Сохраняется в `settings` (key: `ui.language`)
- Применяется мгновенно через `i18n.changeLanguage(lang)`
- Загружается из SQLite при старте в App.tsx

---

## Этап 8.5: Баг-фиксы и UX — ВЫПОЛНЕН

### 8.5.1 Исправлен camelCase-мисматч в ConsoleConfig — ВЫПОЛНЕНО
- Rust возвращает поля в camelCase (`startupCmd`, `shellOverride`, `cwdOverride`, `envVars`, `projectId`, `sortOrder`)
- TypeScript-тип `ConsoleConfig` теперь полностью camelCase (исправлено: `startup_cmd` → `startupCmd` и др.)
- `TerminalPanel.tsx`: стартовые команды теперь корректно читаются из `consoleConfig.startupCmd`
- `EditConsoleDialog.tsx`: инициализация `startupCmd` и сохранение через `startupCmd:` вместо `startup_cmd:`

### 8.5.2 Исправлено сохранение icon/color при создании проекта — ВЫПОЛНЕНО
- `create_project` (Rust) принимал только `name/path/default_shell`, игнорировал `icon`/`color` → хардкодил `📁 / #58a6ff`
- Добавлены параметры `icon: String, color: String` в `create_project` (commands.rs)
- Обновлены: `tauriCommands.ts` → `createProject(...)`, `CreateProjectDialog.tsx` → передаёт реальные значения
- Теперь выбранные emoji и цвет сохраняются в БД и не сбрасываются при перезапуске

### 8.5.3 Подтверждение закрытия приложения — ВЫПОЛНЕНО
- При нажатии кнопки закрытия окна показывается нативный диалог: "Are you sure you want to quit?" / "Quit"
- Реализовано **полностью на стороне Rust** в `on_window_event` (`main.rs` + `lib.rs`):
  - `CloseRequested` → `api.prevent_close()` → диалог в отдельном потоке (`std::thread::spawn`)
  - `AtomicBool QUIT_DIALOG_ACTIVE` — предотвращает повторные срабатывания пока диалог открыт
  - При «OK» → `app.exit(0)` завершает процесс напрямую
  - При «Cancel» → флаг сбрасывается, следующее нажатие X снова покажет диалог
- Использует `tauri_plugin_dialog::MessageDialogButtons::OkCancel` + `MessageDialogKind::Warning`
- JS не участвует — исключает цикличность spurious CloseRequested событий на macOS
- Текст на английском (i18n из Rust недоступен)

---

## Этап 9: Шифрование БД — ВЫПОЛНЕН

### 9.1 SQLCipher — ВЫПОЛНЕНО
- `Cargo.toml`: `bundled` → `bundled-sqlcipher` (AES-256 шифрование всего файла)
- `build.rs`: читает `.env` из корня проекта; встраивает `DB_ENCRYPTION_KEY` в бинарник через `env!()`
- `db.rs`: `PRAGMA key='...'` как первая операция после открытия соединения
- Автомиграция: если найдена plain-text БД → backup + пересоздание зашифрованной

### 9.2 Переменные окружения — ВЫПОЛНЕНО
- `.env` — локальный файл с ключом (в `.gitignore`)
- `.env.example` — шаблон для новых разработчиков
- Для продакшн: `export DB_ENCRYPTION_KEY="$(openssl rand -hex 32)" && npm run tauri build`

---

## Этап 10: AI Ассистент — ПРОТОТИП ВЫПОЛНЕН

### 10.1 Провайдеры AI — ВЫПОЛНЕНО
- `src/lib/aiProviders.ts` — абстракция `AiProvider`: OpenAI + Anthropic
- Стриминг SSE через `fetch()` + `ReadableStream` (без новых Rust-команд)
- CSP в `tauri.conf.json` разрешает `connect-src` для AI-эндпоинтов

### 10.2 AiPanel.tsx — ВЫПОЛНЕНО
- Чат с историей сообщений (только в памяти — для прототипа)
- Стриминг ответа в реальном времени (эффект "печатающего текста")
- Контекст из выделения терминала: блок с превью и кнопкой убрать
- Кнопки позиции Right/Bottom в заголовке (мгновенное переключение)
- Стоп-кнопка для прерывания стриминга (`AbortController`)
- Быстрый выбор провайдера если не настроен

### 10.3 Layout — ВЫПОЛНЕНО
- Позиция "справа": панель между терминалом и wiki, resizable-сплиттер
- Позиция "снизу": панель под терминалом, горизонтальный resizable-сплиттер
- Кнопка AI в title bar с индикатором-точкой при наличии выделения

### 10.4 TerminalPanel — ВЫПОЛНЕНО
- `terminal.onSelectionChange` → `terminalSelection` в Zustand store
- Кнопка `Bot` в баре вкладок: открывает AI панель, индикатор при выделении

### 10.5 Settings → вкладка "Агенты" — ВЫПОЛНЕНО
- Выбор провайдера (OpenAI / Anthropic)
- API-ключ с show/hide
- Выбор модели (кнопки, список зависит от провайдера)
- Позиция панели (Right / Bottom)
- Кнопка "Проверить подключение" → Toast с результатом

### 10.6 Горячая клавиша — ВЫПОЛНЕНО
- `Cmd/Ctrl+I` — toggle AI панели
- Состояние сохраняется в SQLite, восстанавливается при старте

### 10.x Остаток (Post-prototype)
- Drag-and-drop смены позиции панели (мышью)
- Ollama: локальные модели без API-ключа
- Локализация AI-ключей для zh/fr/kk
- OS Keychain для API-ключей (сейчас в зашифрованной SQLite)

---

## Этап 10.7: Чат-сессии AI (группы вопросов) — ПЛАН

По аналогии с wiki: вместо одного общего чата — именованные сессии, которые можно создавать, переключать, удалять. История каждой сессии сохраняется в SQLite.

### Концепция UX

```
┌─────────────────────────────────────┐
│ AI Ассистент   [+] [▼ Отладка nginx]│  ← дропдаун сессий + кнопка создать
├─────────────────────────────────────┤
│  Сессии:                            │
│  ● Отладка nginx          [×]       │  ← активная
│    Разбор docker-compose  [×]       │
│    Объяснение ошибки CI   [×]       │
└─────────────────────────────────────┘
```

Список сессий — небольшой дропдаун или боковая панель (как список страниц в wiki).

### Схема данных (SQLite)

```sql
CREATE TABLE ai_sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'Новый чат',
    provider    TEXT NOT NULL,           -- "openai" / "anthropic"
    model       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE ai_messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,           -- "user" / "assistant" / "system"
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_ai_messages_session ON ai_messages(session_id);
```

Сессия сохраняется в зашифрованной SQLite — история чатов защищена вместе с остальными данными.

### Новые Tauri-команды (checklist)

По стандартному чеклисту (commands.rs → db.rs → main.rs → lib.rs → tauriCommands.ts):

1. `create_ai_session(title, provider, model)` → `AiSession`
2. `load_ai_sessions()` → `AiSession[]`
3. `rename_ai_session(id, title)` → `void`
4. `delete_ai_session(id)` → `void`
5. `load_ai_messages(session_id)` → `AiMessage[]`
6. `save_ai_message(session_id, role, content)` → `AiMessage`
7. `clear_ai_session(session_id)` → `void` (удалить все сообщения, оставить сессию)

### Изменения фронтенда

- **`src/types/index.ts`** — добавить `AiSession`, `AiMessage`
- **`src/stores/appStore.ts`** — добавить `aiSessions[]`, `activeAiSessionId`, CRUD-экшены
- **`src/components/AiPanel.tsx`** — переработать: список сессий (дропдаун), кнопка "+" создать, переключение между сессиями, история из SQLite
- Сообщения загружаются из БД при выборе сессии, отправленные — сохраняются сразу

### Автозаголовок сессии

При создании сессии — заголовок "Новый чат". После первого ответа AI — автоматически генерировать заголовок: отправить `messages[0].content.slice(0, 100)` в отдельный запрос с промптом `"Дай краткий заголовок (до 5 слов) для этого вопроса:"`. Результат сохранить через `rename_ai_session`.

### Привязка к контексту (опционально, Post-MVP)

Аналогично wiki: сессии можно привязывать к workspace/project/console. Тогда при выборе консоли в дереве — AI панель показывает сессии именно для этого контекста.

---

## Этап 11: Post-MVP

- GlobalSearch (Cmd+Shift+K) — FTS5 по wiki с подсветкой
- Горячие клавиши: Cmd+T/W/Tab/1-9/Delete
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод одновременно в несколько консолей)
- Snippets / быстрые команды с параметрами
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git (текущая ветка), Docker (статус)
- Wiki: блоки кода с кнопками "Копировать" и "Вставить в терминал" (TipTap NodeView)

---

## Следующий порядок работы

```
10.7 AI чат-сессии (SQLite-история + группы вопросов)
10.x AI панель: drag-and-drop позиции
10.x AI панель: Ollama
11.x GlobalSearch (Cmd+Shift+K)
11.x Горячие клавиши: Cmd+T/W/Tab/1-9/Delete
```

**MVP + AI прототип завершён.**
