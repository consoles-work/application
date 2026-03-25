# DevConsole Hub

Мультипроектный терминал-менеджер с интегрированной базой знаний.

**Три панели — одно приложение:**
- 🌳 **Дерево проектов** (слева) — иерархия Workspace → Project → Console
- 💻 **Терминал** (центр) — вкладки с полноценными PTY-сессиями
- 📖 **Wiki** (справа) — заметки, сниппеты, документация по каждому проекту

## Технологический стек

| Слой | Технология |
|------|-----------|
| Оболочка | Tauri 2.0 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Терминал | xterm.js + Tauri PTY bridge |
| Wiki-редактор | TipTap (ProseMirror) |
| Хранение | SQLite (через rusqlite) |
| UI | Tailwind CSS |
| Стейт | Zustand |

## Предварительные требования

### Все платформы

1. **Node.js 18+** — https://nodejs.org/
2. **Rust** — https://rustup.rs/

```bash
# Установка Rust (одна команда)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# После установки перезапустить терминал, затем проверить:
rustc --version
cargo --version
```

### Windows (дополнительно)

- **Visual Studio Build Tools** — при установке Rust через rustup будет предложено установить. Выберите "Desktop development with C++".
- **WebView2** — предустановлен на Windows 10/11. Если нет: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### macOS (дополнительно)

```bash
xcode-select --install
```

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

## Быстрый старт

```bash
# 1. Перейти в проект
cd devconsole-hub

# 2. Установить JS-зависимости
npm install

# 3. Запустить в режиме разработки
npm run tauri dev
```

Первый запуск займёт 3-5 минут (Rust компилирует зависимости). Далее — 5-10 секунд.

## Команды

| Команда | Описание |
|---------|----------|
| `npm run tauri dev` | Dev-режим (hot reload фронта + Rust перекомпиляция) |
| `npm run tauri build` | Сборка продакшн-бинарника под текущую ОС |
| `npm run dev` | Только фронтенд в браузере (без Tauri) |
| `npm run build` | Сборка фронтенда |

## Структура проекта

```
devconsole-hub/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Layout.tsx              # Главный layout с 3 панелями
│   │   ├── TreePanel.tsx           # Дерево проектов
│   │   ├── TerminalPanel.tsx       # Терминал (вкладки)
│   │   └── WikiPanel.tsx           # Wiki-редактор
│   ├── stores/
│   │   └── appStore.ts             # Zustand (состояние приложения)
│   ├── lib/
│   │   └── tauriCommands.ts        # Обёртки вызовов Rust-команд
│   ├── types/
│   │   └── index.ts                # TypeScript типы
│   ├── styles/
│   │   └── globals.css             # Tailwind + кастомные стили
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                  # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                 # Точка входа Tauri
│   │   ├── commands.rs             # Tauri-команды (IPC хендлеры)
│   │   ├── db.rs                   # SQLite: таблицы, CRUD
│   │   └── pty_manager.rs          # PTY: запуск шеллов, I/O
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Текущий статус (скелет)

- [x] Структура Tauri 2.0 проекта
- [x] Трёхпанельный layout с resizable сплиттерами
- [x] Zustand store с моделью данных
- [x] Rust-команды для CRUD (дерево проектов)
- [x] SQLite база с миграциями
- [x] PTY manager (каркас)
- [x] TypeScript типы и IPC-обёртки

## Что делать дальше (порядок)

1. **Дерево** — CRUD к UI, drag-and-drop, контекстное меню
2. **Терминал** — xterm.js ↔ PTY через Tauri events
3. **Wiki** — TipTap редактор, сохранение в SQLite
4. **Поиск** — FTS5, Command Palette (Ctrl+P)
5. **Настройки** — темы, горячие клавиши, SSH-профили

## Лицензия

MIT
