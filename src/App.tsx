import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/Toast";
import { useAppStore } from "./stores/appStore";
import { loadAllWorkspaces } from "./lib/tauriCommands";

// ══════════════════════════════════════
// App — корневой компонент
// ══════════════════════════════════════

function App() {
  const { setWorkspaces, toggleTreePanel, toggleWikiPanel, showToast } = useAppStore();

  // Загрузка данных из SQLite при старте
  useEffect(() => {
    loadAllWorkspaces()
      .then(setWorkspaces)
      .catch((e) => showToast("error", `Ошибка загрузки данных: ${e}`));
  }, [setWorkspaces, showToast]);

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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTreePanel, toggleWikiPanel]);

  return (
    <>
      <Layout />
      <ToastContainer />
    </>
  );
}

export default App;
