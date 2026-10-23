import type { ConsoleConfig, SshConfigHost, SshKeyFile, SshKeysReport, Workspace } from "../types";
import { allConsoles, type ConsoleRef } from "./tree";

export type { ConsoleRef } from "./tree";

// ══════════════════════════════════════
// sshAudit — аудит SSH-ключей и консолей по локальным данным
// ══════════════════════════════════════
// На входе — отчёт scan_ssh_keys (ключи, ~/.ssh/config, агент) и дерево консолей.
// На выходе — строки для вкладок окна «SSH-ключи» и список проблем.
// К серверам не обращаемся: всё, что здесь есть, видно с этой машины.
//
// auditSsh:
//  1. Строки ключей и блоков ~/.ssh/config; какие блоки ссылаются на какие ключи.
//  2. SSH-консоли: какими ключами ssh реально пойдёт — свой ключ консоли,
//     IdentityFile подходящих блоков, а если нет ни того, ни другого — ключи по
//     умолчанию; входит ли по паролю, пробрасывает ли агент, проверяет ли ключ
//     хоста. Проблемы консоли.
//  3. Проблемы ключей: права, passphrase, слабый алгоритм, дубли, один ключ на
//     несколько воркспейсов, ключ без использования.
//  4. Проблемы блоков конфига: проброс агента, отключённая проверка хоста,
//     IdentityFile на несуществующий файл.
//  5. Общие: права ~/.ssh, слишком много ключей в агенте.
//  6. Проблемы — по серьёзности; ключи и консоли — проблемные сверху.

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

/** Проблема до регистрации: id даёт auditSsh по порядку обнаружения */
type IssueDraft = Omit<SshIssue, "id">;

/** Шаг 5: сколько ключей в агенте, после которого сервер может оборвать вход
 *  (MaxAuthTries по умолчанию 6, а ключи агента предлагаются по очереди) */
const AGENT_KEYS_LIMIT = 5;

/** Оценка ECDSA: [минимальная длина, оценка] — сверху вниз; короче — 70 */
const ECDSA_SCORES: [number, number][] = [
  [521, 85],
  [384, 80],
];

/** Оценка RSA: [минимальная длина, оценка] — сверху вниз; короче 1024 — 5 */
const RSA_SCORES: [number, number][] = [
  [4096, 80],
  [3072, 75],
  [2048, 55],
  [1024, 15],
];

// ── Аудит ──

export function auditSsh(report: SshKeysReport, workspaces: Workspace[]): SshAudit {
  const issues: SshIssue[] = [];

  const record = (drafts: IssueDraft[]): SshIssue[] =>
    drafts.map((draft) => {
      const issue = { ...draft, id: `${draft.code}-${issues.length}` };

      issues.push(issue);

      return issue;
    });

  // 1. Строки ключей и конфига.
  const keysByPath = new Map(report.keys.map((k) => [k.path, k]));

  const keyRows = new Map<string, KeyRow>(
    report.keys.map((k) => [k.path, { key: k, score: keyScore(k), consoles: [], defaultConsoles: [], configHosts: [], issues: [] }])
  );

  const configRows: ConfigRow[] = report.configHosts.map((host, index) => ({ host, index, consoles: [], issues: [] }));

  report.configHosts.forEach((h, i) => {
    const rows = h.identityFiles.flatMap((id) => (id.path ? keyRows.get(id.path) ?? [] : []));

    for (const row of rows) {
      if (!row.configHosts.includes(i)) row.configHosts.push(i);
    }
  });

  // 2. Консоли.
  const consoleRows = allConsoles(workspaces)
    .filter((ref) => ref.console.connectionType === "ssh")
    .map((ref) => {
      const matched = configRows.filter((r) => hostMatches(r.host, ref.console.sshHost.trim()));

      matched.forEach((r) => r.consoles.push(ref));

      const effective = effectiveKeys(ref.console, matched, report, keysByPath);

      linkKeyUsage(ref, effective, keyRows);

      const facts = connectionFacts(ref.console, matched, effective);

      const row: ConsoleRow = { ...ref, configHosts: matched.map((r) => r.index), effective, ...facts, issues: [] };

      row.issues = record(consoleIssues(ref, effective, facts.passwordOnly, report.defaultIdentities.length));

      return row;
    });

  // 3. Ключи.
  const byFingerprint = new Map<string, KeyRow[]>();

  for (const row of keyRows.values()) {
    if (row.key.fingerprint) byFingerprint.set(row.key.fingerprint, [...(byFingerprint.get(row.key.fingerprint) ?? []), row]);
  }

  for (const row of keyRows.values()) row.issues = record(keyIssues(row, byFingerprint.get(row.key.fingerprint) ?? []));

  // 4. Конфиг.
  for (const row of configRows) row.issues = record(configIssues(row.host, row.index));

  // 5. Общие.
  record(generalIssues(report));

  // 6. Порядок и сводка.
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

// ── Пути ──

/** Так же раскрывает путь expand_path + private_of в ssh_keys.rs — менять вместе */
export function expandKeyPath(raw: string, home: string): string {
  const full = absoluteKeyPath(raw.trim(), home);

  return full.endsWith(".pub") ? full.slice(0, -4) : full;
}

/** Пути ключей, указанные в SSH-консолях, — их тоже надо просканировать */
export function consoleKeyPaths(workspaces: Workspace[]): string[] {
  const paths = allConsoles(workspaces)
    .filter(({ console: c }) => c.connectionType === "ssh" && c.sshKeyPath.trim())
    .map(({ console: c }) => c.sshKeyPath.trim());

  return [...new Set(paths)];
}

// ── Оценка стойкости 0–100 (по образцу Purple) ──

export function keyScore(k: Pick<SshKeyFile, "keyType" | "bits" | "encrypted">): number {
  const score = baseScore(k.keyType.toUpperCase(), k.bits) + passphraseModifier(k.encrypted);

  return Math.max(0, Math.min(100, score));
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

/** Как у ssh: хост подходит, если совпал хоть один шаблон и ни один `!шаблон` */
export function hostMatches(h: SshConfigHost, host: string): boolean {
  if (h.isGlobal) return true;

  if (h.isMatch || !host) return false;

  const negated = h.patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));

  if (negated.some((p) => globMatch(p, host))) return false;

  return h.patterns.some((p) => !p.startsWith("!") && globMatch(p, host));
}

// ── Детали ──

/** Passphrase есть — плюс, нет — минус, неизвестно — без поправки */
function passphraseModifier(encrypted: boolean | null): number {
  if (encrypted !== true && encrypted !== false) return 0;

  return encrypted ? 5 : -10;
}

/** Порог по алгоритму и длине: SK-ключи и ED25519 — сильные, DSA и короткий RSA — небезопасны */
function baseScore(type: string, bits: number): number {
  if (type.endsWith("-SK")) return 95;

  if (type === "ED25519") return 90;

  if (type === "ECDSA") return ECDSA_SCORES.find(([minBits]) => bits >= minBits)?.[1] ?? 70;

  if (type === "RSA") return RSA_SCORES.find(([minBits]) => bits >= minBits)?.[1] ?? 5;

  if (type === "DSA") return 5;

  return 50;
}

/** Шаг 2: ключи, которыми ssh пойдёт на хост консоли. IdentityFile — из всех
 *  подходящих блоков; ключи по умолчанию — только если нет ни -i, ни IdentityFile. */
function effectiveKeys(
  c: ConsoleConfig,
  matched: ConfigRow[],
  report: SshKeysReport,
  keysByPath: Map<string, SshKeyFile>
): EffectiveKey[] {
  const own: EffectiveKey[] = c.sshKeyPath.trim()
    ? [{ path: expandKeyPath(c.sshKeyPath, report.home), via: "console" }]
    : [];

  const fromConfig = matched
    .flatMap((r) => r.host.identityFiles.map((id) => id.path))
    .filter((path) => path && path !== own[0]?.path)
    .filter((path, i, all) => all.indexOf(path) === i)
    .map((path): EffectiveKey => ({ path, via: "config" }));

  const explicit = [...own, ...fromConfig];

  const effective = explicit.length > 0 ? explicit : report.defaultIdentities.map((path): EffectiveKey => ({ path, via: "default" }));

  return effective.map((e) => ({ ...e, key: keysByPath.get(e.path) }));
}

/** Шаг 2: отметить в строках ключей, какие консоли ими ходят */
function linkKeyUsage(ref: ConsoleRef, effective: EffectiveKey[], keyRows: Map<string, KeyRow>) {
  for (const e of effective) {
    const row = keyRows.get(e.path);

    if (!row) continue;

    if (e.via === "default") row.defaultConsoles.push(ref);
    else if (!row.consoles.some((x) => x.console.id === ref.console.id)) row.consoles.push(ref);
  }
}

/** Шаг 2: вход по паролю, проброс агента, проверка ключа хоста — по аргументам и блокам конфига */
function connectionFacts(c: ConsoleConfig, matched: ConfigRow[], effective: EffectiveKey[]) {
  const hasOwnKey = effective.some((e) => e.via === "console");

  // IdentityFile на несуществующий файл ssh пропускает — вход фактически по паролю
  const configKeyExists = effective.some((e) => e.via === "config" && e.key?.privateExists);

  return {
    passwordOnly: !hasOwnKey && !configKeyExists && c.sshPassword !== "",
    forwardAgent: forwardAgentArgs(c.sshExtraArgs) || matched.some((r) => truthy(r.host.forwardAgent)),
    noHostCheck: noHostCheckArgs(c.sshExtraArgs) || matched.some((r) => noHostCheckConfig(r.host)),
  };
}

/** Шаг 2: проблемы консоли */
function consoleIssues(ref: ConsoleRef, effective: EffectiveKey[], passwordOnly: boolean, defaultCount: number): IssueDraft[] {
  const c = ref.console;

  const ownKey = effective.find((e) => e.via === "console");
  const hasConfigKeys = effective.some((e) => e.via === "config");

  const issue = (severity: Severity, code: string, params: Record<string, string | number> = {}): IssueDraft => ({
    consoleId: c.id,
    severity,
    code,
    params: { console: c.name, ...params },
  });

  // Прод-метка ставится и на консоль, и на проект целиком
  const weakForProd =
    c.isDanger || ref.project.isDanger
      ? effective.find((e) => e.key && (e.key.encrypted === false || keyScore(e.key) < 60))?.key
      : undefined;

  const drafts: (IssueDraft | false | undefined)[] = [
    ...ownKeyIssues(c, ownKey, issue),
    passwordOnly && issue("warning", "consolePasswordOnly"),
    !passwordOnly && !ownKey && !hasConfigKeys && issue("info", "consoleDefaultKeys", { count: defaultCount }),
    weakForProd && issue("critical", "consoleDangerWeakKey", { key: weakForProd.name }),
    forwardAgentArgs(c.sshExtraArgs) && issue("warning", "consoleForwardAgent"),
    noHostCheckArgs(c.sshExtraArgs) && issue("warning", "consoleNoHostCheck"),
    ...passphraseIssues(c, ownKey?.key, issue),
  ];

  return drafts.filter((d): d is IssueDraft => !!d);
}

type IssueFactory = (severity: Severity, code: string, params?: Record<string, string | number>) => IssueDraft;

/** Свой ключ консоли: файла нет вовсе / нет приватной части (и в агенте его нет) */
function ownKeyIssues(c: ConsoleConfig, ownKey: EffectiveKey | undefined, issue: IssueFactory): IssueDraft[] {
  if (!ownKey) return [];

  const key = ownKey.key;

  if (!key || (!key.privateExists && !key.publicExists)) return [issue("critical", "consoleKeyMissing", { path: c.sshKeyPath })];

  if (!key.privateExists && !key.agentLoaded) return [issue("warning", "consoleKeyNoPrivate", { path: key.displayPath })];

  return [];
}

/** Passphrase в консоли задана зря (ключ без шифрования) или не задана, а нужна */
function passphraseIssues(c: ConsoleConfig, key: SshKeyFile | undefined, issue: IssueFactory): IssueDraft[] {
  if (!key?.privateExists) return [];

  const unused = key.encrypted === false && !!c.sshPassphrase;
  const missing = key.encrypted === true && !c.sshPassphrase && !key.agentLoaded;

  return [
    ...(unused ? [issue("info", "consolePassphraseUnused", { key: key.name })] : []),
    ...(missing ? [issue("info", "consolePassphraseMissing", { key: key.name })] : []),
  ];
}

/** Шаг 3: проблемы ключа. `sameFingerprint` — строки ключей с тем же отпечатком (включая этот). */
function keyIssues(row: KeyRow, sameFingerprint: KeyRow[]): IssueDraft[] {
  const k = row.key;

  // Файл, указанный в консоли, которого нет, — уже проблема консоли
  if (!k.privateExists && !k.publicExists) return [];

  const issue = (severity: Severity, code: string, params: Record<string, string | number> = {}, extra: Partial<IssueDraft> = {}): IssueDraft => ({
    keyPath: k.path,
    severity,
    code,
    params: { key: k.name, path: k.displayPath, ...params },
    ...extra,
  });

  const used = row.consoles.length + row.defaultConsoles.length + row.configHosts.length > 0;

  const dupes = sameFingerprint.filter((r) => r !== row);

  // О дубле сообщаем один раз — у ключа с наименьшим путём
  const reportDupe = dupes.length > 0 && dupes.every((d) => d.key.path > k.path);

  const workspaceCount = new Set([...row.consoles, ...row.defaultConsoles].map((r) => r.workspace.id)).size;

  const drafts: (IssueDraft | false | undefined)[] = [
    !!k.error && !k.fingerprint && issue("warning", "keyUnreadable", { error: k.error }),
    k.privateExists && permsTooOpen(k.mode) && issue("critical", "keyPermsOpen", { mode: formatMode(k.mode) }, { fixPermissions: k.path }),
    k.privateExists && k.encrypted === false && issue("warning", "keyNoPassphrase"),
    algorithmIssue(k, issue),
    !k.privateExists && used && !k.agentLoaded && issue("warning", "keyPrivateMissing"),
    reportDupe && issue("info", "keyDuplicate", { others: dupes.map((d) => d.key.name).join(", ") }),
    workspaceCount >= 2 && issue("warning", "keyMultiWorkspace", { count: workspaceCount }),
    k.inSshDir && k.privateExists && !used && issue("info", "keyUnused"),
  ];

  return drafts.filter((d): d is IssueDraft => !!d);
}

/** Слабый алгоритм: DSA, RSA короче 2048 — критично; RSA 2048 — к сведению */
function algorithmIssue(k: SshKeyFile, issue: (severity: Severity, code: string, params?: Record<string, string | number>) => IssueDraft) {
  const type = k.keyType.toUpperCase();

  if (type === "DSA") return issue("critical", "keyDsa");

  if (type !== "RSA" || k.bits === 0) return undefined;

  if (k.bits < 2048) return issue("critical", "keyRsaShort", { bits: k.bits });

  return k.bits < 3072 ? issue("info", "keyRsa2048") : undefined;
}

/** Шаг 4: проблемы блока ~/.ssh/config */
function configIssues(h: SshConfigHost, index: number): IssueDraft[] {
  const issue = (severity: Severity, code: string, params: Record<string, string | number> = {}): IssueDraft => ({
    configIndex: index,
    severity,
    code,
    params: { host: h.patterns.join(" "), file: h.file, line: h.line, ...params },
  });

  // Проброс агента на все хосты — критично, на отдельные — предупреждение
  const forAll = h.isGlobal || h.patterns.includes("*");

  return [
    ...(truthy(h.forwardAgent) ? [issue(forAll ? "critical" : "warning", forAll ? "configForwardAgentAll" : "configForwardAgent")] : []),
    ...(noHostCheckConfig(h) ? [issue("warning", "configNoHostCheck")] : []),
    ...h.identityFiles.filter((id) => id.path && !id.exists).map((id) => issue("warning", "configIdentityMissing", { path: id.raw })),
  ];
}

/** Шаг 5 */
function generalIssues(report: SshKeysReport): IssueDraft[] {
  const drafts: IssueDraft[] = [];

  if (report.sshDirExists && permsTooOpen(report.sshDirMode)) {
    drafts.push({
      severity: "warning",
      code: "sshDirPerms",
      params: { path: report.sshDir, mode: formatMode(report.sshDirMode) },
      fixPermissions: "~/.ssh",
    });
  }

  if (report.agentFingerprints.length > AGENT_KEYS_LIMIT) {
    drafts.push({ severity: "info", code: "agentManyKeys", params: { count: report.agentFingerprints.length } });
  }

  return drafts;
}

/** `~` / `~/x` / `%d/x` → от домашней папки; относительный путь — тоже от неё */
function absoluteKeyPath(p: string, home: string): string {
  if (p === "~" || p === "%d") return home;

  if (p.startsWith("~/") || p.startsWith("%d/")) return `${home}/${p.slice(p.indexOf("/") + 1)}`;

  return p.startsWith("/") ? p : `${home}/${p}`;
}

function globMatch(pattern: string, value: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    "i"
  );

  return re.test(value);
}

/** Значение yes/no из конфига: пусто, no и false — «нет» */
function truthy(v: string): boolean {
  const s = v.trim().toLowerCase();

  return s !== "" && s !== "no" && s !== "false";
}

function noHostCheckConfig(h: SshConfigHost): boolean {
  return /^(no|off)$/i.test(h.strictHostKeyChecking) || h.userKnownHostsFile === "/dev/null";
}

/** -A (в том числе в связке флагов, -tA) или -o ForwardAgent=… кроме no */
function forwardAgentArgs(args: string): boolean {
  return /(^|\s)-[a-zA-Z]*A[a-zA-Z]*(\s|$)/.test(args) || /ForwardAgent[\s=]+(?!no\b)\S+/i.test(args);
}

function noHostCheckArgs(args: string): boolean {
  return /StrictHostKeyChecking[\s=]+(no|off)\b/i.test(args) || /UserKnownHostsFile[\s=]+\/dev\/null/i.test(args);
}
