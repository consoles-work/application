# План работ: вики по вкладкам · копирование SSH · локальный AI-движок

Дата: 2026-08-29. Статус: **выполнено** (пункты 0-3), см. отметки в конце.

---

## 0. Прежде всего: почему сломался терминал (исправлено)

Было две разных поломки подряд. Первая — рассинхрон манифеста и `node_modules`:
коммит `f3d1821 "fix utf8"` включил `pty_manager.rs` и `TerminalPanel.tsx`, но
`package.json`/`package-lock.json` в него не попали и остались на `@xterm/xterm: ^5.5.0`
без аддона `addon-unicode11`. Версии восстановлены, lock пересобран, кэш Vite очищен.

Но терминал всё равно не отображался — и вот настоящая причина. В headless-Chrome
на пробной странице с тем же кодом инициализации:

```
Uncaught Error: You must set the allowProposedApi option to true to use proposed API
  @ @xterm_xterm.js:9014
```

`term.unicode` в xterm 6 помечен как **proposed API** и без флага
`allowProposedApi: true` бросает исключение. В `TerminalView` строка
`term.unicode.activeVersion = "11"` стоит **до** `term.open(container)` — исключение
летит из эффекта, `open()` не вызывается вовсе, в DOM ничего не появляется.
Отсюда «ошибок нет, но не отображается»: ошибка была в консоли webview, куда
без devtools не заглянуть.

**Что сделано:**
- `TerminalPanel.tsx` — `allowProposedApi: true` в опциях `Terminal`;
- `globals.css` — `.xterm { box-sizing: border-box }`: с `height: 100%` и
  `padding: 4px` элемент был на 8px выше контейнера, и низ обрезался (это было
  и в xterm 5, просто менее заметно).

Проверено рендером в headless-Chrome: кириллица, псевдографика, CJK и emoji
выводятся корректно, ширина ячеек правильная.

**Вывод на будущее:** `package.json` и `package-lock.json` должны попадать в тот же
коммит, что и код, который на них опирается.

---

## 1. Вики следует за активной вкладкой терминала

### Сейчас
`WikiPanel.tsx:146-147` берёт контекст только из дерева:
```ts
const parentType = selectedNode?.type ?? "global";
const parentId   = selectedNode?.id ?? "global";
```
`useEffect` на `[parentType, parentId]` (строка 187) перезагружает страницы.
Вкладки терминала (`sessions` / `activeSessionId`) на вики не влияют вообще.

### Нужно
Оба источника переключают вики, побеждает последнее действие: кликнул вкладку —
вики показывает её консоль; кликнул узел дерева — показывает узел.

### Решение
Синхронизировать `selectedNode` при смене активной вкладки. `WikiPanel` менять не
нужно — он уже реагирует на `selectedNode`.

**Файлы:**

1. `src/stores/appStore.ts`
   - `setActiveSession` (строка 318) — помимо `activeSessionId` выставлять
     `selectedNode: { type: "console", id: <console_id сессии> }`.
   - `openSession` (строка ~302) — то же при открытии новой вкладки.
   - `closeSession` (строка ~308) — при закрытии активной вкладки переключение
     уходит на соседнюю; синхронизировать `selectedNode` с ней, а если вкладок не
     осталось — оставить `selectedNode` как есть.
2. `src/components/TerminalPanel.tsx` — клик по вкладке уже зовёт `setActiveSession`,
   правок не требует.

### Проверка
Две консоли в разных проектах → своя вики-страница в каждой → переключение вкладок
меняет вики → клик по третьему узлу в дереве переводит вики на него.

### Открытый вопрос
Должно ли переключение вкладки **подсвечивать** соответствующий узел в дереве?
Технически это следствие того же `selectedNode` — то есть да, подсветка поедет за
вкладкой. Если это нежелательно, потребуется отдельное поле контекста вики.

---

## 2. Кнопка «копировать параметры подключения»

### Решение
Чистая функция сборки строки + кнопка рядом с полями SSH.

**Файлы:**

1. `src/lib/connectionString.ts` — **новый**. Функция
   `buildSshCommand(c: ConsoleConfig): string`, собирающая ту же команду, что и
   `TerminalPanel.tsx:253-257` при реальном подключении:
   ```
   ssh -p 2222 -i "~/.ssh/id_ed25519" user@host
   ```
   Порт добавляется только при `!== 22`, ключ — только если задан, `extraArgs` —
   если непусты. Логику подключения из `TerminalPanel` вынести сюда же и
   переиспользовать, чтобы строка гарантированно совпадала с фактическим вызовом.
2. `src/components/dialogs/EditConsoleDialog.tsx` — кнопка «Копировать» в блоке
   `connectionType === "ssh"`, `navigator.clipboard.writeText` + `showToast`.
3. `src/components/dialogs/CreateConsoleDialog.tsx` — та же кнопка (опционально:
   в момент создания копировать обычно нечего).
4. `src/components/ContextMenu.tsx` — пункт «Скопировать SSH-команду» для узла
   консоли, чтобы не открывать диалог ради строки.
5. `src/locales/*.json` — ключи для 5 языков.

### Пароль и passphrase
В строку **не попадают** — секреты в буфере обмена уходят в историю clipboard-менеджеров
и в общий буфер macOS. Если нужно, добавим отдельный явный пункт «копировать с паролем»,
но по умолчанию — нет.

### Требует уточнения
В задаче сказано «юзер ип порт если надо то ключ и ид». Что такое **«ид»** —
`id` консоли из БД или опечатка? Предлагаю по умолчанию готовую `ssh`-команду
(её можно вставить в любой терминал), а при необходимости добавить выпадающее меню
с вариантами: `ssh`-команда · `user@host:port` · многострочный список параметров.

---

## 3. Локальный AI-движок (Claude Code CLI)

### Важное различие
В проекте **уже есть** «локальный» вариант — `OllamaProvider`
(`src/lib/aiProviders.ts:114`), но это HTTP-API к `localhost:11434`, то есть тот же
`fetch`, что у OpenAI/Anthropic.

Референс `/Volumes/work/trading/my-tv-indicators/indicators-desk` — принципиально
другое: **бинарь `claude` запускается подпроцессом из Rust**, работает по подписке
пользователя, API-ключ не нужен вообще. Именно это и добавляем; Ollama и API-провайдеры
остаются как есть.

### Как устроен референс
`src-tauri/src/ai.rs` (383 строки во фронте + ~330 в Rust):

```
claude -p --output-format stream-json --verbose --include-partial-messages \
       --strict-mcp-config --tools "" --model <sonnet|opus|haiku> \
       [--append-system-prompt <persona>]
```
- промпт идёт в **stdin** (может быть большим), stdout — поток newline-delimited JSON;
- из потока берутся `stream_event → content_block_delta → text_delta` и финальный `result`;
- `--strict-mcp-config` без `--mcp-config` → внешние MCP-серверы не подключаются;
- `--tools ""` → модели недоступны инструменты (анализ строго по тексту);
- `cwd = temp_dir` → CLI не читает проект пользователя;
- события во фронт: `ai://chunk`, `ai://done`, `ai://error`;
- реестр `HashMap<session_id, Child>` для отмены (`ai_cancel`).

Автопоиск бинаря (`detect_bin`): сохранённая настройка → `~/.local/bin/claude` →
`~/.claude/local/claude` → `/opt/homebrew/bin/claude` → `/usr/local/bin/claude` →
`zsh -lic "command -v claude"` (login-shell ради пользовательского `PATH` — та же
причина, по которой в `pty_manager.rs` явно выставляется локаль).

### Работы

**Backend (Rust):**

1. `src-tauri/src/ai_local.rs` — **новый**, по образцу `ai.rs`. Портировать:
   `detect_bin`, `resolve_bin`, `check`, `run`, `cancel`, реестр процессов,
   payload-структуры с `#[serde(rename_all = "camelCase")]`.
   Зависимости уже есть: `serde_json = "1"`, `dirs = "5"` в `Cargo.toml`.
2. `src-tauri/src/commands.rs` — четыре `#[tauri::command]`:
   `ai_detect_bin`, `ai_check`, `ai_run`, `ai_cancel`.
3. **Регистрация в `main.rs` И `lib.rs`** — оба `generate_handler![]`.
   Пропуск второго = `command not found` в рантайме (см. CLAUDE.md).
4. `src-tauri/src/db.rs` — переиспользовать существующие `ai_sessions` / `ai_messages`.
   Схема уже подходит: в `ai_sessions.provider` ляжет `"claude-cli"`.
   Ответ ассистента сохраняет **Rust** (как в референсе) — переживает закрытие панели.

**Frontend:**

5. `src/lib/tauriCommands.ts` — обёртки `aiDetectBin`, `aiCheck`, `aiRun`, `aiCancel`.
6. `src/lib/aiProviders.ts` — добавить `"claude-cli"` в `ProviderId` и запись в
   `AI_PROVIDERS` с моделями `sonnet | opus | haiku`. Провайдер помечается флагом
   `isLocalCli: true` — у него нет `buildFetchParams`, он не ходит через `streamCompletion`.
7. `src/components/AiPanel.tsx` — ветвление в `handleSend` (строка 182):
   - проверка `if (!apiKey)` (строка 185) должна **пропускать** `claude-cli`;
   - при `claude-cli`: `aiRun(...)` + подписка на `ai://chunk|done|error` вместо
     `streamCompletion`;
   - «Стоп» зовёт `aiCancel` вместо `AbortController.abort()`.
   Подписку на события ставить один раз в `useEffect` с фильтром по `sessionId`,
   как в референсе (`AiTab.tsx:99-125`), а не создавать на каждую отправку.
8. `src/components/SettingsDialog.tsx`, вкладка «Агенты» (строка 279):
   - при выборе `claude-cli` прятать поле API-ключа;
   - поле пути к бинарю (`ai.claudeBin`) + кнопка «Найти» (`aiDetectBin`);
   - кнопка «Проверить» → `aiCheck` показывает путь и `--version` (токены не тратит);
   - выбор модели из `sonnet | opus | haiku`.
9. `src/locales/*.json` — ключи для 5 языков.

### Риски
- **camelCase на границе IPC.** Payload'ы событий обязаны нести
  `#[serde(rename_all = "camelCase")]`, иначе фронт получит `session_id` вместо
  `sessionId` и молча отфильтрует все чанки (ошибки глотаются в `.catch(() => {})`).
- **Порядок событий.** `ai://done` может прийти раньше, чем отрисуется последний
  чанк — финальный текст берётся из payload `done`, а не из накопленного буфера.
- **Отмена.** `kill` процесса даёт ненулевой exit status; частичный ответ всё равно
  сохраняется (в референсе это учтено).
- **CSP не трогаем** — подпроцесс не идёт через сеть браузера, `tauri.conf.json`
  править не нужно.
- **Бинаря может не быть** — внятная ошибка со ссылкой на «Настройки → Агенты»,
  а не тихий провал.

---

## Порядок и оценка

| # | Задача | Объём | Зависимости |
|---|--------|-------|-------------|
| 1 | Вики по вкладкам | малый — правки в одном сторе | нет |
| 2 | Копирование SSH | малый — новый util + кнопки | нет |
| 3 | Локальный AI-движок | крупный — новый Rust-модуль + ветвление UI | нет |

Предлагаю в этом порядке: 1 и 2 быстрые и независимые, 3 — основной объём.

## Что сделано

Все три пункта реализованы. Решения по открытым вопросам, принятые по умолчанию
(меняются одной правкой, если не подходят):

1. **«ид»** — трактовано как выбор формата. Кнопка копирует готовую `ssh`-команду,
   рядом выпадающее меню: `ssh`-команда · `user@host:port` · список параметров
   (там есть и `id` консоли из БД). Пароль и passphrase не копируются ни в одном
   формате.
2. **Подсветка в дереве следует за вкладкой** — `selectedNode` общий, отдельного
   поля контекста вики не заводил.
3. **Claude Code CLI** добавлен как четвёртый провайдер `claude-cli`; Ollama и
   API-провайдеры не тронуты.

### Изменённые файлы

| Пункт | Файлы |
|---|---|
| 0 | `src/components/TerminalPanel.tsx`, `src/styles/globals.css` |
| 1 | `src/stores/appStore.ts` (`openSession`, `closeSession`, `setActiveSession`) |
| 2 | `src/lib/connectionString.ts` (новый), `src/components/CopyConnectionButton.tsx` (новый), `EditConsoleDialog.tsx`, `ContextMenu.tsx`, `TerminalPanel.tsx` |
| 3 | `src-tauri/src/ai_local.rs` (новый), `commands.rs`, `main.rs`, `lib.rs`, `src/lib/tauriCommands.ts`, `src/lib/aiProviders.ts`, `src/components/AiPanel.tsx`, `src/components/SettingsDialog.tsx` |
| все | `src/locales/{ru,en,zh,fr,kk}.json` |

### Отличия от исходного плана

- **История чата пишет фронт, а не Rust.** В референсе ответ сохраняет `ai.rs`,
  но здесь `AiPanel` уже ведёт историю через `saveAiMessage`/`updateAiMessage` —
  запись из Rust дала бы дубль сообщения. `ai_local.rs` только стримит события.
- **Промпт для CLI собирается из истории** (`buildCliPrompt` в `AiPanel.tsx`):
  `claude -p` — одноразовый вызов без своей сессии, поэтому диалог укладывается
  в текст промпта.
- **Откат алиаса модели.** Настройка `ai.model` одна на всех провайдеров и не
  сбрасывается при переключении. Для CLI чужой алиас (`gpt-4o`) — жёсткая ошибка
  запуска, поэтому при несовпадении берётся `defaultModel`. У HTTP-провайдеров
  имя модели остаётся произвольным (кастомные деплойменты).

### Проверено

- `cargo check`, `tsc --noEmit`, `npm run build` — чисто.
- Формат потока CLI сверен с живым `claude 2.1.251`: команда из `ai_local.rs`
  отрабатывает, парсер снимает `stream_event → content_block_delta → text_delta`
  и финальный `result` с `is_error`.
- Терминал отрисован в headless-Chrome (кириллица, псевдографика, CJK, emoji).

Не проверено вживую в GUI: расширение Chrome не подключено, окно Tauri так не
поднять — нужен прогон `npm run tauri dev`.
