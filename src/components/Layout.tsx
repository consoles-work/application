import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { TreePanel } from "./TreePanel";
import { TerminalPanel } from "./TerminalPanel";
import { WikiPanel } from "./WikiPanel";
import { AiPanel } from "./AiPanel";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";

interface LayoutProps {
  onOpenSettings: () => void;
}

export function Layout({ onOpenSettings }: LayoutProps) {
  const {
    showTreePanel,
    showWikiPanel,
    showAiPanel,
    treePanelWidth,
    wikiPanelWidth,
    aiPanelWidth,
    aiPanelHeight,
    aiPanelPosition,
    terminalSelection,
    setTreePanelWidth,
    setWikiPanelWidth,
    setAiPanelWidth,
    setAiPanelHeight,
    toggleAiPanel,
  } = useAppStore();
  const { t } = useTranslation();

  const [dragging, setDragging] = useState<"tree" | "wiki" | "ai" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (panel: "tree" | "wiki" | "ai") => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(panel);

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (panel === "tree") {
          const width = Math.max(180, Math.min(500, e.clientX - rect.left));
          setTreePanelWidth(width);
        } else if (panel === "wiki") {
          const width = Math.max(250, Math.min(600, rect.right - e.clientX));
          setWikiPanelWidth(width);
        } else if (panel === "ai") {
          if (aiPanelPosition === "right") {
            const rightBound =
              rect.right - (showWikiPanel ? wikiPanelWidth + 4 : 0);
            const width = Math.max(250, Math.min(600, rightBound - e.clientX));
            setAiPanelWidth(width);
          } else {
            const height = Math.max(150, Math.min(600, rect.bottom - e.clientY));
            setAiPanelHeight(height);
          }
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
    [
      setTreePanelWidth,
      setWikiPanelWidth,
      setAiPanelWidth,
      setAiPanelHeight,
      aiPanelPosition,
      showWikiPanel,
      wikiPanelWidth,
    ]
  );

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col bg-surface-0 select-none"
      style={{
        cursor: dragging
          ? dragging === "ai" && aiPanelPosition === "bottom"
            ? "row-resize"
            : "col-resize"
          : undefined,
      }}
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
            onClick={toggleAiPanel}
            className={`px-2 py-1 rounded text-2xs flex items-center gap-1 ${
              showAiPanel
                ? "bg-accent-subtle text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            title="AI Ассистент (Cmd+I)"
          >
            <Bot className="w-3 h-3" />
            {terminalSelection && !showAiPanel && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
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
          <button
            onClick={onOpenSettings}
            className="px-2 py-1 rounded text-2xs text-text-muted hover:text-text-secondary"
            title={t("layout.settingsTooltip")}
          >
            Settings
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
              className={`panel-resizer ${dragging === "tree" ? "dragging" : ""}`}
              onMouseDown={handleMouseDown("tree")}
            />
          </>
        )}

        {/*
          TerminalPanel всегда в одном и том же месте дерева — иначе React
          пересоздаёт компонент при смене позиции AI, убивая PTY-сессии.
          AI панель "снизу" рендерится внутри этого же wrapper,
          AI панель "справа" рендерится снаружи — структура wrapper не меняется.
        */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden min-h-0">
            <TerminalPanel />
          </div>

          {/* AI Panel — bottom position */}
          {showAiPanel && aiPanelPosition === "bottom" && (
            <>
              <div
                className={`panel-resizer-horizontal ${dragging === "ai" ? "dragging" : ""}`}
                onMouseDown={handleMouseDown("ai")}
              />
              <div className="shrink-0 overflow-hidden" style={{ height: aiPanelHeight }}>
                <AiPanel />
              </div>
            </>
          )}
        </div>

        {/* AI Panel — right position */}
        {showAiPanel && aiPanelPosition === "right" && (
          <>
            <div
              className={`panel-resizer ${dragging === "ai" ? "dragging" : ""}`}
              onMouseDown={handleMouseDown("ai")}
            />
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: aiPanelWidth }}
            >
              <AiPanel />
            </div>
          </>
        )}

        {/* Wiki Panel */}
        {showWikiPanel && (
          <>
            <div
              className={`panel-resizer ${dragging === "wiki" ? "dragging" : ""}`}
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
