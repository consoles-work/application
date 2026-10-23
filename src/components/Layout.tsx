import { useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { TreePanel } from "./TreePanel";
import { TerminalPanel } from "./TerminalPanel";
import { WikiPanel } from "./WikiPanel";
import { AiPanel } from "./AiPanel";
import { useTranslation } from "react-i18next";
import { Bot, BarChart3, KeyRound } from "lucide-react";
import { APP_NAME, SITE_URL, displayUrl, openExternal } from "../lib/appInfo";

// ══════════════════════════════════════
// Layout — заголовок окна и четыре панели
// ══════════════════════════════════════
// Дерево | терминал (+ AI снизу) | AI справа | wiki. Панели скрываются кнопками
// в заголовке и горячими клавишами; границы между ними тянутся мышью в
// пределах MIN–MAX. Ширина дерева запоминается между запусками, остальные
// размеры — только до перезапуска.
// Терминал всегда в одном и том же месте дерева React: иначе смена позиции
// AI-панели пересоздала бы его вместе с PTY-сессиями.

type Resizable = "tree" | "wiki" | "ai";

/** Пределы размеров панелей, px */
const LIMITS = {
  tree: [180, 500],
  wiki: [250, 600],
  aiWidth: [250, 600],
  aiHeight: [150, 600],
} as const;

interface LayoutProps {
  onOpenSettings: () => void;
  /** Нет — статистика выключена в настройках, кнопку не показываем */
  onOpenStats?: () => void;
  onOpenSshKeys?: () => void;
  /** Критичных проблем SSH-ключей — точка у кнопки */
  sshKeysAlert?: number;
}

export function Layout({ onOpenSettings, onOpenStats, onOpenSshKeys, sshKeysAlert = 0 }: LayoutProps) {
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
    toggleTreePanel,
    toggleWikiPanel,
    saveSetting,
  } = useAppStore();
  const { t } = useTranslation();

  const [dragging, setDragging] = useState<Resizable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Новый размер панели по положению курсора
  const resize = (panel: Resizable, e: MouseEvent, rect: DOMRect) => {
    if (panel === "tree") return setTreePanelWidth(clamp(e.clientX - rect.left, LIMITS.tree));

    if (panel === "wiki") return setWikiPanelWidth(clamp(rect.right - e.clientX, LIMITS.wiki));

    if (aiPanelPosition === "bottom") return setAiPanelHeight(clamp(rect.bottom - e.clientY, LIMITS.aiHeight));

    // Справа AI-панель стоит перед wiki: её ширина — от левого края wiki (+ сплиттер)
    const rightBound = rect.right - (showWikiPanel ? wikiPanelWidth + 4 : 0);

    setAiPanelWidth(clamp(rightBound - e.clientX, LIMITS.aiWidth));
  };

  const startResize = (panel: Resizable) => (e: React.MouseEvent) => {
    e.preventDefault();

    setDragging(panel);

    const onMove = (ev: MouseEvent) => {
      if (containerRef.current) resize(panel, ev, containerRef.current.getBoundingClientRect());
    };

    const onUp = () => {
      setDragging(null);

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      // Ширина дерева переживает перезапуск
      if (panel === "tree") saveSetting("ui.treePanelWidth", String(useAppStore.getState().treePanelWidth));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const cursor = dragging && (dragging === "ai" && aiPanelPosition === "bottom" ? "row-resize" : "col-resize");

  return (
    <div ref={containerRef} className="h-screen flex flex-col bg-surface-0 select-none" style={{ cursor: cursor || undefined }}>
      {/* ── Title bar ── */}
      <div className="h-10 flex items-center px-4 bg-surface-1 border-b border-border drag-region shrink-0">
        <button
          onClick={() => openExternal(SITE_URL)}
          className="text-xs font-semibold text-text-secondary hover:text-accent hover:underline underline-offset-2 no-drag"
          title={displayUrl(SITE_URL)}
        >
          {APP_NAME}
        </button>
        <div className="flex-1" />
        <div className="flex gap-1 no-drag">
          <button
            onClick={toggleTreePanel}
            className={`px-2 py-1 rounded text-2xs ${panelToggleCls(showTreePanel)}`}
            title="Toggle Tree (Ctrl+B)"
          >
            Tree
          </button>
          <button
            onClick={toggleAiPanel}
            className={`px-2 py-1 rounded text-2xs flex items-center gap-1 ${panelToggleCls(showAiPanel)}`}
            title="AI Ассистент (Cmd+I)"
          >
            <Bot className="w-3 h-3" />
            {terminalSelection && !showAiPanel && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
          <button
            onClick={toggleWikiPanel}
            className={`px-2 py-1 rounded text-2xs ${panelToggleCls(showWikiPanel)}`}
            title="Toggle Wiki (Ctrl+\)"
          >
            Wiki
          </button>
          {onOpenSshKeys && (
            <button
              onClick={onOpenSshKeys}
              className="relative px-2 py-1 rounded text-2xs text-text-muted hover:text-text-secondary flex items-center"
              title={sshKeysAlert > 0 ? t("sshKeys.alertTooltip", { count: sshKeysAlert }) : t("sshKeys.title")}
            >
              <KeyRound className="w-3 h-3" />
              {sshKeysAlert > 0 && <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />}
            </button>
          )}
          {onOpenStats && (
            <button
              onClick={onOpenStats}
              className="px-2 py-1 rounded text-2xs text-text-muted hover:text-text-secondary flex items-center"
              title={t("stats.title")}
            >
              <BarChart3 className="w-3 h-3" />
            </button>
          )}
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
              onMouseDown={startResize("tree")}
            />
          </>
        )}

        {/* AI-панель «снизу» — внутри этой обёртки, «справа» — снаружи: обёртка терминала не меняется */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden min-h-0">
            <TerminalPanel />
          </div>

          {/* AI Panel — bottom position */}
          {showAiPanel && aiPanelPosition === "bottom" && (
            <>
              <div
                className={`panel-resizer-horizontal ${dragging === "ai" ? "dragging" : ""}`}
                onMouseDown={startResize("ai")}
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
              onMouseDown={startResize("ai")}
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
              onMouseDown={startResize("wiki")}
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

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.max(min, Math.min(max, value));
}

/** Кнопка панели в заголовке: панель видна / скрыта */
function panelToggleCls(on: boolean): string {
  return on ? "bg-accent-subtle text-accent" : "text-text-muted hover:text-text-secondary";
}
