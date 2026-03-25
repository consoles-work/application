# DevConsole Hub — План разработки

> Последнее обновление: 2026-03-26

---

## Этап 1: Рабочий терминал — ВЫПОЛНЕН

### 1.1 db.rs: PRAGMA foreign_keys — ВЫПОЛНЕНО
### 1.2 lib.rs + main.rs: AppHandle глобально — ВЫПОЛНЕНО
### 1.3 pty_manager.rs: реальный PTY — ВЫПОЛНЕНО
- portable-pty: spawn/write/resize/kill
- фоновый поток с emit "pty-output"
- автоопределение шелла по ОС
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
- Console: запустить, переименовать, удалить
### 2.4 Диалоги создания — ВЫПОЛНЕНО
- CreateWorkspaceDialog: имя, emoji, цвет
- CreateProjectDialog: имя, Browse (plugin-dialog), shell, emoji, цвет
- CreateConsoleDialog: имя, startup_cmd
### 2.5 Inline rename — ВЫПОЛНЕНО
- F2 или двойной клик → input в строке дерева
- Enter = сохранить через Rust + store, Escape = отмена
### 2.6 Новые Rust-команды — ВЫПОЛНЕНО
- update_project, update_console в commands.rs + db.rs
- tauri-plugin-dialog подключён в Rust и capabilities

### Остаток Этапа 2
- Drag-and-drop (перетаскивание) — отложено

---

## Этап 3: Wiki — TipTap редактор

### 3.1 Подключить TipTap в WikiPanel.tsx
Заменить textarea на TipTap (все пакеты уже установлены):

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
    Placeholder.configure({ placeholder: 'Начните писать...' }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  content: currentPage?.content ? JSON.parse(currentPage.content) : '',
  onUpdate: ({ editor }) => debouncedSave(editor.getJSON()),
});
```

### 3.2 WikiToolbar.tsx
- Новый компонент: H1/H2/H3, Bold/Italic/Code, BulletList/OrderedList/TaskList, CodeBlock, Undo/Redo
- Иконки из lucide-react, высота 32px

### 3.3 Контекстная привязка к дереву
- При выборе узла: `loadWikiPages(node.type, node.id)` → store
- Список страниц + переключение
- Кнопка "Новая страница"

### 3.4 Автосохранение
- debounce 1000ms → `saveWikiPage(page)` → Rust upsert

### 3.5 Теги
- Поле тегов под заголовком: ввод через запятую/Enter, пилюли
- Клик на тег → фильтр списка

### 3.6 Блоки кода — кнопки действий
- Кнопка "Копировать" (clipboard API)
- Кнопка "Вставить в терминал" → `writeToPty(activeSession.ptyId, code + "\n")`

---

## Этап 4: Поиск и навигация

### 4.1 CommandPalette.tsx (Cmd+P)
- Модал по центру, как VS Code
- Fuzzy-поиск по именам узлов + заголовкам wiki + тегам + startup_cmd
- Результаты сгруппированы: Workspaces / Projects / Consoles / Wiki Pages
- Клавиши: Escape закрыть, стрелки навигация, Enter перейти

### 4.2 GlobalSearch.tsx (Cmd+Shift+K)
- FTS5 поиск через `searchWiki(query)`
- Preview контента с подсветкой совпадений

---

## Этап 5: Настройки и UX-polish

### 5.1 Горячие клавиши (дополнить App.tsx)
Добавить к уже работающим (Cmd+B, Cmd+\\, F2):
- Cmd+P → CommandPalette
- Cmd+Shift+K → GlobalSearch
- Cmd+T → новая вкладка (openSession для выбранной консоли)
- Cmd+W → закрыть активную вкладку
- Cmd+Tab / Cmd+Shift+Tab → переключение вкладок
- Cmd+1..9 → вкладка N
- Cmd+, → Settings
- Delete → удалить выбранный узел (с подтверждением)

### 5.2 Settings.tsx (Cmd+,)
- Терминал: шрифт, размер, scrollback, курсор
- Wiki: шрифт, размер
- Тема: тёмная/светлая
- Сохранение в `~/.devconsole/config.json`

### 5.3 Drag-and-drop в дереве
- Перетаскивание консолей между проектами
- Перетаскивание проектов между workspace
- Обновление sort_order + сохранение в БД

---

## Этап 6: Post-MVP

- SSH-профили (хранение конфигов, автогенерация startup_cmd)
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим
- Snippets / быстрые команды с параметрами
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git (текущая ветка), Docker (статус), VS Code (открыть)

---

## Рекомендуемый следующий порядок

```
Этап 3: Wiki (TipTap)
  3.1 WikiPanel.tsx: TipTap + editor
  3.2 WikiToolbar.tsx
  3.3 Привязка к дереву + загрузка/сохранение
  3.4 Автосохранение + теги
  3.5 Блоки кода с кнопками

Этап 4: Поиск
  4.1 CommandPalette
  4.2 GlobalSearch

Этап 5: Polish
  5.1 Горячие клавиши
  5.2 Settings
  5.3 Drag-and-drop
```
