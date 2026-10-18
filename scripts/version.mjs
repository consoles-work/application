#!/usr/bin/env node
// version.mjs — версия приложения в одном месте и синхронизация копий.
//
// Источник правды — package.json. tauri.conf.json ссылается на него
// ("version": "../package.json"), фронт получает её через Vite (__APP_VERSION__).
// Копии, которые сослаться не умеют, скрипт переписывает сам:
//   package-lock.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock.
//
//   npm run version:check              — показать версию, проверить, что копии совпадают
//   npm run version:bump -- patch      — 0.2.0 → 0.2.1 (исправления)
//   npm run version:bump -- minor      — 0.2.1 → 0.3.0 (новые возможности)
//   npm run version:bump -- major      — 0.3.0 → 1.0.0
//   npm run version:bump -- 1.2.3      — конкретная версия
//
// При подъёме раздел «Не выпущено» в CHANGELOG.md становится разделом новой
// версии с сегодняшней датой. В git скрипт ничего не пишет: ни коммитов, ни тегов
// (поэтому не `npm version` — тот коммитит сам).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = (rel) => join(root, rel);
const read = (rel) => readFileSync(file(rel), "utf-8");
const write = (rel, text) => writeFileSync(file(rel), text);

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const CARGO_TOML = "src-tauri/Cargo.toml";
const CARGO_LOCK = "src-tauri/Cargo.lock";
const UNRELEASED = "## [Не выпущено]";

const pkg = JSON.parse(read("package.json"));
const crateName = read(CARGO_TOML).match(/^\[package\][^[]*?^name\s*=\s*"([^"]+)"/m)[1];

// Версии во всех копиях: { "package.json": "0.2.0", ... }
function collect() {
  const lock = JSON.parse(read("package-lock.json"));
  const cargoToml = read(CARGO_TOML).match(/^\[package\][^[]*?^version\s*=\s*"([^"]+)"/m);
  const cargoLock = read(CARGO_LOCK).match(
    new RegExp(`\\[\\[package\\]\\]\\nname = "${crateName}"\\nversion = "([^"]+)"`),
  );
  return {
    "package.json": pkg.version,
    "package-lock.json": lock.version,
    [CARGO_TOML]: cargoToml?.[1],
    [CARGO_LOCK]: cargoLock?.[1],
  };
}

function check() {
  const versions = collect();
  for (const [name, v] of Object.entries(versions)) console.log(`  ${name.padEnd(22)} ${v ?? "—"}`);
  const mismatched = Object.entries(versions).filter(([, v]) => v !== pkg.version);
  if (mismatched.length) {
    console.error(`\nНе совпадает с package.json (${pkg.version}): ${mismatched.map(([n]) => n).join(", ")}`);
    console.error(`Выровнять: npm run version:bump -- ${pkg.version}`);
    process.exit(1);
  }
  console.log(`\nВерсия ${pkg.version}, копии совпадают`);
}

function nextVersion(arg) {
  if (SEMVER.test(arg)) return arg;
  const [, ma, mi, pa] = pkg.version.match(SEMVER).map(Number);
  switch (arg) {
    case "major": return `${ma + 1}.0.0`;
    case "minor": return `${ma}.${mi + 1}.0`;
    case "patch": return `${ma}.${mi}.${pa + 1}`;
    default:
      console.error(`Ожидается patch | minor | major | X.Y.Z, получено: ${arg}`);
      process.exit(1);
  }
}

function bump(arg) {
  const from = pkg.version;
  const to = nextVersion(arg);

  pkg.version = to;
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  const lock = JSON.parse(read("package-lock.json"));
  lock.version = to;
  if (lock.packages?.[""]) lock.packages[""].version = to;
  write("package-lock.json", JSON.stringify(lock, null, 2) + "\n");

  write(CARGO_TOML, read(CARGO_TOML).replace(
    /^(\[package\][^[]*?^version\s*=\s*")[^"]+(")/m, `$1${to}$2`,
  ));
  write(CARGO_LOCK, read(CARGO_LOCK).replace(
    new RegExp(`(\\[\\[package\\]\\]\\nname = "${crateName}"\\nversion = ")[^"]+(")`), `$1${to}$2`,
  ));

  // Не выпущенные изменения переезжают под заголовок новой версии
  const changelog = read("CHANGELOG.md");
  if (changelog.includes(UNRELEASED) && to !== from) {
    const today = new Date().toISOString().slice(0, 10);
    write("CHANGELOG.md", changelog.replace(UNRELEASED, `${UNRELEASED}\n\n## [${to}] — ${today}`));
  }

  console.log(`${from} → ${to}`);
  check();
}

const arg = process.argv[2];
if (arg) bump(arg);
else check();
