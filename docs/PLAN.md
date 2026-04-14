# DevConsole Hub — План разработки

> Последнее обновление: 2026-04-13 (Этап 16 — UX-фиксы: переподключение, контекстное меню, fit терминала)

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
- Drag-and-drop (перетаскивание) — реализовано в Этапе 13.3

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

### 5.3 Drag-and-drop — реализовано в Этапе 13.3

### 5.4 UX-улучшения — ВЫПОЛНЕНО
- Подтверждение закрытия вкладки через нативный ask()
- Подтверждение удаления узлов (workspace / project / console) через ask()
- Danger-пометка: баннер + красный градиент в терминале, индикатор в табе
- Danger-пометка при создании проекта/консоли (чекбокс в диалоге)

---

## Этап 16: UX-фиксы — ВЫПОЛНЕН (2026-04-13)

### 16.1 Переподключение консоли — ВЫПОЛНЕНО
- ПКМ на консоли → пункт "Переподключить" (только если сессия открыта)
- Реализация: `reconnectKey` в `TerminalSession` + `reconnectSession()` в Zustand store
- Инкремент `reconnectKey` меняет `key` у `TerminalView` → React пересоздаёт компонент
- PTY старого процесса корректно завершается через cleanup в `useEffect`
- Локализация на 5 языков (ru/en/zh/fr/kk)

### 16.2 Убрать нативное контекстное меню WebKit — ВЫПОЛНЕНО
- При ПКМ на пустом месте показывался нативный пункт "Reload" из WebKit
- Фикс: глобальный `document.addEventListener("contextmenu", e => e.preventDefault())` в `App.tsx`
- Кастомные контекстные меню работают корректно (они уже вызывают `e.preventDefault()` в обработчике)

### 16.3 Терминал не на всю ширину при первом открытии — ВЫПОЛНЕНО
- `fitAddon.fit()` вызывался до того как WebKit вычислял финальные размеры контейнера
- Фикс: дополнительные вызовы `fit()` через 100ms и 400ms после `term.open()`
- Также добавлен повторный `fit()` через 200ms при переключении на активную вкладку

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

## Этап 10.7: Чат-сессии AI — ВЫПОЛНЕН

По аналогии с wiki: именованные сессии, которые можно создавать, переключать, переименовывать, удалять. История каждой сессии сохраняется в зашифрованной SQLite.

### Что реализовано

**Backend (Rust + SQLite):**
- Две новые таблицы: `ai_sessions` и `ai_messages` (CASCADE delete)
- 8 Tauri-команд: `create_ai_session`, `load_ai_sessions`, `rename_ai_session`, `delete_ai_session`, `load_ai_messages`, `save_ai_message`, `update_ai_message`, `clear_ai_session`
- Зарегистрированы в обоих `main.rs` и `lib.rs`

**TypeScript:**
- `AiSession`, `AiMessage` интерфейсы в `types/index.ts`
- Полные IPC-обёртки в `tauriCommands.ts`
- Store: `aiSessions[]`, `activeAiSessionId`, `aiStreamingMsgId`, CRUD-экшены
- `App.tsx`: загружает сессии при старте, создаёт дефолтную если список пуст

**UX в AiPanel:**
- Дропдаун сессий по клику на заголовок панели
- Кнопка "+" — новая сессия
- Inline-переименование (иконка карандаша → input → Enter/blur)
- Удаление сессии (последняя — только очищает сообщения, не удаляет)
- При смене сессии — история загружается из SQLite
- Каждое сообщение сохраняется в БД сразу при отправке
- После завершения стриминга — финализация content через `update_ai_message`
- Автозаголовок: первые 40 символов ответа AI становятся именем сессии

### Привязка к контексту (опционально, Post-MVP)

Аналогично wiki: сессии можно привязывать к workspace/project/console.

---

## Этап 10.8: Баг-фиксы AI панели — ВЫПОЛНЕН

### 10.8.1 Убрана дублирующая AI-кнопка из таббара терминала — ВЫПОЛНЕНО
- Кнопка `Bot` в правом углу таббара была избыточной — AI панель уже открывается через кнопку в title bar и через `Cmd+I`
- Оставлен только индикатор-точка (`.accent`) при наличии выделенного текста в терминале — он не занимает места и сигнализирует что есть контекст для AI

### 10.8.2 Подтверждение перед удалением чата — ВЫПОЛНЕНО
- `handleDeleteSession`: добавлен `window.confirm("Удалить чат «...»? ...")` перед удалением сессии
- `handleClearChat`: добавлен `window.confirm(...)` перед очисткой истории текущего чата
- Без подтверждения история удалялась случайным кликом без возможности отмены

### 10.8.3 Потеря текста стриминга при смене позиции панели — ВЫПОЛНЕНО
- **Причина**: при смене позиции right ↔ bottom компонент `AiPanel` ремонтируется; `useEffect([activeAiSessionId])` запускался снова и перезагружал сообщения из БД — а там ответ ассистента ещё был пустым (финализация происходит после окончания стриминга)
- **Решение**: добавлена модульная переменная `_loadedSessionId`. `useEffect` пропускает загрузку если та же сессия уже была загружена (`_loadedSessionId === activeAiSessionId`). Загрузка из БД происходит только при реальной смене сессии, не при ремонте компонента

---

## Этап 10.9: UX-улучшения — ВЫПОЛНЕН

### Иконка типа консоли в дереве — ВЫПОЛНЕНО
- `appStore.ts` `getFlatTree()`: `icon: con.connectionType === "ssh" ? "S" : "L"` вместо `">_"`
- `TreePanel.tsx`: иконка консоли рендерится как цветной бейдж (синий для SSH, серый для Local)
- В поиске по дереву (`allNodes`) иконки обновлены аналогично

### Раздельные API-ключи для AI-провайдеров — ВЫПОЛНЕНО
- Ключи хранятся в SQLite как `ai.apiKey.openai` и `ai.apiKey.anthropic`
- `SettingsDialog.tsx` (AgentsTab): одно поле, значение переключается при смене провайдера
- `AiPanel.tsx`: читает ключ по `ai.apiKey.<provider>`, fallback на `ai.apiKey`

### Сохранение состояния раскрытия дерева — ВЫПОЛНЕНО
- Новая функция `set_node_expanded` в db.rs + команда `set_node_expanded` в commands.rs
- Зарегистрирована в main.rs и lib.rs
- `appStore.ts` `toggleNodeExpanded` вызывает `persistNodeExpanded` при каждом переключении

### SSH passphrase — сохранение и автоподстановка — ВЫПОЛНЕНО
- Новая колонка `ssh_passphrase` в таблице `consoles` (automigration)
- Поля passphrase в `CreateConsoleDialog` и `EditConsoleDialog` (маска + show/hide)
- `pty_manager.rs`: `add_key_to_agent()` — SSH_ASKPASS trick для автодобавления ключа в ssh-agent без ввода пароля вручную

---

---

## Этап 10.10: Светлые темы + UX-fix — ВЫПОЛНЕН

### Светлые темы — ВЫПОЛНЕНО
- `themes.ts`: `Solarized Light`, `Catppuccin Latte`, `One Light` с полными xterm-палитрами
- `globals.css`: CSS-переменные для каждой новой темы
- Итого тем: 13 (10 тёмных + 3 светлых)

### UX-фиксы консолей в дереве — ВЫПОЛНЕНО
- `TreePanel.tsx`: убран буквенный badge S/L; SSH-badge перенесён **перед** именем; emoji-иконка у консолей скрыта
- Структура строки консоли: `ssh` (badge) → имя → `⚠ LABEL`

### Сохранение ширины панели дерева — ВЫПОЛНЕНО
- Дефолтная ширина увеличена 250 → 280px
- `Layout.tsx`: при mouseup после ресайза сохраняет `ui.treePanelWidth` в SQLite
- `App.tsx`: восстанавливает ширину из настроек при старте

---

## Этап 10.11: Экспорт/импорт (.dchub) — ВЫПОЛНЕН

### Цели
Возможность сделать резервную копию данных в портативный зашифрованный файл и восстановить их на другой машине.

### Что реализовано

**Rust — новый модуль `export.rs`:**
- Бинарный формат `.dchub`: magic `DCHUB1` (6 байт) + flags (1 байт) + salt (32 байта) + nonce (12 байт) + len (4 байта) + AES-256-GCM ciphertext
- Шифрование: всегда через внутренний app-секрет; опциональный пользовательский пароль добавляет второй слой (PBKDF2-HMAC-SHA256, 100 000 итераций)
- Валидация при импорте: поле `"_verify": "dchub-v1-ok"` в JSON-payload; неверный пароль → ошибка аутентификации GCM
- Функции: `build_export_payload`, `encrypt_export`, `decrypt_export`, `parse_preview`, `apply_import`

**Rust — три новые Tauri-команды:**
- `export_data(file_path, include_tree, include_wiki, include_ai, user_password)` — собирает данные, шифрует, пишет файл
- `preview_import(file_path, user_password)` → `ImportPreview` — расшифровывает, возвращает статистику без изменения БД
- `apply_import(file_path, user_password, include_*, mode)` — применяет импорт (merge / replace)

**Rust — новые функции в `db.rs`:**
- `load_all_wiki_pages()` — все wiki-страницы без фильтрации
- `delete_all_workspaces/wiki_pages/ai_sessions()` — для режима replace
- `get_workspace_names()` — HashSet имён для определения конфликтов

**Cargo.toml — новые зависимости:**
- `aes-gcm = "0.10"`, `pbkdf2 = "0.12"`, `sha2 = "0.10"`, `hmac = "0.12"`, `rand = "0.8"`

**Frontend:**
- `tauriCommands.ts`: обёртки `exportData`, `previewImport`, `applyImport` + интерфейс `ImportPreview`
- `ExportDialog.tsx`: чекбоксы (дерево обязательно, wiki/AI опционально), поле пароля (show/hide)
- `ImportDialog.tsx`: 3-шаговый UI — выбор файла → ввод пароля (если защищён) → превью со статистикой + опции режима + чекбоксы что импортировать
- `TreePanel.tsx`: кнопки Upload (↑ экспорт) и Download (↓ импорт) в header рядом с поиском

### Логика при импорте конфликтов
- Режим **merge**: при совпадении имени workspace добавляет суффикс `(import)`; всем записям назначаются новые UUID
- Режим **replace**: удаляет выбранные данные из БД, затем вставляет из файла
- Wiki, привязанная к конкретным workspace/project/console: **игнорируется** при импорте (ID сменились); импортируются только `parent_type = "global"` страницы ← **исправлено в Этапе 15**

---

## Этап 10.12: UX SSH + локализация экспорт/импорт — ВЫПОЛНЕН

### SSH: пароль сервера + passphrase по условию — ВЫПОЛНЕНО

**Проблема:** в форме SSH отсутствовало поле пароля для аутентификации на сервере (password-based SSH); поле passphrase показывалось всегда, хотя актуально только при наличии ключа.

**Backend:**
- `db.rs`: новая колонка `ssh_password TEXT NOT NULL DEFAULT ''` в `consoles` (automigration)
- `commands.rs`: поле `ssh_password: String` добавлено в `ConsoleConfig`; параметры обновлены в `create_console`, `update_console_config`, `spawn_pty`
- `db.rs`: все запросы (SELECT / INSERT / UPDATE / clone) обновлены
- `pty_manager.rs`: новая логика — если `ssh_password` задан, создаётся временный `SSH_ASKPASS`-скрипт `/tmp/.devconsole_pw_<pid>`, SSH получает переменные `SSH_ASKPASS_REQUIRE=force` и `DISPLAY=dummy`; ключ/passphrase и пароль сервера — независимые пути

**Frontend:**
- `types/index.ts`: `sshPassword: string` в `ConsoleConfig`
- `tauriCommands.ts`: `sshPassword` добавлен во все 3 вызова (`createConsole`, `updateConsoleConfig`, `spawnPty`)
- `CreateConsoleDialog` + `EditConsoleDialog`: новое поле "SSH пароль" (show/hide) видно всегда в SSH-секции; поле "Пароль к ключу" (passphrase) — только когда поле ключа непустое

### SSH по умолчанию в форме — ВЫПОЛНЕНО
- `CreateConsoleDialog`: дефолтный тип изменён `"local"` → `"ssh"`
- В обоих диалогах кнопки переключатора переставлены: `["ssh", "local"]` (SSH — первая кнопка)

### Универсальный текст danger-баннера — ВЫПОЛНЕНО
- `TerminalPanel.tsx`: компонент `DangerWarning` теперь принимает `label: string` и вставляет его в текст
- Вместо "это продакшн-окружение" → "Помечен как «LABEL»" — показывает саму метку пользователя
- Обновлено в 5 локалях: `terminalPanel.dangerWarning` теперь с интерполяцией `{{label}}`

### Локализация ExportDialog и ImportDialog — ВЫПОЛНЕНО
- `ExportDialog.tsx`: полностью переведён на `useTranslation`; убраны все хардкоженные русские строки
- `ImportDialog.tsx`: аналогично; строка ошибки неверного пароля теперь через `t("import.wrongPassword")`
- Новые секции `"export"` и `"import"` добавлены во все 5 локалей: `ru.json`, `en.json`, `zh.json`, `fr.json`, `kk.json`
- Также добавлены недостающие ключи `agentsShowKey`/`agentsHideKey` в `zh.json`, `fr.json`, `kk.json`
- Ключи `sshPassword`, `sshPasswordNote`, `sshPasswordPlaceholder` добавлены в диалоговые секции всех 5 локалей

---

## Этап 15: Исправления экспорта/импорта + настройки в экспорте — ВЫПОЛНЕН

### 15.1 Исправлен импорт wiki-страниц — ВЫПОЛНЕНО

**Проблема:** при импорте дерева всем workspace/project/console назначались новые UUID (чтобы избежать коллизий с существующими записями), но wiki-страницы с `parent_type != "global"` содержали старые `parent_id` — ссылки на не существующие записи. Поэтому они молча отбрасывались, и импортировались только глобальные страницы.

**Исправление в `export.rs` → `apply_import()`:**
- Во время импорта дерева строится `HashMap<String, String>` — маппинг `old_id → new_id` для всех workspace, project и console
- Wiki-страницы с `parent_type = "global"` — импортируются как раньше
- Wiki-страницы с `parent_type = workspace|project|console` + `include_tree = true`: `parent_id` ищется в маппинге → заменяется новым ID → страница сохраняется; если родитель не найден в маппинге — страница пропускается
- Wiki-страницы + `include_tree = false`: сохраняются с оригинальным `parent_id` (работает при merge в ту же БД)

### 15.2 Проверен импорт AI-чатов — ПОДТВЕРЖДЕНО

Код в `apply_import()` корректно:
- Назначает новый UUID каждой сессии
- Назначает новый UUID каждому сообщению
- Связывает сообщения через новый `session_id`
- Вызывает `create_ai_session` + `save_ai_message` — штатные db-функции

### 15.3 Экспорт/импорт настроек — ВЫПОЛНЕНО

**`export.rs`:**
- `ExportPayload`: новое поле `settings: HashMap<String, String>` (с `#[serde(default)]` — обратная совместимость со старыми файлами)
- `ImportPreview`: новое поле `settings_count: usize`
- `build_export_payload(include_settings: bool)`: если `true` — собирает все настройки через `db::get_all_settings()`
- `apply_import(include_settings: bool)`: если `true` и payload не пустой — применяет каждый key-value через `db::set_setting_value()`

**`commands.rs`:**
- `export_data` + `apply_import` — новый параметр `include_settings: bool`

**TypeScript:**
- `ImportPreview`: добавлено `settingsCount: number`
- `exportData()`: новый параметр `includeSettings: boolean`
- `applyImport()`: новый параметр `includeSettings: boolean`

**Frontend:**
- `ExportDialog.tsx`: чекбокс «Настройки приложения» (по умолчанию выключен)
- `ImportDialog.tsx`: строка статистики «Настроек: N» (только если файл содержит настройки); чекбокс «Применить настройки из файла» (только если файл содержит настройки)

**Локализация:** ключи `export.includeSettings`, `import.statsSettings`, `import.includeSettings` во все 5 локалей

---

## Этап 11: Post-MVP

- GlobalSearch (Cmd+Shift+K) — FTS5 по wiki с подсветкой
- Горячие клавиши: Cmd+T/W/Tab/1-9/Delete
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод одновременно в несколько консолей)
- Snippets / быстрые команды с параметрами
- Интеграции: Git (текущая ветка), Docker (статус)
- Wiki: блоки кода с кнопками "Копировать" и "Вставить в терминал" (TipTap NodeView)
- AI панель: drag-and-drop смены позиции (мышью)
- AI панель: Ollama (локальные модели без API-ключа)
- AI панель: привязка сессий к контексту дерева (workspace/project/console)
- OS Keychain для API-ключей

---

## Этап 12: Системная интеграция macOS — ВЫПОЛНЕН (12.1, 12.2; 12.3 пропущен)

---

### 12.1 Автозапуск при входе в систему — ВЫПОЛНЕНО

**Цель:** галочка в Settings → Интерфейс — "Запускать при входе в систему".

**Реализация:**

1. **Rust — плагин** `tauri-plugin-autostart` (официальный Tauri v2 плагин):
  - `Cargo.toml`: добавить `tauri-plugin-autostart`
  - `main.rs` / `lib.rs`: `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))`
  - Плагин создаёт `~/Library/LaunchAgents/com.devconsole-hub.plist` при включении и удаляет при отключении

2. **Rust — две команды** в `commands.rs`:
  - `enable_autostart(app: AppHandle)` — вызывает `AutostartManager::enable()`
  - `disable_autostart(app: AppHandle)` — вызывает `AutostartManager::disable()`
  - `get_autostart_status(app: AppHandle) → bool` — текущее состояние
  - Зарегистрировать в `main.rs` и `lib.rs`

3. **SQLite** — настройка `ui.autostart` (key-value в таблице `settings`)

4. **Frontend:**
  - `tauriCommands.ts`: обёртки `enableAutostart`, `disableAutostart`, `getAutostartStatus`
  - `SettingsDialog.tsx` (вкладка "Интерфейс"): чекбокс "Запускать при входе в систему"
  - При смене чекбокса — сразу вызов команды (без кнопки "Сохранить")
  - `App.tsx`: при старте читает статус из плагина (не из SQLite — источник истины сам LaunchAgent)

5. **Локализация**: ключ `autostart` во все 5 локалей

---

### 12.2 Сворачивание в системный трей — ВЫПОЛНЕНО

**Цель:** по умолчанию крестик сворачивает приложение в трей, а не закрывает; из трея можно открыть или завершить.

**Реализация:**

1. **Rust — плагин** `tauri-plugin-tray` (встроен в Tauri v2, включить capability):
  - `tauri.conf.json` → capabilities: добавить `tray-icon:default`
  - `main.rs` / `lib.rs`: создать `TrayIconBuilder` с иконкой (`icon.png`) и контекстным меню

2. **Контекстное меню трея** (Rust, в `main.rs`):
   ```rust
   let menu = Menu::with_items(app, &[
       &MenuItem::new(app, "Открыть DevConsole Hub", true, None::<&str>),
       &PredefinedMenuItem::separator(app),
       &MenuItem::new(app, "Выход", true, None::<&str>),
   ]);
   ```
  - Клик по иконке трея → `app.get_webview_window("main").show() + set_focus()`
  - "Выход" → `app.exit(0)`

3. **Изменение CloseRequested** (сейчас показывает диалог — этап 8.5.3):
  - Убрать `AtomicBool QUIT_DIALOG_ACTIVE` и диалог подтверждения из `CloseRequested`
  - Новая логика: `CloseRequested` → `api.prevent_close()` → `window.hide()`
  - Завершение только через меню трея ("Выход") или `app.exit(0)`
  - **Опция в Settings**: "При закрытии окна" — переключатель "Свернуть в трей" / "Завершить программу"
  - Настройка `ui.closeToTray` в SQLite (bool, default `true`)
  - В `CloseRequested`: читать настройку и либо `hide()`, либо `app.exit(0)`

4. **Frontend (Settings → Интерфейс)**:
  - Переключатель "При закрытии окна" с двумя вариантами
  - `tauriCommands.ts`: команды не нужны — настройка пишется в SQLite как обычный `set_setting`
  - При запуске из трея (macOS): приложение стартует скрыто — обработать `app_ready` событие

5. **Локализация**: ключи `closeBehavior`, `closeToTray`, `closeAndQuit` в 5 локалей

**Важно для macOS:** при `window.hide()` приложение пропадает из Cmd+Tab (dock), это нормальное поведение для трей-приложений. Если нужно остаться в Dock при скрытии — использовать `NSApp.setActivationPolicy(.accessory)` через Rust FFI (опционально).

---

### 12.3 Подпись и нотаризация macOS (Code Signing + Notarization)

**Цель:** убрать диалог "Приложение от неизвестного разработчика" при первом запуске. Нужен Apple Developer сертификат (уже есть).

**Реализация:**

1. **Конфигурация `tauri.conf.json`**:
   ```json
   "bundle": {
     "macOS": {
       "signingIdentity": "Developer ID Application: <ИМЯ> (<TEAM_ID>)",
       "entitlements": "entitlements.plist",
       "hardenedRuntime": true
     }
   }
   ```

2. **`entitlements.plist`** (создать в корне `src-tauri/`):
   ```xml
   <key>com.apple.security.cs.allow-jit</key><true/>
   <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
   <key>com.apple.security.cs.disable-library-validation</key><true/>
   ```
   Эти права нужны для WebView (WKWebView) в Hardened Runtime.

3. **Нотаризация** — через `notarytool` (Apple ID + App-specific password или API-ключ):
   ```bash
   xcrun notarytool submit devconsole-hub.dmg \
     --apple-id "<APPLE_ID>" \
     --password "<APP_SPECIFIC_PASSWORD>" \
     --team-id "<TEAM_ID>" \
     --wait
   xcrun stapler staple devconsole-hub.dmg
   ```
   Tauri v2 делает это **автоматически** при наличии переменных окружения:
   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: ..."
   export APPLE_ID="..."
   export APPLE_PASSWORD="..."   # App-specific password из appleid.apple.com
   export APPLE_TEAM_ID="..."
   npm run tauri build
   ```

4. **GitHub Actions** (`.github/workflows/build.yml`) — добавить secrets:
  - `APPLE_CERTIFICATE` (base64 от `.p12` файла сертификата)
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - В workflow: шаг импорта сертификата в macOS Keychain перед `npm run tauri build`

5. **Локальная сборка** — один раз прописать переменные в `.env` (не коммитить) или в `.zshrc`:
   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Rocky ... (XXXXXXXXXX)"
   export APPLE_ID="..."
   export APPLE_PASSWORD="..."
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```

6. **Проверка подписи** после сборки:
   ```bash
   codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/DevConsole Hub.app"
   spctl --assess --type execute "src-tauri/target/release/bundle/macos/DevConsole Hub.app"
   ```

**Результат:** первый запуск без диалога Gatekeeper, установка из DMG работает штатно как у App Store-приложений.

---

## Этап 13: Улучшения экспорта и редактирование danger-метки — ВЫПОЛНЕН

---

### 13.1 Выборочный экспорт по воркспейсам — ВЫПОЛНЕНО

**Цель:** в диалоге экспорта можно выбрать конкретные воркспейсы (а не "всё дерево целиком").

**Текущее состояние:** `export_data(filePath, includeTree, includeWiki, includeAi, userPassword)` — флаг `includeTree` включает/исключает дерево целиком. Выбора по воркспейсам нет.

**Реализация:**

1. **Rust — `export_data` в `commands.rs` + `export.rs`:**
    - Новый параметр: `workspace_ids: Option<Vec<String>>` (если `None` или пустой → экспортировать все)
    - `build_export_payload()` в `export.rs`: принимает фильтр workspace_ids, при сборке дерева фильтрует `workspaces` по списку; wiki/AI фильтруется автоматически (только страницы/сессии, привязанные к выбранным workspace+project+console)
    - Зарегистрировать обновлённую команду в `main.rs` и `lib.rs`

2. **TypeScript — `tauriCommands.ts`:**
    - `exportData(..., workspaceIds?: string[])` — добавить опциональный параметр

3. **Frontend — `ExportDialog.tsx`:**
    - Когда `includeTree = true`, показать список воркспейсов из store с чекбоксами (получить через `useAppStore().workspaces`)
    - По умолчанию все чекбоксы отмечены (= поведение как сейчас)
    - Если сняты все → кнопка экспорта заблокирована
    - Если все отмечены → передавать `workspaceIds = undefined` (бэкенд включит всё)
    - Иначе → передавать список отмеченных ID

4. **Локализация:** ключ `export.selectWorkspaces` и `export.allWorkspaces` в 5 локалей

---

### 13.2 Danger-метка: перенос в настройки подключения, удаление из контекстного меню — ВЫПОЛНЕНО

**Проблема:** `EditConsoleDialog` не содержит danger-полей — если при создании допустил ошибку в метке, исправить её нельзя (только снять через контекстное меню и выставить заново через `window.prompt`).

**Решение:** добавить danger-секцию в `EditConsoleDialog` (идентично `CreateConsoleDialog`) и убрать пункт "Пометить/Снять пометку" из контекстного меню — управление меткой полностью переходит в диалог настроек.

**Файлы:**
- `src/components/dialogs/EditConsoleDialog.tsx` — добавить danger-поля
- `src/components/ContextMenu.tsx` — убрать `onToggleDanger` пункт для console
- `src/components/TreePanel.tsx` — убрать `handleToggleDanger` и его передачу в ContextMenu

**Реализация:**

1. **`EditConsoleDialog.tsx`:**
    - Инициализировать state из `ConsoleConfig`: `const [isDanger, setIsDanger] = useState(config.isDanger ?? false)` и `const [dangerLabel, setDangerLabel] = useState(config.dangerLabel || "PRODUCTION")`
    - В форме — тот же блок что в `CreateConsoleDialog` (чекбокс + поле ввода метки при `isDanger = true`)
    - При сохранении: после `updateConsoleConfig(...)` вызвать `setNodeDanger(id, "console", isDanger, finalLabel)` и обновить store

2. **`ContextMenu.tsx`:**
    - Убрать `onToggleDanger` из `ContextMenuProps` и из `buildMenuItems()` для console и project
    - Убрать `import { setNodeDanger }` если он больше нигде не используется в этом файле

3. **`TreePanel.tsx`:**
    - Убрать `handleToggleDanger`, его передачу в `ContextMenu`
    - Убрать `import { setNodeDanger }` если остался только там

4. **Проект** (project-уровень): там тоже есть danger-пометка, но нет диалога редактирования — оставить пункт контекстного меню для проекта как есть (через `window.prompt`), пока не появится `EditProjectDialog`

---

### 13.3 Drag-and-drop консолей между проектами — ВЫПОЛНЕНО

**Цель:** перетащить консоль из одного проекта в другой мышью прямо в дереве.

**Реализация:**

1. **Rust** — команда `move_console(id, target_project_id)` → `UPDATE consoles SET project_id = ?`. Зарегистрирована в `main.rs` и `lib.rs`.

2. **TypeScript** — `moveConsole(id, targetProjectId)` в `tauriCommands.ts`.

3. **Store** — `moveConsoleToProject(consoleId, targetProjectId)` в `appStore.ts`: удаляет консоль из старого проекта, вставляет в новый.

4. **Frontend — `TreePanel.tsx` — mouse-event DnD** (HTML5 DnD API не работает в Tauri WebKit):
    - `onMouseDown` на строках консолей запускает трекер через `window.addEventListener("mousemove"/"mouseup")`
    - Drag активируется после сдвига ≥ 6px (порог, чтобы отличить клик от тащения)
    - Порталовый ghost-элемент следует за курсором, показывает имя консоли и имя проекта-цели
    - Hit-test цели по `getBoundingClientRect` строк с `data-nodetype="project"`
    - Проект-цель подсвечивается (`ring-accent + bg-accent/5`) во время перетаскивания
    - При отпускании — нативный диалог подтверждения (`ask()`), затем `moveConsole` + `moveConsoleToProject`

5. **Ключевой баг:** `draggingConsoleRef.current` обнулялся до вызова дроп-хендлера → хендлер получал `null` и выходил без действия. Исправлено: сначала вызов хендлера, потом очистка ref.

6. **Локализация:** ключи `moveConfirm`, `moveConfirmTitle`, `toastConsoleMoved`, `toastMoveError` во все 5 локалей.

---

## Следующий порядок работы

Все приоритетные пункты выполнены. Остались только Post-MVP:

```
Post-MVP  Горячие клавиши: Delete (удалить выбранный узел)
Post-MVP  AI панель: drag-and-drop смены позиции (11.E — НЕ ДЕЛАЕМ)
Post-MVP  Wiki: блоки кода с кнопками (TipTap NodeView)
Post-MVP  OS Keychain для API-ключей
Post-MVP  Сплит-терминал, Broadcast-режим, Snippets
Post-MVP  macOS Code Signing + Notarization (§12.3)
```

**MVP + AI (OpenAI/Anthropic/Ollama) + GlobalSearch + горячие клавиши вкладок + локализация трея + экспорт/импорт + системная интеграция macOS — всё завершено.**

---

## Этап 11 — Детали реализации незавершённых пунктов

### 11.A Локализация вкладки "Агенты" (zh / fr / kk) — ВЫПОЛНЕНО

**Проблема:** ключи `agentsProvider`, `agentsApiKey`, `agentsModel`, `agentsPanelPosition`, `agentsTestConnection`, `agentsTestSuccess`, `agentsTestError` присутствуют в `ru.json` и `en.json`, но отсутствуют в `zh.json`, `fr.json`, `kk.json` → i18next использует fallback на ключ.

**Файлы:** `src/locales/zh.json`, `src/locales/fr.json`, `src/locales/kk.json`

**Реализация:** скопировать блок `agents*` из `en.json`, перевести значения. Никаких изменений в Rust или TypeScript не требуется. Это чисто текстовая правка трёх файлов.

---

### 11.B GlobalSearch (Cmd+Shift+K) — ВЫПОЛНЕНО

**Цель:** глобальный модал поиска по всем wiki-страницам с подсветкой совпадений в фрагменте контента.

**Backend (уже есть):** FTS5 через `search_wiki(query: String)` возвращает `Vec<WikiSearchResult>` с `title`, `parent_type`, `parent_id`, `snippet`. Новых Rust-команд не нужно.

**Frontend — новый компонент `src/components/GlobalSearch.tsx`:**
1. Модал поверх всего (portal в `document.body`), открывается по `Cmd+Shift+K` в `App.tsx`
2. Input с debounce 300ms → `searchWiki(query)` → список результатов
3. Каждый результат: заголовок страницы, breadcrumb (parentType / parentId), фрагмент контента со `<mark>`-подсветкой из SQLite FTS5 snippet
4. Клик на результат: закрыть модал, выбрать соответствующий узел в дереве, открыть wiki-страницу
5. Навигация стрелками + Enter, Escape — закрыть

**App.tsx:** добавить хоткей `Cmd+Shift+K` аналогично Cmd+P; состояние `showGlobalSearch` в Zustand store.

**Локализация:** ключ `globalSearch`, `globalSearchPlaceholder`, `globalSearchEmpty` в 5 локалях.

---

### 11.C Горячие клавиши для вкладок терминала — ВЫПОЛНЕНО

Все клавиши работают в `TerminalPanel.tsx` через `useEffect` на `keydown` (или в `App.tsx`).

| Комбинация | Действие | Реализация |
|-----------|----------|------------|
| `Cmd+T` | Открыть новую вкладку для выбранной консоли | Найти активную консоль или первую доступную → `openSession()` |
| `Cmd+W` | Закрыть активную вкладку | `closeSession(activeSessionId)` — уже есть в store |
| `Cmd+Tab` | Следующая вкладка | `setActiveSession(sessions[(idx+1) % len].id)` |
| `Cmd+Shift+Tab` | Предыдущая вкладка | `setActiveSession(sessions[(idx-1+len) % len].id)` |
| `Cmd+1..9` | Вкладка N | `setActiveSession(sessions[N-1]?.id)` если существует |
| `Delete` | Удалить выбранный узел дерева | Вызвать ту же логику что в ContextMenu (с подтверждением) |

**Важно:** `Cmd+T` и `Cmd+W` перехватываются WebView до JS — нужно добавить их в `tauri.conf.json` → `app.windows[0].shortcuts` (Tauri v2) или обрабатывать через `preventDefault` в глобальном keydown при фокусе внутри приложения.

---

### 11.D AI панель: Ollama — ВЫПОЛНЕНО

**Цель:** поддержка локальных моделей через Ollama API (localhost:11434) без API-ключа.

**`src/lib/aiProviders.ts`:**
1. Добавить провайдер `"ollama"` в тип `AiProvider`
2. Эндпоинт: `http://localhost:11434/v1/chat/completions` (Ollama поддерживает OpenAI-совместимый API)
3. Заголовок `Authorization` не нужен (или пустой)
4. Список моделей — динамический: `GET http://localhost:11434/api/tags` → `{ models: [{ name }] }`

**`SettingsDialog.tsx` (AgentsTab):**
- Добавить кнопку "Ollama" к переключателю провайдеров
- При выборе Ollama: поле API-ключа скрыто; вместо хардкоженного списка моделей — fetch к localhost + выпадающий список
- Кнопка "Проверить подключение" → `GET localhost:11434/api/tags` → success если ответил

**`tauri.conf.json`:** `connect-src` уже содержит `localhost:11434` (добавлено при реализации AI-прототипа).

**Локализация:** ключи `agentsOllamaNote`, `agentsOllamaNoModels`, `agentsOllamaFetchError` в 5 локалях.

---

### 11.E AI панель: drag-and-drop смены позиции — TODO (низкий приоритет) - пока не делаем

Аналогично DnD консолей в дереве — mouse-event подход (HTML5 DnD не работает в Tauri WebKit).

Реализация: захват за заголовок AI-панели → при перетаскивании определять позицию относительно терминала → если курсор в нижней половине экрана → `aiPanelPosition = "bottom"`, иначе `"right"`. Визуальный ghost с подсветкой зоны.

---

## Этап 14: Локализация системного трея — ВЫПОЛНЕНО

### Проблема

Надписи в меню системного трея (`"Открыть Consoles.work"` и `"Выход"`) захардкожены в `main.rs` на русском языке (`src-tauri/src/main.rs:55-57`). Они не меняются при переключении языка в Settings → Интерфейс, хотя механизм локализации (i18next + SQLite `ui.language`) уже реализован на фронтенде.

Проблема в том, что трей создаётся Rust-кодом, который не имеет доступа к i18next. Решение — читать язык из SQLite в Rust и использовать статическую таблицу переводов.

### Механизм

- Язык хранится в SQLite: ключ `ui.language` (значения: `"ru"`, `"en"`, `"zh"`, `"fr"`, `"kk"`).
- `db.rs` уже имеет функцию `get_setting(key)` → `Option<String>`.
- При запуске: прочитать язык из БД → создать меню с правильными надписями.
- При смене языка пользователем: фронтенд вызывает новую Tauri-команду `update_tray_language(lang)` → Rust пересоздаёт меню трея.

### Реализация

**Шаг 1 — Функция переводов в `main.rs`**

```rust
fn tray_labels(lang: &str) -> (&'static str, &'static str) {
    // Возвращает (show_label, quit_label)
    match lang {
        "en" => ("Open Consoles.work", "Quit"),
        "zh" => ("打开 Consoles.work", "退出"),
        "fr" => ("Ouvrir Consoles.work", "Quitter"),
        "kk" => ("Consoles.work ашу", "Шығу"),
        _    => ("Открыть Consoles.work", "Выход"), // ru + fallback
    }
}
```

**Шаг 2 — Инициализация при старте (`main.rs` → `setup()`)**

```rust
// После db::init():
let lang = db::get_setting("ui.language").unwrap_or_else(|| "ru".to_string());
let (show_label, quit_label) = tray_labels(&lang);
let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
```

Вместо нынешних строк 55-57 с хардкоженным русским текстом.

**Шаг 3 — Хранение `TrayIcon` для обновления**

`TrayIconBuilder::build(app)?` возвращает `TrayIcon`. Сохранить его в глобальном `OnceLock`:

```rust
static TRAY_ICON: OnceLock<tauri::tray::TrayIcon> = OnceLock::new();

// В setup():
let tray = TrayIconBuilder::new()
    .icon(...)
    .menu(&menu)
    // ... обработчики ...
    .build(app)?;
TRAY_ICON.set(tray).ok();
```

**Шаг 4 — Новая функция `rebuild_tray_menu` в `main.rs`**

```rust
pub fn rebuild_tray_menu(app: &tauri::AppHandle, lang: &str) {
    if let Some(tray) = TRAY_ICON.get() {
        let (show_label, quit_label) = tray_labels(lang);
        if let (Ok(show_item), Ok(sep), Ok(quit_item)) = (
            MenuItem::with_id(app, "show", show_label, true, None::<&str>),
            PredefinedMenuItem::separator(app),
            MenuItem::with_id(app, "quit", quit_label, true, None::<&str>),
        ) {
            if let Ok(menu) = Menu::with_items(app, &[&show_item, &sep, &quit_item]) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
}
```

**Шаг 5 — Новая Tauri-команда `update_tray_language` в `commands.rs`**

```rust
#[tauri::command]
pub fn update_tray_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    crate::rebuild_tray_menu(&app, &lang);
    Ok(())
}
```

Зарегистрировать в `main.rs` → `invoke_handler![]` и в `lib.rs` → `invoke_handler![]`.

**Шаг 6 — TypeScript-обёртка в `tauriCommands.ts`**

```ts
export async function updateTrayLanguage(lang: string): Promise<void> {
    await invoke("update_tray_language", { lang });
}
```

**Шаг 7 — Вызов при смене языка в `SettingsDialog.tsx`**

Найти место где вызывается `i18n.changeLanguage(lang)` и `setSetting("ui.language", lang)` — добавить после них:

```ts
await updateTrayLanguage(lang);
```

### Нюанс: `TrayIcon` и `Send + Sync`

`OnceLock<TrayIcon>` работает только если `TrayIcon: Send + Sync`. В Tauri v2 `TrayIcon` реализует оба трейта. Если компилятор выдаст ошибку — обернуть в `Mutex` и снять блокировку при обновлении.

### Альтернативный подход (проще, без глобального стейта)

Вместо хранения `TrayIcon` — использовать `app.tray_by_id("default")` если в `TrayIconBuilder` задан явный ID:

```rust
TrayIconBuilder::new().id("main_tray").icon(...).build(app)?;
// ...
// В команде:
if let Some(tray) = app.tray_by_id("main_tray") {
    let _ = tray.set_menu(Some(new_menu));
}
```

Это чище: не нужен глобальный `OnceLock`, `AppHandle` уже есть в команде.

### Файлы, которые нужно изменить

| Файл | Изменение |
|------|-----------|
| `src-tauri/src/main.rs` | `tray_labels()`, `rebuild_tray_menu()`, явный ID трея `"main_tray"`, использовать язык из БД при инициализации |
| `src-tauri/src/commands.rs` | Новая команда `update_tray_language` |
| `src-tauri/src/main.rs` | Зарегистрировать команду в `invoke_handler![]` |
| `src-tauri/src/lib.rs` | Зарегистрировать команду в `invoke_handler![]` |
| `src/lib/tauriCommands.ts` | Обёртка `updateTrayLanguage(lang)` |
| `src/components/SettingsDialog.tsx` | Вызов `updateTrayLanguage(lang)` при смене языка |
