import { useEffect, useState } from "react";

/**
 * Клавиатура в списке результатов: стрелки — по списку, Enter — выбрать,
 * Escape — закрыть. Сменился `resetKey` (новый запрос) — выбор снова на первом.
 */
export function useListNavigation<T>(items: T[], onSelect: (item: T) => void, onClose: () => void, resetKey: unknown) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [resetKey]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();

    if (e.key === "Enter" && items[index]) return onSelect(items[index]);

    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];

    if (!step) return;

    e.preventDefault();

    setIndex((i) => Math.max(0, Math.min(i + step, items.length - 1)));
  };

  return { index, setIndex, onKeyDown };
}
