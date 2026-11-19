import type { TreeNode, TreeNodeType, Workspace } from "../types";
import { findConsole, findProject } from "./tree";

// ══════════════════════════════════════
// treeOrder — куда встанет перетаскиваемый узел дерева
// ══════════════════════════════════════
// Вызывается из TreePanel, пока тащат воркспейс, проект или консоль.
//  1. Цель — по строке под курсором:
//     а) строка того же уровня — встаём выше или ниже неё (по половине строки);
//     б) строка уровнем выше — внутрь, в конец (проект на воркспейс, консоль
//        на проект);
//     в) строка глубже — после её предка нашего уровня: тащим проект над
//        консолями соседа — встаём после этого соседа целиком;
//     г) консоль над воркспейсом — некуда: родитель консоли только проект.
//  2. Линия-подсказка: над строкой, под последней видимой строкой узла
//     (вместе с раскрытыми детьми) или рамкой вокруг родителя.
//  3. Новый порядок детей родителя-получателя: без перетаскиваемого узла
//     и с ним на новом месте. Родитель тот же и порядок не изменился —
//     бросать некуда, ничего не пишем.
//  4. Дерево с узлом на новом месте — ровно то, что запишет бэкенд, поэтому
//     после успешной команды дерево целиком не перечитывается.

export type DropPlace = "before" | "after" | "inside";

export interface DropTarget {
  node: TreeNode;
  place: DropPlace;
}

/** Шаг 2: где рисовать подсказку; `depth` — отступ линии (уровень цели) */
export interface DropLine {
  rowId: string;
  edge: "top" | "bottom" | "inside";
  depth: number;
}

/** Шаг 3: куда встаёт узел — то, что уходит в `reorder_nodes` */
export interface Placement {
  type: TreeNodeType;
  id: string;
  /** Родитель-получатель; у воркспейса — null */
  parentId: string | null;
  parentName: string;
  /** Узел переезжает в другой воркспейс/проект — спросим подтверждение */
  parentChanged: boolean;
  /** Все дети родителя-получателя в новом порядке */
  orderedIds: string[];
}

/** Уровень узла — он же `depth` строки в плоском дереве */
const LEVEL: Record<TreeNodeType, number> = { workspace: 0, project: 1, console: 2 };

/** Шаг 1: цель для узла типа `draggedType` над строкой `nodes[rowIndex]` */
export function dropTarget(draggedType: TreeNodeType, nodes: TreeNode[], rowIndex: number, lowerHalf: boolean): DropTarget | null {
  const row = nodes[rowIndex];

  const level = LEVEL[draggedType];

  // а) сосед
  if (row.depth === level) return { node: row, place: lowerHalf ? "after" : "before" };

  // б) родитель
  if (row.depth === level - 1) return { node: row, place: "inside" };

  // г) слишком высоко
  if (row.depth < level) return null;

  // в) потомок соседа — ближайший предок нашего уровня выше по списку
  for (let i = rowIndex - 1; i >= 0; i--) {
    if (nodes[i].depth === level) return { node: nodes[i], place: "after" };
  }

  return null;
}

/** Шаг 2 */
export function dropLine(target: DropTarget, nodes: TreeNode[]): DropLine {
  const { node, place } = target;

  if (place === "before") return { rowId: node.id, edge: "top", depth: node.depth };

  if (place === "inside") return { rowId: node.id, edge: "inside", depth: node.depth };

  // «После» — под последней видимой строкой узла, включая раскрытых детей
  let last = nodes.findIndex((n) => n.id === node.id);

  while (last + 1 < nodes.length && nodes[last + 1].depth > node.depth) last++;

  return { rowId: nodes[last].id, edge: "bottom", depth: node.depth };
}

/** Шаг 3; null — узел остаётся на месте */
export function placement(workspaces: Workspace[], dragged: TreeNode, target: DropTarget): Placement | null {
  if (target.node.id === dragged.id) return null;

  const source = parentOf(workspaces, dragged);

  const dest = target.place === "inside" ? childrenOf(workspaces, target.node) : parentOf(workspaces, target.node);

  if (!source || !dest) return null;

  const rest = dest.childIds.filter((id) => id !== dragged.id);

  const at =
    target.place === "inside" ? rest.length : rest.indexOf(target.node.id) + (target.place === "after" ? 1 : 0);

  const orderedIds = [...rest.slice(0, at), dragged.id, ...rest.slice(at)];

  const parentChanged = source.id !== dest.id;

  if (!parentChanged && orderedIds.every((id, i) => id === dest.childIds[i])) return null;

  return { type: dragged.type, id: dragged.id, parentId: dest.id, parentName: dest.name, parentChanged, orderedIds };
}

/** Шаг 4 */
export function applyPlacement(workspaces: Workspace[], p: Placement): Workspace[] {
  if (p.type === "workspace") return arrange(workspaces, p.orderedIds);

  if (p.type === "project") {
    const moved = findProject(workspaces, p.id)?.project;

    if (!moved) return workspaces;

    return workspaces.map((ws) => {
      const others = ws.projects.filter((proj) => proj.id !== p.id);

      if (ws.id !== p.parentId) return others.length === ws.projects.length ? ws : { ...ws, projects: others };

      return { ...ws, projects: arrange([...others, { ...moved, workspaceId: ws.id }], p.orderedIds) };
    });
  }

  const moved = findConsole(workspaces, p.id)?.console;

  if (!moved) return workspaces;

  return workspaces.map((ws) => ({
    ...ws,
    projects: ws.projects.map((proj) => {
      const others = proj.consoles.filter((con) => con.id !== p.id);

      if (proj.id !== p.parentId) return others.length === proj.consoles.length ? proj : { ...proj, consoles: others };

      return { ...proj, consoles: arrange([...others, { ...moved, projectId: proj.id }], p.orderedIds) };
    }),
  }));
}

// ── Детали ──

/** Родитель и его дети по порядку */
interface Siblings {
  id: string | null;
  name: string;
  childIds: string[];
}

/** Шаг 3: среди кого лежит узел сейчас */
function parentOf(workspaces: Workspace[], node: TreeNode): Siblings | null {
  if (node.type === "workspace") return { id: null, name: "", childIds: workspaces.map((ws) => ws.id) };

  if (node.type === "project") {
    const ws = findProject(workspaces, node.id)?.workspace;

    return ws ? { id: ws.id, name: ws.name, childIds: ws.projects.map((p) => p.id) } : null;
  }

  const proj = findConsole(workspaces, node.id)?.project;

  return proj ? { id: proj.id, name: proj.name, childIds: proj.consoles.map((c) => c.id) } : null;
}

/** Шаг 3: дети узла — для броска «внутрь» */
function childrenOf(workspaces: Workspace[], node: TreeNode): Siblings | null {
  if (node.type === "workspace") {
    const ws = workspaces.find((w) => w.id === node.id);

    return ws ? { id: ws.id, name: ws.name, childIds: ws.projects.map((p) => p.id) } : null;
  }

  if (node.type === "project") {
    const proj = findProject(workspaces, node.id)?.project;

    return proj ? { id: proj.id, name: proj.name, childIds: proj.consoles.map((c) => c.id) } : null;
  }

  return null;
}

/** Шаг 4: элементы в порядке `orderedIds`, `sortOrder` — позиция */
function arrange<T extends { id: string; sortOrder: number }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  return orderedIds.flatMap((id, i) => {
    const item = byId.get(id);

    return item ? [{ ...item, sortOrder: i }] : [];
  });
}
