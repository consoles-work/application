import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDialog } from "./components/SettingsDialog";
import { useAppStore } from "./stores/appStore";
import { loadAllWorkspaces, getSettings } from "./lib/tauriCommands";
import { applyTheme } from "./lib/themes";
import { useTranslation } from "react-i18next";
import i18n from "./lib/i18n";

// ══════════════════════════════════════
// App — корневой компонент
// ══════════════════════════════════════

function App() {
  const { setWorkspaces, setSettings, toggleTreePanel, toggleWikiPanel, showToast } = useAppStore();
  const { t } = useTranslation();
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Загрузка данных из SQLite при старте
  useEffect(() => {
    loadAllWorkspaces()
      .then(setWorkspaces)
      .catch((e) => showToast("error", t("app.toastLoadError", { error: e })));

    getSettings().then((s) => {
      setSettings(s);
      applyTheme(s["ui.theme"] ?? "dark");
      i18n.changeLanguage(s["ui.language"] ?? "ru");
    }).catch(() => {});
  }, [setWorkspaces, setSettings, showToast]);

  // Применяем тему при изменении настроек
  const { settings } = useAppStore();
  useEffect(() => {
    applyTheme(settings["ui.theme"] ?? "dark");
  }, [settings["ui.theme"]]);

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "b") {
        e.preventDefault();
        toggleTreePanel();
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        toggleWikiPanel();
      }
      if (mod && e.key === "p") {
        e.preventDefault();
        setShowPalette(true);
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTreePanel, toggleWikiPanel]);

  return (
    <>
      <Layout onOpenSettings={() => setShowSettings(true)} />
      <ToastContainer />
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  );
}

export default App;
