#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="devconsole-hub-linux-builder"

echo "==> Building Docker image..."
docker build \
    -f "$PROJECT_DIR/docker/Dockerfile.linux" \
    -t "$IMAGE_NAME" \
    "$PROJECT_DIR"

echo "==> Running Linux build..."
docker run --rm \
    -v "$PROJECT_DIR:/app" \
    -v "devconsole-hub-cargo-registry:/root/.cargo/registry" \
    -v "devconsole-hub-cargo-git:/root/.cargo/git" \
    -v "devconsole-hub-target:/app/src-tauri/target" \
    "$IMAGE_NAME" \
    bash -c "npm install && npm run tauri build"

echo "==> Copying artifacts to dist-linux/..."
rm -rf "$PROJECT_DIR/dist-linux"
mkdir -p "$PROJECT_DIR/dist-linux"
docker run --rm \
    -v "devconsole-hub-target:/target" \
    -v "$PROJECT_DIR/dist-linux:/out" \
    ubuntu:22.04 \
    bash -c "cp -r /target/release/bundle/. /out/ 2>/dev/null; chown -R $(id -u):$(id -g) /out"

echo ""
echo "==> Done! Artifacts in dist-linux/:"
find "$PROJECT_DIR/dist-linux" \
    -type f \( -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" \) \
    | sed 's|^|    |'
