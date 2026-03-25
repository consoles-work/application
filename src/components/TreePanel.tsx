import { useAppStore } from "../stores/appStore";
import type { TreeNode } from "../types";

// ══════════════════════════════════════
// TreePanel — дерево проектов
// Workspace → Project → Console
// ══════════════════════════════════════

export function TreePanel() {
  const { selectedNode, selectNode, toggleNodeExpanded, getFlatTree } =
    useAppStore();

  const nodes = getFlatTree();

  const handleClick = (node: TreeNode) => {
    selectNode({ type: node.type, id: node.id });

    // Для консоли — также открываем терминальную сессию
    if (node.type === "console") {
      const { sessions, openSession } = useAppStore.getState();
      const existing = sessions.find((s) => s.console_id === node.id);
      if (existing) {
        useAppStore.getState().setActiveSession(existing.id);
      } else {
        openSession({
          id: `session-${Date.now()}`,
          console_id: node.id,
          title: node.name,
          is_active: true,
        });
      }
    }
  };

  const handleToggle = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    if (node.has_children) {
      toggleNodeExpanded(node.type, node.id);
    }
  };

  const getTypeIcon = (node: TreeNode) => {
    if (node.type === "console") return "›";
    if (node.is_expanded) return "▾";
    if (node.has_children) return "▸";
    return " ";
  };

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Projects
        </span>
        <button
          className="text-text-muted hover:text-text-primary text-lg leading-none"
          title="Add Workspace"
          onClick={() => {
            // TODO: модальное окно создания workspace
            const { addWorkspace } = useAppStore.getState();
            addWorkspace({
              id: `ws-${Date.now()}`,
              name: "New Workspace",
              icon: "📁",
              color: "#58a6ff",
              sort_order: 99,
              is_expanded: true,
              projects: [],
            });
          }}
        >
          +
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.map((node) => (
          <div
            key={`${node.type}-${node.id}`}
            className={`tree-item ${
              selectedNode?.id === node.id && selectedNode?.type === node.type
                ? "active"
                : ""
            }`}
            style={{ paddingLeft: `${12 + node.depth * 16}px` }}
            onClick={() => handleClick(node)}
          >
            {/* Expand/collapse arrow */}
            <span
              className="indent w-4 text-center text-text-muted text-xs cursor-pointer"
              onClick={(e) => handleToggle(e, node)}
            >
              {getTypeIcon(node)}
            </span>

            {/* Icon */}
            <span className="text-sm">{node.icon}</span>

            {/* Name */}
            <span className="truncate flex-1 text-xs">{node.name}</span>

            {/* Color dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: node.color }}
            />
          </div>
        ))}

        {nodes.length === 0 && (
          <div className="px-4 py-8 text-center text-text-muted text-xs">
            Нажмите + чтобы создать workspace
          </div>
        )}
      </div>
    </div>
  );
}
