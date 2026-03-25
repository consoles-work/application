# DevConsole Hub — Анализ текущего состояния

> Последнее обновление: 2026-03-26

---

## Что реально готово и работает

### Инфраструктура
- Tauri 2.0 проект инициализирован, компилируется и запускается
- Все npm-зависимости установлены (xterm.js, TipTap, lowlight, lucide-react, plugin-dialog)
- Cargo.toml содержит все Rust-зависимости (rusqlite, portable-pty, uuid, dirs, chrono, tauri-plugin-dialog)
- Tailwind настроен с тёмной палитрой IDE-стиля
- Capabilities настроены: core:default, event listen/unlisten/emit, shell:open, dialog

### Frontend (React + TypeScript)
| Файл | Статус | Примечания |
|------|--------|------------|
| `src/types/index.ts` | Готово | Все интерфейсы |
| `src/stores/appStore.ts` | Готово | CRUD actions + Toast (showToast/removeToast) |
| `src/lib/tauriCommands.ts` | Готово | Все IPC-обёртки включая updateProject, updateConsole |
| `src/components/Layout.tsx` | Готово | Трёхпанельный layout с resizable сплиттерами |
| `src/components/TreePanel.tsx` | Готово | Дерево + контекстное меню + inline rename (F2/двойной клик) + диалоги |
| `src/components/TerminalPanel.tsx` | Готово | Реальный xterm.js + PTY через Tauri IPC |
| `src/components/WikiPanel.tsx` | Заглушка | Скелет с textarea вместо TipTap |
| `src/components/Toast.tsx` | Готово | Success/error/info, автоисчезновение 3 сек |
| `src/components/ContextMenu.tsx` | Готово | Правый клик: Workspace/Project/Console меню |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | Готово | Имя + emoji + цвет |
| `src/components/dialogs/CreateProjectDialog.tsx` | Готово | Имя + Browse (plugin-dialog) + shell + emoji + цвет |
| `src/components/dialogs/CreateConsoleDialog.tsx` | Готово | Имя + startup_cmd |
| `src/App.tsx` | Готово | Загрузка из SQLite + горячие клавиши Cmd+B/Cmd+\\ |
| `src/styles/globals.css` | Готово | Тёмная тема + xterm.js стили |

### Backend (Rust)
| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/lib.rs` | Готово | 18 IPC-команд, AppHandle передаётся в PTY manager |
| `src-tauri/src/main.rs` | Готово | Дубликат lib.rs для десктопного бинарника |
| `src-tauri/src/commands.rs` | Готово | 18 команд: CRUD дерева (включая update_project, update_console), PTY, wiki |
| `src-tauri/src/db.rs` | Готово | PRAGMA foreign_keys=ON, полный CRUD включая update_project_fields, update_console_name |
| `src-tauri/src/pty_manager.rs` | Готово | Реальный portable-pty: spawn/write/resize/kill, фоновый поток с emit pty-output |

---

## Что требует реализации (заглушки)

### TipTap редактор (`WikiPanel.tsx`)
- Вместо TipTap используется обычный `<textarea>`
- Нет реальной загрузки/сохранения страниц через IPC
- Нет автосохранения, нет toolbar, нет тегов

---

## Чего нет вообще (не написано)

### Компоненты
- `CommandPalette.tsx` — палитра команд Ctrl+P
- `GlobalSearch.tsx` — глобальный поиск по wiki Ctrl+Shift+K
- `Settings.tsx` — окно настроек Ctrl+,
- `WikiToolbar.tsx` — toolbar для TipTap

### Функциональность дерева
- Drag-and-drop (перетаскивание консолей/проектов)

### Горячие клавиши (из 12 — работают 3)
| Комбинация | Статус |
|-----------|--------|
| Cmd+B (toggle дерева) | Готово |
| Cmd+\\ (toggle wiki) | Готово |
| F2 (переименовать) | Готово |
| Cmd+P (Command Palette) | Нет |
| Cmd+Shift+K (поиск wiki) | Нет |
| Cmd+T (новая вкладка) | Нет |
| Cmd+W (закрыть вкладку) | Нет |
| Cmd+Tab / Cmd+Shift+Tab | Нет |
| Cmd+1..9 (вкладка N) | Нет |
| Cmd+, (настройки) | Нет |
| Delete (удалить узел) | Нет |
| Cmd+Shift+D (дублировать консоль) | Нет |

### Этап 6 (post-MVP, не начато)
- SSH-профили, сплит-терминал, broadcast-режим, snippets, экспорт/импорт, интеграции

---

## Итоговая оценка готовности

| Область | Готовность |
|---------|-----------|
| Инфраструктура / сборка | 100% |
| TypeScript типы и store | 100% |
| Layout и дерево (визуал + CRUD) | 90% |
| Backend CRUD (Rust + SQLite) | 95% |
| PTY / Терминал | 90% |
| Wiki / TipTap | 10% |
| Поиск и навигация | 0% |
| Настройки и UX-polish | 25% |
| Post-MVP функции | 0% |

**Общая готовность MVP: ~60%**
