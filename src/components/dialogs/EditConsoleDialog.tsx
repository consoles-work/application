import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { updateConsoleConfig } from "../../lib/tauriCommands";
import type { ConsoleConfig } from "../../types";

interface Props {
  console_: ConsoleConfig;
  onClose: () => void;
}

export function EditConsoleDialog({ console_, onClose }: Props) {
  const [name, setName] = useState(console_.name);
  const [connectionType, setConnectionType] = useState<"local" | "ssh">(
    (console_.connectionType as "local" | "ssh") || "local"
  );
  const [startupCmd, setStartupCmd] = useState(console_.startup_cmd || "");

  // SSH fields
  const [sshHost, setSshHost] = useState(console_.sshHost || "");
  const [sshPort, setSshPort] = useState(String(console_.sshPort || 22));
  const [sshUser, setSshUser] = useState(console_.sshUser || "");
  const [sshKeyPath, setSshKeyPath] = useState(console_.sshKeyPath || "");
  const [sshExtraArgs, setSshExtraArgs] = useState(console_.sshExtraArgs || "");

  const [loading, setLoading] = useState(false);
  const { updateConsole: storeUpdateConsole, showToast } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({ multiple: false, directory: false });
      if (typeof selected === "string") setSshKeyPath(selected);
    } catch (e) {
      showToast("error", `Ошибка выбора файла: ${e}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (connectionType === "ssh" && !sshHost.trim()) {
      showToast("error", "Укажите SSH хост");
      return;
    }
    setLoading(true);
    try {
      const port = parseInt(sshPort) || 22;
      await updateConsoleConfig(
        console_.id,
        name.trim(),
        startupCmd.trim() || undefined,
        connectionType,
        sshHost.trim(),
        port,
        sshUser.trim(),
        sshKeyPath.trim(),
        sshExtraArgs.trim()
      );
      storeUpdateConsole(console_.id, {
        name: name.trim(),
        startup_cmd: startupCmd.trim() || undefined,
        connectionType,
        sshHost: sshHost.trim(),
        sshPort: port,
        sshUser: sshUser.trim(),
        sshKeyPath: sshKeyPath.trim(),
        sshExtraArgs: sshExtraArgs.trim(),
      });
      showToast("success", `Консоль «${name.trim()}» обновлена`);
      onClose();
    } catch (err) {
      showToast("error", `Ошибка: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="bg-surface-2 border border-border rounded-xl shadow-2xl w-[440px] p-5 max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-text-primary mb-4">Настройки консоли</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          {/* Name */}
          <div>
            <div className="text-2xs text-text-muted mb-1">Название</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название консоли..."
              className="w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* Connection type */}
          <div>
            <div className="text-2xs text-text-muted mb-1.5">Тип подключения</div>
            <div className="flex gap-1">
              {(["local", "ssh"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setConnectionType(t)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-mono ${connectionType === t ? "bg-accent/20 text-accent border border-accent/40" : "bg-surface-0 text-text-secondary border border-border hover:border-accent/40"}`}>
                  {t === "local" ? "💻 Local" : "🔗 SSH"}
                </button>
              ))}
            </div>
          </div>

          {/* SSH fields */}
          {connectionType === "ssh" && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-0 p-3">
              <div className="text-2xs text-text-muted font-semibold uppercase tracking-wider mb-1">SSH параметры</div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-2xs text-text-muted mb-1">Хост / IP</div>
                  <input value={sshHost} onChange={(e) => setSshHost(e.target.value)}
                    placeholder="192.168.1.10"
                    className="w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono" />
                </div>
                <div className="w-20">
                  <div className="text-2xs text-text-muted mb-1">Порт</div>
                  <input value={sshPort} onChange={(e) => setSshPort(e.target.value)}
                    placeholder="22" type="number" min="1" max="65535"
                    className="w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono" />
                </div>
              </div>

              <div>
                <div className="text-2xs text-text-muted mb-1">Пользователь</div>
                <input value={sshUser} onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono" />
              </div>

              <div>
                <div className="text-2xs text-text-muted mb-1">SSH ключ (опционально)</div>
                <div className="flex gap-2">
                  <input value={sshKeyPath} onChange={(e) => setSshKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    className="flex-1 px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono" />
                  <button type="button" onClick={handleBrowseKey}
                    className="px-2.5 py-1.5 text-xs bg-surface-3 hover:bg-surface-1 text-text-secondary rounded-md border border-border shrink-0">
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <div className="text-2xs text-text-muted mb-1">Доп. аргументы SSH (опционально)</div>
                <input value={sshExtraArgs} onChange={(e) => setSshExtraArgs(e.target.value)}
                  placeholder="-A -C -L 8080:localhost:8080"
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono" />
              </div>
            </div>
          )}

          {/* Startup commands */}
          <div>
            <div className="text-2xs text-text-muted mb-1">
              Стартовые команды <span className="opacity-60">(каждая строка — отдельная команда)</span>
            </div>
            <textarea
              value={startupCmd}
              onChange={(e) => setStartupCmd(e.target.value)}
              placeholder={connectionType === "ssh" ? "cd /var/www/app\ntail -f logs/app.log" : "cd /app\nnpm run dev"}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-3">
              Отмена
            </button>
            <button type="submit" disabled={!name.trim() || loading}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40">
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
