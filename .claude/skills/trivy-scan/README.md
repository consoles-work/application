# trivy-scan — проверка зависимостей на уязвимости

Скилл Claude Code для devconsole-hub: сканирует через Trivy Rust-крейты
(`src-tauri/Cargo.lock`), npm-пакеты (`package-lock.json`), секреты в файлах
проекта и сборочный `docker/Dockerfile.linux`, пишет отчёт с действиями и
помогает их выполнить.

Инструкция для Claude — `SKILL.md`. Этот файл — для человека.

## Требования

- Запущенный Docker Desktop. Trivy ставить не нужно: он работает как сервис
  `trivy` из `docker-compose.yml` скилла (версия закреплена там), база
  уязвимостей — в общем volume `trivy-cache`.

- интернет на первом прогоне: качается база уязвимостей, несколько минут;
- `python3` для отчёта (только стандартная библиотека);
- по желанию — `cargo install cargo-audit` для сверки Rust-крейтов с RustSec.

## Использование

В Claude Code из корня проекта:

```
/trivy-scan
```

или словами: «проверь зависимости на уязвимости», «прогони trivy», «аудит
безопасности перед релизом».

Что произойдёт:

1. Скан файлов проекта (`Cargo.lock`, `package-lock.json`, секреты) и
   `docker/Dockerfile.linux`; образ `devconsole-hub-linux-builder` — если собран.
2. Отчёт `docs/security/trivy-<дата>/report.md` + сырые JSON в `raw/`.
3. Claude дописывает «Что чинить в первую очередь» с учётом того, что реально
   попадает в бинарник, и (с вашего согласия) обновляет зависимости.
4. `cargo test`, `tsc`, `npm run build`, повторный скан, журнал
   `docs/SECURITY_FIXES.md`, записи в PLAN/STATUS/CHANGELOG.

Коммиты скилл не делает — всё остаётся в рабочем дереве.

## Запуск скриптов вручную (без Claude)

```bash
SKILL=.claude/skills/trivy-scan
OUT=docs/security/trivy-$(date +%F)

"$SKILL/scripts/scan.sh" --out "$OUT/raw" \
  --fs . \
  --skip-dir node_modules --skip-dir src-tauri/target \
  --skip-dir dist --skip-dir dist-linux --skip-dir .git \
  --config docker \
  --image devconsole-hub-linux-builder   # если образ собран

# одна команда Trivy вручную
SCAN_ROOT=$PWD SCAN_OUT=$PWD/$OUT/raw docker compose -f "$SKILL/docker-compose.yml" \
  run --rm -T trivy fs --scanners vuln /scan/src-tauri

python3 "$SKILL/scripts/report.py" --in "$OUT/raw" --out "$OUT/report.md" \
  --title "Отчёт Trivy: devconsole-hub"
```

Флаги `scan.sh`:

| Флаг | Что делает |
|---|---|
| `--fs PATH` | скан файлов: lock-файлы и секреты |
| `--skip-dir DIR` | исключить каталог из `--fs` (путь от сканируемого) |
| `--config PATH` | ошибки конфигурации Dockerfile |
| `--image NAME` | скан образа (повторяемый, нужен Docker) |
| `--fixed-only` | только находки с исправлением (`--ignore-unfixed`) |
| `--offline` | не обновлять базы Trivy |

## Файлы

```
.claude/skills/trivy-scan/
├── SKILL.md              инструкция для Claude
├── README.md             этот файл
├── docker-compose.yml    сервис trivy: версия, монтирование проекта, кэш базы
└── scripts/
    ├── scan.sh           запуск Trivy через docker compose, JSON по целям
    └── report.py         markdown-отчёт
```

Результаты: `docs/security/trivy-<дата>/` (`report.md`, `raw/` — в `.gitignore`). Журнал решений
по находкам — `docs/SECURITY_FIXES.md`.

Скилл — копия из `tron-telegram-api`, адаптированная под Tauri-приложение:
вместо Docker-образов прод-стека и `composer.lock` — `Cargo.lock` и
`package-lock.json`, режим сверки с экспортом Harbor убран (реестра образов у
проекта нет). Правки в одном проекте в другой не переносятся сами.
