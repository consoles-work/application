import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../../stores/appStore";
import { createWorkspace } from "../../lib/tauriCommands";
import { useTranslation } from "react-i18next";

const EMOJI_OPTIONS = ["💼", "🚀", "🌙", "⚡", "🔥", "🎯", "🛠️", "📦", "🌐", "🎨", "🔬", "💡"];
const COLOR_OPTIONS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#bc8cff", "#f778ba", "#39c5cf", "#ff7b72"];

interface Props {
  onClose: () => void;
}

export function CreateWorkspaceDialog({ onClose }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💼");
  const [color, setColor] = useState("#58a6ff");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addWorkspace, showToast } = useAppStore();
  const { t } = useTranslation();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const ws = await createWorkspace(name.trim(), icon, color);
      addWorkspace(ws);
      showToast("success", t("dialogs.toastWorkspaceCreated", { name: ws.name }));
      onClose();
    } catch (err) {
      showToast("error", t("dialogs.toastError", { error: err }));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="bg-surface-2 border border-border rounded-xl shadow-2xl w-80 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t("dialogs.newWorkspace")}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Name */}
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dialogs.namePlaceholder")}
            className="px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent"
          />

          {/* Emoji picker */}
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

          {/* Color picker */}
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
