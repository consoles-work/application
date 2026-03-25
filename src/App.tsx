import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { useAppStore } from "./stores/appStore";
import type { Workspace, Project, ConsoleConfig } from "./types";

// ══════════════════════════════════════
// App — корневой компонент
// ══════════════════════════════════════

function App() {
  const { setWorkspaces, toggleTreePanel, toggleWikiPanel } = useAppStore();

  // Загрузка данных при старте
  useEffect(() => {
    // TODO: заменить на loadAllWorkspaces() из tauriCommands
    // когда будет готов Rust-бэкенд. Пока — демо-данные.
    const demoData: Workspace[] = [
      {
        id: "ws-1",
        name: "Основная работа",
        icon: "💼",
        color: "#58a6ff",
        sort_order: 0,
        is_expanded: true,
        projects: [
          {
            id: "proj-1",
            workspace_id: "ws-1",
            name: "Backend API",
            icon: "🔧",
            color: "#3fb950",
            path: "/home/user/projects/backend-api",
            default_shell: "bash",
            env_vars: { NODE_ENV: "development" },
            sort_order: 0,
            is_expanded: true,
            consoles: [
              {
                id: "con-1",
                project_id: "proj-1",
                name: "dev-server",
                startup_cmd: "npm run dev",
                sort_order: 0,
              },
              {
                id: "con-2",
                project_id: "proj-1",
                name: "docker-logs",
                startup_cmd: "docker-compose logs -f",
                sort_order: 1,
              },
              {
                id: "con-3",
                project_id: "proj-1",
                name: "ssh prod",
                startup_cmd: "ssh user@prod-server.com",
                sort_order: 2,
              },
            ],
          },
          {
            id: "proj-2",
            workspace_id: "ws-1",
            name: "Frontend App",
            icon: "🎨",
            color: "#d29922",
            path: "/home/user/projects/frontend",
            default_shell: "zsh",
            env_vars: {},
            sort_order: 1,
            is_expanded: false,
            consoles: [
              {
                id: "con-4",
                project_id: "proj-2",
                name: "vite dev",
                startup_cmd: "npm run dev",
                sort_order: 0,
              },
              {
                id: "con-5",
                project_id: "proj-2",
                name: "storybook",
                startup_cmd: "npm run storybook",
                sort_order: 1,
              },
            ],
          },
        ],
      },
      {
        id: "ws-2",
        name: "Фриланс",
        icon: "🌙",
        color: "#bc8cff",
        sort_order: 1,
        is_expanded: false,
        projects: [
          {
            id: "proj-3",
            workspace_id: "ws-2",
            name: "Client Website",
            icon: "🌐",
            color: "#f778ba",
            path: "/home/user/freelance/client-site",
            default_shell: "bash",
            env_vars: {},
            sort_order: 0,
            is_expanded: false,
            consoles: [
              {
                id: "con-6",
                project_id: "proj-3",
                name: "dev",
                startup_cmd: "npm run dev",
                sort_order: 0,
              },
            ],
          },
        ],
      },
      {
        id: "ws-3",
        name: "Pet Projects",
        icon: "🚀",
        color: "#f85149",
        sort_order: 2,
        is_expanded: false,
        projects: [],
      },
    ];

    setWorkspaces(demoData);
  }, [setWorkspaces]);

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

  return <Layout />;
}

export default App;
