import type { ConsoleConfig, Project, SshConfigHost, SshKeyFile, SshKeysReport, Workspace } from "../types";

// ══════════════════════════════════════
// sshAudit — аудит SSH-ключей и консолей по локальным данным
// ══════════════════════════════════════
// На входе — отчёт scan_ssh_keys (ключи, ~/.ssh/config, агент) и дерево консолей.
// На выходе — строки для вкладок окна «SSH-ключи» и список проблем.
// К серверам не обращаемся: всё, что здесь есть, видно с этой машины.

export type Severity = "critical" | "warning" | "info";

export const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

export interface SshIssue {
  id: string;
  severity: Severity;
  /** Ключ локализации: sshKeys.issue.<code>.title / .why / .fix */
  code: string;
  params: Record<string, string | number>;
  keyPath?: string;
  consoleId?: string;
  configIndex?: number;
  /** Можно исправить кнопкой: путь для fix_ssh_permissions */
  fixPermissions?: string;
}

export interface ConsoleRef {
  console: ConsoleConfig;
  project: Project;
  workspace: Workspace;
}

/** Как консоль получает ключ: свой в настройках / из ~/.ssh/config / ключи по умолчанию */
export type KeyVia = "console" | "config" | "default";

export interface EffectiveKey {
  path: string;
  via: KeyVia;
  key?: SshKeyFile;
}

export interface KeyRow {
  key: SshKeyFile;
  score: number;
  consoles: ConsoleRef[];
  /** Консоли, которые ходят этим ключом как ключом по умолчанию (свой не задан) */
  defaultConsoles: ConsoleRef[];
  configHosts: number[];
  issues: SshIssue[];
}

export interface ConsoleRow extends ConsoleRef {
  configHosts: number[];
  effective: EffectiveKey[];
  /** Вход по паролю без ключа */
  passwordOnly: boolean;
  forwardAgent: boolean;
  noHostCheck: boolean;
  issues: SshIssue[];
}

export interface ConfigRow {
  host: SshConfigHost;
  index: number;
  consoles: ConsoleRef[];
  issues: SshIssue[];
}

export interface SshAudit {
  keys: KeyRow[];
  consoles: ConsoleRow[];
  config: ConfigRow[];
  issues: SshIssue[];
  counts: Record<Severity, number>;
  summary: {
    keys: number;
    withPrivate: number;
    noPassphrase: number;
    inAgent: number;
    sshConsoles: number;
    consolesWithoutOwnKey: number;
  };
}

// Сколько ключей в агенте, после которого сервер может оборвать вход
// (MaxAuthTries по умолчанию 6, а ключи агента предлагаются по очереди)
const AGENT_KEYS_LIMIT = 5;

// ── Пути (так же, как expand_path / private_of в ssh_keys.rs) ──

export function expandKeyPath(raw: string, home: string): string {
  let p = raw.trim();
  if (p === "~" || p === "%d") p = home;
  else if (p.startsWith("~/") || p.startsWith("%d/")) p = `${home}/${p.slice(p.indexOf("/") + 1)}`;
  else if (!p.startsWith("/")) p = `${home}/${p}`;
  return p.endsWith(".pub") ? p.slice(0, -4) : p;
}

/** Пути ключей, указанные в SSH-консолях, — их тоже надо просканировать */
export function consoleKeyPaths(workspaces: Workspace[]): string[] {
  const paths = new Set<string>();
  for (const ws of workspaces)
    for (const p of ws.projects)
      for (const c of p.consoles)
        if (c.connectionType === "ssh" && c.sshKeyPath.trim()) paths.add(c.sshKeyPath.trim());
  return [...paths];
}

// ── Оценка стойкости 0–100 (по образцу Purple) ──

export function keyScore(k: Pick<SshKeyFile, "keyType" | "bits" | "encrypted">): number {
  const t = k.keyType.toUpperCase();
  let base = 50;
  if (t.endsWith("-SK")) base = 95;
  else if (t === "ED25519") base = 90;
  else if (t === "ECDSA") base = k.bits >= 521 ? 85 : k.bits >= 384 ? 80 : 70;
  else if (t === "RSA") base = k.bits >= 4096 ? 80 : k.bits >= 3072 ? 75 : k.bits >= 2048 ? 55 : k.bits >= 1024 ? 15 : 5;
  else if (t === "DSA") base = 5;
  const modifier = k.encrypted === true ? 5 : k.encrypted === false ? -10 : 0;
  return Math.max(0, Math.min(100, base + modifier));
}

export type ScoreLevel = "strong" | "ok" | "weak" | "unsafe";

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 85) return "strong";
  if (score >= 60) return "ok";
  if (score >= 30) return "weak";
  return "unsafe";
}

/** Права шире 600: ssh такой ключ откажется использовать */
export function permsTooOpen(mode: number | null): boolean {
  return mode !== null && (mode & 0o077) !== 0;
}

export function formatMode(mode: number | null): string {
  return mode === null ? "—" : mode.toString(8).padStart(3, "0");
}

// ── ~/.ssh/config: какой Host подходит к консоли ──

function globMatch(pattern: string, value: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    "i"
  );
  return re.test(value);
}

/** Как у ssh: хост подходит, если совпал хоть один шаблон и ни один `!шаблон` */
export function hostMatches(h: SshConfigHost, host: string): boolean {
  if (h.isGlobal) return true;
  if (h.isMatch || !host) return false;
  let matched = false;
  for (const p of h.patterns) {
    if (p.startsWith("!")) {
      if (globMatch(p.slice(1), host)) return false;
    } else if (globMatch(p, host)) matched = true;
  }
  return matched;
}

function truthy(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "no" && s !== "false";
}

function forwardAgentArgs(args: string): boolean {
  return /(^|\s)-[a-zA-Z]*A[a-zA-Z]*(\s|$)/.test(args) || /ForwardAgent[\s=]+(?!no\b)\S+/i.test(args);
}

function noHostCheckArgs(args: string): boolean {
  return /StrictHostKeyChecking[\s=]+(no|off)\b/i.test(args) || /UserKnownHostsFile[\s=]+\/dev\/null/i.test(args);
}

// ── Аудит ──

export function auditSsh(report: SshKeysReport, workspaces: Workspace[]): SshAudit {
  const issues: SshIssue[] = [];
  let seq = 0;
  const add = (issue: Omit<SshIssue, "id">): SshIssue => {
    const full = { ...issue, id: `${issue.code}-${seq++}` };
    issues.push(full);
    return full;
  };

  const keysByPath = new Map(report.keys.map((k) => [k.path, k]));
  const keyRows = new Map<string, KeyRow>(
    report.keys.map((k) => [k.path, { key: k, score: keyScore(k), consoles: [], defaultConsoles: [], configHosts: [], issues: [] }])
  );
  const configRows: ConfigRow[] = report.configHosts.map((host, index) => ({ host, index, consoles: [], issues: [] }));

  // Ссылки из ~/.ssh/config на ключи
  report.configHosts.forEach((h, i) => {
    for (const id of h.identityFiles) {
      const row = id.path ? keyRows.get(id.path) : undefined;
      if (row && !row.configHosts.includes(i)) row.configHosts.push(i);
    }
  });

  // ── Консоли ──
  const consoleRows: ConsoleRow[] = [];
  for (const workspace of workspaces)
    for (const project of workspace.projects)
      for (const c of project.consoles) {
        if (c.connectionType !== "ssh") continue;
        const ref: ConsoleRef = { console: c, project, workspace };
        const matched = configRows.filter((r) => hostMatches(r.host, c.sshHost.trim()));
        matched.forEach((r) => r.consoles.push(ref));

        const effective: EffectiveKey[] = [];
        if (c.sshKeyPath.trim()) {
          const path = expandKeyPath(c.sshKeyPath, report.home);
          effective.push({ path, via: "console", key: keysByPath.get(path) });
        }
        // ssh добавляет IdentityFile из всех подходящих блоков, ключи по умолчанию —
        // только если ни -i, ни IdentityFile нет
        for (const r of matched)
          for (const id of r.host.identityFiles)
            if (id.path && !effective.some((e) => e.path === id.path))
              effective.push({ path: id.path, via: "config", key: keysByPath.get(id.path) });
        if (effective.length === 0)
          for (const path of report.defaultIdentities) effective.push({ path, via: "default", key: keysByPath.get(path) });

        for (const e of effective) {
          const row = keyRows.get(e.path);
          if (!row) continue;
          if (e.via === "default") row.defaultConsoles.push(ref);
          else if (!row.consoles.some((x) => x.console.id === c.id)) row.consoles.push(ref);
        }

        const ownKey = effective.find((e) => e.via === "console");
        const configKeys = effective.filter((e) => e.via === "config");
        // IdentityFile на несуществующий файл ssh пропускает — вход фактически по паролю
        const passwordOnly = !ownKey && !configKeys.some((e) => e.key?.privateExists) && c.sshPassword !== "";
        const forwardAgent = forwardAgentArgs(c.sshExtraArgs) || matched.some((r) => truthy(r.host.forwardAgent));
        const noHostCheck =
          noHostCheckArgs(c.sshExtraArgs) ||
          matched.some((r) => /^(no|off)$/i.test(r.host.strictHostKeyChecking) || r.host.userKnownHostsFile === "/dev/null");
        const row: ConsoleRow = { ...ref, configHosts: matched.map((r) => r.index), effective, passwordOnly, forwardAgent, noHostCheck, issues: [] };
        const base = { consoleId: c.id, params: { console: c.name } };

        if (ownKey && (!ownKey.key || (!ownKey.key.privateExists && !ownKey.key.publicExists)))
          row.issues.push(add({ ...base, severity: "critical", code: "consoleKeyMissing", params: { ...base.params, path: c.sshKeyPath } }));
        else if (ownKey?.key && !ownKey.key.privateExists && !ownKey.key.agentLoaded)
          row.issues.push(add({ ...base, severity: "warning", code: "consoleKeyNoPrivate", params: { ...base.params, path: ownKey.key.displayPath } }));

        if (passwordOnly) row.issues.push(add({ ...base, severity: "warning", code: "consolePasswordOnly" }));
        else if (!ownKey && configKeys.length === 0)
          row.issues.push(add({ ...base, severity: "info", code: "consoleDefaultKeys", params: { ...base.params, count: report.defaultIdentities.length } }));

        // Прод-метка ставится и на консоль, и на проект целиком
        if (c.isDanger || project.isDanger) {
          const weak = effective.find((e) => e.key && (e.key.encrypted === false || keyScore(e.key) < 60));
          if (weak?.key)
            row.issues.push(add({ ...base, severity: "critical", code: "consoleDangerWeakKey", params: { ...base.params, key: weak.key.name } }));
        }
        if (forwardAgentArgs(c.sshExtraArgs)) row.issues.push(add({ ...base, severity: "warning", code: "consoleForwardAgent" }));
        if (noHostCheckArgs(c.sshExtraArgs)) row.issues.push(add({ ...base, severity: "warning", code: "consoleNoHostCheck" }));

        if (ownKey?.key?.privateExists) {
          if (ownKey.key.encrypted === false && c.sshPassphrase)
            row.issues.push(add({ ...base, severity: "info", code: "consolePassphraseUnused", params: { ...base.params, key: ownKey.key.name } }));
          if (ownKey.key.encrypted === true && !c.sshPassphrase && !ownKey.key.agentLoaded)
            row.issues.push(add({ ...base, severity: "info", code: "consolePassphraseMissing", params: { ...base.params, key: ownKey.key.name } }));
        }
        consoleRows.push(row);
      }

  // ── Ключи ──
  const byFingerprint = new Map<string, KeyRow[]>();
  for (const row of keyRows.values())
    if (row.key.fingerprint) byFingerprint.set(row.key.fingerprint, [...(byFingerprint.get(row.key.fingerprint) ?? []), row]);

  for (const row of keyRows.values()) {
    const k = row.key;
    const base = { keyPath: k.path, params: { key: k.name, path: k.displayPath } as Record<string, string | number> };
    const used = row.consoles.length + row.defaultConsoles.length + row.configHosts.length > 0;
    // Файл, указанный в консоли, которого нет, — уже проблема консоли
    if (!k.privateExists && !k.publicExists) continue;

    const push = (issue: Omit<SshIssue, "id" | "keyPath">) => row.issues.push(add({ ...issue, keyPath: k.path }));
    if (k.error && !k.fingerprint) push({ ...base, severity: "warning", code: "keyUnreadable", params: { ...base.params, error: k.error } });
    if (k.privateExists && permsTooOpen(k.mode))
      push({ ...base, severity: "critical", code: "keyPermsOpen", params: { ...base.params, mode: formatMode(k.mode) }, fixPermissions: k.path });
    if (k.privateExists && k.encrypted === false) push({ ...base, severity: "warning", code: "keyNoPassphrase" });

    const t = k.keyType.toUpperCase();
    if (t === "DSA") push({ ...base, severity: "critical", code: "keyDsa" });
    else if (t === "RSA" && k.bits > 0 && k.bits < 2048) push({ ...base, severity: "critical", code: "keyRsaShort", params: { ...base.params, bits: k.bits } });
    else if (t === "RSA" && k.bits >= 2048 && k.bits < 3072) push({ ...base, severity: "info", code: "keyRsa2048" });

    if (!k.privateExists && used && !k.agentLoaded) push({ ...base, severity: "warning", code: "keyPrivateMissing" });

    const dupes = (byFingerprint.get(k.fingerprint) ?? []).filter((r) => r !== row);
    if (dupes.length > 0 && dupes.every((d) => d.key.path > k.path))
      push({ ...base, severity: "info", code: "keyDuplicate", params: { ...base.params, others: dupes.map((d) => d.key.name).join(", ") } });

    const workspaceIds = new Set([...row.consoles, ...row.defaultConsoles].map((r) => r.workspace.id));
    if (workspaceIds.size >= 2) push({ ...base, severity: "warning", code: "keyMultiWorkspace", params: { ...base.params, count: workspaceIds.size } });

    if (k.inSshDir && k.privateExists && !used) push({ ...base, severity: "info", code: "keyUnused" });
  }

  // ── ~/.ssh/config ──
  for (const r of configRows) {
    const h = r.host;
    const base = { configIndex: r.index, params: { host: h.patterns.join(" "), file: h.file, line: h.line } };
    const forAll = h.isGlobal || h.patterns.includes("*");
    if (truthy(h.forwardAgent))
      r.issues.push(add({ ...base, severity: forAll ? "critical" : "warning", code: forAll ? "configForwardAgentAll" : "configForwardAgent" }));
    if (/^(no|off)$/i.test(h.strictHostKeyChecking) || h.userKnownHostsFile === "/dev/null")
      r.issues.push(add({ ...base, severity: "warning", code: "configNoHostCheck" }));
    for (const id of h.identityFiles)
      if (id.path && !id.exists)
        r.issues.push(add({ ...base, severity: "warning", code: "configIdentityMissing", params: { ...base.params, path: id.raw } }));
  }

  // ── Общие ──
  if (report.sshDirExists && permsTooOpen(report.sshDirMode))
    add({ severity: "warning", code: "sshDirPerms", params: { path: report.sshDir, mode: formatMode(report.sshDirMode) }, fixPermissions: "~/.ssh" });
  if (report.agentFingerprints.length > AGENT_KEYS_LIMIT)
    add({ severity: "info", code: "agentManyKeys", params: { count: report.agentFingerprints.length } });

  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
  issues.sort((a, b) => rank(a.severity) - rank(b.severity));
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;

  const keys = [...keyRows.values()]
    // Ключ из консоли, файла которого нет, в списке ключей не показываем — он в проблемах консоли
    .filter((r) => r.key.privateExists || r.key.publicExists)
    .sort((a, b) => worst(a.issues) - worst(b.issues) || a.key.name.localeCompare(b.key.name));
  const withPrivate = keys.filter((r) => r.key.privateExists);

  return {
    keys,
    consoles: consoleRows.sort((a, b) => worst(a.issues) - worst(b.issues)),
    config: configRows,
    issues,
    counts,
    summary: {
      keys: keys.length,
      withPrivate: withPrivate.length,
      noPassphrase: withPrivate.filter((r) => r.key.encrypted === false).length,
      inAgent: keys.filter((r) => r.key.agentLoaded).length,
      sshConsoles: consoleRows.length,
      consolesWithoutOwnKey: consoleRows.filter((r) => !r.effective.some((e) => e.via === "console")).length,
    },
  };
}

/** Самая серьёзная проблема в списке: 0 — критично … 3 — проблем нет (для сортировки) */
export function worst(issues: SshIssue[]): number {
  return issues.reduce((m, i) => Math.min(m, SEVERITY_ORDER.indexOf(i.severity)), SEVERITY_ORDER.length);
}
