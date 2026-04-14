# DevConsole Hub

Мультипроектный терминал-менеджер с интегрированной базой знаний.

**Четыре панели — одно приложение:**
- 🌳 **Дерево проектов** (слева) — иерархия Workspace → Project → Console
- 💻 **Терминал** (центр) — вкладки с полноценными PTY-сессиями
- 🤖 **AI Ассистент** — чат с OpenAI / Anthropic прямо в интерфейсе
- 📖 **Wiki** (справа) — заметки, сниппеты, документация по каждому проекту

---

## Возможности

### Дерево проектов
- Иерархия: **Workspace → Project → Console**
- Emoji-иконки и цветовые метки для визуальной группировки
- Контекстное меню (ПКМ): создание, переименование, дублирование, удаление
- Inline-переименование (F2 или двойной клик)
- Поиск по дереву (иконка 🔍 или Ctrl+F)
- **Danger-метки** ⚠ — выделение продакшн-окружений красным баннером; настраиваются прямо в диалоге "Настройки подключения"
- **Drag-and-drop** — перетащи консоль из одного проекта в другой; подсветка цели, ghost-элемент с именем, диалог подтверждения
- "Открыть в VS Code" и "Открыть в Finder" для проектов

### Терминал
- Полноценные PTY-сессии через `portable-pty`
- Вкладки с мгновенным переключением
- **Local** (нативный шелл) и **SSH** подключения
- SSH: хост, порт, пользователь, ключ + passphrase, пароль сервера, дополнительные аргументы
- SSH passphrase автоподставляется через `ssh-add` без ввода вручную
- Стартовые команды — выполняются автоматически при открытии сессии
- Полная поддержка UTF-8: кириллица и другие не-ASCII символы отображаются корректно
- Danger-баннер — яркая красная полоса + красноватый фон для опасных консолей (продакшн)

### AI Ассистент
- Чат-панель с **ChatGPT** (OpenAI), **Claude** (Anthropic) и **Ollama** (локальные модели без API-ключа)
- **Выделите текст** в терминале → отправить в AI с контекстом
- **Стриминг** — ответ появляется в реальном времени
- **Две позиции**: справа от терминала или снизу под ним (переключение кнопками в заголовке)
- Настройка провайдера, API-ключа и модели в Settings → Агенты; для Ollama — динамическая загрузка списка моделей
- История чатов хранится в зашифрованной SQLite; именованные сессии
- `Cmd+I` — показать/скрыть панель

### Wiki
- Редактор **TipTap** (ProseMirror) с форматированием
- Контекстная привязка: отдельные заметки для каждого workspace / project / console
- Полнотекстовый поиск через **FTS5** (SQLite)
- Автосохранение (debounce 1 сек)
- Теги, заголовки H1–H3, списки, чекбоксы, блоки кода с подсветкой синтаксиса
- Несколько страниц на один контекст

### Поиск и навигация
- **Cmd+P** — Command Palette: быстрый переход к любому узлу дерева
- **Cmd+Shift+K** — GlobalSearch: полнотекстовый поиск по всем Wiki-страницам с навигацией к нужному контексту
- Поиск по дереву (в панели проектов)
- Полнотекстовый поиск по Wiki внутри панели (FTS5)

### Настройки
- **13 тем**: 10 тёмных (GitHub Dark, Dracula, Monokai, Nord, Solarized Dark, Tokyo Night, Catppuccin, One Dark, Gruvbox Dark, GitHub Light) + 3 светлых (Solarized Light, Catppuccin Latte, One Light) + случайная при каждом запуске
- **Терминал**: шрифт (Menlo, Monaco, JetBrains Mono, Fira Code), размер, scrollback, стиль курсора
- **Данные**: путь к БД, размер файла, "Показать в Finder", "Скопировать путь"
- Все настройки хранятся в SQLite, применяются без перезапуска
- Видимость панелей (дерево / wiki / AI) сохраняется между запусками
- **Экспорт/импорт** данных в зашифрованный файл `.dchub` (AES-256-GCM): выборочный экспорт по воркспейсам, wiki, AI-сессии, **настройки приложения**; при импорте wiki-страницы корректно перепривязываются к новым ID
- **Автозапуск**: опция "Запускать при входе в систему" (macOS LaunchAgent)
- **Поведение при закрытии**: "Свернуть в трей" или "Завершить программу" — переключается в Settings → Интерфейс

### Локализация
- **5 языков**: 🇷🇺 Русский, 🇺🇸 English, 🇨🇳 中文, 🇫🇷 Français, 🇰🇿 Қазақша
- Переключение в Settings → Интерфейс → кнопки языков
- Мгновенное применение без перезагрузки
- Сохраняется в SQLite

### Горячие клавиши

| Сочетание | Действие |
|-----------|----------|
| `Cmd/Ctrl+P` | Command Palette (поиск по дереву) |
| `Cmd/Ctrl+Shift+K` | Глобальный поиск по Wiki |
| `Cmd/Ctrl+,` | Открыть настройки |
| `Cmd/Ctrl+B` | Показать / скрыть панель дерева |
| `Cmd/Ctrl+\` | Показать / скрыть wiki-панель |
| `Cmd/Ctrl+I` | Показать / скрыть AI-панель |
| `Cmd/Ctrl+T` | Новая вкладка для выбранной консоли |
| `Cmd/Ctrl+W` | Закрыть текущую вкладку |
| `Cmd/Ctrl+Tab` | Следующая вкладка |
| `Cmd/Ctrl+Shift+Tab` | Предыдущая вкладка |
| `Cmd/Ctrl+1…9` | Переключиться на вкладку N |
| `F2` | Переименовать выбранный узел |

---

## Технологический стек

| Слой | Технология |
|------|-----------|
| Оболочка | Tauri 2.0 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Терминал | xterm.js + portable-pty (Rust) |
| Wiki-редактор | TipTap (ProseMirror) + lowlight |
| Хранение | SQLite (rusqlite, WAL-режим, FTS5, **SQLCipher AES-256**) |
| AI интеграция | OpenAI API + Anthropic API (стриминг SSE) |
| UI | Tailwind CSS + CSS-переменные тем |
| Стейт | Zustand |
| Локализация | i18next + react-i18next |

---

## Предварительные требования

### Все платформы

1. **Node.js 18+** — https://nodejs.org/
2. **Rust** — https://rustup.rs/

```bash
# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Проверить:
rustc --version
cargo --version
```

### macOS (дополнительно)

```bash
xcode-select --install
```

### Windows (дополнительно)

- **Visual Studio Build Tools** — при установке Rust через rustup выберите "Desktop development with C++"
- **WebView2** — предустановлен на Windows 10/11

### Linux (дополнительно)

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libxdo-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  xdotool librsvg
```

---

## Быстрый старт

```bash
git clone <repo>
cd devconsole-hub
npm install

# Скопируйте шаблон переменных (ключ шифрования БД)
cp .env.example .env
# Для разработки значение по умолчанию подходит — можно не менять

npm run tauri dev
```

Первый запуск: 3–5 минут (Cargo компилирует зависимости). Последующие: 5–10 секунд.

## Команды

| Команда | Описание |
|---------|----------|
| `npm run tauri dev` | Dev-режим: hot reload фронта + перекомпиляция Rust |
| `npm run tauri build` | Продакшн-бинарник под текущую ОС |
| `npm run dev` | Только фронтенд в браузере (без Tauri) |
| `npm run build` | Сборка фронтенда (TypeScript + Vite) |
| `./scripts/build-linux.sh` | Сборка под Linux через Docker (с macOS/Windows) |

---

## Иконка приложения

Иконки для всех платформ генерируются скриптом `scripts/gen-icons.sh` из одного исходного файла.

```bash
# Из файла icon.png в корне проекта (по умолчанию, crop 720)
./scripts/gen-icons.sh

# Из произвольного файла
./scripts/gen-icons.sh my-icon.png

# С явным размером кропа
./scripts/gen-icons.sh my-icon.png --crop 800

# Без кропа (использовать исходник как есть)
./scripts/gen-icons.sh my-icon.png --crop 0
```

**Параметр `--crop N`** вырезает центральный квадрат `NxN` из исходника и растягивает его до `1024x1024`. Это нужно, чтобы убрать пустые отступы вокруг логотипа — без кропа иконка в Dock macOS выглядит меньше остальных. Значение по умолчанию: `720`.

После замены иконок нужно пересобрать приложение (`npm run tauri build`) и перезапустить Dock:

```bash
killall Dock
```

**Требования:** macOS (`sips` + `iconutil` встроены), ImageMagick для `.ico` и `--crop`:

```bash
brew install imagemagick
```

---

## Сборка под Linux (через Docker)

Позволяет собрать `.deb` / `.AppImage` прямо с macOS или Windows без виртуальной машины.

### Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — запущен

### Первая сборка

```bash
./scripts/build-linux.sh
```

Первый раз занимает **10–20 минут** — Docker скачивает образ Ubuntu, устанавливает зависимости и компилирует Rust-зависимости с нуля.

Повторные сборки — **1–3 минуты** благодаря Docker volumes-кэшу:
- `devconsole-hub-cargo-registry` — кэш Cargo registry
- `devconsole-hub-cargo-git` — кэш Cargo git-зависимостей
- `devconsole-hub-target` — скомпилированные Rust-артефакты

### Результат

Артефакты появятся в `src-tauri/target/release/bundle/`:

```
src-tauri/target/release/bundle/
├── deb/
│   └── devconsole-hub_0.1.0_amd64.deb
└── appimage/
    └── devconsole-hub_0.1.0_amd64.AppImage
```

### Очистка кэша (если нужно пересобрать с нуля)

```bash
docker volume rm devconsole-hub-cargo-registry devconsole-hub-cargo-git devconsole-hub-target
```

---

## Сборка под Windows

Windows-бинарник требует MSVC-компилятор, который работает **только на Windows**. Docker здесь не поможет.

### Вариант 1 — На Windows-машине

Установить зависимости (см. раздел «Предварительные требования → Windows») и запустить:

```bash
npm install
npm run tauri build
```

Артефакты: `src-tauri/target/release/bundle/msi/*.msi` и `nsis/*.exe`

### Вариант 2 — GitHub Actions (рекомендуется)

Workflow `.github/workflows/build.yml` собирает под **Linux + macOS + Windows** одновременно на облачных раннерах.

**Запуск по тегу:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Запуск вручную:** GitHub → Actions → Build → Run workflow

Готовые артефакты (.deb, .AppImage, .dmg, .msi, .exe) появятся во вкладке **Artifacts** после завершения сборки (~10–15 мин).

---

## Структура проекта

```
devconsole-hub/
├── src/                            # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Layout.tsx              # Четырёхпанельный layout + titlebar
│   │   ├── TreePanel.tsx           # Дерево проектов + поиск + Export/Import
│   │   ├── TerminalPanel.tsx       # Вкладки терминала + xterm.js + PTY
│   │   ├── WikiPanel.tsx           # TipTap редактор + теги + FTS5-поиск
│   │   ├── WikiToolbar.tsx         # Тулбар форматирования wiki
│   │   ├── AiPanel.tsx             # AI-чат (OpenAI/Anthropic), сессии, стриминг
│   │   ├── ContextMenu.tsx         # Контекстное меню дерева
│   │   ├── CommandPalette.tsx      # Cmd+P поиск
│   │   ├── SettingsDialog.tsx      # Окно настроек (4 вкладки)
│   │   ├── ExportDialog.tsx        # Экспорт данных в .dchub
│   │   ├── ImportDialog.tsx        # Импорт из .dchub (3-шаговый)
│   │   ├── Toast.tsx               # Уведомления
│   │   └── dialogs/
│   │       ├── CreateWorkspaceDialog.tsx
│   │       ├── CreateProjectDialog.tsx
│   │       ├── CreateConsoleDialog.tsx
│   │       └── EditConsoleDialog.tsx
│   ├── stores/
│   │   └── appStore.ts             # Zustand: дерево, сессии, AI, настройки
│   ├── lib/
│   │   ├── tauriCommands.ts        # Обёртки invoke() для всех Rust-команд
│   │   ├── themes.ts               # 13 тем + xterm-палитры
│   │   ├── aiProviders.ts          # OpenAI + Anthropic, стриминг SSE
│   │   └── i18n.ts                 # Конфиг i18next
│   ├── locales/                    # Файлы переводов
│   │   ├── ru.json                 # Русский
│   │   ├── en.json                 # English
│   │   ├── zh.json                 # 中文
│   │   ├── fr.json                 # Français
│   │   └── kk.json                 # Қазақша
│   ├── types/
│   │   └── index.ts                # TypeScript типы
│   ├── styles/
│   │   └── globals.css             # Tailwind + темы + xterm-стили
│   ├── App.tsx                     # Корневой компонент, горячие клавиши
│   └── main.tsx
├── src-tauri/                      # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                 # Точка входа (desktop), ~38 команд
│   │   ├── lib.rs                  # Точка входа (mobile), синхронизирован с main.rs
│   │   ├── commands.rs             # Tauri-команды (#[tauri::command])
│   │   ├── db.rs                   # SQLite CRUD (SQLCipher + FTS5 + automigration)
│   │   ├── pty_manager.rs          # PTY: spawn / write / resize / kill + SSH auth
│   │   └── export.rs               # Экспорт/импорт .dchub (AES-256-GCM)
│   ├── build.rs                    # Встраивает DB_ENCRYPTION_KEY в бинарник
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── .env                        # DB_ENCRYPTION_KEY (не в git)
│   └── .env.example
├── docs/
│   ├── ARCHITECTURE.md             # Принцип работы: IPC, PTY, SQLite, компоненты
│   ├── STATUS.md                   # Статус готовности и история изменений
│   └── PLAN.md                     # Детальный план разработки
├── scripts/
│   ├── build-linux.sh              # Сборка под Linux через Docker
│   └── gen-icons.sh                # Генерация иконок из PNG
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Переменные окружения (`.env`)

Файл `.env` читается автоматически при `npm run tauri dev` / `npm run tauri build`. Не коммитится в git.

| Переменная | Описание |
|-----------|----------|
| `DB_ENCRYPTION_KEY` | Ключ шифрования SQLite (AES-256). Встраивается в бинарник при компиляции. |

```bash
# Скопировать шаблон
cp .env.example .env

# Для продакшн-сборки сгенерировать случайный ключ:
openssl rand -hex 32
# Вставить результат в .env как значение DB_ENCRYPTION_KEY
```

> Для разработки ключ по умолчанию в `build.rs` работает автоматически — `.env` менять не обязательно.

---

## Хранилище данных

База SQLite: `~/Library/Application Support/devconsole-hub/data.db` (macOS).

```
workspaces
  └── projects
        └── consoles
wiki_pages  (привязка к любому уровню через parent_type + parent_id)
wiki_fts    (FTS5 — полнотекстовый поиск)
ai_sessions
  └── ai_messages  (CASCADE delete)
settings    (key / value)
```

---

## Добавление новой Tauri-команды

1. Объявить `#[tauri::command]` в `src-tauri/src/commands.rs`
2. Добавить логику в `src-tauri/src/db.rs` (если нужна БД)
3. Зарегистрировать в `src-tauri/src/main.rs` → `invoke_handler![]`
4. Зарегистрировать в `src-tauri/src/lib.rs` → `invoke_handler![]` ⚠️ **оба файла**
5. Добавить TypeScript-обёртку в `src/lib/tauriCommands.ts`

> **Важно:** аргументы Rust → TypeScript автоматически конвертируются через serde: Rust `snake_case` ↔ TypeScript `camelCase` (директива `#[serde(rename_all = "camelCase")]`).

---

## Добавление нового языка

1. Создать файл `src/locales/XX.json` (скопировать структуру из `en.json`, перевести все значения)
2. Подключить в `src/lib/i18n.ts`:
   ```ts
   import xx from "../locales/xx.json";
   // в resources:
   xx: { translation: xx },
   ```
3. Добавить ключ названия языка во **все** существующие локали (`ru.json`, `en.json`, `zh.json`, `fr.json`, `kk.json`):
   ```json
   "langXx": "🏳️ Название языка"
   ```
4. Добавить код языка в массив в `src/components/SettingsDialog.tsx`:
   ```ts
   {(["ru", "en", "zh", "fr", "kk", "xx"] as const).map(...)
   ```

Переключение применяется мгновенно, выбор сохраняется в SQLite (`ui.language`).

---

## Документация

| Файл | Содержание |
|------|-----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Принцип работы: IPC-мост TS↔Rust, PTY, SQLite, поток данных |
| [docs/STATUS.md](docs/STATUS.md) | Статус готовности по компонентам, история изменений, TODO |
| [docs/PLAN.md](docs/PLAN.md) | Детальный план разработки по этапам |

---

## Лицензия

MIT
