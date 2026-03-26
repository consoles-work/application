# DevConsole Hub — Статус проекта

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
| `src/types/index.ts` | Готово | Все интерфейсы: WikiPage (camelCase), isDanger/dangerLabel в Project/Console, SSH-поля в ConsoleConfig |
| `src/stores/appStore.ts` | Готово | CRUD + Toast + Wiki (currentWikiPages, activeWikiPageId, addWikiPage, updateWikiPage, removeWikiPage) |
| `src/lib/tauriCommands.ts` | Готово | Все IPC-обёртки включая setNodeDanger, updateConsoleConfig, wiki-команды |
| `src/components/Layout.tsx` | Готово | Трёхпанельный layout с resizable сплиттерами |
| `src/components/TreePanel.tsx` | Готово | Дерево + ChevronRight/Down + контекстное меню + inline rename (F2) + danger badge + ssh badge + EditConsoleDialog |
| `src/components/TerminalPanel.tsx` | Готово | xterm.js + PTY IPC + danger баннер + красный градиент + нативное подтверждение закрытия (ask) + SSH команда + многострочный startup |
| `src/components/WikiPanel.tsx` | Готово | TipTap редактор + привязка к узлу + автосохранение debounce + теги |
| `src/components/WikiToolbar.tsx` | Готово | H1/H2/H3, Bold/Italic/Code, списки, TaskList, CodeBlock, HR, Undo/Redo |
| `src/components/CommandPalette.tsx` | Готово | Fuzzy-поиск по дереву, ↑↓/Enter/Esc, danger badge |
| `src/components/Toast.tsx` | Готово | Success/error/info, автоисчезновение 3 сек |
| `src/components/ContextMenu.tsx` | Готово | Workspace/Project/Console меню + "Пометить как опасный" + "Настройки подключения..." |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | Готово | Имя + emoji + цвет |
| `src/components/dialogs/CreateProjectDialog.tsx` | Готово | Имя + Browse + shell + emoji + цвет + чекбокс danger |
| `src/components/dialogs/CreateConsoleDialog.tsx` | Готово | Имя + Local/SSH переключатель + все SSH-поля + Browse для ключа + textarea startup + чекбокс danger |
| `src/components/dialogs/EditConsoleDialog.tsx` | Готово | Редактирование существующей консоли: те же поля; вызов через "Настройки подключения..." |
| `src/App.tsx` | Готово | Загрузка из SQLite + горячие клавиши Cmd+B / Cmd+\\ / Cmd+P |
| `src/styles/globals.css` | Готово | Тёмная тема + xterm.js стили + TipTap стили (task list, user-select) |

### Backend (Rust)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/main.rs` | Готово | 20 IPC-команд зарегистрированы (включая update_console_config) |
| `src-tauri/src/lib.rs` | Готово | Дубликат для мобильных/библиотечной сборки |
| `src-tauri/src/commands.rs` | Готово | CRUD дерева, PTY, wiki, set_node_danger, update_console_config; SSH-поля в ConsoleConfig |
| `src-tauri/src/db.rs` | Готово | Полный CRUD + wiki FTS5 + update_node_danger + update_console_config_fields + миграции v1/v2/v3 |
| `src-tauri/src/pty_manager.rs` | Готово | portable-pty: spawn/write/resize/kill; команды с пробелами через `sh -c` (для SSH) |

---

## Что осталось сделать

### Горячие клавиши

| Комбинация | Статус |
|-----------|--------|
| Cmd+B (toggle дерева) | ✅ Готово |
| Cmd+\\ (toggle wiki) | ✅ Готово |
| F2 (переименовать) | ✅ Готово |
| Cmd+P (Command Palette) | ✅ Готово |
| Cmd+Shift+K (поиск wiki) | ❌ Нет |
| Cmd+T (новая вкладка) | ❌ Нет |
| Cmd+W (закрыть вкладку) | ❌ Нет |
| Cmd+Tab / Cmd+Shift+Tab | ❌ Нет |
| Cmd+1..9 (вкладка N) | ❌ Нет |
| Cmd+, (настройки) | ❌ Нет |
| Delete (удалить узел) | ❌ Нет |

### Компоненты / функциональность

| Задача | Приоритет | Примечания |
|--------|-----------|------------|
| `GlobalSearch.tsx` (Cmd+Shift+K) | Высокий | FTS5-поиск по wiki, preview с подсветкой совпадений |
| `Settings.tsx` (Cmd+,) | Средний | Шрифт, размер, тема, scrollback; сохранение в config.json |
| Wiki: блоки кода с кнопками | Низкий | TipTap NodeView: кнопка "Копировать" + "Вставить в терминал" |
| Drag-and-drop в дереве | Отменено | Решили не делать |

### Этап 7 — Post-MVP (не начато)

- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод одновременно в несколько консолей)
- Snippets / быстрые команды с параметрами
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git (текущая ветка), Docker (статус), VS Code (открыть)

---

## Итоговая оценка готовности

| Область | Готовность |
|---------|-----------|
| Инфраструктура / сборка | 100% |
| TypeScript типы и store | 100% |
| Layout и дерево (визуал + CRUD + danger + SSH badge) | 100% |
| Backend CRUD (Rust + SQLite) | 100% |
| PTY / Терминал | 100% |
| SSH-подключение | 100% |
| Wiki / TipTap | 85% |
| Поиск и навигация | 40% (CommandPalette готов, GlobalSearch нет) |
| Настройки и UX-polish | 35% |
| Post-MVP функции | 0% |

**Общая готовность MVP: ~90%**
