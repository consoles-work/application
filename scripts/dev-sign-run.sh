#!/usr/bin/env bash
# dev-sign-run.sh — cargo runner для macOS (src-tauri/.cargo/config.toml).
#
# tauri dev запускает приложение через `cargo run`, а cargo — через этот скрипт.
# Перед запуском подписываем dev-бинарник постоянной подписью: macOS узнаёт
# приложение по подписи кода (уведомление «добавлен объект входа» при автозапуске,
# разрешения TCC), и без неё после каждой пересборки бинарник для системы —
# новое приложение.
#
# Сертификат: CONSOLES_DEV_SIGN_IDENTITY (имя или SHA-1 из `security find-identity`),
# иначе первый подходящий для подписи кода в связке ключей. Нет ни одного —
# запускаем без подписи, как раньше.
#
# Идентификатор подписи отдельный от релизного (work.consoles.app), чтобы
# dev-сборка не делила с установленным приложением объекты входа и разрешения.
#
# При первой подписи macOS спросит доступ codesign к ключу — «Всегда разрешать».

BIN="$1"

if [[ "$(basename "$BIN")" == "consoles-work" ]]; then
    IDENTITY="${CONSOLES_DEV_SIGN_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | awk 'NR==1 && $2 ~ /^[0-9A-F]{40}$/ { print $2 }')}"
    if [[ -n "$IDENTITY" ]]; then
        codesign --force --sign "$IDENTITY" --identifier work.consoles.app.dev "$BIN" 2>&1 \
            | grep -v "replacing existing signature" >&2 \
            || true
    else
        echo "dev-sign-run: нет сертификата для подписи — macOS будет считать каждую сборку новым приложением" >&2
    fi
fi

exec "$@"
