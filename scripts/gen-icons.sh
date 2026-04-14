#!/bin/bash
# gen-icons.sh — генерация всех иконок приложения из одного исходника
#
# Использование:
#   ./scripts/gen-icons.sh              # source: icon.png в корне проекта
#   ./scripts/gen-icons.sh my-icon.png  # кастомный source
#   ./scripts/gen-icons.sh my-icon.png --crop 800 --crop-y -40
#
# Опции:
#   --crop N      обрезать центр NxN пикселей из исходника и растянуть до 1024x1024
#                 (убирает паддинг вокруг логотипа, чтобы иконка в Dock была полноразмерной)
#                 по умолчанию: 800
#                 --crop 0 — отключить обрезку, использовать исходник как есть
#   --crop-y N    вертикальный сдвиг центра кропа в пикселях (отрицательное = вверх)
#                 по умолчанию: -40 (чтобы не срезать верх иконки/волосы)
#   --no-round    не применять скруглённые углы (по умолчанию скругление включено)
#                 Скруглённые углы нужны чтобы macOS не добавлял белый squircle-фон
#                 на неподписанные .app при сборке (баг macOS Ventura/Sonoma)
#
# Требования: macOS (sips + iconutil встроены), ImageMagick (brew install imagemagick) для .ico и --crop

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/src-tauri/icons"

# ── Парсинг аргументов ────────────────────────────────────────────────────────

SOURCE=""
CROP=800
CROP_Y=-20
ROUND=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --crop)
      CROP="$2"; shift 2 ;;
    --crop=*)
      CROP="${1#--crop=}"; shift ;;
    --crop-y)
      CROP_Y="$2"; shift 2 ;;
    --crop-y=*)
      CROP_Y="${1#--crop-y=}"; shift ;;
    --no-round)
      ROUND=0; shift ;;
    *)
      SOURCE="$1"; shift ;;
  esac
done

SOURCE="${SOURCE:-$PROJECT_ROOT/icon.png}"

# ── Проверки ─────────────────────────────────────────────────────────────────

if [ ! -f "$SOURCE" ]; then
  echo "❌ Файл иконки не найден: $SOURCE"
  echo "   Положите icon.png в корень проекта или передайте путь аргументом."
  exit 1
fi

if [ "$CROP" -gt 0 ] 2>/dev/null && ! command -v magick &>/dev/null; then
  echo "❌ --crop требует ImageMagick: brew install imagemagick"
  exit 1
fi

W=$(sips -g pixelWidth "$SOURCE" 2>/dev/null | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$SOURCE" 2>/dev/null | awk '/pixelHeight/{print $2}')

echo "🎨 Генерация иконок из: $SOURCE (${W}x${H})"

# ── Кроп: вырезаем центр и растягиваем до 1024x1024 ──────────────────────────

if [ "$CROP" -gt 0 ] 2>/dev/null; then
  if [ "$CROP" -ge "$W" ] || [ "$CROP" -ge "$H" ]; then
    echo "⚠️  --crop $CROP >= размер исходника (${W}x${H}), кроп пропущен"
  else
    PREPARED="/tmp/gen-icons-prepared-$$.png"
    magick "$SOURCE" -gravity Center -crop "${CROP}x${CROP}+0${CROP_Y}" +repage -resize 1024x1024! "$PREPARED"
    SOURCE="$PREPARED"
    echo "  ✓ crop ${CROP}x${CROP} offset y=${CROP_Y} → 1024x1024"
    CLEANUP_PREPARED=1
  fi
fi

# ── Скругление углов (squircle-маска Apple HIG) ──────────────────────────────
# Убирает белый фон который macOS добавляет неподписанным .app на Ventura/Sonoma

if [ "$ROUND" -eq 1 ]; then
  ROUNDED="/tmp/gen-icons-rounded-$$.png"
  # Радиус 230px на 1024x1024 = ~22.5% (стандарт Apple HIG для macOS иконок)
  magick "$SOURCE" \
    \( +clone -alpha extract \
       -draw "fill black polygon 0,0 0,230 230,0 fill white circle 230,230 230,0" \
       \( +clone -flip \) -compose Multiply -composite \
       \( +clone -flop \) -compose Multiply -composite \
    \) \
    -alpha off -compose CopyOpacity -composite \
    "$ROUNDED"
  SOURCE="$ROUNDED"
  echo "  ✓ squircle-маска применена (r=230)"
  CLEANUP_ROUNDED=1
fi

echo ""

# ── Вспомогательная функция ───────────────────────────────────────────────────

resize() {
  local size=$1
  local dest=$2
  mkdir -p "$(dirname "$dest")"
  sips -z "$size" "$size" "$SOURCE" --out "$dest" >/dev/null
  echo "  ✓ $(realpath --relative-to="$PROJECT_ROOT" "$dest" 2>/dev/null || echo "$dest")  (${size}×${size})"
}

# ── Desktop PNG ───────────────────────────────────────────────────────────────

echo "📦 Desktop PNG"
resize 32  "$ICONS_DIR/32x32.png"
resize 64  "$ICONS_DIR/64x64.png"
resize 128 "$ICONS_DIR/128x128.png"
resize 256 "$ICONS_DIR/128x128@2x.png"
cp "$SOURCE" "$ICONS_DIR/icon.png"
echo "  ✓ src-tauri/icons/icon.png  (source copy)"

# ── macOS .icns ───────────────────────────────────────────────────────────────

echo ""
echo "🍎 macOS .icns"
ICONSET_TMP=$(mktemp -d)
ICONSET="$ICONSET_TMP/icon.iconset"
mkdir -p "$ICONSET"
sips -z 16   16   "$SOURCE" --out "$ICONSET/icon_16x16.png"    >/dev/null
sips -z 32   32   "$SOURCE" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32   32   "$SOURCE" --out "$ICONSET/icon_32x32.png"    >/dev/null
sips -z 64   64   "$SOURCE" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128  128  "$SOURCE" --out "$ICONSET/icon_128x128.png"  >/dev/null
sips -z 256  256  "$SOURCE" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256  256  "$SOURCE" --out "$ICONSET/icon_256x256.png"  >/dev/null
sips -z 512  512  "$SOURCE" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512  512  "$SOURCE" --out "$ICONSET/icon_512x512.png"  >/dev/null
sips -z 1024 1024 "$SOURCE" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET" -o "$ICONS_DIR/icon.icns"
echo "  ✓ src-tauri/icons/icon.icns"
rm -rf "$ICONSET_TMP"

# ── Windows .ico ──────────────────────────────────────────────────────────────

echo ""
echo "🪟 Windows .ico"
if command -v convert &>/dev/null; then
  TMP_ICO=$(mktemp -d)
  for s in 16 24 32 48 64 96 128 256; do
    sips -z "$s" "$s" "$SOURCE" --out "$TMP_ICO/icon_${s}.png" >/dev/null
  done
  convert \
    "$TMP_ICO/icon_16.png" "$TMP_ICO/icon_24.png" "$TMP_ICO/icon_32.png" \
    "$TMP_ICO/icon_48.png" "$TMP_ICO/icon_64.png" "$TMP_ICO/icon_96.png" \
    "$TMP_ICO/icon_128.png" "$TMP_ICO/icon_256.png" \
    "$ICONS_DIR/icon.ico"
  echo "  ✓ src-tauri/icons/icon.ico  (16/24/32/48/64/96/128/256px)"
  rm -rf "$TMP_ICO"
else
  echo "  ⚠ ImageMagick не найден → icon.ico пропущен"
  echo "    Установите: brew install imagemagick"
fi

# ── Windows Store logos ───────────────────────────────────────────────────────

echo ""
echo "🏪 Windows Store logos"
resize 30  "$ICONS_DIR/Square30x30Logo.png"
resize 44  "$ICONS_DIR/Square44x44Logo.png"
resize 71  "$ICONS_DIR/Square71x71Logo.png"
resize 89  "$ICONS_DIR/Square89x89Logo.png"
resize 107 "$ICONS_DIR/Square107x107Logo.png"
resize 142 "$ICONS_DIR/Square142x142Logo.png"
resize 150 "$ICONS_DIR/Square150x150Logo.png"
resize 284 "$ICONS_DIR/Square284x284Logo.png"
resize 310 "$ICONS_DIR/Square310x310Logo.png"
resize 50  "$ICONS_DIR/StoreLogo.png"

# ── iOS ───────────────────────────────────────────────────────────────────────

echo ""
echo "📱 iOS"
IOS="$ICONS_DIR/ios"
resize 20   "$IOS/AppIcon-20x20@1x.png"
resize 40   "$IOS/AppIcon-20x20@2x.png"
resize 40   "$IOS/AppIcon-20x20@2x-1.png"
resize 60   "$IOS/AppIcon-20x20@3x.png"
resize 29   "$IOS/AppIcon-29x29@1x.png"
resize 58   "$IOS/AppIcon-29x29@2x.png"
resize 58   "$IOS/AppIcon-29x29@2x-1.png"
resize 87   "$IOS/AppIcon-29x29@3x.png"
resize 40   "$IOS/AppIcon-40x40@1x.png"
resize 80   "$IOS/AppIcon-40x40@2x.png"
resize 80   "$IOS/AppIcon-40x40@2x-1.png"
resize 120  "$IOS/AppIcon-40x40@3x.png"
resize 1024 "$IOS/AppIcon-512@2x.png"
resize 120  "$IOS/AppIcon-60x60@2x.png"
resize 180  "$IOS/AppIcon-60x60@3x.png"
resize 76   "$IOS/AppIcon-76x76@1x.png"
resize 152  "$IOS/AppIcon-76x76@2x.png"
resize 167  "$IOS/AppIcon-83.5x83.5@2x.png"

# ── Android ───────────────────────────────────────────────────────────────────

echo ""
echo "🤖 Android"
AND="$ICONS_DIR/android"

for dpi in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  case $dpi in
    mdpi)    s=48;  sf=108 ;;
    hdpi)    s=72;  sf=162 ;;
    xhdpi)   s=96;  sf=216 ;;
    xxhdpi)  s=144; sf=324 ;;
    xxxhdpi) s=192; sf=432 ;;
  esac
  resize "$s"  "$AND/mipmap-$dpi/ic_launcher.png"
  resize "$s"  "$AND/mipmap-$dpi/ic_launcher_round.png"
  resize "$sf" "$AND/mipmap-$dpi/ic_launcher_foreground.png"
done

echo ""
echo "✅ Готово! Все иконки сгенерированы в src-tauri/icons/"

[ -n "$CLEANUP_PREPARED" ] && rm -f "$PREPARED"
[ -n "$CLEANUP_ROUNDED" ] && rm -f "$ROUNDED"
