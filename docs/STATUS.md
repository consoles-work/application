# DevConsole Hub — Статус проекта

> Последнее обновление: 2026-03-26

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
| `src/stores/appStore.ts` | ✅ Готово | CRUD + Toast + Wiki + settings (Record<string,string>) |
| `src/lib/tauriCommands.ts` | ✅ Готово | Все IPC-обёртки: дерево, PTY, wiki, clone_console, clone_project, get_settings, set_setting, get_db_info |
| `src/lib/themes.ts` | ✅ Готово | 10 тем с UI-цветами и полной xterm-палитрой, resolveThemeId, applyTheme |
| `src/components/Layout.tsx` | ✅ Готово | Трёхпанельный layout с resizable сплиттерами + кнопка Settings в titlebar |
| `src/components/TreePanel.tsx` | ✅ Готово | Дерево + раскрытие по клику на строку + контекстное меню + inline rename (F2) + danger/ssh badge + клонирование + поиск по дереву |
| `src/components/TerminalPanel.tsx` | ✅ Готово | xterm.js + PTY + danger-баннер + SSH + startup + динамические настройки (шрифт, тема) |
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
| `src/App.tsx` | ✅ Готово | Загрузка данных + настроек + применение темы при старте; Cmd+B/\\/P/, |
| `src/styles/globals.css` | ✅ Готово | CSS-переменные для 10 тем + xterm.js + TipTap стили |

### Backend (Rust)

| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/main.rs` | ✅ Готово | 25 IPC-команд (clone_console/project, get_settings, set_setting, get_db_info) |
| `src-tauri/src/lib.rs` | ✅ Готово | Дубликат для мобильных/библиотечной сборки — синхронизирован с main.rs |
| `src-tauri/src/commands.rs` | ✅ Готово | CRUD дерева, PTY, wiki, danger, clone, settings; DbInfo struct |
| `src-tauri/src/db.rs` | ✅ Готово | Полный CRUD + FTS5 + клонирование + settings-таблица + get_db_info_data + миграции v1-v3 |
| `src-tauri/src/pty_manager.rs` | ✅ Готово | portable-pty: spawn/write/resize/kill; `sh -c` для команд с пробелами |

---

## Горячие клавиши

| Комбинация | Статус |
|-----------|--------|
| Cmd+B (toggle дерева) | ✅ Готово |
| Cmd+\\ (toggle wiki) | ✅ Готово |
| F2 (переименовать) | ✅ Готово |
| Cmd+P (Command Palette) | ✅ Готово |
| Cmd+, (настройки) | ✅ Готово |
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
| Локализация (i18next, ru+en) | Высокий | Этап 8; заготовка кнопок в Settings уже есть |
| Горячие клавиши (Cmd+T/W/Tab/1-9/Delete) | Средний | Post-MVP |
| `GlobalSearch.tsx` (Cmd+Shift+K) | Низкий | Глобальный модал поиска с подсветкой; поиск внутри WikiPanel уже есть |
| Wiki: блоки кода с кнопками | Низкий | TipTap NodeView: "Копировать" + "Вставить в терминал" |
| Drag-and-drop в дереве | Отменено | — |

### Post-MVP (Этап 9)
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод в несколько консолей)
- Snippets / быстрые команды
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git, Docker

---

## Итоговая оценка готовности

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
| Поиск и навигация (дерево + wiki) | 85% (GlobalSearch-модал отсутствует) |
| Локализация | 5% (заготовка кнопок, логика не реализована) |
| Post-MVP функции | 0% |

**Общая готовность MVP: ~99%**
