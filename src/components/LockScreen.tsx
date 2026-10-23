// ══════════════════════════════════════════════════════════════════
// LockScreen — экран ввода пароля
// ══════════════════════════════════════════════════════════════════
// При запуске (основной интерфейс и данные до разблокировки не монтируются
// вовсе) и при автоблокировке по бездействию — см. App.tsx.
// 1. Пустой пароль не проверяем.
// 2. Пароль сверяется с хешем в БД. Исходы: а) верный — разблокировка;
//    б) неверный — сообщение, поле очищается; в) проверка не удалась — то же
//    сообщение, поле остаётся.
// Фон — декоративный «терминал»: на canvas медленно ползут строки команд
// цветами активной темы.

import { useEffect, useRef, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { verifyPassword } from "../lib/tauriCommands";

// Декоративные строки — к данным пользователя не относятся
const LINES = [
  "$ ssh deploy@prod-01",
  "Last login: Mon Oct  2 09:14:07 2026",
  "$ git pull --rebase origin main",
  "Already up to date.",
  "$ docker compose ps",
  "api      running   0.0.0.0:8080->8080/tcp",
  "worker   running",
  "$ tail -f /var/log/app/access.log",
  "GET /health 200 1.2ms",
  "POST /api/v1/sessions 201 18.4ms",
  "$ npm run build",
  "✓ built in 2.41s",
  "$ cargo test",
  "test result: ok. 42 passed; 0 failed",
  "$ kubectl get pods -n production",
  "web-7d9c5f6b8-x2k4p   1/1   Running   0   3d",
  "$ psql -c 'select count(*) from events'",
  " count ",
  "-------",
  " 18342",
  "$ htop",
  "$ systemctl status nginx",
  "● nginx.service - A high performance web server",
  "   Active: active (running)",
];

/** idle — экран показан автоблокировкой по бездействию, а не при запуске */
export function LockScreen({ onUnlock, idle = false }: { onUnlock: () => void; idle?: boolean }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Пустой или уже проверяется.
    if (!password || busy) return;

    // 2. Проверка.
    setBusy(true);
    setError(false);

    try {
      if (await verifyPassword(password)) return onUnlock();

      setError(true);
      setPassword("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface-0 text-text-primary select-none">
      <TerminalBackground />

      <div className="absolute inset-0 flex items-center justify-center">
        <form
          onSubmit={submit}
          className="w-80 flex flex-col items-center gap-4 rounded-2xl border border-border backdrop-blur-md px-8 py-8 shadow-2xl"
          // surface-0 задан hex-переменной — tailwind-модификатор /70 к нему не применим
          style={{ background: "color-mix(in srgb, var(--surface-0) 70%, transparent)" }}
        >
          <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-secondary">
            <Lock size={24} />
          </div>
          <div className="text-lg font-semibold tracking-wide text-text-primary">consoles.work</div>
          <div className="text-sm text-text-secondary -mt-2 text-center">
            {idle ? t("security.lockedIdle") : t("security.subtitle")}
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            autoFocus
            autoComplete="current-password"
            placeholder={t("security.placeholder")}
            disabled={busy}
            className={`w-full h-10 bg-surface-1 border rounded-md px-3 text-sm text-center outline-none text-text-primary disabled:opacity-60 ${
              error ? "border-danger" : "border-border focus:border-accent"
            }`}
          />
          {error && <div className="text-2xs text-danger -mt-2">{t("security.wrong")}</div>}
          <button
            type="submit"
            disabled={!password || busy}
            className="w-full h-10 rounded-md bg-accent text-white text-sm flex items-center justify-center gap-2 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("security.unlock")}
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// Фон
// ══════════════════════════════════════

const LINE_H = 18;
const COL_W = 380;

/** Колонка фона: смещение по списку строк, скорость (px/мс) и фаза скролла */
interface Column {
  offset: number;
  speed: number;
  scroll: number;
}

/** Анимированный фон: несколько колонок терминального вывода, скролл вверх */
function TerminalBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    let palette = readPalette();
    let width = 0;
    let height = 0;
    let cols: Column[] = [];

    // Размер холста — по окну с учётом плотности пикселей; колонки — заново
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Array.from({ length: Math.max(1, Math.ceil(width / COL_W)) }, () => ({
        offset: Math.floor(Math.random() * LINES.length),
        speed: 0.008 + Math.random() * 0.012,
        scroll: Math.random() * LINE_H,
      }));
    };

    resize();

    window.addEventListener("resize", resize);

    // Сменилась тема — новые цвета
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
    });

    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      // Длинная пауза (вкладка была скрыта) — не прыгаем
      const dt = Math.min(64, now - last);

      last = now;

      ctx.clearRect(0, 0, width, height);
      ctx.font = '12px "JetBrains Mono", "SF Mono", Menlo, monospace';
      ctx.textBaseline = "top";

      const frame = { ctx, height, dt, palette };

      cols.forEach((col, ci) => drawColumn(col, 24 + ci * COL_W, frame));

      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Мягкое свечение акцентным цветом в центре */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgb(var(--accent) / 0.12) 0%, transparent 60%)" }}
      />
    </>
  );
}

/** Сдвинуть колонку на dt и нарисовать: команды ($) — акцентом, вывод — приглушённо, к краям — затухание */
function drawColumn(col: Column, x: number, { ctx, height, dt, palette }: Frame) {
  col.scroll += col.speed * dt;

  // Прокрутили строку целиком — следующая строка списка
  while (col.scroll >= LINE_H) {
    col.scroll -= LINE_H;
    col.offset = (col.offset + 1) % LINES.length;
  }

  const rows = Math.ceil(height / LINE_H) + 2;

  for (let r = 0; r < rows; r++) {
    const text = LINES[(col.offset + r) % LINES.length];
    const y = r * LINE_H - col.scroll;
    const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, y / height)));
    const isCmd = text.startsWith("$");

    ctx.globalAlpha = (isCmd ? 0.45 : 0.25) * fade;
    ctx.fillStyle = isCmd ? `rgb(${palette.accent})` : palette.muted;

    ctx.fillText(text, x, y);
  }
}

/** Кадр анимации: холст, высота окна, прошедшее время (мс), цвета темы */
interface Frame {
  ctx: CanvasRenderingContext2D;
  height: number;
  dt: number;
  palette: Palette;
}

interface Palette {
  /** RGB через запятую — для rgb(...) */
  accent: string;
  muted: string;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);

  return {
    accent: cs.getPropertyValue("--accent").trim().replace(/\s+/g, ", ") || "88, 166, 255",
    muted: cs.getPropertyValue("--text-muted").trim() || "#484f58",
  };
}
