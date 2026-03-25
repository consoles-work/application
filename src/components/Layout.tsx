import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { TreePanel } from "./TreePanel";
import { TerminalPanel } from "./TerminalPanel";
import { WikiPanel } from "./WikiPanel";

// ══════════════════════════════════════
// Layout — трёхпанельный layout
// [Tree | Terminal | Wiki]
// ══════════════════════════════════════

export function Layout() {
  const {
    showTreePanel,
    showWikiPanel,
    treePanelWidth,
    wikiPanelWidth,
    setTreePanelWidth,
    setWikiPanelWidth,
  } = useAppStore();

  const [dragging, setDragging] = useState<"tree" | "wiki" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (panel: "tree" | "wiki") => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(panel);

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (panel === "tree") {
          const width = Math.max(180, Math.min(500, e.clientX - rect.left));
          setTreePanelWidth(width);
        } else {
          const width = Math.max(250, Math.min(600, rect.right - e.clientX));
          setWikiPanelWidth(width);
        }
      };

      const handleMouseUp = () => {
        setDragging(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [setTreePanelWidth, setWikiPanelWidth]
  );

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col bg-surface-0 select-none"
      style={{ cursor: dragging ? "col-resize" : undefined }}
    >
      {/* ── Title bar ── */}
      <div className="h-10 flex items-center px-4 bg-surface-1 border-b border-border drag-region shrink-0">
        <span className="text-xs font-semibold text-text-secondary no-drag">
          DevConsole Hub
        </span>
        <div className="flex-1" />
        <div className="flex gap-1 no-drag">
          <button
            onClick={useAppStore.getState().toggleTreePanel}
            className={`px-2 py-1 rounded text-2xs ${
              showTreePanel
                ? "bg-accent-subtle text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            title="Toggle Tree (Ctrl+B)"
          >
            Tree
          </button>
          <button
            onClick={useAppStore.getState().toggleWikiPanel}
            className={`px-2 py-1 rounded text-2xs ${
              showWikiPanel
                ? "bg-accent-subtle text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            title="Toggle Wiki (Ctrl+\)"
          >
            Wiki
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tree Panel */}
        {showTreePanel && (
          <>
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: treePanelWidth }}
            >
              <TreePanel />
            </div>
            <div
              className={`panel-resizer ${
                dragging === "tree" ? "dragging" : ""
              }`}
              onMouseDown={handleMouseDown("tree")}
            />
          </>
        )}

        {/* Terminal Panel — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <TerminalPanel />
        </div>

        {/* Wiki Panel */}
        {showWikiPanel && (
          <>
            <div
              className={`panel-resizer ${
                dragging === "wiki" ? "dragging" : ""
              }`}
              onMouseDown={handleMouseDown("wiki")}
            />
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: wikiPanelWidth }}
            >
              <WikiPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
