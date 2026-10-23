import type { ConsoleConfig, Project, TreeNode, Workspace } from "../types";

// ══════════════════════════════════════
// tree — чистые функции над деревом воркспейсов
// ══════════════════════════════════════
// Поиск консоли и проекта с их родителями, плоский список узлов для отрисовки,
// поиск по дереву. Без React и без обращений к бэкенду.

/** Консоль вместе с проектом и воркспейсом, в которых она лежит */
export interface ConsoleRef {
  console: ConsoleConfig;
  project: Project;
  workspace: Workspace;
}

export interface ProjectRef {
  project: Project;
  workspace: Workspace;
}

/** Строка поиска по дереву: узел + несекретные поля, по которым тоже ищем */
export interface SearchEntry {
  id: string;
  type: TreeNode["type"];
  name: string;
  icon: string;
  /** «Воркспейс › Проект» — где лежит узел */
  breadcrumb: string;
  fields: string[];
}

export interface SearchHit extends SearchEntry {
  /** Строка поля, в которой нашлось, — если совпало не имя */
  match?: string;
}

export function allConsoles(workspaces: Workspace[]): ConsoleRef[] {
  return workspaces.flatMap((workspace) =>
    workspace.projects.flatMap((project) => project.consoles.map((console) => ({ console, project, workspace })))
  );
}

export function allProjects(workspaces: Workspace[]): ProjectRef[] {
  return workspaces.flatMap((workspace) => workspace.projects.map((project) => ({ project, workspace })));
}

export function findConsole(workspaces: Workspace[], consoleId: string): ConsoleRef | undefined {
  return allConsoles(workspaces).find((ref) => ref.console.id === consoleId);
}

export function findProject(workspaces: Workspace[], projectId: string): ProjectRef | undefined {
  return allProjects(workspaces).find((ref) => ref.project.id === projectId);
}

/** Видимые узлы по порядку: воркспейс → (раскрыт) его проекты → (раскрыт) их консоли */
export function flattenTree(workspaces: Workspace[]): TreeNode[] {
  return workspaces.flatMap((ws) => [
    {
      id: ws.id,
      type: "workspace" as const,
      name: ws.name,
      icon: ws.icon,
      color: ws.color,
      depth: 0,
      isExpanded: ws.isExpanded,
      hasChildren: ws.projects.length > 0,
      data: ws,
    },
    ...(ws.isExpanded ? ws.projects.flatMap(projectNodes) : []),
  ]);
}

/** Узел консоли — в дереве и в списке недавних */
export function consoleNode(con: ConsoleConfig, project: Project): TreeNode {
  return {
    id: con.id,
    type: "console",
    name: con.name,
    icon: con.connectionType === "ssh" ? "S" : "L",
    color: project.color,
    depth: 2,
    isExpanded: false,
    hasChildren: false,
    data: con,
  };
}

/**
 * Что ищется по дереву. Кроме имени — несекретные поля форм: адрес, хостинг,
 * заметка, стартовые команды, имена переменных окружения. Пароли, passphrase,
 * путь к ключу и значения переменных (там часто токены) сюда не попадают.
 */
export function searchIndex(workspaces: Workspace[]): SearchEntry[] {
  return workspaces.flatMap((ws) => [
    { id: ws.id, type: "workspace" as const, name: ws.name, icon: ws.icon, breadcrumb: "", fields: [] },
    ...ws.projects.flatMap((proj) => [
      {
        id: proj.id,
        type: "project" as const,
        name: proj.name,
        icon: proj.icon,
        breadcrumb: ws.name,
        fields: [proj.path, proj.defaultShell, proj.isDanger ? proj.dangerLabel : "", ...Object.keys(proj.envVars ?? {})],
      },
      ...proj.consoles.map((con) => ({
        id: con.id,
        type: "console" as const,
        name: con.name,
        icon: con.connectionType === "ssh" ? "S" : "L",
        breadcrumb: `${ws.name} › ${proj.name}`,
        fields: consoleSearchFields(con),
      })),
    ]),
  ]);
}

/** Совпадения по имени — первыми; затем по полям, со строкой, в которой нашлось */
export function searchTree(entries: SearchEntry[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();

  if (!q) return [];

  const byName = entries.filter((e) => e.name.toLowerCase().includes(q));

  const byField = entries.flatMap((e) => {
    if (e.name.toLowerCase().includes(q)) return [];

    const hit = e.fields.find((f) => f?.toLowerCase().includes(q));

    if (!hit) return [];

    const line = hit.split("\n").find((l) => l.toLowerCase().includes(q)) ?? hit;

    return [{ ...e, match: line.trim() }];
  });

  return [...byName, ...byField];
}

// ── Детали ──

function projectNodes(proj: Project): TreeNode[] {
  const node: TreeNode = {
    id: proj.id,
    type: "project",
    name: proj.name,
    icon: proj.icon,
    color: proj.color,
    depth: 1,
    isExpanded: proj.isExpanded,
    hasChildren: proj.consoles.length > 0,
    data: proj,
  };

  if (!proj.isExpanded) return [node];

  return [node, ...proj.consoles.map((con) => consoleNode(con, proj))];
}

function consoleSearchFields(con: ConsoleConfig): string[] {
  const ssh = con.connectionType === "ssh";

  const sshFields = ssh
    ? [con.sshUser && con.sshHost ? `${con.sshUser}@${con.sshHost}` : "", con.sshHost, con.sshUser, con.sshPort ? String(con.sshPort) : "", con.sshExtraArgs]
    : [];

  return [
    ...sshFields,
    con.hosting ?? "",
    con.note ?? "",
    con.startupCmd ?? "",
    con.cwdOverride ?? "",
    con.shellOverride ?? "",
    con.isDanger ? con.dangerLabel : "",
    ...Object.keys(con.envVars ?? {}),
  ];
}
