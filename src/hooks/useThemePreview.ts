// ══════════════════════════════════════════════════════════════════
// useThemePreview — предпросмотр темы при наведении в настройках
// ══════════════════════════════════════════════════════════════════
//
// Кнопки тем в «Настройки → Интерфейс» зовут hover / leave / pick:
//  1. Курсор задержался на кнопке — тема показывается на всём окне, но в
//     настройки не пишется. Пока предпросмотр идёт, соседние темы при
//     наведении показываются сразу, без новой задержки.
//  2. Курсор ушёл с кнопок, не нажав, — возвращается выбранная тема; ушёл
//     раньше задержки — ничего не происходит. Откат ждёт короткую паузу:
//     переход на соседнюю кнопку через зазор между ними не мигает.
//  3. Нажатие — тема выбирается как обычно (настройка пишется в БД и стор),
//     примерка снимается, когда выбор сохранён: иначе на время записи
//     мелькнула бы прежняя тема. Не сохранилось — вернётся прежняя.
//  Закрыли настройки (или ушли с вкладки) посреди предпросмотра — откат.
//
// Примеряемая тема живёт в сторе (`previewTheme`), а не только на <html>:
// цвета xterm и водяного знака терминал берёт из стора. Показывает её эффект
// темы в App.tsx — хук только решает, какую тему примерять и когда.
// Хук создаётся один раз на весь список тем (тёмные и светлые группы — общий),
// иначе переход между группами терял бы состояние предпросмотра.

import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

/** Шаг 1: сколько держать курсор на кнопке, прежде чем показать тему. */
const PREVIEW_DELAY_MS = 1000;

/** Шаг 2: пауза перед откатом — успеть перейти на соседнюю кнопку. */
const RESTORE_DELAY_MS = 150;

export function useThemePreview(onPick: (id: string) => void | Promise<void>) {
  // Один таймер на ожидание показа и ожидание отката: любое событие сначала
  // сбрасывает его — откат не сработает поверх новой темы.
  const timer = useRef<number | undefined>(undefined);

  const previewing = useRef(false);

  const setPreviewTheme = useAppStore((s) => s.setPreviewTheme);

  // Откат: снять примерку — App.tsx покажет выбранную тему из стора.
  const restore = () => {
    window.clearTimeout(timer.current);

    if (!previewing.current) return;

    previewing.current = false;

    setPreviewTheme(null);
  };

  // 1. Задержались — показываем; предпросмотр уже идёт — показываем сразу.
  const hover = (id: string) => {
    window.clearTimeout(timer.current);

    if (previewing.current) {
      setPreviewTheme(id);

      return;
    }

    timer.current = window.setTimeout(() => {
      previewing.current = true;

      setPreviewTheme(id);
    }, PREVIEW_DELAY_MS);
  };

  // 3. Выбрали — примерка держится, пока выбор не сохранён; потом снимается,
  //    если за это время не началась новая.
  const pick = async (id: string) => {
    window.clearTimeout(timer.current);

    previewing.current = false;

    await onPick(id);

    if (!previewing.current) setPreviewTheme(null);
  };

  // 2. Ушли с кнопки — откат после паузы (новое наведение его отменит).
  const leave = () => {
    window.clearTimeout(timer.current);

    if (previewing.current) timer.current = window.setTimeout(restore, RESTORE_DELAY_MS);
  };

  // Закрыли настройки посреди предпросмотра — откат.
  useEffect(() => restore, []); // eslint-disable-line react-hooks/exhaustive-deps -- только при размонтировании

  return { hover, leave, pick };
}
