# DevConsole Hub — Подробное ТЗ для агента

## Контекст проекта

DevConsole Hub — кроссплатформенное десктопное приложение (Windows/macOS/Linux) для разработчиков, которые ведут несколько проектов одновременно. Приложение объединяет три компонента: иерархическое дерево проектов, встроенные терминальные сессии и персональную базу знаний (wiki).

### Технологический стек

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Оболочка | Tauri | 2.x |
| Frontend | React + TypeScript + Vite | React 18, TS 5.5, Vite 5 |
| Терминал | xterm.js + node-pty bridge через Tauri IPC | @xterm/xterm 5.5 |
| Wiki-редактор | TipTap (ProseMirror) | 2.6 |
| База данных | SQLite через rusqlite | rusqlite 0.31 (bundled) |
| PTY | portable-pty (Rust) | 0.8 |
| UI-стили | Tailwind CSS 3.4 | |
| State management | Zustand 4.5 | |
| Rust backend | Rust edition 2021 | |

### Структура проекта

```
devconsole-hub/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Layout.tsx              # Трёхпанельный layout с resizable сплиттерами
│   │   ├── TreePanel.tsx           # Дерево проектов (левая панель)
│   │   ├── TerminalPanel.tsx       # Терминал с вкладками (центр)
│   │   └── WikiPanel.tsx           # Wiki-редактор (правая панель)
│   ├── stores/
│   │   └── appStore.ts             # Zustand store — всё состояние приложения
│   ├── lib/
│   │   └── tauriCommands.ts        # TypeScript-обёртки для Rust IPC команд
│   ├── types/
│   │   └── index.ts                # Все TypeScript-интерфейсы
│   ├── styles/
│   │   └── globals.css             # Tailwind + кастомные стили (тёмная тема)
│   ├── App.tsx                     # Корневой компонент + горячие клавиши
│   └── main.tsx                    # Точка входа React
├── src-tauri/                  # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                 # Точка входа Tauri, регистрация команд
│   │   ├── lib.rs                  # Библиотечная точка входа (Tauri 2.0)
│   │   ├── commands.rs             # 16 IPC-команд: CRUD дерева, PTY, wiki
│   │   ├── db.rs                   # SQLite: таблицы, CRUD, FTS5 поиск
│   │   └── pty_manager.rs          # PTY менеджер (каркас, нужна реализация)
│   ├── Cargo.toml                  # Rust зависимости
│   ├── tauri.conf.json             # Конфигурация Tauri
│   └── build.rs                    # Build script
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## Текущее состояние (что уже работает)

### Готово и работает:
1. **Структура проекта** — проект инициализирован, компилируется, запускается через `npm run tauri dev`
2. **Трёхпанельный layout** — Layout.tsx с resizable сплиттерами между панелями (drag мышкой)
3. **Дерево проектов** — TreePanel.tsx рендерит flat tree из Zustand store, поддерживает expand/collapse, выделение узла, при клике на console создаёт терминальную сессию
4. **Zustand store** — полная модель данных с actions для CRUD всех сущностей, управление сессиями, UI-состояние
5. **TypeScript типы** — все интерфейсы: Workspace, Project, ConsoleConfig, WikiPage, TerminalSession, TreeNode, AppSettings
6. **Rust commands.rs** — 16 IPC-команд зарегистрированы (дерево, PTY, wiki), все типы с serde
7. **Rust db.rs** — SQLite инициализация, таблицы с FK и CASCADE, полный CRUD для workspaces/projects/consoles/wiki, FTS5 полнотекстовый поиск
8. **Rust pty_manager.rs** — каркас менеджера сессий (HashMap, spawn/write/resize/kill), реальная PTY-логика закомментирована
9. **Tauri IPC обёртки** — tauriCommands.ts со всеми invoke-вызовами
10. **Демо-данные** — App.tsx загружает демо-дерево (3 workspace, проекты, консоли)
11. **Стили** — тёмная тема в стиле IDE, скроллбары, tree items, terminal tabs, wiki editor стили

### Что работает как placeholder (нужна реализация):
1. **Терминал** — TerminalPanel.tsx показывает вкладки и placeholder вместо реального xterm.js
2. **Wiki** — WikiPanel.tsx показывает textarea вместо TipTap, демо-список страниц
3. **PTY bridge** — pty_manager.rs содержит закомментированный код с portable-pty, нужно раскомментировать и подключить к Tauri events
4. **Загрузка из БД** — App.tsx использует демо-данные вместо вызова loadAllWorkspaces()

---

## Модель данных

### Иерархия: Workspace → Project → Console

```
Workspace (верхний уровень)
├── id: string (UUID)
├── name: string
├── icon: string (emoji)
├── color: string (hex)
├── sort_order: number
├── is_expanded: boolean
└── projects: Project[]
    ├── id: string (UUID)
    ├── workspace_id: string (FK)
    ├── name: string
    ├── icon: string
    ├── color: string
    ├── path: string (путь к директории проекта на диске)
    ├── default_shell: "bash" | "zsh" | "fish" | "powershell" | "cmd" | "wsl"
    ├── env_vars: Record<string, string>
    ├── sort_order: number
    ├── is_expanded: boolean
    └── consoles: ConsoleConfig[]
        ├── id: string (UUID)
        ├── project_id: string (FK)
        ├── name: string (например "dev-server", "docker-logs", "ssh prod")
        ├── shell_override?: string
        ├── cwd_override?: string
        ├── startup_cmd?: string (команда при открытии: "npm run dev")
        ├── env_vars?: Record<string, string>
        └── sort_order: number
```

### Wiki

```
WikiPage
├── id: string (UUID)
├── parent_type: "workspace" | "project" | "console"
├── parent_id: string (FK к соответствующей сущности)
├── title: string
├── content: string (JSON от TipTap или Markdown)
├── tags: string[] (["#deploy", "#config", "#credentials"])
├── pinned: boolean
├── created_at: string (ISO 8601)
└── updated_at: string (ISO 8601)
```

### Терминальная сессия (runtime, не в БД)

```
TerminalSession
├── id: string
├── console_id: string (ссылка на ConsoleConfig)
├── title: string (имя вкладки)
├── is_active: boolean
└── pty_id?: number (ID процесса на Rust-стороне)
```

### SQLite таблицы (уже созданы в db.rs)

```sql
workspaces (id, name, icon, color, sort_order, is_expanded)
projects (id, workspace_id FK, name, icon, color, path, default_shell, env_vars JSON, sort_order, is_expanded)
consoles (id, project_id FK, name, shell_override, cwd_override, startup_cmd, env_vars JSON, sort_order)
wiki_pages (id, parent_type, parent_id, title, content, tags JSON, pinned, created_at, updated_at)
wiki_fts (FTS5: title, content, tags) — виртуальная таблица для полнотекстового поиска
```

---

## Задачи разработки (в порядке приоритета)

### ЭТАП 1: Рабочий терминал (критический путь)

Это самая важная часть — без рабочего терминала приложение бесполезно.

#### 1.1. Подключить xterm.js к реальному PTY

**Файлы для изменения:** `src/components/TerminalPanel.tsx`, `src-tauri/src/pty_manager.rs`, `src-tauri/src/main.rs`

**Что нужно сделать:**

1. В `pty_manager.rs` раскомментировать и доработать реализацию с `portable-pty`:
   - Функция `spawn()` должна: создать PTY через `native_pty_system().openpty()`, запустить шелл через `pair.slave.spawn_command()`, получить reader/writer, запустить фоновый поток для чтения вывода
   - Фоновый поток читает из PTY reader и отправляет данные на фронтенд через Tauri event `"pty-output"` с payload `{ pty_id: u32, data: String }`
   - Для этого нужен `AppHandle` — его нужно передать в `spawn()` или сохранить глобально при `setup()`
   - `write()` — записывает в PTY writer
   - `resize()` — вызывает `pair.master.resize(PtySize { rows, cols, ... })`
   - `kill()` — вызывает `child.kill()`

2. Структура `PtySession` должна хранить:
   ```rust
   struct PtySession {
       child: Box<dyn portable_pty::Child + Send>,
       writer: Box<dyn std::io::Write + Send>,
       master: Box<dyn portable_pty::MasterPty + Send>,  // для resize
       active: bool,
   }
   ```

3. В `main.rs` / `lib.rs` при `.setup()` сохранить `AppHandle` для использования в pty_manager

4. В `TerminalPanel.tsx` создать реальный терминальный компонент:
   ```typescript
   // Для каждой сессии:
   // 1. Создать Terminal instance из @xterm/xterm
   // 2. Загрузить FitAddon из @xterm/addon-fit
   // 3. Вызвать spawnPty(shell, cwd, envVars) для получения pty_id
   // 4. Подписаться на event "pty-output" и фильтровать по pty_id
   // 5. term.onData() → writeToPty(ptyId, data)
   // 6. term.onResize() → resizePty(ptyId, cols, rows)
   // 7. При закрытии вкладки → killPty(ptyId)
   ```

5. Настройки терминала:
   - Шрифт: JetBrains Mono, 14px
   - Тема: совпадает с тёмной темой приложения (background: #0d1117)
   - Scrollback: 10000 строк
   - FitAddon для автоматического resize при изменении размера панели

**Критично:**
- xterm.js инстанс должен корректно создаваться/уничтожаться при переключении вкладок (НЕ пересоздавать при каждом переключении — нужно скрывать/показывать или использовать ref)
- При resize сплиттера — вызывать fitAddon.fit() с debounce
- При закрытии вкладки — обязательно вызывать killPty() чтобы не оставлять зомби-процессы

#### 1.2. Определение шелла по ОС

**Файл:** `src-tauri/src/pty_manager.rs`

При spawn нужно определять шелл по умолчанию:
- macOS: `/bin/zsh`
- Linux: `$SHELL` или `/bin/bash`
- Windows: `powershell.exe`

Использовать `std::env::consts::OS` для определения платформы.

#### 1.3. Startup commands

Когда у ConsoleConfig есть `startup_cmd` (например "npm run dev"), после spawn PTY нужно:
1. Дождаться инициализации шелла (~100-300ms)
2. Записать `startup_cmd + "\n"` через writeToPty

---

### ЭТАП 2: Дерево проектов — полная функциональность

#### 2.1. Подключить CRUD к SQLite

**Файлы:** `src/App.tsx`, `src/components/TreePanel.tsx`, `src/stores/appStore.ts`

1. В `App.tsx` заменить демо-данные на вызов `loadAllWorkspaces()` из `tauriCommands.ts`
2. Все мутации (add/update/delete) в store должны вызывать соответствующие Rust-команды
3. Обрабатывать ошибки из Rust (Result<T, String>) — показывать toast/notification

#### 2.2. Контекстное меню (правый клик)

**Новый файл:** `src/components/ContextMenu.tsx`

Меню для каждого типа узла:

**Workspace:**
- Добавить проект
- Переименовать
- Изменить цвет/иконку
- Удалить (с подтверждением — удалит все вложенные проекты и консоли)

**Project:**
- Добавить консоль
- Открыть в IDE (VS Code / JetBrains)
- Открыть в файловом менеджере
- Переименовать
- Изменить путь к директории
- Удалить

**Console:**
- Запустить (открыть терминальную сессию)
- Изменить стартовую команду
- Переименовать
- Дублировать
- Удалить

Меню должно позиционироваться по координатам правого клика, закрываться при клике вне или Escape.

#### 2.3. Drag-and-drop

**Файл:** `src/components/TreePanel.tsx`

- Перетаскивание консолей между проектами
- Перетаскивание проектов между workspace
- Визуальная индикация drop-зоны
- Обновление sort_order при перетаскивании
- Сохранение нового порядка в SQLite

#### 2.4. Inline-редактирование имён

- Двойной клик или F2 на узле → поле ввода прямо в дереве
- Enter — сохранить, Escape — отменить
- Автофокус и выделение текста при начале редактирования

#### 2.5. Добавление новых узлов

**Новые компоненты:** модальные диалоги или inline-формы

**Создание Workspace:**
- Поля: имя, выбор emoji-иконки, выбор цвета
- Минимальная валидация: имя не пустое

**Создание Project:**
- Поля: имя, путь к директории (с кнопкой "Browse" через Tauri dialog), выбор шелла по умолчанию, emoji, цвет
- Browse должен открывать нативный диалог выбора директории

**Создание Console:**
- Поля: имя, стартовая команда (опционально), override шелла (опционально), override cwd (опционально)

---

### ЭТАП 3: Wiki — полноценный редактор

#### 3.1. Подключить TipTap

**Файл:** `src/components/WikiPanel.tsx`

Заменить textarea на TipTap:

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { common, createLowlight } from 'lowlight';
```

Расширения (extensions) для TipTap:
- **StarterKit** — заголовки, bold, italic, списки, blockquote, code inline, horizontal rule
- **CodeBlockLowlight** — блоки кода с подсветкой синтаксиса (поддержка: js, ts, rust, python, bash, json, yaml, sql, docker)
- **Placeholder** — текст-подсказка "Начните писать..."
- **TaskList + TaskItem** — чеклисты
- **Table** (позже) — таблицы в wiki

#### 3.2. Toolbar wiki-редактора

**Новый компонент:** `src/components/WikiToolbar.tsx`

Минимальный toolbar над редактором:
- H1 / H2 / H3
- Bold / Italic / Code
- Bullet list / Ordered list / Task list
- Code block (с выбором языка)
- Undo / Redo

Стиль: маленькие иконки, компактный, не занимает много места.

#### 3.3. Контекстная привязка к дереву

1. При выборе узла в дереве — загружать wiki-страницы для этого узла через `loadWikiPages(parentType, parentId)`
2. При переключении узла — автосохранение текущей wiki-страницы
3. У каждого узла может быть несколько wiki-страниц — показывать список с переключением
4. Кнопка "Новая страница" — создаёт WikiPage привязанную к текущему узлу

#### 3.4. Блоки кода с действиями

Для каждого блока кода в wiki:
- Кнопка "Копировать" — копирует код в буфер обмена
- Кнопка "Вставить в терминал" — вставляет код в активную терминальную сессию через writeToPty
- Отображение языка в заголовке блока

#### 3.5. Сохранение и загрузка

- Контент хранится как JSON (TipTap `editor.getJSON()`)
- Автосохранение с debounce 1 секунда после последнего изменения
- Загрузка через `editor.commands.setContent(json)`

#### 3.6. Теги

- Поле тегов под заголовком страницы
- Ввод через запятую или Enter
- Клик на тег → фильтрация списка страниц по тегу
- Предустановленные теги: #deploy, #config, #credentials, #troubleshooting, #docker, #ssh, #database, #api

---

### ЭТАП 4: Поиск и навигация

#### 4.1. Command Palette (Ctrl+P)

**Новый компонент:** `src/components/CommandPalette.tsx`

Модальное окно по центру экрана (как в VS Code):
- Поле ввода с fuzzy-поиском
- Ищет по: именам узлов дерева, заголовкам wiki-страниц, тегам, стартовым командам консолей
- Результаты группированы: Workspaces, Projects, Consoles, Wiki Pages
- Enter → перейти к выбранному элементу (выбрать узел, открыть сессию, открыть wiki-страницу)
- Escape → закрыть

#### 4.2. Глобальный поиск по wiki (Ctrl+Shift+K)

**Новый компонент:** `src/components/GlobalSearch.tsx`

- Полнотекстовый поиск через SQLite FTS5 (уже реализован в db.rs — `search_wiki_fts`)
- Показывает результаты с preview контента
- Подсветка совпадений в результатах
- Переход к найденной странице по клику

---

### ЭТАП 5: Настройки и UX-polish

#### 5.1. Настройки приложения

**Новый компонент:** `src/components/Settings.tsx`

Открывается по Ctrl+, (запятая) или из меню:

- **Терминал:** шрифт, размер шрифта, размер scrollback, курсор (block/underline/bar)
- **Wiki:** шрифт, размер шрифта
- **Дерево:** размер шрифта, отступы
- **Тема:** тёмная/светлая (позже — кастомные)
- **Горячие клавиши:** перечень с возможностью переназначить

Настройки хранятся в `~/.devconsole/config.json` (Rust-сторона для чтения/записи).

#### 5.2. Горячие клавиши

| Комбинация | Действие |
|-----------|---------|
| Ctrl/Cmd + P | Command Palette |
| Ctrl/Cmd + Shift + K | Глобальный поиск wiki |
| Ctrl/Cmd + T | Новая вкладка терминала |
| Ctrl/Cmd + W | Закрыть текущую вкладку |
| Ctrl/Cmd + Tab | Следующая вкладка |
| Ctrl/Cmd + Shift + Tab | Предыдущая вкладка |
| Ctrl/Cmd + 1..9 | Переключиться на вкладку N |
| Ctrl/Cmd + B | Toggle дерева |
| Ctrl/Cmd + \ | Toggle wiki |
| Ctrl/Cmd + , | Настройки |
| F2 | Переименовать выбранный узел |
| Delete | Удалить выбранный узел (с подтверждением) |
| Ctrl/Cmd + Shift + D | Дублировать выбранную консоль |

#### 5.3. Toast-уведомления

**Новый компонент:** `src/components/Toast.tsx`

Компактные уведомления в правом нижнем углу:
- Успешные действия (зелёные): "Workspace создан", "Настройки сохранены"
- Ошибки (красные): ошибки из Rust-команд
- Автоматическое исчезновение через 3 секунды

---

### ЭТАП 6: Расширенные возможности (post-MVP)

#### 6.1. SSH-профили

**Новые файлы:** `src/components/SshProfiles.tsx`, расширение `commands.rs`

- Хранение SSH-конфигов: host, port, user, путь к ключу, passphrase (в системном keychain)
- Выбор SSH-профиля при создании консоли
- Стартовая команда автоматически генерируется: `ssh -i ~/.ssh/key user@host -p port`

#### 6.2. Сплит-терминал

Разделение центральной панели горизонтально или вертикально:
- Ctrl+Shift+H — горизонтальный сплит
- Ctrl+Shift+V — вертикальный сплит
- Каждая половина — независимая терминальная вкладка
- Drag для изменения пропорций

#### 6.3. Broadcast-режим

- Кнопка "Broadcast" в панели вкладок
- При активации — ввод дублируется во все выбранные терминалы
- Полезно для одновременного выполнения команд на нескольких серверах

#### 6.4. Быстрые команды (Snippets)

**Расширение wiki или отдельная панель:**

- Сохранённые команды с привязкой к проекту
- Запуск в один клик в активном терминале
- Параметризация: `deploy {{branch}}` → показывает поле ввода перед запуском

#### 6.5. Экспорт/Импорт

- Экспорт всего workspace (дерево + wiki) как .zip
- Импорт из .zip
- Экспорт wiki в Markdown
- Синхронизация через Git (опционально)

#### 6.6. Интеграции

- Git: показывать текущую ветку в узле проекта
- Docker: статус контейнеров рядом с проектом
- "Открыть в VS Code" через `code .` из контекстного меню проекта

---

## Архитектура IPC (Rust ↔ TypeScript)

### Как работает Tauri IPC

```
TypeScript (Frontend)                    Rust (Backend)
─────────────────────                    ──────────────
                                         
invoke("create_workspace", {             #[tauri::command]
  name: "My WS",          ──────────►   fn create_workspace(name: String, ...)
  icon: "📁",                               → db::save_workspace(...)
  color: "#58a6ff"                           → Ok(workspace)
})                         ◄──────────   
  .then(workspace => ...)                return Result<Workspace, String>
                                         
                                         
listen("pty-output",       ◄──────────   app_handle.emit("pty-output",
  (event) => {                              PtyOutput { pty_id, data }
    term.write(event.data)               );  // из фонового потока
  }                                      
)                                        
```

### Все зарегистрированные команды

**Дерево (commands.rs → db.rs):**
- `load_workspaces() → Vec<Workspace>` — загрузка всего дерева
- `create_workspace(name, icon, color) → Workspace`
- `update_workspace(id, name, icon, color)`
- `delete_workspace(id)` — каскадное удаление
- `create_project(workspace_id, name, path, default_shell) → Project`
- `delete_project(id)` — каскадное удаление
- `create_console(project_id, name, startup_cmd?) → ConsoleConfig`
- `delete_console(id)`

**PTY (commands.rs → pty_manager.rs):**
- `spawn_pty(shell, cwd, env_vars) → u32` — возвращает pty_id
- `write_to_pty(pty_id, data)` — отправить ввод
- `resize_pty(pty_id, cols, rows)` — изменить размер
- `kill_pty(pty_id)` — завершить сессию

**Wiki (commands.rs → db.rs):**
- `load_wiki_pages(parent_type, parent_id) → Vec<WikiPage>`
- `save_wiki_page(page: WikiPage)` — upsert
- `delete_wiki_page(id)`
- `search_wiki(query) → Vec<WikiPage>` — FTS5 поиск

**Tauri Events (Rust → TypeScript):**
- `"pty-output"` — `{ pty_id: u32, data: String }` — вывод терминала

---

## Стилевые соглашения

### CSS / Tailwind

Цветовая палитра (определена в `tailwind.config.js`):

```
surface-0: #0d1117  — фон приложения
surface-1: #161b22  — фон панелей
surface-2: #1c2128  — поповеры, карточки
surface-3: #2d333b  — ховер-состояния
border:    #30363d  — границы
accent:    #58a6ff  — акцентный цвет (синий)
text-primary:   #e6edf3
text-secondary: #8b949e
text-muted:     #484f58
success: #3fb950
warning: #d29922
danger:  #f85149
```

Шрифты:
- UI: Inter (sans-serif)
- Код/терминал: JetBrains Mono (monospace)

### Rust

- Все типы данных с `#[serde(rename_all = "camelCase")]` для совместимости с JS
- Ошибки возвращаются как `Result<T, String>` (Tauri требование для IPC)
- Комментарии на русском для понятности
- `///` doc-комментарии над публичными функциями

### TypeScript

- Строгая типизация (strict: true)
- Все IPC-вызовы обёрнуты в функции в `tauriCommands.ts`
- Компоненты — функциональные, с хуками
- Состояние — через Zustand (useAppStore)

---

## Известные ограничения и подводные камни

1. **portable-pty на Windows** — требует Visual Studio Build Tools. На macOS/Linux работает из коробки.

2. **xterm.js и resize** — при изменении размера панели через сплиттер нужно вызывать `fitAddon.fit()` с debounce ~100ms, иначе будет мерцание.

3. **Tauri events и потоки** — `AppHandle.emit()` можно вызывать из любого потока, но `AppHandle` нужно клонировать перед передачей в `thread::spawn()`.

4. **SQLite и потоки** — используется `Mutex<Connection>`, только один поток может работать с БД одновременно. Для MVP это ОК, для production может потребоваться пул соединений.

5. **ON DELETE CASCADE** — в SQLite нужно включить `PRAGMA foreign_keys = ON` для каждого соединения. Сейчас это не включено в db.rs — нужно добавить.

6. **TipTap контент** — хранится как JSON. При загрузке нужно проверять что JSON валиден, иначе editor.setContent() упадёт.

7. **Иконки** — в src-tauri/icons/ лежат placeholder-иконки. Для релиза нужны нормальные иконки в форматах: .png (32x32, 128x128, 256x256), .icns (macOS), .ico (Windows).

---

## Как запускать и тестировать

```bash
# Установить зависимости (один раз)
npm install

# Режим разработки (hot reload frontend + Rust перекомпиляция)
npm run tauri dev

# Сборка продакшн-бинарника
npm run tauri build

# Только фронтенд в браузере (без Tauri, для быстрой итерации UI)
npm run dev
```

Первый `npm run tauri dev` компилирует Rust ~3-5 минут. Далее — инкрементальная компиляция ~5-15 секунд.

При изменении TypeScript — hot reload мгновенный.
При изменении Rust — автоматическая перекомпиляция и перезапуск.
