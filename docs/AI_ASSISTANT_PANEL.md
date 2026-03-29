# AI Assistant Panel — Анализ и план реализации

> Дата: 2026-03-29

---

## Идея

Добавить панель AI-ассистента, которую пользователь может разместить **справа от терминала** или **снизу под терминалом** (выбор сохраняется в настройках). В панели — чат с AI (ChatGPT / Claude / другие), куда можно:

- Писать вопросы вручную
- Выделить текст в терминале → нажать кнопку → отправить выделенное в чат с вопросом
- Настраивать AI-провайдера и API-ключ в Settings

---

## Главные проблемы

### 1. Хранение API-ключей — SQLCipher (шифрование всей БД)

**Проблема:** API-ключи (и все данные пользователя) хранятся в plain-text файле `data.db`. Любой, кто получит этот файл, прочитает всё.

**Решение: SQLCipher — шифрование всей базы данных.**

SQLCipher — это форк SQLite с прозрачным AES-256-CBC шифрованием всего файла `.db`. Приложение работает точно так же, разница только в одной строке после открытия соединения: `PRAGMA key='...'`. Файл на диске — зашифрованный бинарник, без ключа не открывается ни SQLite Browser, ни `sqlite3`.

**Как встраивается ключ в бинарник (без env-файла в рантайме):**

Используем `build.rs` — скрипт, который запускается при `cargo build`. Он читает переменную окружения `DB_ENCRYPTION_KEY` **во время компиляции** и закапывает её в бинарник через `cargo:rustc-env`. В рантайме никакой переменной окружения нет — ключ уже внутри `.exe`/`.app`.

```
Разработчик: export DB_ENCRYPTION_KEY="случайная-строка-64-символа"
             cargo build --release
                    ↓
             build.rs читает $DB_ENCRYPTION_KEY
             cargo:rustc-env=DB_ENCRYPTION_KEY=...
                    ↓
             В Rust-коде: const KEY: &str = env!("DB_ENCRYPTION_KEY");
                    ↓
             Готовый бинарник содержит ключ внутри себя.
             Никакого .env файла рядом с бинарником нет.
```

Если переменная не задана при сборке — `build.rs` использует дефолтный dev-ключ (данные разработчика не потеряются, но продакшн-сборка должна иметь свой ключ).

**Уровень защиты:** файл `data.db` без бинарника — просто зашифрованный мусор. Против человека с бинарником + файлом БД это security through obscurity, но это всё равно на порядок лучше plain-text.

**Сравнение вариантов:**

| Вариант | Защита | Сложность | Для нас |
|---------|--------|-----------|---------|
| Plain-text SQLite | ❌ Нет | Ноль | Нет |
| SQLCipher + compile-time key | ✅ Хорошая | Минимальная | **Выбираем** |
| OS Keychain (macOS/Win/Linux) | ✅✅ Отличная | Средняя | Post-MVP |

**Нюанс — миграция существующих БД:**
Если у пользователя уже есть plain-text `data.db` — при первом запуске новой версии приложение должно зашифровать её. SQLCipher умеет это через `sqlcipher_export`. Для прототипа — просто пересоздаём БД (данных нет, мы ещё в разработке).

---

### 2. HTTP-запросы к AI API

**Проблема:** Tauri по умолчанию блокирует исходящие HTTP-запросы через CSP (`Content-Security-Policy`). Нужно явно разрешить домены провайдеров.

**Варианты реализации:**
- **TypeScript `fetch()`** — проще, нативная поддержка стриминга (ReadableStream / SSE). Требует добавить домены в CSP (`tauri.conf.json → security.csp`).
- **Rust `reqwest`** — запрос идёт с бэкенда, CSP не при чём. Чуть сложнее со стримингом (нужно emit событий по чанкам), зато ключи не светятся во фронте.

**Решение для прототипа:** TypeScript `fetch()` — быстрее реализовать, стриминг из коробки. Ключи всё равно хранятся в SQLite и читаются через Tauri команду.

**Что добавить в `tauri.conf.json`:**
```json
"security": {
  "csp": "default-src 'self'; connect-src 'self' https://api.openai.com https://api.anthropic.com"
}
```

---

### 3. Получение выделенного текста из терминала

**Проблема:** xterm.js и панель AI — это разные компоненты. Нужно передать текст выделения из `TerminalPanel` в `AiPanel`.

**Решение:** xterm.js имеет `terminal.getSelection()` — возвращает строку с выделенным текстом. Нужно:

1. Добавить в Zustand store поле `terminalSelection: string`
2. В `TerminalPanel.tsx` подписаться на событие `terminal.onSelectionChange(() => { setTerminalSelection(terminal.getSelection()) })`
3. В `AiPanel.tsx` читать `terminalSelection` из store и показывать кнопку "Спросить об этом"

---

### 4. Позиция панели: справа или снизу

**Проблема:** Текущий Layout — горизонтальная трёхколоночная сетка (`flex-row`). Добавить панель снизу под только терминалом (не под всеми тремя панелями) — нетривиально.

**Решение:**

Обернуть `TerminalPanel` в вертикальный flex-контейнер:

```
[TreePanel] | [  TerminalPanel   ] | [WikiPanel]
            | [AiPanel — снизу   ] |
```

или добавить как 4-ю колонку:

```
[TreePanel] | [TerminalPanel] | [AiPanel] | [WikiPanel]
```

Для прототипа — **справа** (проще реализовать: добавить новую панель между TerminalPanel и WikiPanel). Для финальной версии добавить настройку `ai.panelPosition: "right" | "bottom"`.

---

### 5. Стриминг ответов

**Проблема:** AI API возвращают ответы по чанкам (SSE / stream). Без стриминга — долгое ожидание перед появлением текста.

**Решение:** Использовать `fetch()` с `ReadableStream`. OpenAI и Anthropic поддерживают `stream: true`. Чанки добавляются к сообщению в реальном времени — эффект "печатающего ответа".

---

### 6. Поддержка нескольких провайдеров

**Проблема:** У OpenAI и Anthropic разные форматы API (endpoint, заголовки, структура тела запроса и ответа).

**Решение:** Абстракция `AiProvider` на TypeScript:

```ts
interface AiProvider {
  id: "openai" | "anthropic" | "ollama"
  name: string
  baseUrl: string
  models: string[]
  buildRequest(messages: ChatMessage[], model: string, apiKey: string): RequestInit
  parseChunk(chunk: string): string  // достать текст из SSE-чанка
}
```

Реализации: `OpenAiProvider`, `AnthropicProvider`, (опционально) `OllamaProvider` — для локальных моделей без API-ключа.

---

### 7. Локализация

Панель нужно будет добавить в локали (`ru.json`, `en.json`, и т.д.) по аналогии с остальными компонентами.

---

## Архитектура прототипа

```
src/
├── components/
│   └── AiPanel.tsx              # Чат-панель: история, ввод, кнопка выделения
├── lib/
│   ├── aiProviders.ts           # Абстракция провайдеров (OpenAI, Anthropic)
│   └── tauriCommands.ts         # +get_ai_settings, set_ai_setting
└── stores/
    └── appStore.ts              # +terminalSelection, +showAiPanel, +aiPanelPosition

src-tauri/
├── build.rs                     # НОВЫЙ: читает DB_ENCRYPTION_KEY из env при компиляции
└── src/
    ├── commands.rs              # без изменений для шифрования
    └── db.rs                    # +PRAGMA key после Connection::open
```

---

## Пошаговый план реализации

### Шаг 0 — SQLCipher: шифрование базы данных (делать первым)

Это независимая задача, которую нужно сделать до всего остального — она затрагивает основу данных.

**0.1 — `src-tauri/Cargo.toml`:** заменить `bundled` на `bundled-sqlcipher`:

```toml
# было:
rusqlite = { version = "0.31", features = ["bundled"] }

# стало:
rusqlite = { version = "0.31", features = ["bundled-sqlcipher"] }
```

**0.2 — создать `src-tauri/build.rs`** (новый файл, скрипт компиляции):

```rust
fn main() {
    // Читает переменную окружения ВО ВРЕМЯ КОМПИЛЯЦИИ, встраивает в бинарник.
    // В рантайме эта переменная не нужна — ключ уже внутри .exe/.app.
    let key = std::env::var("DB_ENCRYPTION_KEY")
        .unwrap_or_else(|_| "devconsole-hub-dev-key-change-before-release".to_string());
    println!("cargo:rustc-env=DB_ENCRYPTION_KEY={}", key);
    tauri_build::build();
}
```

**0.3 — `src-tauri/src/db.rs`:** добавить `PRAGMA key` сразу после `Connection::open`:

```rust
// Compile-time constant — встроен в бинарник при сборке
const DB_KEY: &str = env!("DB_ENCRYPTION_KEY");

pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    let path = db_path();
    let conn = Connection::open(&path)?;

    // ПЕРВОЕ что нужно сделать после открытия — задать ключ шифрования.
    // Без этого SQLCipher откажется читать/писать файл.
    conn.execute_batch(&format!("PRAGMA key='{}';", DB_KEY))?;

    // Дальше всё как раньше:
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    // ...
}
```

**0.4 — Сборка для продакшн:**

```bash
# Генерируем случайный ключ один раз:
export DB_ENCRYPTION_KEY="$(openssl rand -hex 32)"

# Сборка — ключ компилируется внутрь:
npm run tauri build

# Никакого .env файла рядом с бинарником нет.
# data.db без этого бинарника — зашифрованный мусор.
```

**0.5 — Миграция существующей plain-text БД (если нужна):**

Если у пользователя уже есть `data.db` от предыдущей версии, при первом запуске новой версии SQLCipher не сможет её открыть (она не зашифрована). Нужна логика в `init()`:

```rust
// Пробуем открыть как зашифрованную:
conn.execute_batch(&format!("PRAGMA key='{}';", DB_KEY))?;
// Проверяем что это SQLCipher-файл (не plain-text):
let ok: Result<i64, _> = conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0));
if ok.is_err() {
    // Это plain-text БД — мигрируем: шифруем на месте через sqlcipher_export
    conn.execute_batch(&format!(
        "ATTACH DATABASE '{path_new}' AS encrypted KEY '{key}';
         SELECT sqlcipher_export('encrypted');
         DETACH DATABASE encrypted;",
        ...
    ))?;
    // Переименовываем файлы
}
```

Для прототипа (нет живых пользователей) — просто удаляем старую БД при первом запуске.

---

### Шаг 1 — Настройки AI (Rust + store)

1. В `db.rs` добавить ключи в таблицу `settings` (они автоматически попадут в зашифрованную БД):
   - `ai.provider` — `"openai"` / `"anthropic"` / `"ollama"`
   - `ai.apiKey` — API-ключ (теперь защищён шифрованием БД)
   - `ai.model` — выбранная модель (`"gpt-4o"`, `"claude-3-5-sonnet-20241022"`, и т.д.)
   - `ai.panelPosition` — `"right"` / `"bottom"`
   - `ai.showPanel` — видимость

2. Новых Tauri-команд не нужно — используем существующие `get_settings` / `set_setting`.

3. Зарегистрировать в `main.rs` + `lib.rs` (ничего нового).

---

### Шаг 2 — CSP в tauri.conf.json

Добавить в `security.csp`:
```
connect-src 'self' https://api.openai.com https://api.anthropic.com http://localhost:11434
```
(localhost:11434 — Ollama)

---

### Шаг 3 — TypeScript: провайдеры (aiProviders.ts)

Реализовать `AiProvider` интерфейс и два провайдера:
- `OpenAiProvider` — `POST https://api.openai.com/v1/chat/completions`
- `AnthropicProvider` — `POST https://api.anthropic.com/v1/messages`

Оба со стримингом (SSE).

---

### Шаг 4 — Zustand store

Добавить в `appStore.ts`:
```ts
terminalSelection: string          // текущее выделение в терминале
setTerminalSelection: (s: string) => void

showAiPanel: boolean
toggleAiPanel: () => void          // сохранять в SQLite

aiPanelPosition: "right" | "bottom"
setAiPanelPosition: (p) => void    // сохранять в SQLite
```

---

### Шаг 5 — TerminalPanel.tsx

Подписаться на изменения выделения:
```ts
terminal.onSelectionChange(() => {
  setTerminalSelection(terminal.getSelection())
})
```

Добавить кнопку (иконка SparklesIcon) рядом с вкладками терминала:
- Если `terminalSelection` не пустое — подсвечена / активна
- Клик → открывает AiPanel и заполняет поле ввода выделенным текстом

---

### Шаг 6 — AiPanel.tsx

Компонент чата:

```
┌─────────────────────────────────────┐
│ AI Assistant           [x] [⚙]      │  ← заголовок, крестик закрыть, шестерня настроек
├─────────────────────────────────────┤
│                                     │
│  [User]: что делает эта ошибка?     │
│  [AI]: Это означает...              │  ← история сообщений со скроллом
│                                     │
├─────────────────────────────────────┤
│ [Контекст из терминала ▼]           │  ← раскрываемый блок с выделенным текстом
├─────────────────────────────────────┤
│ [Введите вопрос...       ] [Отправ] │  ← ввод + кнопка
└─────────────────────────────────────┘
```

Логика:
- `messages: ChatMessage[]` — локальный стейт (не в SQLite для прототипа)
- Кнопка "Спросить об этом" → заполняет textarea текстом: `"Объясни: \n\`\`\`\n{selection}\n\`\`\`"`
- При отправке → вызов провайдера с стримингом → чанки добавляются к последнему сообщению

---

### Шаг 7 — Layout.tsx: две позиции + drag-to-reposition

AI-панель живёт в одном из двух слотов. Позиция хранится в SQLite (`ai.panelPosition: "right" | "bottom"`).

**Позиция "справа"** (между терминалом и wiki):
```
[Tree] | [Terminal] | [AI Panel] | [Wiki]
```
- AiPanel добавляется в flex-row между TerminalPanel и WikiPanel
- Новый resizable-сплиттер слева от AiPanel (аналогично существующим)

**Позиция "снизу"** (под терминалом):
```
[Tree] | [Terminal        ] | [Wiki]
       | [AI Panel        ] |
```
- TerminalPanel и AiPanel оборачиваются в `div` с `flex-col`
- Между ними вертикальный resizable-сплиттер
- Wiki при этом занимает полную высоту справа

**Переключение позиции — drag-and-drop:**

Самый простой подход без тяжёлых drag-and-drop библиотек:

1. В заголовке AiPanel — иконка `GripVertical` (ручка перетаскивания)
2. `onMouseDown` на ней → слушаем `mousemove` на `document`
3. Если курсор ушёл вниз за нижнюю треть TerminalPanel → `panelPosition = "bottom"`
4. Если курсор ушёл вправо → `panelPosition = "right"`
5. Визуальный "дроп-хинт" (полупрозрачная полоса) показывает куда встанет панель
6. `mouseup` → сохраняем позицию в SQLite через `set_setting`

Это ~60 строк кода без зависимостей, поведение интуитивно понятное.

**Альтернатива (проще для прототипа):** кнопки в заголовке AiPanel — иконки `PanelRight` / `PanelBottom` из lucide-react. Клик мгновенно переключает позицию. Drag — финальная реализация.

---

### Шаг 8 — SettingsDialog.tsx: вкладка "Агенты"

Отдельная вкладка **"Агенты"** (после вкладок "Данные", "Терминал", "Интерфейс"):

```
┌──────────────────────────────────────────────────┐
│ Настройки                                    [x] │
├────────────┬─────────────────────────────────────┤
│  Данные    │  Агенты                             │
│  Терминал  │                                     │
│  Интерфейс │  Провайдер                          │
│  Агенты  ← │  [● OpenAI] [  Anthropic] [  Ollama]│
│            │                                     │
│            │  API-ключ                           │
│            │  [sk-••••••••••••••••••] [👁 Показать]│
│            │                                     │
│            │  Модель                             │
│            │  [gpt-4o              ▼]             │
│            │                                     │
│            │  ─────────────────────────────────  │
│            │  + Добавить второй аккаунт          │
│            │  (Post-MVP: несколько провайдеров)   │
│            │                                     │
│            │  Позиция панели                     │
│            │  [■ Справа] [□ Снизу]               │
│            │                                     │
│            │  [  Проверить подключение  ]         │
└────────────┴─────────────────────────────────────┘
```

Что сохраняется в SQLite через `set_setting`:
- `ai.provider` → `"openai"` | `"anthropic"` | `"ollama"`
- `ai.apiKey` → строка (защищена SQLCipher)
- `ai.model` → строка
- `ai.panelPosition` → `"right"` | `"bottom"`
- `ai.showPanel` → `"true"` | `"false"`

Кнопка **"Проверить подключение"** — отправляет минимальный тестовый запрос к API и показывает Toast: зелёный "Подключение успешно" или красный с текстом ошибки (неверный ключ, нет сети).

Список моделей зависит от провайдера:
- OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
- Anthropic: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Ollama: текстовое поле (модель вводится вручную, т.к. у каждого свои)

---

### Шаг 9 — Горячая клавиша

`Cmd/Ctrl+I` — показать/скрыть AI-панель (добавить в `App.tsx` и `README.md`).

---

### Шаг 10 — Локализация

Добавить ключи в `src/locales/ru.json`, `en.json`, и остальные файлы переводов.

---

## Scope прототипа (что делаем сейчас)

| Что | Статус |
|-----|--------|
| SQLCipher (шифрование БД) | Прототип — делать первым |
| aiProviders.ts (OpenAI + Anthropic, стриминг) | Прототип |
| AiPanel.tsx (чат, без SQLite-истории) | Прототип |
| Layout: обе позиции (справа + снизу) | Прототип |
| Переключение позиции кнопками в заголовке | Прототип |
| Выделение из терминала → в чат | Прототип |
| Settings → вкладка "Агенты" (провайдер, ключ, модель, позиция) | Прототип |
| Drag-and-drop для смены позиции | После прототипа |
| SQLite-история чатов | После прототипа |
| Ollama (локальные модели) | После прототипа |
| OS Keychain для API-ключей | После прототипа |
| Несколько аккаунтов на один провайдер | После прототипа |

---

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| CSP блокирует fetch к AI API | Высокая | Явно прописать домены в `tauri.conf.json` |
| Стриминг Anthropic API отличается от OpenAI | Средняя | Разные парсеры в `parseChunk()` |
| Большой контекст из терминала → превышение лимитов токенов | Средняя | Обрезать до 4000 символов с предупреждением |
| Layout сломается при одновременно скрытых панелях | Средняя | Проверить все 4 комбинации видимости панелей |
| bundled-sqlcipher увеличит время компиляции | Низкая | Первая сборка дольше, далее инкрементально |
