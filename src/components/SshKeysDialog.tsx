import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertTriangle, ChevronDown, ChevronRight, CircleCheck, Copy, Info, KeyRound, LocateFixed,
  Lock, LockOpen, Pencil, Plus, RefreshCw, ShieldAlert, Wrench,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useEscape } from "../hooks/useEscape";
import { fixSshPermissions, generateSshKey, scanSshKeys } from "../lib/tauriCommands";
import {
  auditSsh, consoleKeyPaths, formatMode, permsTooOpen, scoreLevel, worst, SEVERITY_ORDER,
  type ConfigRow, type ConsoleRef, type ConsoleRow, type KeyRow, type Severity, type SshAudit, type SshIssue,
} from "../lib/sshAudit";
import { ConsoleIcon } from "../lib/consoleIcons";
import { EditConsoleDialog } from "./dialogs/EditConsoleDialog";
import { UnderlineTabs } from "./UnderlineTabs";
import type { ConsoleConfig, SshKeyFile, SshKeysReport } from "../types";

// ══════════════════════════════════════
// SshKeysDialog — раздел «SSH-ключи»: инвентаризация и аудит
// ══════════════════════════════════════
// Всё локально: ~/.ssh, ~/.ssh/config, ssh-agent и настройки консолей.
// К серверам не подключаемся. Пишем на диск только по кнопке:
// «Исправить права» (chmod) и «Создать ключ» (новый файл в ~/.ssh).
//
// 1. Открытие: скан бэкендом (ключи из ~/.ssh и из консолей, конфиг, агент),
//    затем аудит на фронте (sshAudit.ts). Не просканировалось — тост.
// 2. Вкладки: проблемы (с переходом к ключу, консоли, блоку конфига), ключи,
//    SSH-консоли, блоки ~/.ssh/config.
// 3. После исправления прав, создания ключа и правки консоли — повторный скан:
//    файлы и пути могли измениться.
// 4. «Перейти к консоли» раскрывает её в дереве и закрывает окно.
// Escape закрывает окно, но не поверх диалога редактирования консоли.

type Tab = "issues" | "keys" | "consoles" | "config";

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-sky-500",
};
const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
};
const SEVERITY_FLAG: Record<Severity, string> = {
  critical: "text-red-500 border-red-500/40",
  warning: "text-amber-500 border-amber-500/40",
  info: "text-sky-500 border-sky-500/40",
};
const SEVERITY_ICON: Record<Severity, typeof Info> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};
const SCORE_CLS = {
  strong: "text-emerald-500 border-emerald-500/40",
  ok: "text-sky-500 border-sky-500/40",
  weak: "text-amber-500 border-amber-500/40",
  unsafe: "text-red-500 border-red-500/40",
};

const inputCls =
  "w-full bg-surface-0 border border-border rounded-md px-2 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent";
const btnCls =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs text-text-secondary border border-border hover:bg-surface-2 hover:text-text-primary";

export function SshKeysDialog({ onClose, onAudit }: { onClose: () => void; onAudit?: (audit: SshAudit) => void }) {
  const { t, i18n } = useTranslation();
  const { workspaces, showToast, selectNode, toggleNodeExpanded, showTreePanel, setShowTreePanel } = useAppStore();
  const [report, setReport] = useState<SshKeysReport | null>(null);
  const [tab, setTab] = useState<Tab>("issues");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [highlightConfig, setHighlightConfig] = useState<number | null>(null);
  const [editConsole, setEditConsole] = useState<ConsoleConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. Скан и аудит.
  const load = async () => {
    setLoading(true);

    try {
      setReport(await scanSshKeys(consoleKeyPaths(useAppStore.getState().workspaces)));
    } catch (e) {
      showToast("error", t("sshKeys.loadError", { error: e }));
    } finally {
      setLoading(false);
    }
  };

  // Скан — один раз при открытии; повторный — по кнопке и после изменений (шаг 3)
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEscape(onClose, !editConsole);

  const audit = useMemo(() => (report ? auditSsh(report, workspaces) : null), [report, workspaces]);

  // Индикатор у кнопки в заголовке окна; onAudit — колбэк родителя, его смена аудит не повторяет
  useEffect(() => {
    if (audit) onAudit?.(audit);
  }, [audit]); // eslint-disable-line react-hooks/exhaustive-deps

  const consoleById = useMemo(() => new Map((audit?.consoles ?? []).map((r) => [r.console.id, r])), [audit]);
  const keyByPath = useMemo(() => new Map((audit?.keys ?? []).map((r) => [r.key.path, r])), [audit]);

  const s = audit?.summary;
  const problems = audit ? audit.counts.critical + audit.counts.warning : 0;

  // ── Действия ──
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);

      showToast("success", t("sshKeys.copied", { what }));
    } catch (e) {
      showToast("error", String(e));
    }
  };

  // 3. Исправить права и пересканировать.
  const fixPerms = async (path: string) => {
    try {
      await fixSshPermissions(path);

      showToast("success", t("sshKeys.permsFixed"));

      await load();
    } catch (e) {
      showToast("error", t("sshKeys.permsFixError", { error: e }));
    }
  };

  // 4. Консоль в дереве: раскрыть воркспейс и проект, показать дерево, выбрать консоль.
  const goToConsole = (ref: ConsoleRef) => {
    if (!ref.workspace.isExpanded) toggleNodeExpanded("workspace", ref.workspace.id);
    if (!ref.project.isExpanded) toggleNodeExpanded("project", ref.project.id);
    if (!showTreePanel) setShowTreePanel(true);

    selectNode({ type: "console", id: ref.console.id });

    onClose();
  };

  const showKey = (path: string) => {
    setTab("keys");
    setExpandedKey(path);
    setCreating(false);
  };

  const showConfig = (index: number) => {
    setTab("config");
    setHighlightConfig(index);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[920px] max-w-[95vw] h-[86vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <KeyRound className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">{t("sshKeys.title")}</h2>
          <span className="text-2xs text-text-muted truncate">{t("sshKeys.subtitle")}</span>
          <div className="flex-1" />
          <button className={btnCls} onClick={load} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {t("sshKeys.refresh")}
          </button>
          <button className="text-text-muted hover:text-text-primary text-base leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        {!audit || !s ? (
          <div className="flex-1 text-xs text-text-muted py-10 text-center">{t("sshKeys.loading")}</div>
        ) : (
          <>
            {/* Сводка */}
            <div className="grid grid-cols-4 gap-2 px-5 pt-4 shrink-0">
              <Tile
                label={t("sshKeys.tileKeys")}
                value={String(s.keys)}
                sub={t("sshKeys.tileKeysSub", { agent: s.inAgent, agentState: t(`sshKeys.agent.${report!.agentStatus}`) })}
              />
              <Tile
                label={t("sshKeys.tileNoPassphrase")}
                value={String(s.noPassphrase)}
                sub={t("sshKeys.tileNoPassphraseSub", { total: s.withPrivate })}
                tone={s.noPassphrase > 0 ? "warning" : undefined}
              />
              <Tile
                label={t("sshKeys.tileProblems")}
                value={String(problems)}
                sub={t("sshKeys.tileProblemsSub", { critical: audit.counts.critical, info: audit.counts.info })}
                tone={problemsTone(audit.counts.critical, problems)}
              />
              <Tile
                label={t("sshKeys.tileConsoles")}
                value={String(s.consolesWithoutOwnKey)}
                sub={t("sshKeys.tileConsolesSub", { total: s.sshConsoles })}
              />
            </div>

            <div className="px-5 pt-3 shrink-0">
              <UnderlineTabs<Tab>
                tabs={[
                  { id: "issues", label: t("sshKeys.tabIssues", { count: audit.issues.length }) },
                  { id: "keys", label: t("sshKeys.tabKeys", { count: s.keys }) },
                  { id: "consoles", label: t("sshKeys.tabConsoles", { count: s.sshConsoles }) },
                  { id: "config", label: t("sshKeys.tabConfig", { count: audit.config.length }) },
                ]}
                active={tab}
                onChange={(id) => { setTab(id); setHighlightConfig(null); }}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "issues" && (
                <IssuesTab
                  audit={audit}
                  t={t}
                  keyByPath={keyByPath}
                  consoleById={consoleById}
                  onShowKey={showKey}
                  onShowConfig={showConfig}
                  onEditConsole={(c) => setEditConsole(c)}
                  onGoToConsole={goToConsole}
                  onFixPerms={fixPerms}
                />
              )}
              {tab === "keys" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-text-muted flex-1">{t("sshKeys.keysHint", { dir: report!.sshDir })}</span>
                    {!creating && (
                      <button className={btnCls} onClick={() => setCreating(true)}>
                        <Plus className="w-3 h-3" />
                        {t("sshKeys.create")}
                      </button>
                    )}
                  </div>
                  {creating && (
                    <CreateKeyForm
                      t={t}
                      existing={new Set(report!.keys.filter((k) => k.inSshDir).map((k) => k.name))}
                      onCancel={() => setCreating(false)}
                      onCreated={async (path) => {
                        setCreating(false);
                        await load();
                        setExpandedKey(path);
                      }}
                    />
                  )}
                  {audit.keys.length === 0 && !creating && (
                    <div className="text-xs text-text-muted py-8 text-center">{t("sshKeys.noKeys")}</div>
                  )}
                  {audit.keys.map((row) => (
                    <KeyCard
                      key={row.key.path}
                      row={row}
                      t={t}
                      lang={i18n.language}
                      audit={audit}
                      expanded={expandedKey === row.key.path}
                      onToggle={() => setExpandedKey((cur) => (cur === row.key.path ? null : row.key.path))}
                      onCopy={copy}
                      onFixPerms={fixPerms}
                      onGoToConsole={goToConsole}
                      onShowConfig={showConfig}
                    />
                  ))}
                </div>
              )}
              {tab === "consoles" && (
                <ConsolesTab
                  rows={audit.consoles}
                  audit={audit}
                  t={t}
                  onEdit={(c) => setEditConsole(c)}
                  onGoTo={goToConsole}
                  onShowKey={showKey}
                />
              )}
              {tab === "config" && (
                <ConfigTab report={report!} rows={audit.config} t={t} highlight={highlightConfig} onGoTo={goToConsole} />
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-border shrink-0">
          <span className="text-2xs text-text-muted flex-1">{t("sshKeys.footer")}</span>
        </div>
      </div>

      {editConsole && (
        <EditConsoleDialog
          console_={editConsole}
          onClose={() => {
            setEditConsole(null);
            // Путь ключа мог поменяться — новый файл надо просканировать
            load();
          }}
        />
      )}
    </div>
  );
}

/** Для заголовка окна: скан + аудит без открытия окна (индикатор у кнопки) */
export async function quickSshAudit(): Promise<SshAudit> {
  const workspaces = useAppStore.getState().workspaces;

  const report = await scanSshKeys(consoleKeyPaths(workspaces));

  return auditSsh(report, workspaces);
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: Severity }) {
  return (
    <div className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 min-w-0">
      <div className="text-2xs text-text-muted truncate">{label}</div>
      <div className={`text-lg font-semibold tabular-nums leading-tight mt-0.5 truncate ${tone ? SEVERITY_TEXT[tone] : "text-text-primary"}`}>
        {value}
      </div>
      <div className="text-2xs text-text-secondary truncate mt-0.5" title={sub}>{sub}</div>
    </div>
  );
}

// ── Проблемы ──

function IssuesTab({
  audit, t, keyByPath, consoleById, onShowKey, onShowConfig, onEditConsole, onGoToConsole, onFixPerms,
}: {
  audit: SshAudit;
  t: TFunction;
  keyByPath: Map<string, KeyRow>;
  consoleById: Map<string, ConsoleRow>;
  onShowKey: (path: string) => void;
  onShowConfig: (index: number) => void;
  onEditConsole: (c: ConsoleConfig) => void;
  onGoToConsole: (ref: ConsoleRef) => void;
  onFixPerms: (path: string) => void;
}) {
  if (audit.issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-xs text-text-muted">
        <CircleCheck className="w-6 h-6 text-emerald-500" />
        {t("sshKeys.noIssues")}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {audit.issues.map((issue) => {
        const keyRow = issue.keyPath ? keyByPath.get(issue.keyPath) : undefined;
        const con = issue.consoleId ? consoleById.get(issue.consoleId) : undefined;
        const cfg = issue.configIndex !== undefined ? audit.config[issue.configIndex] : undefined;
        return (
          <div key={issue.id} className={`bg-surface-0 border border-border border-l-2 ${SEVERITY_BORDER[issue.severity]} rounded-lg px-3 py-2.5`}>
            <div className="flex items-start gap-2">
              <SeverityIcon severity={issue.severity} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary">{t(`sshKeys.issue.${issue.code}.title`, issue.params)}</div>
                <div className="text-2xs text-text-secondary mt-0.5">{t(`sshKeys.issue.${issue.code}.why`, issue.params)}</div>
                <div className="text-2xs text-text-muted mt-0.5">
                  <span className="font-medium">{t("sshKeys.fixLabel")}</span> {t(`sshKeys.issue.${issue.code}.fix`, issue.params)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {keyRow && (
                    <button className={btnCls} onClick={() => onShowKey(keyRow.key.path)}>
                      <KeyRound className="w-3 h-3" />
                      <span className="font-mono">{keyRow.key.displayPath}</span>
                    </button>
                  )}
                  {con && (
                    <>
                      <span className="text-2xs text-text-muted truncate">{refPath(con)} ›</span>
                      <button className={btnCls} onClick={() => onEditConsole(con.console)}>
                        <Pencil className="w-3 h-3" />
                        {con.console.name}
                      </button>
                      <button className={btnCls} onClick={() => onGoToConsole(con)} title={t("sshKeys.goToConsole")}>
                        <LocateFixed className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {cfg && (
                    <button className={btnCls} onClick={() => onShowConfig(cfg.index)}>
                      <span className="font-mono">Host {cfg.host.patterns.join(" ")}</span>
                      <span className="text-text-muted">{cfg.host.file}:{cfg.host.line}</span>
                    </button>
                  )}
                  {issue.fixPermissions && (
                    <button className={btnCls} onClick={() => onFixPerms(issue.fixPermissions!)}>
                      <Wrench className="w-3 h-3" />
                      {t("sshKeys.fixPerms")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ключи ──

function KeyBadges({ row, t }: { row: KeyRow; t: TFunction }) {
  const k = row.key;
  const level = scoreLevel(row.score);
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {k.keyType && (
        <span className="text-2xs font-mono text-text-secondary border border-border rounded px-1.5 py-px">
          {k.keyType}{k.bits ? ` ${k.bits}` : ""}
        </span>
      )}
      {k.keyType && (
        <span className={`text-2xs border rounded px-1.5 py-px tabular-nums ${SCORE_CLS[level]}`} title={t("sshKeys.scoreHint")}>
          {t(`sshKeys.score.${level}`)} · {row.score}
        </span>
      )}
      {k.privateExists && k.encrypted !== null && (
        <span
          className={`inline-flex items-center gap-1 text-2xs ${k.encrypted ? "text-emerald-500" : "text-amber-500"}`}
          title={k.encrypted ? t("sshKeys.encrypted") : t("sshKeys.notEncrypted")}
        >
          {k.encrypted ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
        </span>
      )}
      {k.agentLoaded && (
        <span className="text-2xs text-accent border border-accent/40 rounded px-1.5 py-px">{t("sshKeys.inAgent")}</span>
      )}
    </div>
  );
}

function KeyCard({
  row, t, lang, audit, expanded, onToggle, onCopy, onFixPerms, onGoToConsole, onShowConfig,
}: {
  row: KeyRow;
  t: TFunction;
  lang: string;
  audit: SshAudit;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string, what: string) => void;
  onFixPerms: (path: string) => void;
  onGoToConsole: (ref: ConsoleRef) => void;
  onShowConfig: (index: number) => void;
}) {
  const k = row.key;
  const usedBy = row.consoles.length + row.defaultConsoles.length;
  const field = (label: string, value: React.ReactNode) => (
    <>
      <div className="text-2xs text-text-muted">{label}</div>
      <div className="text-2xs text-text-primary font-mono break-all">{value}</div>
    </>
  );
  return (
    <div className="bg-surface-0 border border-border rounded-lg">
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        <KeyRound className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-mono text-text-primary truncate">{k.name}</span>
        {!k.inSshDir && <span className="text-2xs text-text-muted truncate">{k.displayPath}</span>}
        <WorstDot issues={row.issues} />
        <div className="flex-1" />
        <span className="text-2xs text-text-muted shrink-0">
          {usedBy > 0 ? t("sshKeys.usedBy", { count: usedBy }) : t("sshKeys.notUsed")}
        </span>
        <KeyBadges row={row} t={t} />
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          <div className="flex gap-4">
            <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 flex-1 min-w-0 content-start">
              {field(t("sshKeys.fPath"), k.displayPath)}
              {field(t("sshKeys.fFingerprint"), k.fingerprint || "—")}
              {field(t("sshKeys.fComment"), k.comment || "—")}
              {field(t("sshKeys.fPassphrase"), passphraseText(k, t))}
              {field(t("sshKeys.fFormat"), [k.privateFormat || "—", k.publicExists ? ".pub" : t("sshKeys.noPub"), k.hasCertificate ? "cert" : ""].filter(Boolean).join(" · "))}
              {field(t("sshKeys.fMode"), (
                <span className={k.privateExists && permsTooOpen(k.mode) ? "text-red-500" : ""}>{k.privateExists ? formatMode(k.mode) : "—"}</span>
              ))}
              {field(t("sshKeys.fModified"), formatDate(k.modified, lang))}
              {field(t("sshKeys.fAgent"), k.agentLoaded ? t("sshKeys.yes") : t("sshKeys.no"))}
              {k.error && field(t("sshKeys.fError"), k.error)}
            </div>
            {k.randomart && (
              <pre className="text-[10px] leading-[1.15] font-mono text-text-secondary bg-surface-1 border border-border rounded-md px-2 py-1.5 shrink-0" title={t("sshKeys.randomartHint")}>
                {k.randomart}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {k.publicKey && (
              <button className={btnCls} onClick={() => onCopy(k.publicKey, t("sshKeys.whatPublic"))}>
                <Copy className="w-3 h-3" />
                {t("sshKeys.copyPublic")}
              </button>
            )}
            {k.fingerprint && (
              <button className={btnCls} onClick={() => onCopy(k.fingerprint, t("sshKeys.whatFingerprint"))}>
                <Copy className="w-3 h-3" />
                {t("sshKeys.copyFingerprint")}
              </button>
            )}
            {k.privateExists && permsTooOpen(k.mode) && (
              <button className={btnCls} onClick={() => onFixPerms(k.path)}>
                <Wrench className="w-3 h-3" />
                {t("sshKeys.fixPerms")}
              </button>
            )}
          </div>

          {row.issues.length > 0 && (
            <div className="space-y-1">
              {row.issues.map((i) => (
                <div key={i.id} className="flex items-start gap-1.5 text-2xs text-text-secondary">
                  <SeverityIcon severity={i.severity} size={12} />
                  <span>{t(`sshKeys.issue.${i.code}.title`, i.params)}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-2xs font-medium text-text-primary mb-1">{t("sshKeys.usedByTitle")}</div>
            {usedBy === 0 && row.configHosts.length === 0 && <div className="text-2xs text-text-muted">{t("sshKeys.notUsedLong")}</div>}
            <div className="space-y-0.5">
              {[...row.consoles.map((r) => ({ r, def: false })), ...row.defaultConsoles.map((r) => ({ r, def: true }))].map(({ r, def }) => (
                <button
                  key={r.console.id}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-surface-2"
                  onClick={() => onGoToConsole(r)}
                  title={t("sshKeys.goToConsole")}
                >
                  <ConsoleIcon con={r.console} size={12} />
                  <span className="text-2xs text-text-primary truncate">{r.console.name}</span>
                  {r.console.isDanger && <span className="text-2xs text-red-500">⚠</span>}
                  <span className="text-2xs text-text-muted truncate">{refPath(r)}</span>
                  <div className="flex-1" />
                  {def && <span className="text-2xs text-text-muted">{t("sshKeys.viaDefault")}</span>}
                </button>
              ))}
              {row.configHosts.map((i) => (
                <button
                  key={`cfg-${i}`}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-surface-2"
                  onClick={() => onShowConfig(i)}
                >
                  <span className="text-2xs font-mono text-text-primary truncate">Host {audit.config[i]?.host.patterns.join(" ")}</span>
                  <div className="flex-1" />
                  <span className="text-2xs text-text-muted">{t("sshKeys.viaConfig")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateKeyForm({
  t, existing, onCancel, onCreated,
}: {
  t: TFunction;
  existing: Set<string>;
  onCancel: () => void;
  onCreated: (path: string) => void;
}) {
  const { showToast } = useAppStore();
  const [name, setName] = useState(() => freeKeyName(existing));
  const [comment, setComment] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const nameOk = /^[A-Za-z0-9_.@-]{1,64}$/.test(name) && !name.startsWith(".") && !name.endsWith(".pub");
  const clash = existing.has(name);
  const mismatch = pass !== pass2;
  const canSubmit = nameOk && !clash && !mismatch && !busy;

  // Проверки имени — те же, что в ssh_keys.rs (is_valid_key_name): бэкенд всё равно откажет
  const submit = async () => {
    if (!canSubmit) return;

    setBusy(true);

    try {
      const key = await generateSshKey(name, comment, pass);

      showToast("success", t("sshKeys.created", { path: key.displayPath }));

      onCreated(key.path);
    } catch (e) {
      showToast("error", t("sshKeys.createError", { error: e }));

      setBusy(false);
    }
  };

  const fillRandom = () => {
    const p = randomPassphrase();

    setPass(p);
    setPass2(p);
    setShow(true);
  };

  return (
    <div className="bg-surface-0 border border-accent/40 rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-text-primary">{t("sshKeys.createTitle")}</div>
      <div className="text-2xs text-text-muted">{t("sshKeys.createHint")}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-2xs text-text-primary mb-1">{t("sshKeys.createName")}</div>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          {(!nameOk || clash) && (
            <div className="text-2xs text-red-500 mt-0.5">{clash ? t("sshKeys.createClash") : t("sshKeys.createBadName")}</div>
          )}
        </div>
        <div>
          <div className="text-2xs text-text-primary mb-1">{t("sshKeys.createComment")}</div>
          <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("sshKeys.createCommentPlaceholder")} />
        </div>
        <div>
          <div className="text-2xs text-text-primary mb-1">{t("sshKeys.createPassphrase")}</div>
          <div className="flex gap-1">
            <input className={inputCls} type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} />
            <button
              type="button"
              className={btnCls}
              onClick={fillRandom}
              title={t("sshKeys.createGenerateHint")}
            >
              {t("sshKeys.createGenerate")}
            </button>
          </div>
        </div>
        <div>
          <div className="text-2xs text-text-primary mb-1">{t("sshKeys.createRepeat")}</div>
          <div className="flex gap-1">
            <input className={inputCls} type={show ? "text" : "password"} value={pass2} onChange={(e) => setPass2(e.target.value)} />
            <button type="button" className={btnCls} onClick={() => setShow((v) => !v)}>
              {show ? t("settings.agentsHideKey") : t("settings.agentsShowKey")}
            </button>
          </div>
          {mismatch && pass2 !== "" && <div className="text-2xs text-red-500 mt-0.5">{t("sshKeys.createMismatch")}</div>}
        </div>
      </div>
      {pass === "" ? (
        <div className="text-2xs text-amber-500">{t("sshKeys.createNoPassphrase")}</div>
      ) : (
        <div className="text-2xs text-text-muted">{t("sshKeys.createRemember")}</div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button className={btnCls} onClick={onCancel}>{t("common.cancel")}</button>
        <button
          className="px-3 py-1 rounded-md text-2xs bg-accent text-white disabled:opacity-40"
          disabled={!canSubmit}
          onClick={submit}
        >
          {busy ? t("sshKeys.creating") : t("sshKeys.createSubmit")}
        </button>
      </div>
    </div>
  );
}

// ── Консоли ──

function ConsolesTab({
  rows, audit, t, onEdit, onGoTo, onShowKey,
}: {
  rows: ConsoleRow[];
  audit: SshAudit;
  t: TFunction;
  onEdit: (c: ConsoleConfig) => void;
  onGoTo: (ref: ConsoleRef) => void;
  onShowKey: (path: string) => void;
}) {
  if (rows.length === 0) return <div className="text-xs text-text-muted py-8 text-center">{t("sshKeys.noConsoles")}</div>;
  return (
    <table className="w-full text-2xs">
      <thead>
        <tr className="text-text-muted text-left">
          <th className="font-normal pb-1.5">{t("sshKeys.colConsole")}</th>
          <th className="font-normal pb-1.5">{t("sshKeys.colHost")}</th>
          <th className="font-normal pb-1.5">{t("sshKeys.colKey")}</th>
          <th className="font-normal pb-1.5">{t("sshKeys.colFlags")}</th>
          <th className="pb-1.5" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const c = r.console;
          const shown = r.effective.slice(0, 3);
          return (
            <tr key={c.id} className="border-t border-border align-top">
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-1.5">
                  <WorstDot issues={r.issues} />
                  <ConsoleIcon con={c} size={12} />
                  <span className="text-text-primary truncate max-w-[180px]" title={r.issues.map((i) => t(`sshKeys.issue.${i.code}.title`, i.params)).join("\n")}>
                    {c.name}
                  </span>
                  {c.isDanger && <span className="text-red-500" title={c.dangerLabel}>⚠</span>}
                </div>
                <div className="text-text-muted truncate max-w-[240px]">{refPath(r)}</div>
              </td>
              <td className="py-1.5 pr-2 font-mono text-text-secondary break-all">
                {c.sshUser ? `${c.sshUser}@` : ""}{c.sshHost}{c.sshPort && c.sshPort !== 22 ? `:${c.sshPort}` : ""}
              </td>
              <td className="py-1.5 pr-2">
                {r.passwordOnly && <span className="text-amber-500">{t("sshKeys.viaPassword")}</span>}
                {!r.passwordOnly && shown.length === 0 && <span className="text-text-muted">{t("sshKeys.viaAgentOnly")}</span>}
                {!r.passwordOnly &&
                  shown.map((e) => (
                    <div key={e.path} className="flex items-center gap-1.5">
                      {e.key && (e.key.privateExists || e.key.publicExists) ? (
                        <button className="font-mono text-text-primary hover:text-accent truncate max-w-[160px]" onClick={() => onShowKey(e.path)}>
                          {e.key.name}
                        </button>
                      ) : (
                        <span className="font-mono text-red-500 truncate max-w-[160px]">{e.path.split("/").pop()}</span>
                      )}
                      {e.key?.privateExists && e.key.encrypted === false && <LockOpen className="w-3 h-3 text-amber-500" />}
                      {e.key?.encrypted && <Lock className="w-3 h-3 text-emerald-500" />}
                      <span className="text-text-muted">{t(`sshKeys.via.${e.via}`)}</span>
                    </div>
                  ))}
                {r.effective.length > shown.length && <div className="text-text-muted">+{r.effective.length - shown.length}</div>}
              </td>
              <td className="py-1.5 pr-2">
                <div className="flex flex-wrap gap-1">
                  {r.forwardAgent && <Flag tone="warning">ForwardAgent</Flag>}
                  {r.noHostCheck && <Flag tone="warning">{t("sshKeys.flagNoHostCheck")}</Flag>}
                  {c.sshPassword && !r.passwordOnly && <Flag>{t("sshKeys.flagPassword")}</Flag>}
                  {r.configHosts.filter((i) => !audit.config[i]?.host.isGlobal).length > 0 && <Flag>~/.ssh/config</Flag>}
                </div>
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">
                <button className="p-1 text-text-muted hover:text-text-primary" onClick={() => onEdit(c)} title={t("sshKeys.editConsole")}>
                  <Pencil className="w-3 h-3" />
                </button>
                <button className="p-1 text-text-muted hover:text-text-primary" onClick={() => onGoTo(r)} title={t("sshKeys.goToConsole")}>
                  <LocateFixed className="w-3 h-3" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Flag({ children, tone }: { children: React.ReactNode; tone?: Severity }) {
  return (
    <span className={`border rounded px-1 py-px ${tone ? SEVERITY_FLAG[tone] : "text-text-muted border-border"}`}>
      {children}
    </span>
  );
}

// ── ~/.ssh/config ──

function ConfigTab({
  report, rows, t, highlight, onGoTo,
}: {
  report: SshKeysReport;
  rows: ConfigRow[];
  t: TFunction;
  highlight: number | null;
  onGoTo: (ref: ConsoleRef) => void;
}) {
  useEffect(() => {
    if (highlight !== null) document.getElementById(`ssh-config-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight]);

  if (!report.configExists) return <div className="text-xs text-text-muted py-8 text-center">{t("sshKeys.noConfig", { path: report.configPath })}</div>;
  return (
    <div className="space-y-2">
      <div className="text-2xs text-text-muted">{t("sshKeys.configHint", { path: report.configPath })}</div>
      {rows.map((r) => {
        const h = r.host;
        const kv = (k: string, v: string) =>
          v ? (
            <span key={k} className="text-text-secondary">
              <span className="text-text-muted">{k}</span> {v}
            </span>
          ) : null;
        return (
          <div
            key={r.index}
            id={`ssh-config-${r.index}`}
            className={`bg-surface-0 border rounded-lg px-3 py-2 ${highlight === r.index ? "border-accent" : "border-border"}`}
          >
            <div className="flex items-center gap-2">
              <WorstDot issues={r.issues} />
              <span className="text-xs font-mono text-text-primary truncate">
                {h.isGlobal ? t("sshKeys.configGlobal") : `${h.isMatch ? "Match" : "Host"} ${h.patterns.join(" ")}`}
              </span>
              <div className="flex-1" />
              <span className="text-2xs text-text-muted font-mono">{h.file}:{h.line}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-2xs font-mono">
              {kv("HostName", h.hostName)}
              {kv("User", h.user)}
              {kv("Port", h.port)}
              {kv("ForwardAgent", h.forwardAgent)}
              {kv("StrictHostKeyChecking", h.strictHostKeyChecking)}
              {kv("UserKnownHostsFile", h.userKnownHostsFile)}
              {kv("IdentitiesOnly", h.identitiesOnly)}
              {kv("PasswordAuthentication", h.passwordAuthentication)}
            </div>
            {h.identityFiles.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {h.identityFiles.map((id, i) => (
                  <div key={i} className="text-2xs font-mono">
                    <span className="text-text-muted">IdentityFile</span>{" "}
                    <span className={id.path && !id.exists ? "text-red-500" : "text-text-secondary"}>{id.raw}</span>
                    {id.path && !id.exists && <span className="text-red-500"> — {t("sshKeys.fileMissing")}</span>}
                  </div>
                ))}
              </div>
            )}
            {r.issues.map((i) => (
              <div key={i.id} className="flex items-start gap-1.5 text-2xs text-text-secondary mt-1">
                <SeverityIcon severity={i.severity} size={12} />
                <span>{t(`sshKeys.issue.${i.code}.title`, i.params)}</span>
              </div>
            ))}
            {r.consoles.length > 0 && !h.isGlobal && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-2xs text-text-muted">{t("sshKeys.configConsoles")}</span>
                {r.consoles.map((c) => (
                  <button key={c.console.id} className={btnCls} onClick={() => onGoTo(c)}>
                    <ConsoleIcon con={c.console} size={11} />
                    {c.console.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Детали ──

function SeverityIcon({ severity, size = 14 }: { severity: Severity; size?: number }) {
  const Icon = SEVERITY_ICON[severity];

  return <Icon className={`shrink-0 ${SEVERITY_TEXT[severity]}`} style={{ width: size, height: size }} />;
}

/** Значок самой серьёзной проблемы; проблем нет — ничего */
function WorstDot({ issues }: { issues: SshIssue[] }) {
  if (issues.length === 0) return null;

  return <SeverityIcon severity={SEVERITY_ORDER[worst(issues)]} size={13} />;
}

/** Плитка «Проблемы»: есть критичные — красная, иначе любые — жёлтая */
function problemsTone(critical: number, problems: number): Severity | undefined {
  if (critical > 0) return "critical";

  return problems > 0 ? "warning" : undefined;
}

/** Есть ли passphrase у ключа — словами */
function passphraseText(k: SshKeyFile, t: TFunction): string {
  if (!k.privateExists) return t("sshKeys.noPrivate");

  if (k.encrypted === null) return t("sshKeys.unknown");

  return k.encrypted ? t("sshKeys.yes") : t("sshKeys.no");
}

/** Свободное имя нового ключа: id_ed25519_new, id_ed25519_new2, … */
function freeKeyName(existing: Set<string>): string {
  let n = "id_ed25519_new";

  for (let i = 2; existing.has(n); i++) n = `id_ed25519_new${i}`;

  return n;
}

function refPath(r: ConsoleRef) {
  return `${r.workspace.name} › ${r.project.name}`;
}

function formatDate(sec: number | null, lang: string) {
  return sec ? new Date(sec * 1000).toLocaleDateString(lang) : "—";
}

/** Случайная passphrase: 24 символа без похожих (0/O, 1/l) */
function randomPassphrase(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const bytes = crypto.getRandomValues(new Uint8Array(24));

  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
