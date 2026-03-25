# DevConsole Hub — План разработки

> Создан: 2026-03-26

---

## Этап 1: Рабочий терминал (КРИТИЧЕСКИЙ ПУТЬ)

Без этого приложение — просто красивая заглушка.

### 1.1 Fix: PRAGMA foreign_keys + AppHandle

**Файл:** `src-tauri/src/db.rs`
- Добавить `PRAGMA foreign_keys = ON;` в `init()` — без этого ON DELETE CASCADE не работает

**Файл:** `src-tauri/src/lib.rs`
- В `.setup(|app| { ... })` получить `app.handle().clone()` и сохранить в глобальный `OnceLock<AppHandle>`
- Экспортировать `get_app_handle()` для использования в pty_manager

### 1.2 Rust: реальный PTY в `pty_manager.rs`

Раскомментировать и доработать portable-pty реализацию:

```
PtySession {
    child: Box<dyn portable_pty::Child + Send>,
    writer: Box<dyn std::io::Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    active: bool,
}
```

- `spawn(shell, cwd, env_vars, app_handle)`:
  1. `native_pty_system().openpty(PtySize { rows: 24, cols: 80, ... })`
  2. Настроить `CommandBuilder` с shell/cwd/env
  3. Запустить процесс через `pair.slave.spawn_command(cmd)`
  4. Получить `reader` и `writer`
  5. `thread::spawn` — читает из PTY и шлёт `app_handle.emit("pty-output", { pty_id, data })`
  6. Определение шелла по ОС: macOS=`/bin/zsh`, Linux=`$SHELL`, Windows=`powershell.exe`

- `write(pty_id, data)`: `session.writer.write_all(data.as_bytes())`
- `resize(pty_id, cols, rows)`: `session.master.resize(PtySize { rows, cols, ... })`
- `kill(pty_id)`: `session.child.kill()`, убрать из HashMap

### 1.3 Frontend: реальный xterm.js в `TerminalPanel.tsx`

Для каждой сессии (хранить инстанс Terminal в `useRef` или Map по sessionId):

1. При создании сессии:
   - `new Terminal({ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, theme: { background: '#0d1117' }, scrollback: 10000 })`
   - `term.loadAddon(new FitAddon())`
   - `term.open(containerRef.current)`
   - `fitAddon.fit()`
   - `await spawnPty(shell, cwd, envVars)` → получить `ptyId`, сохранить в сессии

2. Подписка на события:
   - `listen('pty-output', (e) => { if (e.payload.pty_id === ptyId) term.write(e.payload.data) })`
   - `term.onData((data) => writeToPty(ptyId, data))`
   - `term.onResize(({ cols, rows }) => resizePty(ptyId, cols, rows))`

3. При переключении вкладок: скрывать/показывать DOM-элемент (НЕ пересоздавать Terminal)

4. ResizeObserver на контейнере → `fitAddon.fit()` с debounce 100ms

5. При закрытии вкладки: `term.dispose()`, `unlisten()`, `killPty(ptyId)`

### 1.4 Startup commands

После spawn PTY, если у ConsoleConfig есть `startup_cmd`:
- `setTimeout(() => writeToPty(ptyId, startup_cmd + "\n"), 200)`

---

## Этап 2: Подключение дерева к SQLite

### 2.1 Загрузка данных при старте

**Файл:** `src/App.tsx`
- Заменить демо-данные на `loadWorkspaces()` из `tauriCommands.ts`
- Обработка ошибки (показать Toast)

### 2.2 CRUD операции через Rust

Все мутации в store должны сначала вызывать Rust-команду, потом обновлять store:

```typescript
// Пример паттерна:
async function handleAddWorkspace(name, icon, color) {
  try {
    const ws = await createWorkspace(name, icon, color);
    addWorkspace(ws);
  } catch (e) {
    showToast({ type: 'error', message: String(e) });
  }
}
```

### 2.3 Toast-уведомления

**Новый файл:** `src/components/Toast.tsx`
- Стек уведомлений в правом нижнем углу
- Типы: success (зелёный), error (красный), info (синий)
- Автоисчезновение через 3 секунды
- Добавить `showToast` action в Zustand store

### 2.4 Контекстное меню

**Новый файл:** `src/components/ContextMenu.tsx`
- Портал в `document.body`, позиция по координатам правого клика
- Закрывается по клику вне / Escape
- Workspace: Добавить проект, Переименовать, Изменить иконку/цвет, Удалить
- Project: Добавить консоль, Открыть в VS Code, Открыть в файловом менеджере, Переименовать, Удалить
- Console: Запустить, Изменить startup_cmd, Переименовать, Дублировать, Удалить

### 2.5 Диалоги создания узлов

**Новый файл:** `src/components/dialogs/CreateWorkspaceDialog.tsx`
- Имя, выбор emoji, выбор цвета

**Новый файл:** `src/components/dialogs/CreateProjectDialog.tsx`
- Имя, путь (Browse через `@tauri-apps/plugin-dialog`), шелл, emoji, цвет

**Новый файл:** `src/components/dialogs/CreateConsoleDialog.tsx`
- Имя, startup_cmd (опционально), shell override, cwd override

### 2.6 Inline-переименование

**Файл:** `src/components/TreePanel.tsx`
- Двойной клик или F2 на выбранном узле → `<input>` прямо в строке дерева
- Enter → `updateWorkspace/updateProject/updateConsole` → Rust update → store update
- Escape → отмена

### 2.7 Drag-and-drop

**Файл:** `src/components/TreePanel.tsx`
- HTML5 Drag and Drop API или @dnd-kit/core
- Перетаскивание консолей между проектами
- Перетаскивание проектов между workspace
- Визуальный дроп-индикатор (синяя линия)
- Обновление sort_order + сохранение в БД

---

## Этап 3: Wiki — TipTap редактор

### 3.1 Подключить TipTap

**Файл:** `src/components/WikiPanel.tsx`

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
  onUpdate: ({ editor }) => {
    debouncedSave(editor.getJSON());
  },
});
```

### 3.2 Toolbar

**Новый файл:** `src/components/WikiToolbar.tsx`
- H1 / H2 / H3 / Bold / Italic / Code / BulletList / OrderedList / TaskList / CodeBlock / Undo / Redo
- Иконки из lucide-react
- Компактный, 32px высота

### 3.3 Контекстная привязка к дереву

При выборе узла в TreePanel:
1. `loadWikiPages(node.type, node.id)` → обновить `currentWikiPages` в store
2. Показать список страниц + редактор первой/выбранной страницы
3. Кнопка "Новая страница" → `saveWikiPage(newPage)` → добавить в список

### 3.4 Автосохранение

- `useDebounce` 1000ms на изменения в редакторе
- `saveWikiPage(page)` → Rust upsert_wiki_page

### 3.5 Теги

- Поле под заголовком: ввод через запятую/Enter, отображение тегов-пилюль
- Клик на тег → фильтр списка страниц

### 3.6 Блоки кода — кнопки действий

Кастомное расширение TipTap или NodeView для CodeBlock:
- Кнопка "Копировать" (clipboard API)
- Кнопка "Вставить в терминал" → `writeToPty(activeSession.ptyId, code + "\n")`
- Отображение языка в заголовке

---

## Этап 4: Поиск и навигация

### 4.1 Command Palette (Cmd+P)

**Новый файл:** `src/components/CommandPalette.tsx`
- Модал по центру экрана, как VS Code
- Fuzzy-поиск по именам узлов дерева + заголовкам wiki + тегам + startup_cmd
- Результаты сгруппированы: Workspaces / Projects / Consoles / Wiki Pages
- Enter → перейти (выбрать узел / открыть сессию / открыть страницу)
- Клавиши: Escape закрыть, стрелки навигация

### 4.2 Глобальный поиск wiki (Cmd+Shift+K)

**Новый файл:** `src/components/GlobalSearch.tsx`
- FTS5 поиск через `searchWiki(query)` → Rust `search_wiki_fts`
- Preview контента с подсветкой совпадений
- Переход к найденной странице по клику

---

## Этап 5: Настройки и UX-polish

### 5.1 Горячие клавиши (дополнить App.tsx)

Добавить в глобальный обработчик keydown:
- Cmd+P → открыть CommandPalette
- Cmd+Shift+K → открыть GlobalSearch
- Cmd+T → openSession (новый терминал для выбранной консоли)
- Cmd+W → closeSession (текущая вкладка)
- Cmd+Tab → следующая вкладка
- Cmd+1..9 → вкладка N
- Cmd+, → открыть Settings
- F2 → начать inline-переименование выбранного узла
- Delete → удалить выбранный узел (с подтверждением)

### 5.2 Settings

**Новый файл:** `src/components/Settings.tsx`
- Открывается по Cmd+,
- Терминал: шрифт, размер, scrollback, курсор
- Wiki: шрифт, размер
- Дерево: размер шрифта, отступы
- Тема: тёмная/светлая
- Сохранение в `~/.devconsole/config.json` через новую Rust-команду

---

## Этап 6: Post-MVP (после основного MVP)

- SSH-профили (хранение конфигов, автогенерация startup_cmd)
- Сплит-терминал (Ctrl+Shift+H / V)
- Broadcast-режим (ввод во все терминалы сразу)
- Snippets / быстрые команды с параметрами
- Экспорт/импорт workspace (zip + Markdown)
- Интеграции: Git (текущая ветка), Docker (статус), VS Code (открыть)

---

## Порядок работы (рекомендуемый)

```
1.1 db.rs: foreign_keys fix
1.2 lib.rs: AppHandle global
1.3 pty_manager.rs: реальный PTY
1.4 TerminalPanel.tsx: xterm.js
    → Milestone: рабочий терминал

2.1 App.tsx: загрузка из БД
2.3 Toast.tsx: уведомления
2.4 ContextMenu.tsx: правый клик
2.5 Диалоги создания
2.6 Inline rename
2.7 Drag-and-drop
    → Milestone: полноценное дерево

3.1-3.6 WikiPanel: TipTap
    → Milestone: рабочая wiki

4.1 CommandPalette
4.2 GlobalSearch
5.1 Все горячие клавиши
5.2 Settings
    → Milestone: MVP готов

6.* Post-MVP
```