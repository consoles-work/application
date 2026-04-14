import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalSearch } from "./components/GlobalSearch";
import { SettingsDialog } from "./components/SettingsDialog";
import { useAppStore } from "./stores/appStore";
import { loadAllWorkspaces, getSettings, loadAiSessions, createAiSession } from "./lib/tauriCommands";
import { applyTheme } from "./lib/themes";
import { useTranslation } from "react-i18next";
import i18n from "./lib/i18n";

// ══════════════════════════════════════
// App — корневой компонент
// ══════════════════════════════════════

function App() {
  const { setWorkspaces, setSettings, toggleTreePanel, toggleWikiPanel, setShowTreePanel, setShowWikiPanel, showToast, toggleAiPanel, setShowAiPanel, setAiPanelPosition, setAiSessions, setActiveAiSessionId, setTreePanelWidth } = useAppStore();
  const { t } = useTranslation();
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Загрузка данных из SQLite при старте
  useEffect(() => {
    loadAllWorkspaces()
      .then(setWorkspaces)
      .catch((e) => showToast("error", t("app.toastLoadError", { error: e })));

    // Загружаем AI сессии; если нет — создаём первую
    loadAiSessions().then(async (sessions) => {
      if (sessions.length === 0) {
        const first = await createAiSession("Новый чат", "openai", "").catch(() => null);
        if (first) {
          setAiSessions([first]);
          setActiveAiSessionId(first.id);
        }
      } else {
        setAiSessions(sessions);
        setActiveAiSessionId(sessions[0].id);
      }
    }).catch(() => {});

    getSettings().then((s) => {
      setSettings(s);
      applyTheme(s["ui.theme"] ?? "dark");
      i18n.changeLanguage(s["ui.language"] ?? "ru");
      // Восстанавливаем видимость панелей (по умолчанию — показывать)
      if (s["ui.showTreePanel"] !== undefined) setShowTreePanel(s["ui.showTreePanel"] !== "false");
      if (s["ui.showWikiPanel"] !== undefined) setShowWikiPanel(s["ui.showWikiPanel"] !== "false");
      if (s["ui.showAiPanel"] !== undefined) setShowAiPanel(s["ui.showAiPanel"] === "true");
      if (s["ui.aiPanelPosition"] !== undefined) setAiPanelPosition(s["ui.aiPanelPosition"] as "right" | "bottom");
      if (s["ui.treePanelWidth"] !== undefined) {
        const w = parseInt(s["ui.treePanelWidth"]);
        if (w >= 180 && w <= 500) setTreePanelWidth(w);
      }
    }).catch(() => {});
  }, [setWorkspaces, setSettings, showToast]);

  // Применяем тему при изменении настроек
  const { settings } = useAppStore();
  useEffect(() => {
    applyTheme(settings["ui.theme"] ?? "dark");
  }, [settings["ui.theme"]]);

  // Отключаем нативное контекстное меню WebKit (убирает "Reload" при ПКМ на пустом месте)
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "b") { e.preventDefault(); toggleTreePanel(); }
      if (mod && e.key === "\\") { e.preventDefault(); toggleWikiPanel(); }
      if (mod && e.key === "p") { e.preventDefault(); setShowPalette(true); }
      if (mod && e.key === ",") { e.preventDefault(); setShowSettings(true); }
      if (mod && e.key === "i") { e.preventDefault(); toggleAiPanel(); }

      // Cmd+Shift+K — глобальный поиск по wiki
      if (mod && e.shiftKey && e.key === "K") {
        e.preventDefault();
        setShowGlobalSearch(true);
      }

      // Cmd+W — закрыть активную вкладку терминала
      if (mod && !e.shiftKey && e.key === "w") {
        e.preventDefault();
        const { activeSessionId, closeSession } = useAppStore.getState();
        if (activeSessionId) closeSession(activeSessionId);
      }

      // Cmd+Tab / Cmd+Shift+Tab — следующая / предыдущая вкладка
      if (mod && e.key === "Tab") {
        e.preventDefault();
        const { sessions, activeSessionId, setActiveSession } = useAppStore.getState();
        if (sessions.length <= 1) return;
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx === -1) return;
        const next = e.shiftKey
          ? (idx - 1 + sessions.length) % sessions.length
          : (idx + 1) % sessions.length;
        setActiveSession(sessions[next].id);
      }

      // Cmd+1..9 — перейти на вкладку N
      if (mod && !e.shiftKey && e.key >= "1" && e.key <= "9") {
        const n = parseInt(e.key) - 1;
        const { sessions, setActiveSession } = useAppStore.getState();
        if (sessions[n]) {
          e.preventDefault();
          setActiveSession(sessions[n].id);
        }
      }

      // Cmd+T — открыть новую сессию для выбранной консоли
      if (mod && !e.shiftKey && e.key === "t") {
        e.preventDefault();
        const { selectedNode, sessions, openSession, workspaces } = useAppStore.getState();
        if (selectedNode?.type === "console") {
          const alreadyOpen = sessions.find((s) => s.console_id === selectedNode.id);
          if (!alreadyOpen) {
            let consoleName = selectedNode.id;
            for (const ws of workspaces) {
              for (const proj of ws.projects) {
                const con = proj.consoles.find((c) => c.id === selectedNode.id);
                if (con) { consoleName = con.name; break; }
              }
            }
            openSession({ id: `session-${Date.now()}`, console_id: selectedNode.id, title: consoleName, is_active: true });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTreePanel, toggleWikiPanel, toggleAiPanel]);

  return (
    <>
      <Layout onOpenSettings={() => setShowSettings(true)} />
      <ToastContainer />
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  );
}

export default App;
