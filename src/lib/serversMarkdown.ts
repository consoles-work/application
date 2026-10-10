// ══════════════════════════════════════════════
// Публичный экспорт списка серверов в Markdown
// (без паролей, passphrase и путей к ключам — только для просмотра)
// ══════════════════════════════════════════════

import type { Workspace, Project, ConsoleConfig } from "../types";

type T = (key: string, opts?: Record<string, unknown>) => string;

/** Экранировать текст для ячейки Markdown-таблицы */
function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function sshConsoles(project: Project): ConsoleConfig[] {
  return project.consoles.filter((c) => c.connectionType === "ssh" && c.sshHost.trim());
}

function renderTable(consoles: ConsoleConfig[], withHosting: boolean, t: T): string[] {
  const headers = [
    t("serversReport.name"),
    t("serversReport.host"),
    t("serversReport.port"),
    t("serversReport.user"),
    ...(withHosting ? [t("serversReport.hosting")] : []),
  ];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const c of consoles) {
    const row = [
      cell(c.name),
      `\`${cell(c.sshHost)}\``,
      String(c.sshPort || 22),
      cell(c.sshUser),
      ...(withHosting ? [cell(c.hosting ?? "")] : []),
    ];
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines;
}

/**
 * Собрать Markdown-отчёт по серверам воркспейса или проекта.
 * Возвращает null, если SSH-серверов нет.
 */
export function buildServersMarkdown(
  root: { type: "workspace"; data: Workspace } | { type: "project"; data: Project },
  t: T
): string | null {
  const projects = root.type === "workspace" ? root.data.projects : [root.data];
  const sections = projects
    .map((p) => ({ project: p, consoles: sshConsoles(p) }))
    .filter((s) => s.consoles.length > 0);
  if (sections.length === 0) return null;

  // Колонка «Хостинг» появляется, только если хоть у одного сервера она заполнена
  const withHosting = sections.some((s) => s.consoles.some((c) => c.hosting?.trim()));
  const total = sections.reduce((n, s) => n + s.consoles.length, 0);

  const lines: string[] = [
    `# ${t("serversReport.title", { name: root.data.name })}`,
    "",
    `${t("serversReport.exportedAt")}: ${new Date().toLocaleString()}  `,
    `${t("serversReport.total")}: ${total}`,
    "",
  ];

  for (const s of sections) {
    if (root.type === "workspace") {
      lines.push(`## ${s.project.name}`, "");
    }
    lines.push(...renderTable(s.consoles, withHosting, t), "");
  }

  return lines.join("\n");
}
