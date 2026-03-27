# DevConsole Hub — Архитектура и принцип работы

---

## Общая картина

DevConsole Hub — это десктопное Tauri-приложение. Tauri — это фреймворк, где:

- **Frontend** (UI) — React + TypeScript, работает в системном WebView (как браузер)
- **Backend** — Rust-процесс, имеет доступ к ОС: файловая система, PTY, SQLite
- **Мост между ними** — Tauri IPC (Inter-Process Communication)

```
┌──────────────────────────────────────────────┐
│                 WebView (UI)                  │
│  React + TypeScript + xterm.js + TipTap      │
│                                              │
│  appStore (Zustand) — единственный           │
│  источник истины для UI-состояния            │
└────────────────┬─────────────────────────────┘
                 │  Tauri IPC
                 │  invoke("команда", { args })   →   Promise<Result>
                 │  listen("событие", callback)   ←   app.emit(...)
┌────────────────▼─────────────────────────────┐
│              Rust-процесс                    │
│                                              │
│  commands.rs  — IPC-обработчики              │
│  db.rs        — SQLite (rusqlite)            │
│  pty_manager.rs — терминальные сессии        │
└──────────────────────────────────────────────┘
```

---

## Как TypeScript вызывает Rust (invoke)

Это главный механизм общения фронта с бэком.

### Сторона TypeScript

Все вызовы собраны в одном файле — `src/lib/tauriCommands.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

// Пример: загрузить все workspace-ы из БД
export async function loadAllWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>("load_workspaces");
}

// Пример: создать workspace
export async function createWorkspace(name: string, icon: string, color: string) {
  return invoke<Workspace>("create_workspace", { name, icon, color });
}
```

`invoke` возвращает `Promise` — как обычный fetch. Аргументы передаются объектом в camelCase.

### Сторона Rust

В `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn create_workspace(name: String, icon: String, color: String) -> Result<Workspace, String> {
    // Создаём объект, сохраняем в БД, возвращаем
    let workspace = Workspace { id: uuid::Uuid::new_v4().to_string(), name, icon, color, ... };
    crate::db::save_workspace(&workspace)?;
    Ok(workspace)
}
```

Макрос `#[tauri::command]` регистрирует функцию как IPC-endpoint. `Result<T, String>` — если `Ok(val)`, Promise резолвится значением; если `Err(msg)`, Promise реджектится строкой-ошибкой.

### Регистрация команд

Функции нужно явно перечислить в `invoke_handler`. **Важно: в двух файлах:**

```rust
// src-tauri/src/main.rs  (десктоп)
// src-tauri/src/lib.rs   (мобильные платформы)
.invoke_handler(tauri::generate_handler![
    load_workspaces,
    create_workspace,
    spawn_pty,
    // ... все остальные
])
```

Если добавить команду в `commands.rs` но забыть про `invoke_handler` — в рантайме будет ошибка `command not found`.

### Конвертация camelCase ↔ snake_case

Rust использует `snake_case`, TypeScript — `camelCase`. Tauri конвертирует автоматически:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // ← эта директива
pub struct Project {
    pub workspace_id: String,   // в JSON станет "workspaceId"
    pub default_shell: String,  // в JSON станет "defaultShell"
    pub is_danger: bool,        // в JSON станет "isDanger"
}
```

Поэтому TypeScript-интерфейсы для таких структур должны использовать camelCase:

```ts
interface Project {
  workspaceId: string;   // не workspace_id
  defaultShell: string;
  isDanger: boolean;
}
```

---

## Как Rust отправляет данные в TypeScript (emit/listen)

Для PTY-терминала нужен обратный поток: Rust → TypeScript (вывод процесса).
`invoke` не подходит — данные приходят асинхронно, потоком.
Решение — события Tauri:

### Сторона Rust (отправка)

В `pty_manager.rs`, фоновый поток читает вывод PTY и шлёт событие:

```rust
app_handle.emit("pty-output", PtyOutput { pty_id: id, data })
```

### Сторона TypeScript (подписка)

В `TerminalPanel.tsx`:

```ts
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<{ pty_id: number; data: string }>("pty-output", (event) => {
  if (event.payload.pty_id === myPtyId) {
    term.write(event.payload.data);  // пишем в xterm.js
  }
});

// При размонтировании компонента — отписываемся
unlisten();
```

---

## Слой данных: SQLite

База данных хранится в `~/Library/Application Support/devconsole-hub/data.db` (macOS).
Инициализируется один раз при старте в `main.rs` → `db::init()`.

### Схема таблиц

```
workspaces
    id, name, icon, color, sort_order, is_expanded

    └── projects  (workspace_id → workspaces.id ON DELETE CASCADE)
            id, workspace_id, name, icon, color, path,
            default_shell, env_vars (JSON), sort_order,
            is_danger, danger_label

            └── consoles  (project_id → projects.id ON DELETE CASCADE)
                    id, project_id, name, shell_override, cwd_override,
                    startup_cmd, env_vars (JSON), sort_order,
                    is_danger, danger_label,
                    connection_type, ssh_host, ssh_port,
                    ssh_user, ssh_key_path, ssh_extra_args

wiki_pages
    id, parent_type, parent_id, title, content,
    tags (JSON), pinned, created_at, updated_at

wiki_fts  (FTS5 — виртуальная таблица для полнотекстового поиска)
    title, content, tags  → linked to wiki_pages

settings
    key, value  (key-value хранилище настроек приложения)
```

`ON DELETE CASCADE` — удаление workspace автоматически удаляет все его projects и consoles.

### Глобальное подключение к БД

Одно подключение на всё приложение, защищённое `Mutex`:

```rust
static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

fn get_db() -> &'static Mutex<Connection> {
    DB.get().expect("Database not initialized")
}

// Использование:
let db = get_db().lock().unwrap();
db.execute("INSERT INTO ...", params![...])?;
```

`WAL-режим` включён — позволяет читать БД параллельно с записью.

### env_vars и теги — JSON в SQLite

Rust-структуры `HashMap<String, String>` и `Vec<String>` хранятся в SQLite как JSON-строки:

```rust
// Запись:
let env_json = serde_json::to_string(&project.env_vars).unwrap_or("{}".to_string());
conn.execute("UPDATE projects SET env_vars = ?1", params![env_json])?;

// Чтение:
let env_str: String = row.get("env_vars")?;
let env_vars: HashMap<String, String> = serde_json::from_str(&env_str).unwrap_or_default();
```

---

## PTY-менеджер (терминал)

PTY (Pseudo-Terminal) — это виртуальный терминал, к которому подключается процесс (shell/ssh).

### Жизненный цикл PTY-сессии

```
TypeScript                              Rust (pty_manager.rs)
    │                                           │
    │── invoke("spawn_pty", {shell, cwd}) ─────►│
    │                                    создаёт PTY-пару (master/slave)
    │                                    запускает shell в slave
    │                                    фоновый поток читает master
    │◄────────────────── Ok(pty_id) ────────────│
    │                                           │
    │                                    [фоновый поток]
    │◄── emit("pty-output", {pty_id, data}) ────│ (непрерывно)
    │                                           │
    │── invoke("write_to_pty", {ptyId, data}) ──►│
    │                                    пишет bytes в master
    │                                           │
    │── invoke("resize_pty", {ptyId, cols, rows})►│
    │                                    меняет размер PTY
    │                                           │
    │── invoke("kill_pty", {ptyId}) ────────────►│
    │                                    завершает процесс, чистит сессию
```

### UTF-8 и кириллица

При запуске PTY явно устанавливаются переменные окружения:

```rust
cmd.env("LANG", "en_US.UTF-8");   // из системного окружения или дефолт
cmd.env("LC_CTYPE", "UTF-8");
cmd.env("TERM", "xterm-256color");
```

Это нужно потому что Tauri-приложение, запущенное через dock/Finder, не наследует окружение пользователя и `LANG` может оказаться пустым.

---

## Frontend: Zustand store

`src/stores/appStore.ts` — единственный источник истины для UI. Компоненты не хранят данные локально (кроме эфемерных UI-состояний), всё в сторе.

### Что хранит стор

```ts
{
  // Данные из БД (синхронизируются при старте и CRUD-операциях)
  workspaces: Workspace[];
  currentWikiPages: WikiPage[];

  // Runtime-состояние (не сохраняется в БД)
  sessions: TerminalSession[];   // открытые вкладки терминала
  activeSessionId: string | null;
  selectedNode: SelectedNode | null;

  // UI-состояние (сохраняется в settings-таблице SQLite)
  showTreePanel: boolean;
  showWikiPanel: boolean;
  settings: Record<string, string>;
}
```

### Поток данных при CRUD-операции

```
Пользователь нажимает "Создать workspace"
         │
         ▼
CreateWorkspaceDialog.tsx
  → вызывает createWorkspace() из tauriCommands.ts
         │
         ▼
invoke("create_workspace", { name, icon, color })
         │
         ▼
Rust: commands.rs :: create_workspace()
  → генерирует UUID
  → db::save_workspace()  →  INSERT INTO workspaces
  → возвращает Workspace{}
         │
         ▼
Promise резолвится с новым Workspace
         │
         ▼
appStore.addWorkspace(workspace)  — обновляет стор
         │
         ▼
React перерисовывает TreePanel с новым узлом
```

---

## Frontend: компоненты

```
App.tsx                        — корень, загрузка данных при старте, горячие клавиши
└── Layout.tsx                 — три панели + resizable-сплиттеры + titlebar
    ├── TreePanel.tsx          — дерево workspace/project/console
    │   ├── ContextMenu.tsx    — правый клик
    │   ├── CommandPalette.tsx — Cmd+P поиск
    │   └── dialogs/           — Create/Edit диалоги
    ├── TerminalPanel.tsx      — вкладки + xterm.js инстансы
    └── WikiPanel.tsx          — TipTap редактор + поиск
        └── WikiToolbar.tsx    — кнопки форматирования
```

### xterm.js + PTY

`TerminalPanel.tsx` создаёт xterm.js-терминал и подключает его к PTY:

```ts
const term = new Terminal({ fontFamily, fontSize, theme });
term.loadAddon(new FitAddon());
term.open(containerRef.current);

// Ввод пользователя → PTY
term.onData((data) => writeToPty(ptyId, data));

// Вывод PTY → xterm.js
listen("pty-output", (e) => {
  if (e.payload.pty_id === ptyId) term.write(e.payload.data);
});

// Изменение размера → PTY
term.onResize(({ cols, rows }) => resizePty(ptyId, cols, rows));
```

### Wiki: TipTap + автосохранение

Контент хранится как TipTap JSON (не HTML и не Markdown). Автосохранение через debounce 1000ms:

```ts
editor.on("update", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveWikiPage(...), 1000);
});
```

---

## Настройки приложения

Настройки — key-value пары в SQLite-таблице `settings`. Ключи — строки вида `ui.theme`, `terminal.fontSize`, `ui.showTreePanel` и т.д.

```
Чтение при старте:
  invoke("get_settings") → Record<string, string> → appStore.settings

Запись:
  invoke("set_setting", { key: "ui.theme", value: "dracula" })
  + appStore.setSetting("ui.theme", "dracula")  ← обновляет локальное состояние
```

Видимость панелей сохраняется автоматически: `toggleTreePanel()` и `toggleWikiPanel()` в сторе вызывают `invoke("set_setting", ...)` и восстанавливаются при следующем запуске.

---

## Старт приложения: порядок инициализации

```
1. Rust: main() → run()
2. Rust: db::init()         — открывает/создаёт data.db, создаёт таблицы
3. Rust: pty_manager::init() — сохраняет AppHandle, создаёт HashMap сессий
4. Rust: запускает WebView с фронтендом

5. React: App.tsx монтируется
6. TS: loadAllWorkspaces()  — загружает дерево из SQLite
7. TS: getSettings()        — загружает настройки, применяет тему, язык,
                              восстанавливает видимость панелей
8. UI готов к работе
```

---

## Файловая структура (ключевые файлы)

```
src/                              — Frontend (TypeScript + React)
  App.tsx                         — корневой компонент
  stores/appStore.ts              — Zustand store
  lib/
    tauriCommands.ts              — ВСЕ invoke()-вызовы (единственное место)
    themes.ts                     — 10 тем UI + xterm-палитры
    i18n.ts                       — локализация (i18next)
  components/
    Layout.tsx
    TreePanel.tsx
    TerminalPanel.tsx
    WikiPanel.tsx
    ...
  types/index.ts                  — TypeScript-интерфейсы (зеркало Rust-структур)
  styles/globals.css              — CSS-переменные тем

src-tauri/src/                    — Backend (Rust)
  main.rs                         — точка входа, регистрация команд (десктоп)
  lib.rs                          — то же для мобильных платформ
  commands.rs                     — #[tauri::command] функции + Rust-структуры
  db.rs                           — SQLite CRUD через rusqlite
  pty_manager.rs                  — PTY-сессии через portable-pty

src-tauri/
  tauri.conf.json                 — конфигурация Tauri (окно, capabilities)
  Cargo.toml                      — Rust-зависимости
```
