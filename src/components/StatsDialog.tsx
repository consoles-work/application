import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ask } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAppStore } from "../stores/appStore";
import { getUsageStats, clearUsageStats, type UsageStat } from "../lib/tauriCommands";
import { flushUsage, localDay, METRICS } from "../lib/usageStats";
import { formatSavedTime } from "../lib/quickCommandStats";
import { getThemeById, resolveThemeId } from "../lib/themes";

// ══════════════════════════════════════
// StatsDialog — статистика использования за сегодня / 7 / 30 дней
// ══════════════════════════════════════
// Данные читаются один раз (30 дней), периоды фильтруются на клиенте.
// Цвет проекта закрепляется по месячному рейтингу, чтобы при смене периода
// проект не перекрашивался.

type Period = "today" | "week" | "month";
const PERIOD_DAYS: Record<Period, number> = { today: 1, week: 7, month: 30 };

// Категориальная палитра (порядок слотов фиксирован), отдельные ступени для тёмной темы
const PALETTE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const PALETTE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const OTHER_COLOR = "#8a8a86";
const MAX_SLICES = PALETTE_LIGHT.length;
const OTHER_ID = "__other__";

function shiftDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDay(d);
}

// «45 сек» / «12 мин» / «2 ч 05 мин»
function formatDuration(sec: number, t: TFunction): string {
  const s = Math.round(sec);
  if (s < 60) return t("stats.durSec", { value: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t("stats.durMin", { value: m });
  return t("stats.durHourMin", { hours: Math.floor(m / 60), minutes: String(m % 60).padStart(2, "0") });
}

interface Slice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function StatsDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { workspaces, settings, showToast } = useAppStore();
  const [rows, setRows] = useState<UsageStat[] | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);

  const dark = getThemeById(resolveThemeId(settings["ui.theme"] ?? "dark")).dark;
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  const nf = (n: number) => Math.round(n).toLocaleString(i18n.language);

  const load = async () => {
    // Сначала сбрасываем накопленное в памяти — иначе последних секунд не будет видно
    await flushUsage();
    try {
      setRows(await getUsageStats(shiftDay(PERIOD_DAYS.month - 1)));
    } catch (e) {
      showToast("error", t("stats.loadError", { error: e }));
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSelectedProject(null), [period]);

  // Имена проектов/консолей из текущего дерева; удалённые — общей подписью
  const names = useMemo(() => {
    const projects = new Map<string, string>();
    const consoles = new Map<string, { name: string; projectId: string }>();
    for (const ws of workspaces) {
      for (const p of ws.projects) {
        projects.set(p.id, `${p.icon} ${p.name}`);
        for (const c of p.consoles) consoles.set(c.id, { name: c.name, projectId: p.id });
      }
    }
    return { projects, consoles };
  }, [workspaces]);
  const projectName = (id: string) =>
    id === OTHER_ID ? t("stats.otherProjects") : names.projects.get(id) ?? t("stats.deletedProject");
  const consoleName = (id: string) => names.consoles.get(id)?.name ?? t("stats.deletedConsole");

  // Цвет проекта — по месячному рейтингу времени (стабилен между периодами)
  const colorByProject = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.metric === METRICS.consoleTime) totals.set(r.projectId, (totals.get(r.projectId) ?? 0) + r.value);
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return new Map(ranked.slice(0, MAX_SLICES).map((id, i) => [id, palette[i]]));
  }, [rows, palette]);

  const data = useMemo(() => {
    const from = shiftDay(PERIOD_DAYS[period] - 1);
    const list = (rows ?? []).filter((r) => r.day >= from);
    const total: Record<string, number> = {};
    const byProject = new Map<string, number>();
    const byConsole = new Map<string, { projectId: string; time: number; typed: number; qcRuns: number; qcChars: number }>();
    const timeline = new Map<string, number>(); // час ("0".."23") или день
    for (const r of list) {
      total[r.metric] = (total[r.metric] ?? 0) + r.value;
      if (r.metric === METRICS.active) {
        const key = period === "today" ? String(r.hour) : r.day;
        timeline.set(key, (timeline.get(key) ?? 0) + r.value);
      }
      if (!r.consoleId) continue;
      if (r.metric === METRICS.consoleTime) byProject.set(r.projectId, (byProject.get(r.projectId) ?? 0) + r.value);
      const c = byConsole.get(r.consoleId) ?? { projectId: r.projectId, time: 0, typed: 0, qcRuns: 0, qcChars: 0 };
      if (r.metric === METRICS.consoleTime) c.time += r.value;
      if (r.metric === METRICS.typed) c.typed += r.value;
      if (r.metric === METRICS.qcRuns) c.qcRuns += r.value;
      if (r.metric === METRICS.qcChars) c.qcChars += r.value;
      byConsole.set(r.consoleId, c);
    }

    // Срезы: проекты с цветом из палитры, остальные — одним серым «Другие»
    const slices: Slice[] = [];
    let other = 0;
    for (const [id, value] of [...byProject.entries()].sort((a, b) => b[1] - a[1])) {
      const color = colorByProject.get(id);
      if (color) slices.push({ id, label: "", value, color });
      else other += value;
    }
    if (other > 0) slices.push({ id: OTHER_ID, label: "", value: other, color: OTHER_COLOR });

    // Столбики: 24 часа сегодня или N дней
    const bars: { key: string; label: string; tip: string; value: number }[] = [];
    if (period === "today") {
      for (let h = 0; h < 24; h++) {
        bars.push({ key: String(h), label: String(h), tip: `${h}:00–${h + 1}:00`, value: timeline.get(String(h)) ?? 0 });
      }
    } else {
      for (let i = PERIOD_DAYS[period] - 1; i >= 0; i--) {
        const day = shiftDay(i);
        const d = new Date(`${day}T00:00:00`);
        bars.push({
          key: day,
          label: String(d.getDate()),
          tip: d.toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" }),
          value: timeline.get(day) ?? 0,
        });
      }
    }

    const consoles = [...byConsole.entries()]
      .map(([id, c]) => ({ id, ...c }))
      .filter((c) => c.time > 0 || c.typed > 0 || c.qcRuns > 0)
      .sort((a, b) => b.time - a.time || b.typed - a.typed);

    return { total, slices, bars, consoles, empty: list.length === 0 };
  }, [rows, period, colorByProject, i18n.language]);

  const m = (k: string) => data.total[k] ?? 0;
  const typed = m(METRICS.typed);
  const qcChars = m(METRICS.qcChars);
  const qcShare = typed + qcChars > 0 ? Math.round((qcChars * 100) / (typed + qcChars)) : 0;

  const handleClear = async () => {
    const ok = await ask(t("stats.clearConfirm"), { title: t("stats.clear"), kind: "warning" });
    if (!ok) return;
    try {
      await clearUsageStats();
      setRows([]);
      showToast("success", t("stats.cleared"));
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const visibleConsoles = (selectedProject
    ? data.consoles.filter((c) =>
        selectedProject === OTHER_ID ? !colorByProject.has(c.projectId) : c.projectId === selectedProject
      )
    : data.consoles
  ).slice(0, 12);
  const maxConsoleTime = Math.max(1, ...visibleConsoles.map((c) => c.time));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[820px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header: заголовок, периоды, закрыть */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">{t("stats.title")}</h2>
          <div className="flex rounded-lg border border-border overflow-hidden ml-2">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                className={`px-3 py-1 text-xs transition-colors ${
                  period === p ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-surface-2"
                }`}
                onClick={() => setPeriod(p)}
              >
                {t(`stats.period.${p}`)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button className="text-text-muted hover:text-text-primary text-base leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {rows === null ? (
            <div className="text-xs text-text-muted py-10 text-center">{t("stats.loading")}</div>
          ) : data.empty ? (
            <div className="text-xs text-text-muted py-10 text-center">{t("stats.empty")}</div>
          ) : (
            <>
              {/* ── Плитки-итоги ── */}
              <div className="grid grid-cols-3 gap-2">
                <Tile
                  label={t("stats.activeTime")}
                  value={formatDuration(m(METRICS.active), t)}
                  sub={t("stats.appOpen", { time: formatDuration(m(METRICS.appOpen), t) })}
                />
                <Tile
                  label={t("stats.savedByQuick")}
                  value={formatSavedTime(qcChars, t)}
                  sub={t("stats.savedSub", { runs: nf(m(METRICS.qcRuns)), share: qcShare })}
                />
                <Tile
                  label={t("stats.typed")}
                  value={nf(typed)}
                  sub={t("stats.typedSub", { pasted: nf(m(METRICS.pasted)) })}
                />
                <Tile
                  label={t("stats.commands")}
                  value={nf(m(METRICS.enters))}
                  sub={t("stats.commandsSub")}
                />
                <Tile
                  label={t("stats.sessions")}
                  value={nf(m(METRICS.sessions))}
                  sub={t("stats.outputSub", { chars: nf(m(METRICS.output)) })}
                />
                <Tile
                  label={t("stats.aiMessages")}
                  value={nf(m(METRICS.aiMessages))}
                  sub={t("stats.wikiSub", { edits: nf(m(METRICS.wikiEdits)) })}
                />
              </div>

              {/* ── Время по проектам (кольцо) + легенда ── */}
              <section className="bg-surface-0 border border-border rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-xs font-semibold text-text-primary">{t("stats.byProject")}</h3>
                  <span className="text-2xs text-text-muted">{t("stats.byProjectHint")}</span>
                </div>
                {data.slices.length === 0 ? (
                  <div className="text-2xs text-text-muted py-6 text-center">{t("stats.noConsoleTime")}</div>
                ) : (
                  <div className="flex gap-6 items-center">
                    <Donut
                      slices={data.slices}
                      hover={hoverSlice}
                      selected={selectedProject}
                      onHover={setHoverSlice}
                      onSelect={(id) => setSelectedProject((cur) => (cur === id ? null : id))}
                      centerLabel={(s, total) =>
                        s
                          ? { title: projectName(s.id), value: formatDuration(s.value, t), sub: `${Math.round((s.value * 100) / total)}%` }
                          : { title: t("stats.total"), value: formatDuration(total, t), sub: "" }
                      }
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {(() => {
                        const total = data.slices.reduce((a, s) => a + s.value, 0);
                        return data.slices.map((s) => {
                          const active = selectedProject === s.id;
                          const dim = (hoverSlice && hoverSlice !== s.id) || (selectedProject && !active);
                          return (
                            <button
                              key={s.id}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-opacity ${
                                active ? "bg-surface-2" : "hover:bg-surface-2"
                              } ${dim ? "opacity-50" : ""}`}
                              onMouseEnter={() => setHoverSlice(s.id)}
                              onMouseLeave={() => setHoverSlice(null)}
                              onClick={() => setSelectedProject((cur) => (cur === s.id ? null : s.id))}
                            >
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                              <span className="flex-1 truncate text-text-primary">{projectName(s.id)}</span>
                              <span className="text-text-secondary tabular-nums">{formatDuration(s.value, t)}</span>
                              <span className="w-10 text-right text-text-muted tabular-nums">
                                {Math.round((s.value * 100) / total)}%
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </section>

              {/* ── Активное время по часам / дням ── */}
              <section className="bg-surface-0 border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold text-text-primary mb-3">
                  {period === "today" ? t("stats.byHour") : t("stats.byDay")}
                </h3>
                <Bars bars={data.bars} color={palette[0]} format={(v) => formatDuration(v, t)} />
              </section>

              {/* ── Консоли (фильтр по выбранному проекту) ── */}
              <section className="bg-surface-0 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-text-primary">
                    {selectedProject
                      ? t("stats.consolesOf", { project: projectName(selectedProject) })
                      : t("stats.consoles")}
                  </h3>
                  {selectedProject && (
                    <button className="text-2xs text-accent hover:underline" onClick={() => setSelectedProject(null)}>
                      {t("stats.showAll")}
                    </button>
                  )}
                </div>
                {visibleConsoles.length === 0 ? (
                  <div className="text-2xs text-text-muted py-3 text-center">{t("stats.noConsoleTime")}</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-2xs text-text-muted text-left">
                        <th className="font-normal pb-1">{t("stats.colConsole")}</th>
                        <th className="font-normal pb-1 w-[38%]">{t("stats.colTime")}</th>
                        <th className="font-normal pb-1 text-right">{t("stats.colTyped")}</th>
                        <th className="font-normal pb-1 text-right">{t("stats.colQuick")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleConsoles.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="py-1.5 pr-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ backgroundColor: colorByProject.get(c.projectId) ?? OTHER_COLOR }}
                              />
                              <span className="truncate text-text-primary">{consoleName(c.id)}</span>
                            </div>
                            <div className="text-2xs text-text-muted truncate pl-3.5">{projectName(c.projectId)}</div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(c.time * 100) / maxConsoleTime}%`,
                                    backgroundColor: colorByProject.get(c.projectId) ?? OTHER_COLOR,
                                  }}
                                />
                              </div>
                              <span className="w-20 text-right text-text-secondary tabular-nums">
                                {formatDuration(c.time, t)}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 text-right text-text-secondary tabular-nums">{nf(c.typed)}</td>
                          <td className="py-1.5 text-right text-text-secondary tabular-nums">
                            {c.qcRuns > 0 ? `${nf(c.qcRuns)} · ${formatSavedTime(c.qcChars, t)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-border shrink-0">
          <span className="text-2xs text-text-muted flex-1">{t("stats.footer")}</span>
          <button className="text-2xs text-text-secondary hover:text-text-primary" onClick={load}>
            {t("stats.refresh")}
          </button>
          <button className="text-2xs text-red-400 hover:text-red-300" onClick={handleClear}>
            {t("stats.clear")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 min-w-0">
      <div className="text-2xs text-text-muted truncate">{label}</div>
      <div className="text-lg font-semibold text-text-primary tabular-nums leading-tight mt-0.5 truncate">{value}</div>
      <div className="text-2xs text-text-secondary truncate mt-0.5" title={sub}>{sub}</div>
    </div>
  );
}

// ── Кольцевая диаграмма: наведение — подсветка и подпись в центре, клик — выбор ──

function Donut({
  slices,
  hover,
  selected,
  onHover,
  onSelect,
  centerLabel,
}: {
  slices: Slice[];
  hover: string | null;
  selected: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  centerLabel: (s: Slice | null, total: number) => { title: string; value: string; sub: string };
}) {
  const size = 180;
  const c = size / 2;
  const rOuter = 86;
  const rInner = 56;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const focus = slices.find((s) => s.id === (hover ?? selected)) ?? null;
  const label = centerLabel(focus, total);

  const point = (r: number, a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
  let angle = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s) => {
          const start = angle;
          const sweep = (s.value / total) * Math.PI * 2;
          angle += sweep;
          const isFocus = focus?.id === s.id;
          const ro = isFocus ? rOuter + 4 : rOuter;
          const dim = focus && !isFocus;
          // Один срез на весь круг SVG-дугой не нарисовать — рисуем кольцо
          if (slices.length === 1) {
            return (
              <circle
                key={s.id}
                cx={c}
                cy={c}
                r={(ro + rInner) / 2}
                fill="none"
                stroke={s.color}
                strokeWidth={ro - rInner}
                className="cursor-pointer"
                onMouseEnter={() => onHover(s.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(s.id)}
              />
            );
          }
          const end = start + sweep;
          const large = sweep > Math.PI ? 1 : 0;
          const [x1, y1] = point(ro, start);
          const [x2, y2] = point(ro, end);
          const [x3, y3] = point(rInner, end);
          const [x4, y4] = point(rInner, start);
          const d = `M${x1},${y1} A${ro},${ro} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`;
          return (
            <path
              key={s.id}
              d={d}
              fill={s.color}
              // Зазор между сегментами цветом фона
              stroke="var(--surface-0)"
              strokeWidth={2}
              opacity={dim ? 0.45 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(s.id)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-12 text-center">
        <div className="text-2xs text-text-muted truncate max-w-full">{label.title}</div>
        <div className="text-sm font-semibold text-text-primary tabular-nums">{label.value}</div>
        {label.sub && <div className="text-2xs text-text-secondary tabular-nums">{label.sub}</div>}
      </div>
    </div>
  );
}

// ── Столбики с подсказкой при наведении ──

function Bars({
  bars,
  color,
  format,
}: {
  bars: { key: string; label: string; tip: string; value: number }[];
  color: string;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ i: number; rect: DOMRect } | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  // Подписи оси X: не больше ~12, чтобы не слипались
  const step = Math.ceil(bars.length / 12);
  const h = 120;

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: h }}>
        {bars.map((b, i) => (
          <div
            key={b.key}
            className="flex-1 h-full flex items-end cursor-default"
            onMouseEnter={(e) => setHover({ i, rect: e.currentTarget.getBoundingClientRect() })}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: b.value > 0 ? Math.max(2, (b.value / max) * h) : 0,
                backgroundColor: color,
                opacity: hover && hover.i !== i ? 0.5 : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="h-px bg-border" />
      <div className="flex gap-[2px] mt-1">
        {bars.map((b, i) => (
          <div key={b.key} className="flex-1 text-center text-2xs text-text-muted tabular-nums">
            {i % step === 0 ? b.label : ""}
          </div>
        ))}
      </div>
      {hover &&
        createPortal(
          <div
            className="fixed z-[60] pointer-events-none bg-surface-2 border border-border rounded-md shadow-xl px-2 py-1 text-2xs"
            style={{ left: hover.rect.left + hover.rect.width / 2, top: hover.rect.top - 8, transform: "translate(-50%, -100%)" }}
          >
            <div className="text-text-muted">{bars[hover.i].tip}</div>
            <div className="text-text-primary font-semibold tabular-nums">{format(bars[hover.i].value)}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
