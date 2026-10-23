#!/bin/sh
# Метрики readable-flow для TS/TSX: eslint с плагинами ставится один раз во
# временную папку, в проект ничего не добавляется.
#   .claude/skills/readable-flow/ts-metrics.sh                  — весь src/
#   .claude/skills/readable-flow/ts-metrics.sh src/lib/links.ts — отдельные файлы
set -e

SKILL_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SKILL_DIR/../../.." && pwd)
CACHE="${READABLE_FLOW_ESLINT:-${TMPDIR:-/tmp}/readable-flow-eslint}"

if [ ! -d "$CACHE/node_modules/eslint-plugin-react-hooks" ]; then
  mkdir -p "$CACHE"
  echo '{"private":true,"type":"module"}' > "$CACHE/package.json"
  npm install --prefix "$CACHE" --silent --no-audit --no-fund \
    eslint@9 typescript-eslint@8 eslint-plugin-sonarjs@3 eslint-plugin-react-hooks@5 typescript@5
fi

cp "$SKILL_DIR/eslint.config.mjs" "$CACHE/eslint.config.mjs"

cd "$ROOT"

[ $# -eq 0 ] && set -- src

exec "$CACHE/node_modules/.bin/eslint" -c "$CACHE/eslint.config.mjs" --no-warn-ignored "$@"
