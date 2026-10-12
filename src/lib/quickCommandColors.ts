import type { QuickCommandColor } from "../types";

// Палитра кнопок быстрых команд. Цвета одинаковые для всех тем:
// на кнопке они идут полупрозрачным фоном и рамкой, текст остаётся цветом темы.
export const QUICK_COMMAND_COLORS: { id: QuickCommandColor; hex: string }[] = [
  { id: "", hex: "" },
  { id: "green", hex: "#22c55e" },
  { id: "blue", hex: "#3b82f6" },
  { id: "yellow", hex: "#eab308" },
  { id: "orange", hex: "#f97316" },
  { id: "red", hex: "#ef4444" },
  { id: "purple", hex: "#a855f7" },
];

export function quickCommandHex(color?: string): string {
  return QUICK_COMMAND_COLORS.find((c) => c.id === color)?.hex ?? "";
}
