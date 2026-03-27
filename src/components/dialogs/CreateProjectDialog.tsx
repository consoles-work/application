import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { createProject, setNodeDanger } from "../../lib/tauriCommands";
import type { ShellType } from "../../types";
import { useTranslation } from "react-i18next";

const EMOJI_OPTIONS = ["📁", "🔧", "🎨", "🌐", "🔬", "📱", "⚙️", "🗄️", "🤖", "📊", "🔐", "🧪"];
const COLOR_OPTIONS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#bc8cff", "#f778ba", "#39c5cf", "#ff7b72"];
const SHELLS: ShellType[] = ["bash", "zsh", "fish", "powershell", "cmd"];

interface Props {
  workspaceId: string;
  onClose: () => void;
}

export function CreateProjectDialog({ workspaceId, onClose }: Props) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [shell, setShell] = useState<ShellType>("zsh");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("#58a6ff");
  const [isDanger, setIsDanger] = useState(false);
  const [dangerLabel, setDangerLabel] = useState("PRODUCTION");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addProject, showToast } = useAppStore();
  const { t } = useTranslation();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === "string") setPath(selected);
    } catch (e) {
      showToast("error", t("dialogs.toastDirSelectError", { error: e }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const proj = await createProject(workspaceId, name.trim(), path, shell);
      const finalLabel = dangerLabel.trim() || "PRODUCTION";
      if (isDanger) {
        await setNodeDanger(proj.id, "project", true, finalLabel);
      }
      addProject(workspaceId, { ...proj, icon, color, isDanger, dangerLabel: finalLabel });
      showToast("success", t("dialogs.toastProjectCreated", { name: proj.name }));
      onClose();
    } catch (err) {
      showToast("error", t("dialogs.toastError", { error: err }));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="bg-surface-2 border border-border rounded-xl shadow-2xl w-96 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t("dialogs.newProject")}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Name */}
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dialogs.projectNamePlaceholder")}
            className="px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent"
          />

          {/* Path + Browse */}
          <div className="flex gap-2">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={t("dialogs.pathPlaceholder")}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent font-mono text-xs"
            />
            <button type="button" onClick={handleBrowse}
              className="px-3 py-2 text-xs bg-surface-3 hover:bg-surface-1 text-text-secondary rounded-lg border border-border">
              {t("common.browse")}
            </button>
          </div>

          {/* Shell */}
          <div>
            <div className="text-2xs text-text-muted mb-1">{t("dialogs.defaultShell")}</div>
            <div className="flex gap-1">
              {SHELLS.map((s) => (
                <button key={s} type="button" onClick={() => setShell(s)}
                  className={`px-2 py-1 text-xs rounded-lg font-mono ${shell === s ? "bg-accent/20 text-accent border border-accent/40" : "bg-surface-0 text-text-secondary border border-border hover:border-accent/40"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div>
            <div className="text-2xs text-text-muted mb-1">{t("dialogs.icon")}</div>
            <div className="flex flex-wrap gap-1">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} type="button" onClick={() => setIcon(e)}
                  className={`w-8 h-8 rounded-lg text-base ${icon === e ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-surface-3"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="text-2xs text-text-muted mb-1">{t("dialogs.color")}</div>
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-white ring-offset-1 ring-offset-surface-2" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Danger flag */}
          <div className="rounded-lg border border-border bg-surface-0 p-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDanger}
                onChange={(e) => setIsDanger(e.target.checked)}
                className="accent-red-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-text-primary">{t("dialogs.markDangerous")}</span>
            </label>
            {isDanger && (
              <input
                value={dangerLabel}
                onChange={(e) => setDangerLabel(e.target.value)}
                placeholder={t("dialogs.dangerLabelPlaceholder")}
                className="px-2 py-1.5 rounded-md bg-surface-2 border border-red-500/40 text-xs text-red-400 outline-none focus:border-red-500 font-mono"
              />
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-3">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={!name.trim() || loading}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40">
              {loading ? t("common.creating") : t("common.create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
