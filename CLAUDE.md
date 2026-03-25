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

## Архитектура

Приложение Tauri 2.0: трёхпанельный GUI (дерево проектов / терминал / wiki).

### IPC-мост Rust ↔ TypeScript

Весь backend — это Rust-функции с `#[tauri::command]`. Вызов со стороны фронта:
```ts
// src/lib/tauriCommands.ts — единственное место для invoke()
invoke("rust_command_name", { camelCaseArgs })
```
Rust-функции объявлены в `src-tauri/src/commands.rs`, зарегистрированы в `src-tauri/src/lib.rs` через `tauri::generate_handler![]`. Аргументы автоматически конвертируются через serde: Rust использует `snake_case`, TypeScript — `camelCase` (директива `#[serde(rename_all = "camelCase")]`).

### Слой данных

- **SQLite** (`src-tauri/src/db.rs`) — единственное персистентное хранилище. Файл БД: `~/Library/Application Support/devconsole-hub/data.db` (macOS). Глобальное соединение через `OnceLock<Mutex<Connection>>`. WAL-режим включён.
- Иерархия: `workspaces` → `projects` → `consoles` с каскадным удалением (`ON DELETE CASCADE`). Wiki-страницы (`wiki_pages`) прикрепляются к любому уровню через `parent_type` + `parent_id`. FTS5-таблица `wiki_fts` для полнотекстового поиска.
- `env_vars` хранятся в SQLite как JSON-строка, десериализуются при чтении.

### PTY-менеджер

`src-tauri/src/pty_manager.rs` — скелет на `portable-pty`. Реальный запуск PTY-процессов закомментирован (TODO). Текущий `spawn()` создаёт заглушку и возвращает числовой `pty_id`. Планируемая архитектура: фоновый Rust-поток читает из PTY и шлёт данные на фронт через `app.emit("pty-output", ...)`, фронт пишет через `invoke("write_to_pty", ...)`.

### Frontend

- **Zustand store** (`src/stores/appStore.ts`) — единственный источник истины для UI. Держит дерево `workspaces[]`, список `sessions[]` (runtime, не в БД), состояние панелей.
- `getFlatTree()` в store разворачивает вложенную иерархию в плоский массив `TreeNode[]` для рендера `TreePanel`.
- **Компоненты**: `Layout.tsx` — корень с тремя панелями и resizable-сплиттерами; `TreePanel.tsx`, `TerminalPanel.tsx`, `WikiPanel.tsx` — независимые панели.
- **Wiki-редактор**: TipTap (ProseMirror). Контент хранится как TipTap JSON в поле `content` WikiPage.
- **Терминал**: xterm.js (`@xterm/xterm`). Подключение к PTY-бэкенду ещё не реализовано.

### Текущее состояние (скелет)

`App.tsx` загружает демо-данные вместо реального `loadAllWorkspaces()`. CRUD-операции с деревом через Rust реализованы, но ещё не подключены к UI. PTY и xterm.js — каркас без реального I/O.

### Горячие клавиши

- `Cmd/Ctrl+B` — показать/скрыть панель дерева
- `Cmd/Ctrl+\` — показать/скрыть wiki-панель