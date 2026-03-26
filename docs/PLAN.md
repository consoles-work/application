# DevConsole Hub — План разработки

> Последнее обновление: 2026-03-26 (актуально)

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
- Project: добавить консоль, открыть в VS Code/Finder, переименовать, удалить
- Console: запустить, настройки подключения, переименовать, удалить
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
- Иконки раскрытия: ChevronRight/ChevronDown вместо ▸/▾
- Пустое место для консолей (нет иконки раскрытия)
- SSH badge (синий) для SSH-консолей
### 2.8 Пометка "Опасный узел" — ВЫПОЛНЕНО
- Поля is_danger + danger_label в projects и consoles (SQLite + Rust)
- Красный badge ⚠ PRODUCTION в дереве
- Контекстное меню: "Пометить как опасный..." / "Снять пометку"
- window.prompt для ввода метки

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
- Требует TipTap NodeView (отложено на этап 7)

---

## Этап 4: Поиск и навигация — ЧАСТИЧНО ВЫПОЛНЕН

### 4.1 CommandPalette.tsx (Cmd+P) — ВЫПОЛНЕНО
- Модал по центру, fuzzy-поиск (подстрока) по именам узлов
- Результаты с типом (WS/PRJ/CON), иконкой, danger-badge
- Клавиши: Escape закрыть, стрелки навигация, Enter перейти
- Открытие сессии при выборе консоли

### 4.2 GlobalSearch.tsx (Cmd+Shift+K) — TODO
- FTS5 поиск через `searchWiki(query)`
- Preview контента с подсветкой совпадений

---

## Этап 5: Настройки и UX-polish — ЧАСТИЧНО ВЫПОЛНЕН

### 5.1 Горячие клавиши — ЧАСТИЧНО ВЫПОЛНЕНО
Работают: Cmd+B, Cmd+\, F2, Cmd+P
Осталось добавить в App.tsx:
- Cmd+Shift+K → GlobalSearch
- Cmd+T → новая вкладка (openSession для выбранной консоли)
- Cmd+W → закрыть активную вкладку (с ask())
- Cmd+Tab / Cmd+Shift+Tab → переключение вкладок
- Cmd+1..9 → вкладка N
- Cmd+, → Settings
- Delete → удалить выбранный узел (с подтверждением)

### 5.2 Settings.tsx (Cmd+,) — TODO
- Терминал: шрифт, размер, scrollback, курсор
- Wiki: шрифт, размер
- Тема: тёмная/светлая
- Сохранение в `~/.devconsole/config.json`

### 5.3 Drag-and-drop — ОТМЕНЕНО

### 5.4 UX-улучшения — ВЫПОЛНЕНО
- Подтверждение закрытия вкладки через нативный ask()
- Danger-пометка: баннер + красный градиент в терминале, индикатор в табе
- Danger-пометка при создании проекта/консоли (чекбокс в диалоге)

---

## Этап 6: Конфигурация подключения консоли — ВЫПОЛНЕН

### 6.1 Типы подключения — ВЫПОЛНЕНО
- `connection_type`: `"local"` (шелл) или `"ssh"` (удалённый сервер)
- Поля: `ssh_host`, `ssh_port` (default 22), `ssh_user`, `ssh_key_path`, `ssh_extra_args`
- При открытии SSH-консоли PTY автоматически запускает: `ssh [-p port] [-i key] [extra] user@host`
- Команды с пробелами запускаются через `sh -c` в pty_manager.rs

### 6.2 Startup-команды — ВЫПОЛНЕНО
- Поле `startup_cmd` теперь многострочное (textarea)
- Каждая строка = отдельная команда, выполняется последовательно с задержкой 400ms
- Работает и для local, и для SSH (после установки соединения)

### 6.3 Backend (Rust + SQLite) — ВЫПОЛНЕНО
- Новые колонки в таблице `consoles`: `connection_type`, `ssh_host`, `ssh_port`, `ssh_user`, `ssh_key_path`, `ssh_extra_args`
- Автомиграция для существующих БД
- Новая команда `update_console_config` для полного обновления настроек консоли

### 6.4 Frontend — ВЫПОЛНЕНО
- `CreateConsoleDialog` — переключатель Local/SSH, все SSH-поля, Browse для ключа, textarea для startup команд
- `EditConsoleDialog` (новый) — то же самое для редактирования, через контекстное меню "Настройки подключения..."
- SSH badge (синий) в дереве рядом с именем SSH-консолей

---

## Этап 7: Post-MVP

- GlobalSearch (Cmd+Shift+K) — FTS5 по wiki с подсветкой
- Горячие клавиши: Cmd+T/W/Tab/1-9/Delete
- Settings.tsx (Cmd+,) — шрифт, тема, scrollback
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод одновременно в несколько консолей)
- Snippets / быстрые команды с параметрами
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git (текущая ветка), Docker (статус), VS Code (открыть)
- Wiki: блоки кода с кнопками "Копировать" и "Вставить в терминал" (TipTap NodeView)

---

## Следующий порядок работы

```
4.2 GlobalSearch (Cmd+Shift+K)
5.1 Горячие клавиши: Cmd+T/W/Tab/1-9/Delete
5.2 Settings (Cmd+,)
```
