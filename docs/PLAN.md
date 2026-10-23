# DevConsole Hub — План разработки

> Последнее обновление: 2026-10-23 (Этап 34 — рефакторинг всего кода по `readable-flow`, исправлены snake_case-поля дерева, автосохранение wiki, пометка «опасно»; Этап 33 — скилл `readable-flow` для приведения кода Rust + TS в порядок; Этап 32 — перестановка вкладок терминала перетаскиванием; Этап 31 — кликабельные ссылки в терминале, wiki, AI-чате и заметке консоли; Этап 30 — недавние консоли в левой панели; Этап 29 — сброс цвета, протёкшего из прерванной программы; Этап 28 — раздел «SSH-ключи»: инвентаризация и аудит; Этап 27 — постоянная подпись dev-сборки на macOS; Этап 26 — ссылка на сайт, «О программе», версионирование, версия 0.2.0; Этап 25 — крестик закрытия на всех вкладках терминала; Этап 24 — окно из трея по запуску из «Программ»/Dock на macOS; Этап 23 — настройки воркспейса и проекта, убраны VS Code/Finder; Этап 22 — вкладки в диалоге консоли, хостинг-комбобокс, иконка и цвет консоли; Этап 21 — статистика использования; Этап 20.3 — счётчик запусков быстрых команд и сэкономленное время; Этап 19 — ключ БД из пароля, запланирован)

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
- Project: добавить консоль, дублировать, переименовать, удалить (в этапе 23 убраны «Открыть в VS Code/Finder», «Переименовать» заменён на «Настройки...»)
- Console: запустить, настройки подключения, дублировать, переименовать, удалить («Переименовать» убран в этапе 23 — имя меняется в настройках, F2)
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
- *Позже (этап 12) диалог убрали в пользу трея; вернули и расширили на все пути выхода в этапе 20.2.*

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
- Snippets / быстрые команды с параметрами (быстрые команды без параметров — этап 20.1)
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

```
Этап 19   Безопасность: ключ БД из пароля пользователя + исправление ограничений (см. ниже)
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

---

## Этап 18: Пароль на вход — ВЫПОЛНЕН (2026-10-03)

- `src-tauri/src/security.rs` — Argon2id-хеш (крейт `argon2 0.5`) в `settings` под ключом `security.passwordHash`; `is_set` / `verify` / `set_password` (смена и снятие — только с верным текущим паролем)
- Команды `is_password_set`, `verify_password`, `set_password` (зарегистрированы в `main.rs` и `lib.rs`)
- Ключи `security.*` закрыты: `get_all_settings` их не отдаёт (а значит, и экспорт), `set_setting` их не пишет, `apply_import` их пропускает
- `src/components/LockScreen.tsx` — полноэкранный экран блокировки, фон — анимированный «терминальный» вывод на canvas в цветах темы
- `App.tsx` — гейт: пока пароль не введён, `MainApp` не монтируется и данные из БД не загружаются (тема и язык применяются заранее)
- `SettingsDialog.tsx` — вкладка «Безопасность»; локализация `security.*` на 5 языков
- **Автоблокировка по бездействию:** настройка `ui.autoLockMinutes` (0 — выкл; пресеты 1/5/10/15/30/60 + произвольное число до 1440). `App.tsx` ловит `mousemove`/`mousedown`/`keydown`/`wheel`/`touchstart` в capture-фазе, сравнивает метку последней активности с порогом раз в 10 с и при `focus`/`visibilitychange` (после сна и возврата из трея). При срабатывании `MainApp` не размонтируется (иначе оборвутся PTY) — `LockScreen` ложится оверлеем `z-[10000]`, интерфейс под ним получает `inert`, а `stopPropagation` в `onKeyDown` оверлея не пускает клавиши к глобальным хоткеям

Известные ограничения — README, раздел «Безопасность и известные ограничения». Их исправление — этап 19.

---

## Этап 20: Быстрые команды + подтверждение выхода — ВЫПОЛНЕН (2026-10-12)

### 20.1 Быстрые команды консоли — ВЫПОЛНЕНО

- У каждой консоли свой список кнопок: подпись, команда (может быть многострочной), необязательное описание
- **Хранение:** JSON-колонка `consoles.quick_commands` (`TEXT NOT NULL DEFAULT '[]'`, миграция через `ALTER TABLE ... .ok()`); Rust-тип `QuickCommand`, поле `ConsoleConfig.quick_commands` с `#[serde(default)]`
- Команда `set_console_quick_commands(id, commands)` — заменяет список целиком (зарегистрирована в `main.rs` и `lib.rs`), обёртка `setConsoleQuickCommands` в `tauriCommands.ts`
- `db.rs`: общие `CONSOLE_COLUMNS` / `console_from_row` / `write_console` вместо четырёх копий INSERT/SELECT консоли (загрузка, сохранение, клон консоли, клон проекта)
- **Экспорт/импорт `.dchub`:** команды едут вместе с деревом автоматически (часть `ConsoleConfig`); старые файлы импортируются без них. Публичный `.md`-экспорт серверов их не включает
- Клонирование консоли/проекта копирует команды
- **UI:**
  - ПКМ по консоли в дереве → «⚡ Быстрые команды...» → `dialogs/QuickCommandsDialog.tsx`: список, добавить / редактировать / удалить (с подтверждением) / порядок стрелками; при пустом списке сразу форма добавления
  - Панель `QuickCommandsBar` под терминалом (`TerminalPanel.tsx`) — показывается, только если команды есть. Клик — команда в PTY (`\n` → `\r`, в конце Enter), ПКМ по кнопке — редактирование, ⚙ — весь список. Подсказка: описание + команда
  - Подтверждение перед запуском — только у команд с галочкой «Показывать предупреждение» (`QuickCommand.confirm`, по умолчанию выключена; не зависит от `isDanger` консоли). Такие команды помечены ⚠ в списке и в подсказке
  - На кнопке иконка ▶ (Play). Необязательный цвет `QuickCommand.color` — палитра из 6 цветов в `src/lib/quickCommandColors.ts` (полупрозрачный фон + рамка); красный — для опасных команд. В форме — выбор цвета и превью кнопки, в списке — цветная точка
  - Своя подсказка `QuickCommandHint` при наведении (подпись, описание, команда): нативный `title` в WebKit у Tauri показывается ненадёжно
- Локализация `quickCommands.*` + `contextMenu.quickCommands` на 5 языков

### 20.2 Подтверждение выхода — ВЫПОЛНЕНО

- `commands.rs` → `confirm_quit(app)`: единая точка для всех путей выхода — пункт «Выход» в трее, закрытие окна при `ui.closeToTray = false`, Cmd+Q
- Нативный диалог `tauri_plugin_dialog` (`OkCancelCustom`, `Warning`), текст на языке из `ui.language` (5 языков, `quit_dialog_labels`); окно перед показом достаётся из трея, диалог привязан к нему
- `QUIT_DIALOG_ACTIVE` снова используется — не даёт открыть второй диалог
- **Cmd+Q на macOS:** штатный `PredefinedMenuItem::quit` из меню по умолчанию вызывает `terminate:` в обход приложения (tao 0.34 не шлёт `ExitRequested`). `install_app_menu()` берёт `Menu::default`, заменяет последний пункт подменю приложения своим `app_quit` с `CmdOrCtrl+Q`; обработчик — `app.on_menu_event`. Надпись обновляется в `update_tray_language`
- Ограничение: «Завершить» из контекстного меню иконки в Dock по-прежнему закрывает приложение без вопроса (тот же `terminate:`)

### 20.3 Счётчик запусков быстрых команд и сэкономленное время — ВЫПОЛНЕНО (2026-10-13)

- Поля `QuickCommand.run_count` / `saved_chars` (`#[serde(default)]`) — хранятся в той же колонке `consoles.quick_commands`, миграция не нужна; едут в `.dchub`, старые записи читаются с нулями
- Команда `record_quick_command_run(console_id, command_id)` → обновлённая `QuickCommand` (зарегистрирована в `main.rs` и `lib.rs`, обёртка `recordQuickCommandRun`). `db.rs`: read-modify-write под общим локом БД; `+1` запуск, `+ (символов в команде + 1 за Enter)`
- `TerminalPanel.tsx` → `runQuickCommand`: после отправки в PTY пишет запуск, результат кладёт в store
- Оценка времени — `src/lib/quickCommandStats.ts`: `символы ÷ TYPING_CHARS_PER_MINUTE` (200 симв/мин ≈ 40 слов/мин), формат «≈ N сек / мин / ч мин». Намеренно грубо
- Символы копятся в момент запуска: правка текста команды не пересчитывает уже накопленное
- **UI:** в подсказке над кнопкой и в списке `QuickCommandsDialog` — «Запусков: N · сэкономлено ≈ X» (или «Ещё не запускалась»); внизу списка итог по консоли + строка с формулой
- Локализация `quickCommands.stats*` / `saved*` на 5 языков

---

## Этап 21: Статистика использования — ВЫПОЛНЕНО (2026-10-15)

**Цель:** в конце дня открыть окно и увидеть, сколько работал, сколько сэкономили быстрые команды, сколько набрано руками и в каком проекте ушло больше всего времени — за сегодня / 7 дней / 30 дней.

- [x] **БД:** таблица `usage_stats (day, hour, console_id, project_id, metric, value)`, PK `(day, hour, console_id, metric)`; запись — upsert `value = value + excluded.value`. `console_id = ''` — метрики уровня приложения; `project_id` — проект консоли на момент записи (время остаётся за проектом, даже если консоль перенесли/удалили). Без FK. Строки старше 31 дня удаляются при старте (`db::init`) и при каждом чтении (`prune_usage_stats`)
- [x] **Команды** (в `main.rs` и `lib.rs`, обёртки в `tauriCommands.ts`): `record_usage_stats(entries)` — пакет одной транзакцией, мусор (день не `YYYY-MM-DD`, час вне 0..23, value ≤ 0) отбрасывается; `get_usage_stats(since_day)`; `clear_usage_stats`. Структура `UsageStat` в `commands.rs`
- [x] **Трекер** `src/lib/usageStats.ts`: приращения копятся в памяти, сброс в БД раз в 30 с и при скрытии окна (дробные секунды докапливаются). Метрики `METRICS`: `app_open_sec` (окно видно), `active_sec` (окно в фокусе и ввод/мышь не реже раза в 5 мин), `console_sec` (активное время на вкладке консоли → диаграмма по проектам), `typed_chars` / `pasted_chars` / `enter_keys` (разбор `term.onData`: одна клавиша — набор, bracketed paste или несколько символов разом — вставка, ESC-последовательности не считаются), `output_chars`, `sessions_opened` (включая переподключения), `qc_runs` / `qc_saved_chars` (та же формула, что `record_quick_command_run`), `ai_messages`, `wiki_edits` (одно debounce-сохранение). Тик 5 с, разрыв > 30 с (сон, трей) не засчитывается
- [x] Подключение: `TerminalPanel` (ввод, вывод, сессии, быстрые команды), `AiPanel.handleSend`, `WikiPanel.scheduleSave`; `App.tsx` — старт трекера, `setUsageEnabled` после загрузки настроек, `setUsagePaused` под экраном блокировки
- [x] **Окно** `StatsDialog.tsx` (кнопка 📊 в заголовке, `Layout.onOpenStats`): периоды Сегодня / 7 / 30 дней (данные читаются один раз за 30 дней, перед чтением — `flushUsage`); 6 плиток (активное время + окно открыто; сэкономлено быстрыми командами + доля от всего ввода; набрано / вставлено; команд руками; сессии + вывод; AI + wiki); кольцевая диаграмма по проектам (SVG, наведение — подпись в центре, клик по сегменту/легенде — фильтр таблицы консолей), до 7 проектов + «Другие»; столбики активного времени по часам/дням с подсказкой; таблица консолей (время, набрано, быстрые команды). Цвет проекта закреплён по месячному рейтингу — не меняется при смене периода. Палитра — категориальная, отдельные ступени для тёмных тем, проверена валидатором
- [x] **Настройка** `stats.enabled` (по умолчанию вкл.) на вкладке «Интерфейс» + кнопка «Очистить статистику» (и в окне статистики). Выключено — кнопки в заголовке нет, трекер ничего не пишет; уже собранное не удаляется
- [x] Локализация `stats.*`, `settings.statsEnabled` / `statsNote` на 5 языков

**Ограничения:** статистика не попадает в экспорт `.dchub`; при выходе теряется не больше ~30 с несброшенных данных; «активная работа» — эвристика (фокус + ввод за 5 мин), время без открытой консоли в диаграмму проектов не входит.

---

## Этап 22: Диалог консоли — вкладки, хостинг-комбобокс, иконка и цвет — ВЫПОЛНЕНО (2026-10-15)

**Цель:** окно создания/редактирования консоли помещается без прокрутки до «Сохранить»; хостинг выбирается из уже введённых; консоли в дереве различимы.

- [x] **Общая форма** `src/components/dialogs/ConsoleForm.tsx` (`ConsoleFormValues`, `consoleFormValues(con?)`) — `CreateConsoleDialog` / `EditConsoleDialog` стали тонкими обёртками с `onSubmit`. Попутно Create тоже закрывается по Escape; подписи danger-блока унифицированы
- [x] **Вкладки** `src/components/UnderlineTabs.tsx`: равные вкладки во всю ширину, серая базовая линия, полоска `bg-accent` переезжает под активную (transition `left` 300 мс); точка у вкладки, где есть заполненные поля. Раскладка: Основное (имя, тип, SSH + копирование подключения) / Запуск (стартовые команды, доп. аргументы SSH) / Описание (хостинг, заметка) / Оформление (превью строки дерева, иконка, цвет, метка продакшн). Диалог 460×min(600px, 90vh): шапка и кнопки закреплены, прокручивается только содержимое. Ошибка валидации (нет имени / SSH-хоста) переключает на «Основное»
- [x] **Хостинг — комбобокс** `src/components/SuggestInput.tsx`: значения из всех консолей store, без дублей с точностью до регистра (первое написание), по алфавиту, справа — сколько консолей используют. При фокусе — весь список, при наборе — фильтр по подстроке; ↑/↓, Enter подставляет (форму не отправляет), Escape закрывает только список. Своё значение вписывается как раньше
- [x] **Иконка и цвет:** колонки `consoles.icon`, `consoles.color` (`TEXT NOT NULL DEFAULT ''`, миграция `ALTER TABLE`), поля `ConsoleConfig.icon/color` (`#[serde(default)]` — старые `.dchub` импортируются, новые несут оформление), параметры `create_console` / `update_console_config` и обёртки в `tauriCommands.ts`. Набор `src/lib/consoleIcons.tsx` (29 иконок, в БД — ключ, не имя компонента); пусто — авто: SSH → Server, local → Terminal. Цвет — палитра `quickCommandColors.ts`, расширена бирюзовым и розовым (доступны и быстрым командам). Показ: дерево (вместо пустого места перед именем) и вкладки терминала; без цвета иконка приглушённая
- [x] Локализация `dialogs.tab*`, `hostingPickHint`, `lookPreview`, `consoleIcon*`, `consoleColor`, `quickCommands.colors.cyan/pink` на 5 языков

- [x] **Доработка по отзыву:** тип подключения SSH/Local — тем же `UnderlineTabs`; у рамки SSH-полей убран заголовок «SSH параметры» (сама рамка осталась); высота диалога — по содержимому (`max-h-[92vh]`, у области вкладок `min-h-[470px]` — ровно «Основное» с SSH, чтобы окно не прыгало при переключении; поле пароля к ключу увеличивает окно). У локальной консоли на «Основном» только имя и тип — это не поломка: стартовые команды, хостинг и заметка переехали на свои вкладки; добавлена подсказка `dialogs.localHint` со ссылкой на «Запуск»
- [x] **Поля всех вкладок — в рамках, как SSH на «Основном»** (`boxCls`, поля внутри — `boxInputCls` моноширинные / `boxTextCls` обычные): Запуск — одна рамка; Описание — одна рамка; Оформление — превью отдельно, иконка + цвет в одной рамке, «продакшн» в своей
- [x] Подписи полей в форме консоли (и в `CopyConnectionButton`) — `text-text-primary` вместо `text-text-muted` (серый плохо читался на светлых темах); подсказки остались приглушёнными
- [x] **Бейдж `ssh` в дереве заменён плашкой иконки** `ConsoleIconTile` (`consoleIcons.tsx`): квадрат 24px, иконка 16px (во вкладках терминала — 14px), фон/рамка подкрашены цветом консоли (без цвета — нейтральные). Тип подключения различается иконкой «авто» (сервер / терминал) и подсказкой на плашке (`SSH · user@host` / `Local`). Во вкладках терминала — по-прежнему простая иконка
- [x] **Окно приложения запоминает размер и положение:** `tauri-plugin-window-state` (в `main.rs` и `lib.rs`), флаги — все, кроме `VISIBLE` (иначе окно, спрятанное в трей, стартовало бы невидимым). Состояние сохраняется при выходе; первый запуск — 1400×900 из `tauri.conf.json`
- [x] **Обновлён Tauri** (плагин требует новее): `tauri` 2.10.3 → 2.12.4, `tauri-build` 2.7.3, плагины dialog 2.8.3 / shell 2.5.0 / autostart 2.7.0 / single-instance 2.5.4; JS — `@tauri-apps/api` 2.12.4, `cli` 2.12.3, `plugin-dialog` 2.8.3, `plugin-shell` 2.5.0 (версии Rust и JS совпадают)

**Ограничения:** в `CommandPalette` / глобальном поиске иконка консоли пока не показывается; проверено `tsc` + `cargo check` + `npm run build`, в живом приложении — нет.

---

## Этап 23: Редактирование воркспейса и проекта, чистка меню проекта — ВЫПОЛНЕНО (2026-10-15)

**Цель:** иконку и цвет воркспейса (1-й уровень) и проекта (2-й уровень) можно поменять после создания — как у консолей; из меню проекта убраны нерабочие пункты.

- [x] **Пункт «Настройки...»** (⚙) в контекстном меню воркспейса и проекта, рядом с «Переименовать». Открывает те же `CreateWorkspaceDialog` / `CreateProjectDialog` в режиме редактирования (необязательный проп `workspace` / `project`): заголовок «Настройки workspace/проекта», кнопка «Сохранить». Проект — имя, путь, шелл, иконка, цвет, метка опасности; воркспейс — имя, иконка, цвет. Бэкенд не менялся: используются существующие `update_workspace` / `update_project` (раньше вызывались только при переименовании) и `set_node_danger` (только если флаг/метка изменились). Store обновляется через `updateWorkspace` / `updateProject`
- [x] Если текущая иконка не входит в набор (импорт, старые данные) — она показывается первой, чтобы не потерялась при сохранении. Оба диалога (и в режиме создания) теперь закрываются по Escape
- [x] **Удалены «Открыть в VS Code» / «Открыть в Finder»** из меню проекта вместе с обработчиками и импортом `plugin-shell` в `ContextMenu.tsx`; ключи `contextMenu.openInVSCode/openInFinder/toastOpeningVSCode/toastOpenError` убраны из локалей
- [x] **По отзыву:** пункт «Переименовать» у воркспейса и проекта убран из меню — дублировал «Настройки...» (имя меняется там). Затем убран и у консоли (дублировал «Настройки подключения»). Пункт «Переименовать» больше нет ни на одном уровне: проп `onRename` у `ContextMenu` и ключ `contextMenu.rename` удалены. Inline-переименование по F2 / двойному клику осталось
- [x] **Больше иконок:** проект — 12 → 27 (три полных ряда по 9: + 🖥️ 💻 ☁️ 🐳 🐧 🍎 🛒 💳 📦 🚀 🔥 🛡️ 📡 🎮 📝), воркспейс — 12 → 21 (три полных ряда по 7: + 🏢 🏠 🧩 🌍 ⭐ 💎 🧠 🎓 🌱). Число подобрано под ширину диалогов (`w-96` / `w-80`, кнопка 32px + gap 4px), чтобы последний ряд был заполнен
- [x] Локализация `contextMenu.settings`, `dialogs.editWorkspace/editProject`, `dialogs.toastWorkspaceUpdated/toastProjectUpdated` на 5 языков

**Ограничения:** проверено `tsc` + `npm run build`, в живом приложении — нет.

---

## Этап 24: Окно из трея по запуску из «Программ» / Dock (macOS) — ВЫПОЛНЕНО (2026-10-17)

**Проблема:** если окно спрятано в трей, повторный запуск приложения через иконку в «Программах», Launchpad или Dock окно не показывает — приходится открывать через трей.

**Причина:** на macOS повторный запуск уже работающего приложения не создаёт второй процесс — LaunchServices активирует существующий и шлёт ему `applicationShouldHandleReopen` (в Tauri — `RunEvent::Reopen`). Колбэк `tauri-plugin-single-instance` в этом случае не вызывается, а `Reopen` не обрабатывался.

- [x] `main.rs` и `lib.rs`: `.run(ctx)` заменён на `.build(ctx)` + `.run(|app, event| ...)`; на `RunEvent::Reopen` (под `#[cfg(target_os = "macos")]`) окно `main` разворачивается, показывается и получает фокус — так же, как в колбэке single-instance и в меню трея
- [x] `cargo check` — без ошибок и предупреждений

**Ограничения:** в живом приложении не проверено (нужен `npm run tauri dev` / сборка). Срабатывает и на клик по иконке в Dock, если приложение там видно.

---

## Этап 25: Крестик закрытия на всех вкладках терминала — ВЫПОЛНЕНО (2026-10-17)

**Проблема:** при нескольких открытых вкладках крестик «×» виден только у активной.

**Причина:** у кнопки закрытия стоял inline-стиль `opacity: isActive ? 0.6 : 0` — у неактивных вкладок она была полностью прозрачной (но кликабельной). Показ по наведению inline-стилем не сделать.

- [x] `globals.css`: класс `.terminal-tab-close` — у неактивной вкладки `opacity: 0.35`, у активной и при наведении на вкладку `0.7`, при наведении на сам крестик `1`
- [x] `TerminalPanel.tsx`: inline-`opacity` убран у крестика вкладок консолей и подвкладок экземпляров, вместо него класс `terminal-tab-close`
- [x] `tsc --noEmit` — без ошибок

**Ограничения:** в живом приложении не проверено.

---

## Этап 26: Ссылка на сайт, «О программе», фундамент версионирования — ВЫПОЛНЕНО (2026-10-18)

**Задача:** кликабельная ссылка на consoles.work; в «О программе» — сайт и GitHub; перестать жить в вечной 0.1.0.

- [x] `src/lib/appInfo.ts`: `APP_NAME`, `APP_VERSION`, `APP_COMMIT`, `SITE_URL` (https://consoles.work), `GITHUB_URL` (https://github.com/consoles-work/application), `displayUrl`, `openExternal` (plugin-shell, в `npm run dev` — `window.open`)
- [x] `Layout.tsx`: «Consoles.work» в заголовке окна — кнопка-ссылка на сайт
- [x] `AboutDialog.tsx`: иконка, версия + короткий хеш коммита сборки, описание, кнопки «Сайт» и «Исходный код на GitHub», Esc / клик вне закрывают
- [x] Меню приложения macOS: штатный пункт About (`PredefinedMenuItem::about`) заменён на `MenuItem` `app_about` в `install_app_menu` (`commands.rs`); надпись локализована (`about_label`), переключается вместе с языком. `show_about()` показывает окно и шлёт событие `show-about`, `App.tsx` его слушает. Обработчик в `main.rs` и `lib.rs`. Штатная панель оставлена бы без ссылок: muda на macOS отдаёт `credits` простым текстом
- [x] Настройки → Интерфейс: внизу «Consoles.work версия X.Y.Z» и кнопка «О программе»
- [x] Локализация: раздел `about` (title, version, description, site, github) в 5 языках
- [x] Версия в одном месте — `package.json`. `tauri.conf.json`: `"version": "../package.json"`. Vite: `define` → `__APP_VERSION__`, `__APP_COMMIT__` (`git rev-parse --short HEAD`, без git — пусто); типы в `src/vite-env.d.ts`
- [x] `scripts/version.mjs` + `npm run version:check` / `npm run version:bump -- patch|minor|major|X.Y.Z`: синхронизирует `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, переносит «Не выпущено» в `CHANGELOG.md` под новую версию. В git ничего не пишет
- [x] `CHANGELOG.md`: 0.1.0 — всё до введения версий, 0.2.0 — этот этап. Версия поднята до **0.2.0**
- [x] `docs/RULES.md`: раздел «2. Версии» — схема SemVer для 0.x, когда поднимать, запись в CHANGELOG
- [x] `tsc --noEmit`, `cargo check`, `vite build` — без ошибок

**Ограничения:** в живом приложении не проверено. Уведомления macOS «добавлен объект входа» и разрешения TCC привязаны не к версии, а к bundle id (`work.consoles.app`) и подписи кода: без постоянной подписи каждая пересборка для macOS — новое приложение. Решение — подписывать сборки постоянным сертификатом (как `scripts/dev-sign-run.sh` в ultraplan), отдельной задачей.

---

## Этап 27: Постоянная подпись dev-сборки (macOS) — ВЫПОЛНЕНО (2026-10-18)

**Проблема:** macOS (уведомления «добавлен объект входа», разрешения TCC) узнаёт приложение по подписи кода. Dev-бинарник после каждой пересборки подписан заново ad-hoc — для системы это новое приложение.

- [x] Из ultraplan перенесены `scripts/dev-sign-run.sh` и `src-tauri/.cargo/config.toml` (`runner` для `cfg(target_os = "macos")`). `tauri dev` запускает бинарник через `cargo run` → cargo через скрипт → скрипт подписывает `target/debug/consoles-work` и делает `exec`
- [x] Сертификат: `CONSOLES_DEV_SIGN_IDENTITY` (имя или SHA-1) либо первый из `security find-identity -v -p codesigning`; нет сертификата — запуск без подписи с предупреждением. Идентификатор подписи `work.consoles.app.dev` — отдельный от релизного `work.consoles.app`
- [x] Другие бинарники (тесты) проходят через скрипт без подписи
- [x] Проверено: копия бинарника подписана (`Identifier=work.consoles.app.dev`, `TeamIdentifier=48Z969Y7B7`), `cargo test` идёт через runner без ошибок

**Ограничения:** только dev-сборка. Релизная (`npm run tauri build`) по-прежнему без постоянной подписи — это этап 12.3 (`signingIdentity`, hardened runtime, нотаризация). Объекты входа и разрешения, выданные dev-сборке до этого этапа, macOS может спросить ещё один раз — дальше подпись постоянная.

---

## Этап 28: Раздел «SSH-ключи» — инвентаризация и аудит — ВЫПОЛНЕНО (2026-10-19)

**Проблема:** один ключ на все серверы; из интерфейса не видно, какие ключи есть, защищены ли они passphrase, какие консоли каким ключом ходят и где настроены рискованные параметры подключения, исследование — `docs/SSH_KEY_MANAGER_RESEARCH.md`.

**Решение владельца (2026-10-19):** только локальный менеджмент и отображение проблем. На серверы не подключаемся, ничего там не меняем (раскатка и ротация ключей из исследования — не делаем). Поведение подключения консолей не меняем.

- [x] Исследование — `docs/SSH_KEY_MANAGER_RESEARCH.md`

**Источники данных (только чтение, локально):** `~/.ssh/*` (пары ключей), файлы ключей, указанные в консолях и в `IdentityFile` из `~/.ssh/config`, `~/.ssh/config` (+ `Include`), `ssh-add -l`, поля SSH-консолей из БД.

### 28.1 Инвентаризация ключей — ВЫПОЛНЕНО
- [x] `src-tauri/src/ssh_keys.rs`, команда `scan_ssh_keys(extraPaths)` → `SshKeysReport`. Кандидаты: файлы `*.pub` и файлы с заголовком приватного ключа в `~/.ssh` (кроме `config`, `known_hosts*`, `authorized_keys*`, `*-cert.pub`), пути ключей из консолей (передаёт фронт), `IdentityFile` из конфига. Ключ идентифицируется путём к приватному файлу (`x.pub` → `x`)
- [x] Тип, длина, SHA256-отпечаток, комментарий, строка публичного ключа, randomart — свой разбор блоба (`.pub` или публичная часть заголовка `openssh-key-v1`, она не шифруется), SHA-256 через `sha2`. Сверено с `ssh-keygen -l` / `-lv` на ED25519, RSA 3072 с passphrase, ECDSA 384 без `.pub`, RSA 2048 в PEM — совпадает байт в байт
- [x] Passphrase — по заголовку: OpenSSH (шифр в заголовке, `none` = без), PEM (`Proc-Type: 4,ENCRYPTED`), PKCS#8 (`ENCRYPTED PRIVATE KEY`), PuTTY. Без вызова `ssh-keygen` (он падает на ключах с открытыми правами)
- [x] Агент: `ssh-add -l -E sha256` → статус `ok` / `empty` / `unavailable` и отпечатки
- [x] Пара файлов (`privateExists` / `publicExists`), сертификат рядом (`hasCertificate`), права (`mode`), дата изменения, права `~/.ssh`
- [x] Дубликаты по отпечатку; оценка стойкости 0–100 (`keyScore` в `sshAudit.ts`)
- [x] `inspect_ssh_key(path)` — то же для одного файла

### 28.2 Связь ключ ↔ консоли — ВЫПОЛНЕНО
- [x] `src/lib/sshAudit.ts` (`auditSsh(report, workspaces)`, чистые функции). Для консоли: свой ключ (`-i`) + `IdentityFile` всех подходящих `Host` (шаблоны `*` `?` `!`, блок до первого Host — для всех; `Match` не вычисляется); если ни того ни другого — ключи по умолчанию `id_*`, как у ssh
- [x] Для ключа — консоли (свой / config) и отдельно «как ключ по умолчанию», хосты конфига
- [x] Ключ в нескольких воркспейсах; неиспользуемые ключи

### 28.3 Аудит проблем — ВЫПОЛНЕНО
- [x] 24 проверки, у каждой уровень, «почему важно» и «что сделать» (`sshKeys.issue.<code>.title/why/fix`). Критично: файл ключа консоли не найден, прод-консоль (`is_danger` консоли или проекта) на ключе без passphrase или с оценкой < 60, права ключа шире 600, DSA, RSA < 2048, `ForwardAgent` для всех хостов. Внимание: ключ без passphrase, ключ в нескольких воркспейсах, только `.pub` без приватного, вход только по паролю, `-A` / `ForwardAgent`, отключённая проверка ключа хоста (в консоли и в конфиге), `IdentityFile` на несуществующий файл, права `~/.ssh`. К сведению: RSA 2048, дубликаты, неиспользуемый ключ, ключ не указан (идёт по умолчанию), лишняя / несохранённая passphrase, больше 5 ключей в агенте
- [x] Проверено на реальном отчёте `~/.ssh` + синтетических консолях (node, бандл `sshAudit.ts` через esbuild)

### 28.4 Окно «SSH-ключи» — ВЫПОЛНЕНО
- [x] `src/components/SshKeysDialog.tsx`, кнопка с иконкой ключа в заголовке (`Layout.onOpenSshKeys`), красная точка — есть критичные проблемы. Индикатор считается при старте (`quickSshAudit()` в `App.tsx` после загрузки дерева) и обновляется при каждом открытии окна
- [x] Плитки: ключей (+ в агенте, состояние агента), без passphrase, проблем, консолей без своего ключа
- [x] Вкладки (`UnderlineTabs`): Проблемы / Ключи (раскрываемые карточки: поля, randomart, где используется, проблемы ключа) / Консоли (хост, фактический ключ и откуда он, флаги) / `~/.ssh/config` (блоки, директивы, `IdentityFile` с отметкой «нет файла», консоли блока)
- [x] Действия: скопировать публичный ключ / отпечаток; «Исправить права» — `fix_ssh_permissions` (600 для приватного ключа, 700 для `~/.ssh`, другие пути не трогает); «Показать в дереве» (раскрывает воркспейс и проект, показывает панель дерева); «Изменить консоль» — `EditConsoleDialog` поверх окна, после закрытия — повторный скан
- [x] **Создать ключ:** `generate_ssh_key(name, comment, passphrase)` — ED25519 через крейт `ssh-key` 0.6 (шифрование AES-256-CTR + bcrypt-pbkdf, как у OpenSSH), файлы создаются `create_new` сразу с правами 600 / 644, существующие не перезаписываются, имя — `[A-Za-z0-9_.@-]`, без `.pub`. Passphrase можно сгенерировать (24 символа)
- [x] `ConsoleForm.tsx`: под полем ключа (debounce 400 мс, `inspect_ssh_key`) — файл не найден / только `.pub` / права / без passphrase / нужна passphrase

### 28.5 Локализация и документация — ВЫПОЛНЕНО
- [x] `sshKeys.*` (181 ключ) на 5 языков; README («SSH-ключи», структура), CLAUDE.md, CHANGELOG

**Не делаем:** подключение к серверам, раскатку и удаление ключей в `authorized_keys`, запись в `~/.ssh/config`, изменение команды подключения консолей (`IdentitiesOnly=yes` — только как рекомендация в аудите). функции облаков, туннелей, контейнеров, MCP — вне темы.

**Ограничения:** блоки `Match` в `~/.ssh/config` показываются, но к консолям не применяются; `Include` — glob только в последнем компоненте пути; `IdentityFile` с токенами `%h`, `%r` и т. п. не раскрываются; Windows — права не проверяются и не исправляются. Ключи в аппаратных токенах и агентах-менеджерах (1Password, Secretive), у которых нет файла, видны только как число ключей в агенте.

---

## Этап 29: Цвет, «протёкший» из прерванной программы — ВЫПОЛНЕНО (2026-10-20)

**Проблема:** после `docker logs -f` + `^C` приглашение shell и весь дальнейший вывод в консоли серые — «как будто кавычка не закрыта». Бот красит строки (`ESC[90m` и т. п.), а `^C` обрывает поток раньше, чем приходит сброс `ESC[0m`; цвет в терминале — общее состояние, его наследует всё последующее. Так ведёт себя любой эмулятор (iTerm, Terminal.app), xterm.js не виноват; байты доходят целыми — UTF-8 декодер PTY и текст проверены.

- [x] `TerminalPanel.tsx`: `resetLeakedSgr(term)` — пишет `ESC[0m` в xterm (не в PTY) перед отправкой ввода с Enter (`\r`) или Ctrl+C (`\x03`) и перед запуском быстрой команды. Только в обычном буфере: полноэкранные программы (vim, htop, less) живут в альтернативном и цвета ведут сами
- [x] Отброшено: `minimumContrastRatio` у xterm — проблема не в контрасте палитры, правка откачена

**Ограничения:** если нажать Enter, пока программа ещё печатает цветной кусок без новых SGR, остаток этого куска выйдет цветом по умолчанию — до её следующей escape-последовательности. Если цвет протёк, а пользователь ничего не нажимал, вывод остаётся окрашенным до первого Enter.

---

## Этап 30: Недавние консоли в левой панели — ВЫПОЛНЕНО (2026-10-21)

Над деревом — секция «Недавние» с последними 5 использованными консолями для быстрого перехода.

- [x] `appStore.ts`: `touchRecentConsole(consoleId)` поднимает консоль в начало списка; вызывается из `openSession` и `setActiveSession` — то есть при открытии сессии, переключении вкладки, клике по консоли в дереве, CommandPalette, поиске. Список — JSON-массив id в настройке `ui.recentConsoles` (хранится до 20, свежие первыми); если консоль уже первая, в БД не пишем. `parseRecentConsoles()` — разбор с защитой от мусора
- [x] `TreePanel.tsx`: секция (в 30.1 перенесена под дерево), видна, когда список не пуст и не открыт поиск. Строка: иконка консоли, имя, проект (полный путь «воркспейс › проект» — в подсказке), ⚠ у опасных, зелёная точка, если сессия открыта; текущая консоль подсвечена. Клик — как в дереве (`handleClick`: активировать последний экземпляр или открыть новую сессию), ПКМ — обычное меню консоли. Удалённые консоли отсеиваются при показе. Секция сворачивается, состояние — `ui.recentConsolesCollapsed`. Число строк — `RECENT_CONSOLES_SHOWN = 5`
- [x] Локализация: `treePanel.recentHeader`, `treePanel.recentSessionOpen` на 5 языков

### 30.1 Секция внизу, удаление из списка и очистка — ВЫПОЛНЕНО (2026-10-21)
- [x] Секция переехала под дерево — в низ левой панели (`border-t`), дерево над ней прокручивается как раньше
- [x] Крестик на строке (виден всегда) — `removeRecentConsole(id)` убирает консоль из недавних; кнопка-ластик в заголовке секции — `clearRecentConsoles()` очищает список после подтверждения (нативный `ask()`); удаление одной консоли из списка — без подтверждения. После очистки секция скрывается до следующего использования консоли
- [x] Локализация: `treePanel.recentRemove`, `treePanel.recentClear`, `treePanel.recentClearConfirm` на 5 языков

**Ограничения:** число показываемых консолей не настраивается из UI (константа). Список едет в `.dchub` вместе с настройками; после импорта id консолей меняются, и старые записи просто не показываются.

---

## Этап 31: Кликабельные ссылки — ВЫПОЛНЕНО (2026-10-22)

Ссылки открываются в системном браузере (`openExternal`). Только `http`, `https`, `mailto` — `file://`, `javascript:` и прочие схемы не открываем.

- [x] `src/lib/links.ts`: `isSafeExternalUrl`, `openLink`, `findLinks` / `splitLinks` (только URL со схемой — `main.rs` и `config.py` ссылками не считаются; хвостовая пунктуация, `**` и непарная скобка срезаются — `[текст](https://…)`, «(см. https://…)»), `isOpenLinkClick` / `OPEN_LINK_KEY` (Cmd на macOS, Ctrl на остальных)
- [x] `src/components/LinkifiedText.tsx`: текст с кликабельными ссылками, без `href` (чтобы не увести сам webview), всплытие клика гасится
- [x] Терминал (`TerminalPanel.tsx`): `@xterm/addon-web-links` + опция `linkHandler` для гиперссылок OSC 8 (`ls --hyperlink`); открытие по Cmd+клик (Ctrl+клик), обычный клик остаётся за выделением; при наведении подсказка `terminalPanel.openLinkHint` (5 языков). Штатный `window.open` xterm в Tauri не работает — свой обработчик
- [x] Wiki (`WikiPanel.tsx`): `@tiptap/extension-link` 2.x (autolink при наборе, ссылка при вставке, `isAllowedUri` — только безопасные схемы, `openOnClick: false`); клик по ссылке — в браузер через `editorProps.handleDOMEvents.click` (обычным кликом; если клик закончил выделение внутри ссылки — не открываем). Старые страницы: `linkifyPlainUrls` после `setContent` размечает URL-текст ссылками (вне кода), транзакция без истории и без `onUpdate` — в БД попадёт при следующей правке. Стиль `.wiki-editor .ProseMirror a`
- [x] AI-чат (`AiPanel.tsx`): ссылки в сообщениях (и во время стриминга)
- [x] Заметка консоли (полоса над терминалом): ссылки, клик по ссылке не сворачивает заметку

**Ограничения (этап 31):** в wiki нет кнопки «вставить ссылку» с произвольным текстом — ссылка появляется из набранного/вставленного URL или из вставленного HTML. Адреса без схемы (`example.com`) и голые e-mail ссылками не становятся. Текст ссылки в wiki редактируется стрелками или выделением — обычный клик её открывает.


---

## Этап 32: Перестановка вкладок терминала перетаскиванием — ВЫПОЛНЕНО (2026-10-22)

Верхние вкладки (консоли) и подвкладки (экземпляры консоли) можно переставлять мышью. Порядок не сохраняется между запусками (открытые вкладки и так не восстанавливаются).

- [x] `appStore.ts`: `moveConsoleTab(consoleId, beforeConsoleId | null)` — экземпляры консоли переезжают группой, `sessions` остаётся «подряд»; `moveSessionTab(sessionId, beforeSessionId | null)` — экземпляр внутри своей консоли. `null` — в конец (для экземпляра — в конец своей группы). Порядок `sessions` = порядок вкладок, поэтому за перестановкой следует и переключение вкладок по клавишам
- [x] `TerminalPanel.tsx`: хук `useTabReorder` — mouse-события на `window` (HTML5 DnD в Tauri WebKit не работает), порог 6px (`TAB_DRAG_THRESHOLD`), так что клик остаётся кликом; место вставки — перед первой вкладкой, чья середина правее курсора (`data-tab-id` внутри `data-tab-bar`); с крестика перетаскивание не начинается. Перетаскиваемая вкладка полупрозрачна, место вставки — полоска акцентного цвета (`dropMarker` / `DropMarker`, не показывается, если перестановка ничего не меняет); после броска вкладка становится активной. Терминалы рендерятся в порядке id (время открытия), а не вкладок — перестановка не двигает DOM-узлы xterm

**Ограничения:** полоса вкладок не прокручивается сама, если тащить к краю, когда вкладок больше, чем помещается. Перетащить экземпляр в другую консоль или вынести подвкладку наверх нельзя.

---

## Этап 33: Скилл `readable-flow` — линейно читаемый код Rust + TS — ВЫПОЛНЕНО (2026-10-23)

Скилл Claude Code для приведения кода проекта в порядок: по мотивам `ts-readable-flow`, адаптирован под Tauri-проект (Rust-бэкенд + React/TS-фронт). Вызов — `/readable-flow` или автоматически на «приведи код в порядок» / рефакторинг сложного файла.

- [x] `.claude/skills/readable-flow/SKILL.md`: общие правила (шапка файла — процесс по шагам с исходами, сценарий одной функцией из пронумерованных абзацев, когда выделять функцию, плоский поток, пустые строки, решения отдельно от действий, сначала убрать лишнее); раздел Rust (ошибки `Result<T, String>` / `let-else` / `unwrap` только для инвариантов, `let mut` и shadowing, итераторы, область `Mutex`, `cfg` в деталях, >4 параметров у команды — структура); раздел React/TS (эффект = ресурс + очистка, производные данные без эффектов, хуки/подкомпоненты, тернарники, `.catch(() => {})`, стор, локали); граница Rust ↔ TS; порядок в файле; процедура рефакторинга с PLAN/STATUS и проверкой; метрики; чек-лист
- [x] Метрики без правки проекта: `rust-metrics.sh` — clippy только с линтами скилла и порогами из `clippy.toml` скилла (`CLIPPY_CONF_DIR`), можно по отдельным файлам; `ts-metrics.sh` — eslint 9 + `eslint-plugin-sonarjs` + `eslint-plugin-react-hooks` ставятся один раз в `$TMPDIR/readable-flow-eslint`, конфиг `eslint.config.mjs` лежит в скилле

**Ограничения:** метрики старого кода дают много замечаний (на 2026-10-23: Rust — 36, TS — 148), норма скилла — ноль в отрефакторенных функциях и «не хуже» в изменённых. `ts-metrics.sh` при первом запуске нужна сеть. Сам код проекта этим этапом не менялся.

---

## Этап 34: Рефакторинг всего кода по скиллу `readable-flow` — ВЫПОЛНЕНО (2026-10-23)

Rust (`src-tauri/src/*.rs`) и фронт (`src/**/*.ts(x)`) приведены к правилам `.claude/skills/readable-flow`: шапка файла — процесс по шагам с исходами, сценарии сверху вниз пронумерованными абзацами, плоский поток, решения по данным — в чистых функциях и таблицах, без молча проглоченных ошибок.

Метрики: Rust — 36 → 0 замечаний, TS — 148 → 0. `cargo test` — 16 тестов (было 6), `npx tsc --noEmit`, `npm run build` проходят.

- [x] **Rust, структура.** `main.rs` только вызывает `lib::run()`; приложение собирается в одном `lib.rs` (раньше `main.rs` и `lib.rs` были копиями с регистрацией всех команд в обоих). Трей, меню приложения macOS, закрытие окна и подтверждение выхода — новый модуль `app_shell.rs` (из `commands.rs`, `main.rs`, `lib.rs`). `commands.rs` — тонкий фасад; сценарии экспорта/импорта с чтением и записью файла переехали в `export.rs`
- [x] **Rust, контракты IPC — структуры вместо длинных списков аргументов**: `spawn_pty(request: SpawnRequest)`, `create_console/update_console_config(…, fields: ConsoleFields)`, `create_project/update_project(…, fields: ProjectFields)`, `export_data/apply_import(…, sections: Sections, mode: ImportMode)`, `ai_run(request: RunRequest)`; TS-обёртки и типы (`SpawnPtyRequest`, `ConsoleFields`, `ProjectFields`, `ExportSections`) обновлены
- [x] **Rust, модули.** `pty_manager.rs`: общий `write_askpass`, `env_defaults`, поток вывода — `forward_output`. `db.rs`: хелперы `conn` / `execute` / `query_all`, общие `*_COLUMNS` + `*_from_row` для проектов и wiki, схема и миграции — константы. `ssh_keys.rs`, `ai_local.rs` (разбор stream-json — `parse_stream_line`), `security.rs`, `build.rs` — шапки и плоский поток. Новые тесты: `pty_manager` (UTF-8-хвост, окружение, `sh -c`), `export` (шифрование, пароль, обрезанный файл), `ssh_keys` (директивы конфига, имена ключей, `.pub`), `ai_local` (строки потока)
- [x] **TS, общие модули.** `src/lib/tree.ts` — обход дерева, плоский список, поиск по дереву (вместо 10 копий циклов `ws → proj → con`); `src/hooks/useEscape.ts` (8 копий), `src/hooks/useListNavigation.ts` (CommandPalette, GlobalSearch). Стор: `openConsole` (перейти к консоли или открыть), `saveSetting` (в стор сразу, в БД по возможности), чистые функции расстановки вкладок
- [x] **TS, крупные файлы.** `TerminalPanel` (что запускать — `launchRequest` в `connectionString.ts`; создание xterm — `createTerminal`), `TreePanel` (перетаскивание — хук `useConsoleDrag`, строка — `TreeRow`), `ContextMenu` (удаление — таблица по типу узла), `sshAudit` (`auditSsh` разложен на шаги, сложность 156 → ≤ 10), `AiPanel`, `App` (горячие клавиши — таблица, автоблокировка — хук), `SettingsDialog`, `StatsDialog` (расчёты — чистые функции), `WikiPanel`, `usageStats`, диалоги
- [x] Документация: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `README.md` — регистрация команд только в `lib.rs`, `app_shell.rs`, `tree.ts`, `hooks/`

**Найденные и исправленные ошибки** (видны пользователю — в `CHANGELOG.md`):
- TS-типы `Workspace` и `Project` читали snake_case-поля (`is_expanded`, `default_shell`, `env_vars`), а Rust отдаёт camelCase. Следствия: раскрытие дерева не восстанавливалось после перезапуска; шелл и переменные окружения проекта не применялись к терминалу; переименование проекта (F2) падало; диалог настроек проекта всегда показывал и сохранял `zsh`
- `ContextMenu` сам вызывал `set_node_danger`, а затем то же делал `TreePanel`: отмена вопроса о подписи оставляла пометку «опасно» включённой в БД, но не в дереве
- `WikiPanel`: эффект «сохранить при уходе» зависел от объекта страницы и на каждом нажатии отменял отложенное сохранение — debounce не работал, счётчик правок wiki в статистике всегда был 0; ошибки сохранения не показывались
- Настройки → Агенты: кнопка «Проверить подключение» была недоступна для Claude CLI без API-ключа
- `pty_manager::spawn`: сессия регистрировалась после запуска потока вывода — мгновенно завершившийся процесс оставлял запись навсегда
- `db::init`: если отложить старую незашифрованную БД не удавалось, init уходил в бесконечную рекурсию — теперь ошибка запуска

**Поведение, изменённое намеренно:** ошибки загрузки, переименования и очистки AI-чатов показываются тостом (раньше молча); клон консоли без найденного проекта не создаётся (раньше копия появлялась в БД, но не в дереве); в меню трея «Открыть» разворачивает и свёрнутое окно. Остальные ранее молча проглоченные ошибки (сохранение настроек, статистика, буфер обмена) пишутся в консоль разработчика.

**Ограничения:** интерфейс после рефакторинга не прогонялся вручную (`npm run tauri dev`) — проверены компиляция, тесты, сборка фронта и метрики. Палитра Cmd+P по-прежнему ищет только среди видимых (раскрытых) узлов — теперь, когда раскрытие восстанавливается, это заметнее.

---

## Этап 19: Ключ БД из пароля пользователя — TODO

**Цель:** без пароля база не расшифровывается в принципе (сейчас пароль — только UI-гейт, а ключ SQLCipher зашит в бинарник). Попутно закрыть остальные пункты из списка ограничений README.

### 19.1 Схема ключей (envelope encryption)

Не выводить ключ SQLCipher напрямую из пароля, а использовать обёртку — тогда смена пароля не требует перешифровки всей БД:

- **DEK** (data encryption key) — случайные 32 байта, ими открывается SQLCipher: `PRAGMA key = "x'<hex DEK>'"` (raw key, без внутреннего PBKDF2 SQLCipher).
- **KEK** = Argon2id(пароль, соль), параметры ~ m=64 MiB, t=3, p=1 (≈0.5 с на проверку).
- DEK хранится только в обёрнутом виде: AES-256-GCM(KEK, DEK).
- **Ключ восстановления** (опционально, но рекомендуется): случайная строка, показывается один раз при включении пароля; второй экземпляр DEK, обёрнутый KEK из ключа восстановления. Без него забытый пароль = потеря всех данных.
- Обёртки и соли — в незашифрованном файле рядом с БД `security.json` (секретов не содержит):
  ```json
  { "version": 1, "kdf": "argon2id", "m": 65536, "t": 3, "p": 1,
    "password": { "salt": "...", "nonce": "...", "wrapped": "..." },
    "recovery": { "salt": "...", "nonce": "...", "wrapped": "..." } }
  ```
- Нет `security.json` → режим как сейчас (ключ из бинарника, без пароля).

### 19.2 Отложенное открытие БД

Сейчас `db::init()` вызывается в `setup()` до показа окна, а `get_db()` паникует, если БД не открыта.

- `main.rs` / `lib.rs`: если есть `security.json` — БД в `setup()` не открывать.
- `get_db()` → возвращать `Result` (`"Database is locked"`) вместо `expect`; все вызовы уже работают через `?` / `map_err`.
- До разблокировки DB-зависимые места должны иметь дефолты: язык трея (`ui.language` в `setup()`), `ui.closeToTray` в `CloseRequested` (`get_setting_bool` уже возвращает дефолт при ошибке — проверить).
- Тема и язык экрана блокировки: продублировать `ui.theme` / `ui.language` в `security.json` (не секрет) или использовать дефолты.
- Новая команда `unlock(password)` → Argon2id → развернуть DEK (ошибка GCM = неверный пароль) → `db::init_with_key(DEK)`. `unlock_with_recovery(code)` — аналогично.
- Новая команда `security_status()` → `{ mode: "none" | "password", unlocked: bool }` для гейта в `App.tsx` (заменяет `is_password_set`, который требует открытой БД).

### 19.3 Включение / смена / снятие

- **Включить:** сгенерировать DEK → `PRAGMA wal_checkpoint(TRUNCATE)` → `PRAGMA rekey = "x'<DEK>'"` → записать `security.json` (атомарно: tmp + rename). Перед rekey — копия `data.db.bak-<timestamp>`, удалить после успешной проверки.
- **Сменить:** проверить текущий пароль → перевернуть только обёртку `password` в `security.json` (без rekey).
- **Снять:** проверить пароль → rekey обратно на ключ из бинарника → удалить `security.json`.
- Хеш `security.passwordHash` из этапа 18 больше не нужен: при миграции — включить новый режим тем же паролем (пользователь его вводит на экране входа) и удалить старый ключ.

### 19.4 Исправить остальные ограничения из README

- [ ] `db::init()`: убрать молчаливое переименование в `data.db.plaintext_backup` при неверном ключе — показывать ошибку («БД не расшифровывается этим ключом»), а не создавать пустую базу. Старую plaintext-миграцию оставить только для файлов с заголовком `SQLite format 3`.
- [ ] `build.rs`: в release-сборке без `DB_ENCRYPTION_KEY` — падать с ошибкой вместо ключа-заглушки; добавить `cargo:rerun-if-changed=../.env` и `cargo:rerun-if-env-changed=DB_ENCRYPTION_KEY`.
- [ ] `pty_manager.rs`: askpass-скрипт с SSH-паролем (`/tmp/.consoleswork_pw_<pid>`) удалять после подключения (или при `kill_pty` / выходе из приложения); создавать сразу с правами `0600/0700` (`OpenOptions` + `mode()`), в `$TMPDIR` пользователя, с уникальным именем на сессию. Лучше — передавать пароль скрипту через env, а не писать его в файл.
- [x] Автоблокировка по бездействию — сделана в этапе 18 (визуальная, UI-оверлей).
- [ ] Автоблокировка «настоящая»: при блокировке закрывать соединение с БД (`DB` → `Mutex<Option<Connection>>`) и забывать DEK; решить, что делать с открытыми PTY-сессиями и AI-стримингом. Опция «блокировать при сворачивании в трей».
- [ ] Ограничение попыток: задержка, растущая после каждой ошибки (1 → 2 → 4 → … с), счётчик — в памяти процесса.
- [ ] Горячая клавиша «Заблокировать сейчас» (например, `Cmd+L`) и пункт в меню трея.

### 19.5 Проверка

- Unit-тесты: wrap/unwrap DEK, неверный пароль, ключ восстановления, смена пароля без rekey.
- Интеграционно на копии реальной БД: включить → перезапуск → разблокировать → данные на месте; сменить пароль; снять; неверный пароль не портит и не переименовывает файл.
- `strings data.db` и `strings <бинарник>` — ключ БД в бинарнике не помогает открыть базу в режиме пароля.
- Экспорт/импорт `.dchub` работает в обоих режимах.

### Файлы, которые нужно изменить

| Файл | Изменение |
|------|-----------|
| `src-tauri/src/security.rs` | DEK/KEK, `security.json`, unlock / enable / change / disable, recovery |
| `src-tauri/src/db.rs` | `get_db() -> Result`, `init_with_key`, rekey, убрать молчаливый backup |
| `src-tauri/src/main.rs`, `lib.rs` | отложенный `db::init`, новые команды, дефолты до разблокировки |
| `src-tauri/src/commands.rs` | `security_status`, `unlock`, `unlock_with_recovery`, `lock` |
| `src-tauri/src/pty_manager.rs` | удаление askpass-файла с паролем |
| `src-tauri/build.rs` | ошибка без ключа в release, rerun-if-* |
| `src/App.tsx`, `LockScreen.tsx` | гейт через `security_status`, ввод ключа восстановления |
| `src/components/SettingsDialog.tsx` | показ ключа восстановления, автоблокировка |
| `README.md` | обновить раздел ограничений |
