import { useEffect } from "react";
import { useAppStore, type Toast } from "../stores/appStore";

// Уведомления в правом нижнем углу; каждое исчезает само через TOAST_MS или по крестику

const TOAST_MS = 3000;

const COLORS: Record<Toast["type"], string> = {
  success: "border-success text-success",
  error: "border-danger  text-danger",
  info: "border-accent  text-accent",
};

const ICONS: Record<Toast["type"], string> = { success: "✓", error: "✕", info: "i" };

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_MS);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface-2 shadow-lg text-xs animate-fade-in ${COLORS[toast.type]}`}
    >
      <span className="font-bold">{ICONS[toast.type]}</span>
      <span className="text-text-primary">{toast.message}</span>
      <button className="ml-1 text-text-muted hover:text-text-primary" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
