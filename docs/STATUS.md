# DevConsole Hub — Анализ текущего состояния

> Дата анализа: 2026-03-26

---

## Что реально готово и работает

### Инфраструктура
- Tauri 2.0 проект инициализирован, компилируется и запускается
- Все npm-зависимости установлены (xterm.js, TipTap, lowlight, lucide-react)
- Cargo.toml содержит все Rust-зависимости (rusqlite, portable-pty, uuid, dirs, chrono)
- Tailwind настроен с тёмной палитрой IDE-стиля

### Frontend (React + TypeScript)
| Файл | Статус | Примечания |
|------|--------|------------|
| `src/types/index.ts` | Готово | Все интерфейсы: Workspace, Project, ConsoleConfig, WikiPage, TerminalSession, TreeNode, AppSettings |
| `src/stores/appStore.ts` | Готово | Полный Zustand store: CRUD actions для дерева, управление сессиями, UI-состояние, getFlatTree() |
| `src/lib/tauriCommands.ts` | Готово | Обёртки invoke() для всех 16 Rust-команд |
| `src/components/Layout.tsx` | Готово | Трёхпанельный layout с resizable сплиттерами |
| `src/components/TreePanel.tsx` | Готово | Рендер flat tree, expand/collapse, выделение узла, открытие сессии при клике на console |
| `src/components/TerminalPanel.tsx` | Заглушка | Вкладки работают, вместо xterm.js — статичный placeholder |
| `src/components/WikiPanel.tsx` | Заглушка | Список страниц + вкладки работают, вместо TipTap — обычный textarea |
| `src/App.tsx` | Частично | Горячие клавиши Cmd+B / Cmd+\\ работают; данные — демо, не из БД |
| `src/styles/globals.css` | Готово | Тёмная тема, стили для tree items, terminal tabs, wiki editor |

### Backend (Rust)
| Файл | Статус | Примечания |
|------|--------|------------|
| `src-tauri/src/lib.rs` | Готово | Регистрация 16 команд, вызов db::init() и pty_manager::init() в setup() |
| `src-tauri/src/commands.rs` | Готово | Все 16 IPC-команд объявлены, типы с serde/camelCase |
| `src-tauri/src/db.rs` | Готово | Инициализация SQLite, WAL-режим, все таблицы, полный CRUD, FTS5 поиск |
| `src-tauri/src/pty_manager.rs` | Заглушка | Структура сессий есть, реальный portable-pty код закомментирован |

---

## Что требует реализации (заглушки)

### Критический путь (без этого приложение бесполезно)

**1. PTY bridge — Rust side (`pty_manager.rs`)**
- Реальный код portable-pty закомментирован
- Структура `PtySession` не содержит реальных полей (child, writer, master)
- `spawn()` создаёт заглушку вместо процесса
- `write()`, `resize()`, `kill()` — только println-заглушки
- Нет `AppHandle` для emit событий на фронт

**2. xterm.js — Frontend side (`TerminalPanel.tsx`)**
- Нет реального Terminal instance
- Нет подписки на событие `"pty-output"`
- Нет отправки ввода через writeToPty()
- Нет FitAddon и resize при изменении панели
- Нет корректного создания/уничтожения инстансов при переключении вкладок

**3. Загрузка данных из БД (`App.tsx`)**
- Используются жёстко заданные демо-данные вместо `loadAllWorkspaces()`
- Мутации дерева (add/update/delete) в store не вызывают Rust-команды

**4. TipTap редактор (`WikiPanel.tsx`)**
- Вместо TipTap используется обычный `<textarea>`
- Нет реальной загрузки/сохранения страниц через IPC
- Нет автосохранения

### Известные баги/пропуски в готовом коде

- `db.rs`: `PRAGMA foreign_keys = ON` не включён — CASCADE удаление не работает
- `lib.rs`: `AppHandle` не сохраняется глобально — PTY не сможет слать события на фронт
- `pty_manager.rs`: функция `spawn()` принимает `AppHandle` в TODO-комментарии, но не в сигнатуре

---

## Чего нет вообще (не написано ни строчки)

### Компоненты
- `ContextMenu.tsx` — контекстное меню правого клика для дерева
- `CommandPalette.tsx` — палитра команд Ctrl+P
- `GlobalSearch.tsx` — глобальный поиск по wiki Ctrl+Shift+K
- `Settings.tsx` — окно настроек Ctrl+,
- `Toast.tsx` — уведомления об ошибках и успешных действиях
- Модальные диалоги создания Workspace / Project / Console
- Компонент `WikiToolbar.tsx` — toolbar для TipTap

### Функциональность дерева
- Контекстное меню (правый клик)
- Drag-and-drop (перетаскивание консолей/проектов)
- Inline-редактирование имён (F2 / двойной клик)
- Диалоги создания новых узлов с Browse-кнопкой

### Горячие клавиши (из 12 — работают 2)
| Комбинация | Статус |
|-----------|--------|
| Cmd+B (toggle дерева) | Готово |
| Cmd+\\ (toggle wiki) | Готово |
| Cmd+P (Command Palette) | Нет |
| Cmd+Shift+K (поиск wiki) | Нет |
| Cmd+T (новая вкладка) | Нет |
| Cmd+W (закрыть вкладку) | Нет |
| Cmd+Tab / Cmd+Shift+Tab | Нет |
| Cmd+1..9 (вкладка N) | Нет |
| Cmd+, (настройки) | Нет |
| F2 (переименовать) | Нет |
| Delete (удалить узел) | Нет |
| Cmd+Shift+D (дублировать консоль) | Нет |

### Этап 6 (post-MVP, не начато)
- SSH-профили
- Сплит-терминал
- Broadcast-режим
- Snippets / быстрые команды
- Экспорт/импорт
- Интеграции (Git, Docker, VS Code)

---

## Итоговая оценка готовности

| Область | Готовность |
|---------|-----------|
| Инфраструктура / сборка | 100% |
| TypeScript типы и store | 95% |
| Layout и дерево (визуал) | 80% |
| Backend CRUD (Rust + SQLite) | 85% |
| PTY / Терминал | 5% (только структура) |
| Wiki / TipTap | 10% (только UI-скелет) |
| Дерево — полная функциональность | 30% |
| Поиск и навигация | 0% |
| Настройки и UX-polish | 5% (только 2 хоткея) |
| Post-MVP функции | 0% |

**Общая готовность MVP: ~25%**