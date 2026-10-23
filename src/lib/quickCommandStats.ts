import type { TFunction } from "i18next";
import type { QuickCommand } from "../types";

// Средняя скорость набора ≈ 40 слов/мин ≈ 200 символов/мин.
// Оценка намеренно грубая: длина команды ÷ скорость набора, без учёта опечаток и вспоминания команды.
export const TYPING_CHARS_PER_MINUTE = 200;

/** Всего запусков и «не набранных» символов по кнопкам консоли */
export function sumQuickCommandStats(commands: QuickCommand[]) {
  return commands.reduce(
    (acc, c) => ({ runs: acc.runs + (c.runCount ?? 0), chars: acc.chars + (c.savedChars ?? 0) }),
    { runs: 0, chars: 0 }
  );
}

// «≈ 45 сек» / «≈ 12 мин» / «≈ 2 ч 5 мин»
export function formatSavedTime(chars: number, t: TFunction): string {
  const seconds = Math.round((chars * 60) / TYPING_CHARS_PER_MINUTE);

  if (seconds < 60) return t("quickCommands.savedSec", { value: seconds });

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return t("quickCommands.savedMin", { value: minutes });

  return t("quickCommands.savedHourMin", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}
