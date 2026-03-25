import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

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

function ToastItem({
  toast,
  onClose,
}: {
  toast: { id: string; type: "success" | "error" | "info"; message: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "border-success text-success",
    error:   "border-danger  text-danger",
    info:    "border-accent  text-accent",
  };

  const icons = { success: "✓", error: "✕", info: "i" };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface-2 shadow-lg text-xs animate-fade-in ${colors[toast.type]}`}
    >
      <span className="font-bold">{icons[toast.type]}</span>
      <span className="text-text-primary">{toast.message}</span>
      <button
        className="ml-1 text-text-muted hover:text-text-primary"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}