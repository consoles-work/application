#!/usr/bin/env python3
"""Собрать markdown-отчёт из JSON-результатов Trivy.

    report.py --in RAW_DIR --out report.md [--title "..."]

Читает все *.json из RAW_DIR (имена вида image__*.json / fs__*.json /
config__*.json, которые кладёт scan.sh) и пишет один отчёт: сводка по целям,
полный разбор CRITICAL/HIGH, найденные секреты и ошибки конфигурации.
У fs-скана находки помечаются lock-файлом (`src-tauri/Cargo.lock` — Rust,
`package-lock.json` — npm): от этого зависит, чем чинить.
MEDIUM/LOW не расписываются построчно — их обычно сотни, и они тонут в шуме;
для них показываются счётчики и самые «тяжёлые» пакеты.
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict

SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]
SEV_RU = {"CRITICAL": "критич.", "HIGH": "высок.", "MEDIUM": "средн.", "LOW": "низк."}


def esc(text):
    """Экранировать для ячейки markdown-таблицы."""
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).replace("|", "\\|").strip()


def trim(text, limit=110):
    text = esc(text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


class Target:
    def __init__(self, path, data):
        self.file = path.name
        self.kind = path.name.split("__", 1)[0]
        name = data.get("ArtifactName") or ""
        # У fs/config-сканов ArtifactName — это точка монтирования внутри
        # контейнера ("/scan"), одинаковая для всех целей. Осмысленное имя
        # лежит в имени файла, которое проставил scan.sh.
        if name in ("", ".") or name == "/scan" or name.startswith("/scan/"):
            name = path.stem.split("__", 1)[-1].replace("_", "-")
        self.name = name
        os_info = (data.get("Metadata") or {}).get("OS") or {}
        self.os = " ".join(x for x in [os_info.get("Family"), os_info.get("Name")] if x)
        self.vulns = []          # (severity, result_target, vuln)
        self.secrets = []        # (result_target, secret)
        self.misconfigs = []     # (result_target, misconfig)
        seen = set()

        for res in data.get("Results") or []:
            where = res.get("Target") or ""
            for v in res.get("Vulnerabilities") or []:
                key = (v.get("VulnerabilityID"), v.get("PkgName"), v.get("InstalledVersion"))
                if key in seen:
                    continue
                seen.add(key)
                sev = (v.get("Severity") or "UNKNOWN").upper()
                self.vulns.append((sev, where, v))
            for s in res.get("Secrets") or []:
                self.secrets.append((where, s))
            for m in res.get("Misconfigurations") or []:
                if (m.get("Status") or "FAIL").upper() == "FAIL":
                    self.misconfigs.append((where, m))

    @property
    def counts(self):
        c = Counter(sev for sev, _, _ in self.vulns)
        return {s: c.get(s, 0) for s in SEV_ORDER}

    @property
    def urgent(self):
        """CRITICAL и HIGH — то, что закрывают в первую очередь."""
        order = {"CRITICAL": 0, "HIGH": 1}
        rows = [(s, w, v) for s, w, v in self.vulns if s in order]
        return sorted(rows, key=lambda r: (order[r[0]], r[2].get("PkgName") or ""))

    @property
    def urgent_fixed(self):
        return [r for r in self.urgent if r[2].get("FixedVersion")]

    def urgent_unfixed_by_pkg(self):
        """Critical/high без исправления, по пакетам: {пакет: (крит., выс.)}."""
        res = {}
        for sev, _, v in self.urgent:
            if v.get("FixedVersion"):
                continue
            crit, high = res.get(v.get("PkgName") or "?", (0, 0))
            res[v.get("PkgName") or "?"] = (crit + (sev == "CRITICAL"), high + (sev == "HIGH"))
        return sorted(res.items(), key=lambda kv: (-kv[1][0], -kv[1][1], kv[0]))

    @property
    def fixable(self):
        return sum(1 for _, _, v in self.vulns if v.get("FixedVersion"))

    @property
    def total(self):
        return len(self.vulns)

    def worst_packages(self, limit=8):
        c = Counter()
        fixes = {}
        for sev, _, v in self.vulns:
            pkg = v.get("PkgName") or "?"
            c[pkg] += 1
            if v.get("FixedVersion"):
                fixes.setdefault(pkg, (v.get("InstalledVersion"), v.get("FixedVersion")))
        return [(pkg, n, fixes.get(pkg)) for pkg, n in c.most_common(limit)]


def load(raw_dir):
    targets = []
    for path in sorted(pathlib.Path(raw_dir).glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            print(f"пропускаю {path.name}: {exc}", file=sys.stderr)
            continue
        targets.append(Target(path, data))
    return targets


KIND_RU = {"image": "образ", "fs": "файлы", "config": "конфиги"}


def render(targets, title):
    today = dt.date.today().isoformat()
    out = [f"# {title}", "", f"Дата сканирования: {today}  ",
           f"Инструмент: Trivy, целей проверено: {len(targets)}", ""]

    tot = Counter()
    for t in targets:
        tot.update(t.counts)
    secrets_total = sum(len(t.secrets) for t in targets)
    misconf_total = sum(len(t.misconfigs) for t in targets)

    out += ["## Сводка", "",
            "Уровни — все находки; «Крит.+выс. с фиксом» — то, что закрывается обновлением.", "",
            "| Цель | Тип | ОС | Крит. | Выс. | Средн. | Низк. | Крит.+выс. с фиксом | Секреты | Конфиг |",
            "|---|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    fixed_total = 0
    for t in targets:
        c = t.counts
        fixed_total += len(t.urgent_fixed)
        out.append("| `{}` | {} | {} | {} | {} | {} | {} | {} | {} | {} |".format(
            esc(t.name), KIND_RU.get(t.kind, t.kind), esc(t.os) or "—",
            c["CRITICAL"], c["HIGH"], c["MEDIUM"], c["LOW"], len(t.urgent_fixed),
            len(t.secrets), len(t.misconfigs)))
    out.append("| **Итого** |  |  | **{}** | **{}** | **{}** | **{}** | **{}** | **{}** | **{}** |".format(
        tot["CRITICAL"], tot["HIGH"], tot["MEDIUM"], tot["LOW"], fixed_total, secrets_total, misconf_total))
    out.append("")

    urgent_targets = [t for t in targets if t.urgent_fixed or t.secrets]
    if not urgent_targets and not misconf_total:
        out += ["> Критичных и высоких уязвимостей с доступным исправлением не найдено, "
                "секретов и ошибок конфигурации тоже. ", ""]

    out += ["## Что чинить в первую очередь", "",
            "<!-- Заполняется по итогам разбора: 3–6 конкретных действий, "
            "самое срочное сверху. Формулировать как задачу («`cargo update -p X` до Y»), а не как пересказ CVE. -->", ""]

    if secrets_total:
        out += ["## Найденные секреты", "",
                "Секрет в git, в образе или в собранном приложении — это утечка: ключ считается "
                "скомпрометированным и требует ротации. Файл вне git (`git check-ignore`) "
                "и вне сборки — не утечка, но отметить.", "",
                "| Цель | Файл | Правило | Уровень | Строка |", "|---|---|---|---|---:|"]
        for t in targets:
            for where, s in t.secrets:
                out.append("| `{}` | `{}` | {} | {} | {} |".format(
                    esc(t.name), esc(where), esc(s.get("RuleID") or s.get("Category")),
                    SEV_RU.get((s.get("Severity") or "").upper(), esc(s.get("Severity"))),
                    s.get("StartLine", "")))
        out.append("")

    if misconf_total:
        out += ["## Ошибки конфигурации (Dockerfile)", "",
                "| Цель | Файл | ID | Уровень | Проблема | Как исправить |",
                "|---|---|---|---|---|---|"]
        for t in targets:
            for where, m in sorted(t.misconfigs,
                                   key=lambda r: SEV_ORDER.index((r[1].get("Severity") or "UNKNOWN").upper())):
                out.append("| `{}` | `{}` | {} | {} | {} | {} |".format(
                    esc(t.name), esc(where), esc(m.get("ID")),
                    SEV_RU.get((m.get("Severity") or "").upper(), esc(m.get("Severity"))),
                    trim(m.get("Title"), 80), trim(m.get("Resolution"), 90)))
        out.append("")

    out += ["## Разбор по целям", ""]
    for t in targets:
        c = t.counts
        out += [f"### `{t.name}`", "",
                "- Тип: {}{}".format(KIND_RU.get(t.kind, t.kind), f", ОС: {t.os}" if t.os else "")]
        if t.kind == "config":
            # config-скан ищет не CVE, а огрехи Dockerfile/compose — они уже
            # выписаны выше, дублировать нулевые счётчики уязвимостей незачем.
            out += [f"- Ошибок конфигурации: {len(t.misconfigs)} (детали в разделе выше)", ""]
            continue
        out += [f"- Уязвимостей всего: {t.total} (есть исправление: {t.fixable})",
                "- По уровням: крит. {CRITICAL}, выс. {HIGH}, средн. {MEDIUM}, низк. {LOW}".format(**c),
                ""]
        urgent = t.urgent_fixed
        if urgent:
            out += ["Критичные и высокие с исправлением:", "",
                    "| Уровень | Файл | Пакет | Установлено | Исправлено в | CVE | Суть |",
                    "|---|---|---|---|---|---|---|"]
            for sev, where, v in urgent:
                out.append("| {} | `{}` | `{}` | `{}` | `{}` | [{}]({}) | {} |".format(
                    SEV_RU.get(sev, sev), esc(where), esc(v.get("PkgName")), esc(v.get("InstalledVersion")),
                    esc(v.get("FixedVersion")) or "нет", esc(v.get("VulnerabilityID")),
                    v.get("PrimaryURL") or "", trim(v.get("Title") or v.get("Description"), 100)))
            out.append("")
        unfixed = t.urgent_unfixed_by_pkg()
        if unfixed:
            out += ["Критичные и высокие без исправления (крит./выс.): " + ", ".join(
                f"`{esc(pkg)}` {c}/{h}" for pkg, (c, h) in unfixed), ""]
        if not urgent and not unfixed and t.total:
            out += ["Критичных и высоких нет.", ""]

        if t.total:
            out += ["Пакеты с наибольшим числом находок:", ""]
            for pkg, n, fix in t.worst_packages():
                hint = f" — обновить `{fix[0]}` → `{fix[1]}`" if fix else ""
                out.append(f"- `{pkg}`: {n}{hint}")
            out.append("")

    out += ["## Как воспроизвести", "",
            "```bash",
            "# только lock-файлы, с доступным исправлением",
            "trivy fs --scanners vuln --ignore-unfixed --skip-dirs node_modules --skip-dirs src-tauri/target .",
            "# Rust-крейты по базе RustSec (если установлен cargo-audit)",
            "cd src-tauri && cargo audit",
            "```", "",
            "Сырые JSON-результаты лежат рядом с этим отчётом в каталоге `raw/`.", ""]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="raw", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--title", default="Отчёт Trivy: devconsole-hub")
    args = ap.parse_args()

    targets = load(args.raw)
    if not targets:
        print("В каталоге нет JSON-результатов Trivy", file=sys.stderr)
        return 1
    path = pathlib.Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(targets, args.title))
    tot = Counter()
    for t in targets:
        tot.update(t.counts)
    print(f"Отчёт: {path}")
    print("Итого: крит. {}, выс. {}, средн. {}, низк. {}, секретов {}, конфиг {}".format(
        tot["CRITICAL"], tot["HIGH"], tot["MEDIUM"], tot["LOW"],
        sum(len(t.secrets) for t in targets), sum(len(t.misconfigs) for t in targets)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
