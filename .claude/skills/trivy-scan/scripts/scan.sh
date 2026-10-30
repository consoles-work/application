#!/usr/bin/env bash
# Запуск Trivy через docker compose: файловая система (lock-файлы, секреты),
# конфиги, образы. JSON-результаты — в каталог --out, по одному файлу на цель.
#
#   scan.sh --out DIR [--fs PATH]... [--skip-dir DIR]... [--config PATH]... [--image NAME]...
#           [--fixed-only] [--offline]
#
# Trivy — сервис `trivy` из ../docker-compose.yml (версия закреплена там).
# Корень проекта (git toplevel) монтируется в /scan, поэтому --fs и --config
# должны лежать внутри проекта.
#
# По умолчанию — все уязвимости; --fixed-only оставляет только те, для которых
# вышло исправление (--ignore-unfixed).
#
# --skip-dir действует на --fs: путь относительно сканируемого каталога
# (node_modules, src-tauri/target и т.п.), передаётся в trivy как --skip-dirs.

set -uo pipefail

COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docker-compose.yml"

OUT=""
IGNORE_UNFIXED=""
EXTRA=() CONFIG_EXTRA=()
IMAGES=() FS_PATHS=() CONFIG_PATHS=() SKIP_DIRS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out)        OUT="$2"; shift 2 ;;
        --image)      IMAGES+=("$2"); shift 2 ;;
        --fs)         FS_PATHS+=("$2"); shift 2 ;;
        --config)     CONFIG_PATHS+=("$2"); shift 2 ;;
        --skip-dir)   SKIP_DIRS+=("$2"); shift 2 ;;
        --fixed-only) IGNORE_UNFIXED="--ignore-unfixed"; shift ;;
        # config не принимает --skip-*-db-update (у него своя база проверок),
        # поэтому для него офлайн — отдельный флаг.
        --offline)    EXTRA+=(--skip-db-update --skip-java-db-update)
                      CONFIG_EXTRA+=(--skip-check-update); shift ;;
        *) echo "Неизвестный аргумент: $1" >&2; exit 2 ;;
    esac
done

[[ -n "$OUT" ]] || { echo "Нужен --out DIR" >&2; exit 2; }

# 1. Окружение: Docker, корень проекта, каталог результатов.
command -v docker >/dev/null || { echo "docker не найден в PATH" >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "Docker-демон недоступен (запусти Docker Desktop)" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
export SCAN_ROOT="$ROOT" SCAN_OUT="$OUT"

# Кэш базы уязвимостей (~60 МБ на первом прогоне) — external volume из compose.
docker volume inspect trivy-cache >/dev/null 2>&1 || docker volume create trivy-cache >/dev/null

slug() { echo "$1" | tr '/:@ ' '____' | tr -cd '[:alnum:]_.-'; }

# Путь хоста → путь внутри контейнера (/scan/...); пусто, если вне проекта.
in_container() {
    local abs
    abs="$(cd "$1" 2>/dev/null && pwd)" || return 1
    case "$abs" in
        "$ROOT")   echo /scan ;;
        "$ROOT"/*) echo "/scan/${abs#"$ROOT"/}" ;;
        *)         return 1 ;;
    esac
}

FAILED=0

run_trivy() {
    local label="$1" outfile="$2"; shift 2
    echo ">>> trivy $label"
    if docker compose -f "$COMPOSE_FILE" --progress quiet run --rm -T trivy "$@" \
        --format json -o "/out/$(basename "$outfile")" >/dev/null; then
        echo "    → $(basename "$outfile")"
    else
        echo "    !! скан не удался: $label" >&2
        FAILED=$((FAILED + 1))
    fi
}

# 2. Образы (локальные, через docker.sock).
for img in ${IMAGES[@]+"${IMAGES[@]}"}; do
    [[ -n "$img" ]] || continue
    run_trivy "image $img" "$OUT/image__$(slug "$img").json" \
        image --scanners vuln,secret $IGNORE_UNFIXED ${EXTRA[@]+"${EXTRA[@]}"} "$img"
done

# 3. Файлы проекта: lock-файлы и секреты.
for p in ${FS_PATHS[@]+"${FS_PATHS[@]}"}; do
    target="$(in_container "$p")" || { echo "Нет пути или он вне проекта: $p" >&2; FAILED=$((FAILED+1)); continue; }
    skip=()
    for d in ${SKIP_DIRS[@]+"${SKIP_DIRS[@]}"}; do
        skip+=(--skip-dirs "$target/${d#./}")
    done
    run_trivy "fs $p" "$OUT/fs__$(slug "$(basename "$(cd "$p" && pwd)")").json" \
        fs --scanners vuln,secret $IGNORE_UNFIXED ${EXTRA[@]+"${EXTRA[@]}"} \
        ${skip[@]+"${skip[@]}"} "$target"
done

# 4. Конфиги: Dockerfile и прочее, что Trivy умеет проверять.
for p in ${CONFIG_PATHS[@]+"${CONFIG_PATHS[@]}"}; do
    target="$(in_container "$p")" || { echo "Нет пути или он вне проекта: $p" >&2; FAILED=$((FAILED+1)); continue; }
    run_trivy "config $p" "$OUT/config__$(slug "$(basename "$(cd "$p" && pwd)")").json" \
        config ${CONFIG_EXTRA[@]+"${CONFIG_EXTRA[@]}"} "$target"
done

# compose run оставляет сеть проекта trivy-scan — убрать (volume external, его не тронет).
docker compose -f "$COMPOSE_FILE" --progress quiet down >/dev/null 2>&1

echo "Готово. JSON в $OUT (неудачных сканов: $FAILED)"
exit $(( FAILED > 0 ? 1 : 0 ))
