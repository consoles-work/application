# DevConsole Hub

Мультипроектный терминал-менеджер с интегрированной базой знаний.

**Три панели — одно приложение:**
- 🌳 **Дерево проектов** (слева) — иерархия Workspace → Project → Console
- 💻 **Терминал** (центр) — вкладки с полноценными PTY-сессиями
- 📖 **Wiki** (справа) — заметки, сниппеты, документация по каждому проекту

---

## Возможности

### Дерево проектов
- Иерархия: **Workspace → Project → Console**
- Emoji-иконки и цветовые метки для визуальной группировки
- Контекстное меню (ПКМ): создание, переименование, дублирование, удаление
- Inline-переименование (F2 или двойной клик)
- Поиск по дереву (иконка 🔍 или Ctrl+F)
- **Danger-метки** ⚠ — выделение продакшн-окружений красным баннером
- "Открыть в VS Code" и "Открыть в Finder" для проектов

### Терминал
- Полноценные PTY-сессии через `portable-pty`
- Вкладки с мгновенным переключением
- **Local** (нативный шелл) и **SSH** подключения
- SSH: хост, порт, пользователь, ключ, дополнительные аргументы
- Стартовые команды — выполняются автоматически при открытии сессии
- Полная поддержка UTF-8: кириллица и другие не-ASCII символы отображаются корректно
- Danger-баннер — яркая красная полоса + красноватый фон для опасных консолей (продакшн)

### Wiki
- Редактор **TipTap** (ProseMirror) с форматированием
- Контекстная привязка: отдельные заметки для каждого workspace / project / console
- Полнотекстовый поиск через **FTS5** (SQLite)
- Автосохранение (debounce 1 сек)
- Теги, заголовки H1–H3, списки, чекбоксы, блоки кода с подсветкой синтаксиса
- Несколько страниц на один контекст

### Поиск и навигация
- **Cmd+P** — Command Palette: быстрый переход к любому узлу дерева
- Поиск по дереву (Ctrl+F в панели проектов)
- Полнотекстовый поиск по Wiki (FTS5)

### Настройки
- **10 тем**: GitHub Dark/Light, Dracula, Monokai, Nord, Solarized Dark, Tokyo Night, Catppuccin, One Dark, Gruvbox Dark + случайная при каждом запуске
- **Терминал**: шрифт (Menlo, Monaco, JetBrains Mono, Fira Code), размер, scrollback, стиль курсора
- **Данные**: путь к БД, размер файла, "Показать в Finder", "Скопировать путь"
- Все настройки хранятся в SQLite, применяются без перезапуска
- Видимость панелей (дерево / wiki) сохраняется между запусками

### Локализация
- **5 языков**: 🇷🇺 Русский, 🇺🇸 English, 🇨🇳 中文, 🇫🇷 Français, 🇰🇿 Қазақша
- Переключение в Settings → Интерфейс → кнопки языков
- Мгновенное применение без перезагрузки
- Сохраняется в SQLite

### Горячие клавиши

| Сочетание | Действие |
|-----------|----------|
| `Cmd/Ctrl+P` | Command Palette (поиск по дереву) |
| `Cmd/Ctrl+,` | Открыть настройки |
| `Cmd/Ctrl+B` | Показать / скрыть панель дерева |
| `Cmd/Ctrl+\` | Показать / скрыть wiki-панель |
| `F2` | Переименовать выбранный узел |
| `Ctrl+F` | Поиск в панели проектов |

---

## Технологический стек

| Слой | Технология |
|------|-----------|
| Оболочка | Tauri 2.0 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Терминал | xterm.js + portable-pty (Rust) |
| Wiki-редактор | TipTap (ProseMirror) + lowlight |
| Хранение | SQLite (rusqlite, WAL-режим, FTS5) |
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
│   │   ├── Layout.tsx              # Трёхпанельный layout + titlebar
│   │   ├── TreePanel.tsx           # Дерево проектов + поиск + rename
│   │   ├── TerminalPanel.tsx       # Вкладки терминала + xterm.js
│   │   ├── WikiPanel.tsx           # TipTap редактор + теги + поиск
│   │   ├── WikiToolbar.tsx         # Тулбар форматирования wiki
│   │   ├── ContextMenu.tsx         # Контекстное меню дерева
│   │   ├── CommandPalette.tsx      # Cmd+P поиск
│   │   ├── SettingsDialog.tsx      # Окно настроек
│   │   ├── Toast.tsx               # Уведомления
│   │   └── dialogs/
│   │       ├── CreateWorkspaceDialog.tsx
│   │       ├── CreateProjectDialog.tsx
│   │       ├── CreateConsoleDialog.tsx
│   │       └── EditConsoleDialog.tsx
│   ├── stores/
│   │   └── appStore.ts             # Zustand: дерево, сессии, настройки
│   ├── lib/
│   │   ├── tauriCommands.ts        # Обёртки invoke() для всех Rust-команд
│   │   ├── themes.ts               # 10 тем + CSS-переменные
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
│   │   ├── main.rs                 # Точка входа (desktop)
│   │   ├── lib.rs                  # Точка входа (mobile)
│   │   ├── commands.rs             # Tauri-команды (#[tauri::command])
│   │   ├── db.rs                   # SQLite: схема, CRUD, миграции
│   │   └── pty_manager.rs          # PTY: spawn / write / resize / kill
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/
│   ├── ARCHITECTURE.md             # Принцип работы: IPC, PTY, SQLite, компоненты
│   ├── STATUS.md                   # Статус готовности и история изменений
│   └── PLAN.md                     # Детальный план разработки
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Хранилище данных

База SQLite: `~/Library/Application Support/devconsole-hub/data.db` (macOS).

```
workspaces
  └── projects
        └── consoles
wiki_pages  (привязка к любому уровню через parent_type + parent_id)
wiki_fts    (FTS5 — полнотекстовый поиск)
settings    (key / value)
env_vars
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
