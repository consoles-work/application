import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../stores/appStore";
import type { TreeNode } from "../types";
import { useTranslation } from "react-i18next";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const { getFlatTree, selectNode, openSession, sessions, setActiveSession } = useAppStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const allNodes = getFlatTree();

  const filtered = query.trim()
    ? allNodes.filter((n) =>
        n.name.toLowerCase().includes(query.toLowerCase())
      )
    : allNodes;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (node: TreeNode) => {
    selectNode({ type: node.type, id: node.id });
    if (node.type === "console") {
      const existing = sessions.find((s) => s.console_id === node.id);
      if (existing) setActiveSession(existing.id);
      else openSession({ id: `session-${Date.now()}`, console_id: node.id, title: node.name, is_active: true });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  const typeLabel: Record<string, string> = { workspace: "WS", project: "PRJ", console: "CON" };
  const typeColor: Record<string, string> = { workspace: "text-purple-400", project: "text-blue-400", console: "text-green-400" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50" onClick={onClose}>
      <div
        className="w-[560px] bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-sm">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="text-2xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded border border-border">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-text-muted text-xs">{t("commandPalette.nothingFound")}</div>
          ) : (
            filtered.map((node, i) => (
              <div
                key={`${node.type}-${node.id}`}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === selectedIndex ? "bg-accent-subtle" : "hover:bg-surface-3"
                }`}
                style={{ paddingLeft: `${16 + node.depth * 12}px` }}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleSelect(node)}
              >
                <span className={`text-2xs font-mono font-bold ${typeColor[node.type]} w-8 shrink-0`}>
                  {typeLabel[node.type]}
                </span>
                <span className="text-sm">{node.icon}</span>
                <span className="flex-1 text-sm text-text-primary truncate">{node.name}</span>
                {(node.data as { isDanger?: boolean; dangerLabel?: string }).isDanger && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    ⚠ {(node.data as { dangerLabel?: string }).dangerLabel}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-2xs text-text-muted">
          <span>{t("commandPalette.navHint")}</span>
          <span>{t("commandPalette.openHint")}</span>
          <span>{t("commandPalette.closeHint")}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
