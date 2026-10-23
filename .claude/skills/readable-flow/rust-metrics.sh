#!/bin/sh
# Метрики readable-flow для Rust: clippy только с линтами скилла и порогами из
# clippy.toml рядом (CLIPPY_CONF_DIR) — конфиг проекта не меняется.
#   .claude/skills/readable-flow/rust-metrics.sh                        — весь крейт
#   .claude/skills/readable-flow/rust-metrics.sh src/pty_manager.rs ... — только эти файлы
set -e

SKILL_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SKILL_DIR/../../.." && pwd)

cd "$ROOT/src-tauri"

CLIPPY_CONF_DIR="$SKILL_DIR" cargo clippy --quiet --message-format=short -- \
  -A clippy::all \
  -W clippy::cognitive_complexity \
  -W clippy::too_many_arguments \
  -W clippy::excessive_nesting \
  -W clippy::redundant_else \
  -W clippy::collapsible_if \
  -W clippy::collapsible_else_if \
  -W clippy::needless_return \
  -W clippy::let_and_return \
  -W clippy::if_same_then_else \
  -W clippy::match_same_arms \
  -W clippy::needless_bool \
  -W clippy::nonminimal_bool \
  -W clippy::manual_let_else \
  -W clippy::question_mark \
  > "${TMPDIR:-/tmp}/readable-flow-clippy.txt" 2>&1 || true

OUT="${TMPDIR:-/tmp}/readable-flow-clippy.txt"

if [ $# -eq 0 ]; then
  grep -E "^(src|build)" "$OUT" | grep -v "generated [0-9]* warning" || echo "Замечаний нет"
  exit 0
fi

for f in "$@"; do
  grep -F "${f#src-tauri/}:" "$OUT" || true
done
