import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../stores/appStore";
import type { TreeNode } from "../types";
import { useTranslation } from "react-i18next";
import { useListNavigation } from "../hooks/useListNavigation";

// ══════════════════════════════════════
// CommandPalette — переход к узлу дерева по имени (Cmd+P)
// ══════════════════════════════════════
// Ищет среди видимых узлов дерева (содержимое свёрнутых не показывается).
// Выбор узла выделяет его в дереве; консоль ещё и открывается — к последнему
// её терминалу, а если терминала нет — новым.

const TYPE_LABEL: Record<TreeNode["type"], string> = { workspace: "WS", project: "PRJ", console: "CON" };
const TYPE_COLOR: Record<TreeNode["type"], string> = { workspace: "text-purple-400", project: "text-blue-400", console: "text-green-400" };

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const { getFlatTree, selectNode, openConsole } = useAppStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const q = query.trim().toLowerCase();

  const filtered = getFlatTree().filter((n) => !q || n.name.toLowerCase().includes(q));

  const handleSelect = (node: TreeNode) => {
    selectNode({ type: node.type, id: node.id });

    if (node.type === "console") openConsole(node.id, node.name);

    onClose();
  };

  const nav = useListNavigation(filtered, handleSelect, onClose, query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
            onKeyDown={nav.onKeyDown}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="text-2xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded border border-border">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-text-muted text-xs">{t("commandPalette.nothingFound")}</div>
          )}
          {filtered.map((node, i) => (
              <div
                key={`${node.type}-${node.id}`}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === nav.index ? "bg-accent-subtle" : "hover:bg-surface-3"
                }`}
                style={{ paddingLeft: `${16 + node.depth * 12}px` }}
                onMouseEnter={() => nav.setIndex(i)}
                onClick={() => handleSelect(node)}
              >
                <span className={`text-2xs font-mono font-bold ${TYPE_COLOR[node.type]} w-8 shrink-0`}>
                  {TYPE_LABEL[node.type]}
                </span>
                <span className="text-sm">{node.icon}</span>
                <span className="flex-1 text-sm text-text-primary truncate">{node.name}</span>
                {(node.data as { isDanger?: boolean; dangerLabel?: string }).isDanger && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    ⚠ {(node.data as { dangerLabel?: string }).dangerLabel}
                  </span>
                )}
              </div>
          ))}
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
