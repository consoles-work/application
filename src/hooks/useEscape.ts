import { useEffect } from "react";

/** Escape в любом месте окна — `onEscape` (закрыть диалог, меню). `enabled: false` — не слушать. */
export function useEscape(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape, enabled]);
}
