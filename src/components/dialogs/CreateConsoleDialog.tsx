import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../../stores/appStore";
import { createConsole, setNodeDanger } from "../../lib/tauriCommands";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function CreateConsoleDialog({ projectId, onClose }: Props) {
  const [name, setName] = useState("");
  const [startupCmd, setStartupCmd] = useState("");
  const [isDanger, setIsDanger] = useState(false);
  const [dangerLabel, setDangerLabel] = useState("PRODUCTION");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addConsole, showToast } = useAppStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const con = await createConsole(projectId, name.trim(), startupCmd.trim() || undefined);
      const finalLabel = dangerLabel.trim() || "PRODUCTION";
      if (isDanger) {
        await setNodeDanger(con.id, "console", true, finalLabel);
      }
      addConsole(projectId, { ...con, isDanger, dangerLabel: finalLabel });
      showToast("success", `Консоль «${con.name}» создана`);
      onClose();
    } catch (err) {
      showToast("error", `Ошибка: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="bg-surface-2 border border-border rounded-xl shadow-2xl w-80 p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-text-primary mb-4">Новая консоль</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (dev-server, logs...)"
            className="px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent"
          />
          <div>
            <div className="text-2xs text-text-muted mb-1">Стартовая команда (опционально)</div>
            <input
              value={startupCmd}
              onChange={(e) => setStartupCmd(e.target.value)}
              placeholder="npm run dev"
              className="w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent font-mono"
            />
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
              <span className="text-xs text-text-primary">⚠ Пометить как опасный</span>
            </label>
            {isDanger && (
              <input
                value={dangerLabel}
                onChange={(e) => setDangerLabel(e.target.value)}
                placeholder="Метка (PRODUCTION, STAGING...)"
                className="px-2 py-1.5 rounded-md bg-surface-2 border border-red-500/40 text-xs text-red-400 outline-none focus:border-red-500 font-mono"
              />
            )}
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-3">
              Отмена
            </button>
            <button type="submit" disabled={!name.trim() || loading}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40">
              {loading ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}