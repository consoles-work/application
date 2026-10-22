import { Fragment, useMemo } from "react";
import { splitLinks, openLink } from "../lib/links";

/**
 * Текст, в котором http(s)- и mailto-ссылки кликабельны (открываются в системном
 * браузере). `href` не ставим: клик по настоящей ссылке может увести сам webview.
 * Всплытие клика гасим — ссылка бывает внутри кликабельного блока (заметка консоли).
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts = useMemo(() => splitLinks(text), [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.url ? (
          <a
            key={i}
            role="link"
            title={p.url}
            className="text-accent underline underline-offset-2 cursor-pointer hover:text-accent-hover"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openLink(p.url);
            }}
          >
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        )
      )}
    </>
  );
}
