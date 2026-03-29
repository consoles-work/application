<?php
$supported = ['en', 'ru', 'zh', 'fr', 'kk'];

// Установка языка через GET-параметр
if (isset($_GET['lang']) && in_array($_GET['lang'], $supported)) {
    $lang = $_GET['lang'];
    setcookie('lang', $lang, time() + 60 * 60 * 24 * 365, '/');
} elseif (isset($_COOKIE['lang']) && in_array($_COOKIE['lang'], $supported)) {
    $lang = $_COOKIE['lang'];
} else {
    $lang = 'en';
}

$t = require __DIR__ . '/lang/' . $lang . '.php';

// Вспомогательная функция: безопасный вывод (для plain-текста)
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
// Для строк с доверенным HTML-разметкой (kbd, strong) — выводим as-is
function h(string $s): string { return $s; }
?>
<!DOCTYPE html>
<html lang="<?= e($lang) ?>" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= e($t['page_title']) ?></title>
  <meta name="description" content="<?= e($t['page_desc']) ?>" />

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwindcss.config = {
      theme: {
        extend: {
          colors: {
            bg: { 900: '#08090d', 800: '#0e1019', 700: '#151723', 600: '#1c1f2e' },
            stroke: { DEFAULT: '#1e2235', light: '#2a2f47' },
            txt: { 100: '#f0f2f8', 200: '#b4b9ce', 300: '#7b819a', 400: '#4e5370' },
            brand: { DEFAULT: '#6c8aff', light: '#96b0ff', dark: '#4a68e0', glow: 'rgba(108,138,255,0.15)' },
            mint: '#5eebc2', coral: '#ff7a8a', amber: '#ffc26e',
          },
          fontFamily: {
            display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
            body: ['"DM Sans"', 'system-ui', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
          },
        }
      }
    }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

  <style>
    body { background: #08090d; color: #f0f2f8; }
    ::selection { background: rgba(108,138,255,0.3); }
    .hero-glow { position: absolute; width: 800px; height: 600px; border-radius: 50%; filter: blur(120px); opacity: 0.12; pointer-events: none; }
    .glow-blue { background: #6c8aff; left: 10%; top: -10%; }
    .glow-mint { background: #5eebc2; right: 5%; top: 20%; opacity: 0.07; }
    .terminal-line::before { content: attr(data-prefix); color: #5eebc2; margin-right: 0.5rem; }
    .cursor-blink { display: inline-block; width: 8px; height: 18px; background: #6c8aff; animation: blink 1s step-end infinite; vertical-align: text-bottom; margin-left: 2px; }
    @keyframes blink { 50% { opacity: 0; } }
    .app-frame { background: linear-gradient(135deg, #0e1019 0%, #151723 100%); border: 1px solid #1e2235; border-radius: 12px; box-shadow: 0 0 0 1px rgba(108,138,255,0.05), 0 25px 80px rgba(0,0,0,0.5), 0 0 120px rgba(108,138,255,0.04); }
    .app-frame-bar { height: 38px; background: #0e1019; border-bottom: 1px solid #1e2235; border-radius: 12px 12px 0 0; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .feature-card { background: linear-gradient(135deg, rgba(14,16,25,0.8), rgba(21,23,35,0.6)); border: 1px solid #1e2235; transition: all 0.3s ease; }
    .feature-card:hover { border-color: #2a2f47; box-shadow: 0 0 40px rgba(108,138,255,0.06); transform: translateY(-2px); }
    [x-intersect] { opacity: 0; transform: translateY(24px); transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
    .is-visible { opacity: 1 !important; transform: translateY(0) !important; }
    .text-gradient { background: linear-gradient(135deg, #6c8aff 0%, #96b0ff 40%, #5eebc2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .text-gradient-warm { background: linear-gradient(135deg, #ffc26e 0%, #ff7a8a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    kbd { display: inline-block; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #151723; border: 1px solid #2a2f47; border-radius: 4px; color: #b4b9ce; line-height: 1.6; }
    .nav-blur { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
    .platform-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid #1e2235; border-radius: 999px; font-size: 13px; color: #b4b9ce; transition: all 0.2s; }
    .platform-pill:hover { border-color: #6c8aff; color: #f0f2f8; }
    .btn-primary { position: relative; overflow: hidden; }
    .btn-primary::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 45%, transparent 50%); transform: translateX(-100%); transition: transform 0.6s; }
    .btn-primary:hover::after { transform: translateX(100%); }
    .lang-btn { padding: 3px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; transition: all 0.15s; color: #4e5370; text-decoration: none; }
    .lang-btn:hover { color: #b4b9ce; }
    .lang-btn-active { color: #6c8aff; background: rgba(108,138,255,0.12); }
    .not-used-logo { opacity: 0.35; filter: grayscale(1); transition: all 0.3s; }
    .not-used-logo:hover { opacity: 0.6; filter: grayscale(0.5); }
  </style>
</head>

<body class="font-body antialiased overflow-x-hidden">

  <!-- NAV -->
  <nav class="fixed top-0 inset-x-0 z-50 nav-blur"
       x-data="{ scrolled: false }"
       @scroll.window="scrolled = (window.scrollY > 40)"
       :class="scrolled ? 'bg-bg-900/80 border-b border-stroke' : 'bg-transparent'">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <a href="#" class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
        </div>
        <span class="font-display font-semibold text-lg text-txt-100 tracking-tight">Consoles</span>
      </a>

      <div class="hidden md:flex items-center gap-6 text-sm text-txt-300">
        <a href="#features" class="hover:text-txt-100 transition-colors"><?= e($t['nav_features']) ?></a>
        <a href="#interface" class="hover:text-txt-100 transition-colors"><?= e($t['nav_interface']) ?></a>
        <a href="#stack" class="hover:text-txt-100 transition-colors"><?= e($t['nav_tech']) ?></a>
        <a href="#download" class="hover:text-txt-100 transition-colors"><?= e($t['nav_download']) ?></a>

        <!-- Lang switcher -->
        <div class="flex items-center gap-0.5 border-l border-stroke pl-4 ml-2">
          <?php foreach ($supported as $l): ?>
            <a href="?lang=<?= e($l) ?>"
               class="lang-btn<?= $lang === $l ? ' lang-btn-active' : '' ?>"
            ><?= strtoupper(e($l)) ?></a>
          <?php endforeach; ?>
        </div>
      </div>

      <a href="#download" class="btn-primary bg-brand hover:bg-brand-dark text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"><?= e($t['nav_cta']) ?></a>
    </div>
  </nav>


  <!-- HERO -->
  <section class="relative pt-40 pb-24 px-6">
    <div class="hero-glow glow-blue"></div>
    <div class="hero-glow glow-mint"></div>
    <div class="max-w-5xl mx-auto text-center relative z-10">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-stroke text-xs text-txt-300 mb-8">
        <span class="w-1.5 h-1.5 rounded-full bg-mint animate-pulse"></span>
        <?= e($t['hero_badge']) ?>
      </div>
      <h1 class="font-display font-bold text-5xl md:text-7xl lg:text-[5.2rem] tracking-tight leading-[1.05] mb-6">
        <?= e($t['hero_h1_1']) ?><br/>
        <span class="text-gradient"><?= e($t['hero_h1_2']) ?></span>
      </h1>
      <p class="text-txt-200 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
        <?= h($t['hero_sub']) ?>
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
        <a href="#download" class="btn-primary bg-brand hover:bg-brand-dark text-white font-semibold text-base px-8 py-3.5 rounded-xl transition-colors"><?= e($t['hero_cta']) ?></a>
        <a href="https://github.com/" target="_blank" class="flex items-center gap-2 text-txt-300 hover:text-txt-100 text-sm transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          <?= e($t['hero_github']) ?>
        </a>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <span class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 17.607c-.786 2.28-3.139 6.317-5.563 6.361-1.608.031-2.125-.953-3.963-.953-1.837 0-2.412.923-3.932.983-2.572.099-6.542-5.827-6.542-10.995 0-4.747 3.308-7.1 6.198-7.143 1.55-.028 3.014 1.045 3.959 1.045.949 0 2.727-1.29 4.596-1.101.782.033 2.979.315 4.389 2.377-3.741 2.442-3.158 7.549.858 9.426zm-5.222-17.607c-2.826.114-5.132 3.079-4.81 5.531 2.612.203 5.118-2.725 4.81-5.531z"/></svg>macOS</span>
        <span class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>Windows</span>
        <span class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.311.015-.466.044-1.837.346-2.907 1.867-3.775 3.306-.862 1.44-1.583 3.006-2.125 3.08-.542.075-1.306-.467-2.293-.685-.987-.218-2.208-.06-3.149.78-.94.84-1.312 2.167-.948 3.471.364 1.304 1.273 2.592 2.55 3.502 1.278.91 2.433 1.2 3.38 1.83.947.63 1.594 1.674 2.363 2.584.769.91 1.715 1.713 3.092 1.988 1.377.276 2.454-.258 3.387-.976.934-.718 1.72-1.62 2.453-2.36.732-.74 1.453-1.303 2.213-1.5.76-.196 1.19.133 1.882.075.692-.058 1.65-.542 2.276-1.505.626-.963.914-2.397.505-3.631-.41-1.234-1.517-2.28-2.617-2.875-1.1-.595-2.182-.741-2.946-1.212-.764-.47-1.153-1.282-1.766-2.182-.613-.9-1.453-1.884-2.795-2.33C13.449.073 12.96 0 12.504 0z"/></svg>Linux</span>
      </div>
    </div>
  </section>


  <!-- APP MOCKUP -->
  <section id="interface" class="relative px-6 pb-32">
    <div class="max-w-6xl mx-auto" x-data x-intersect.once="$el.classList.add('is-visible')">
      <div class="app-frame overflow-hidden">
        <div class="app-frame-bar flex items-center px-4 gap-2">
          <div class="dot bg-[#ff5f57]"></div><div class="dot bg-[#febc2e]"></div><div class="dot bg-[#28c840]"></div>
          <span class="ml-3 text-xs text-txt-400 font-mono">Consoles — ~/projects</span>
        </div>
        <div class="flex" style="height: 420px;">
          <div class="w-56 border-r border-stroke p-3 shrink-0 overflow-hidden">
            <div class="text-[10px] uppercase tracking-widest text-txt-400 mb-3 px-1">Projects</div>
            <div class="space-y-0.5 text-[13px]">
              <div class="flex items-center gap-2 px-2 py-1.5 text-txt-200"><span class="text-txt-400 text-xs">▾</span><span>💼</span><span class="font-medium">Production</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 ml-4 text-txt-200"><span class="text-txt-400 text-xs">▾</span><span>🔧</span><span>Backend API</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 ml-8 rounded-md bg-brand/10 text-brand-light"><span class="text-xs">›</span><span class="text-xs">💻</span><span>dev-server</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 ml-8 text-txt-300"><span class="text-xs">›</span><span class="text-xs">💻</span><span>docker-logs</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 ml-8 text-txt-300"><span class="text-xs">›</span><span class="text-xs">💻</span><span>ssh prod</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 ml-4 text-txt-300"><span class="text-txt-400 text-xs">▸</span><span>🎨</span><span>Frontend App</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 text-txt-300 mt-2"><span class="text-txt-400 text-xs">▸</span><span>🌙</span><span class="font-medium">Freelance</span></div>
              <div class="flex items-center gap-2 px-2 py-1.5 text-txt-300"><span class="text-txt-400 text-xs">▸</span><span>🚀</span><span class="font-medium">Side Projects</span></div>
            </div>
          </div>
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="h-9 flex items-center border-b border-stroke px-2 gap-1 shrink-0">
              <div class="px-3 py-1 text-xs text-brand-light border-b-2 border-brand bg-brand/5 rounded-t">dev-server</div>
              <div class="px-3 py-1 text-xs text-txt-400">docker-logs</div>
              <div class="px-3 py-1 text-xs text-txt-400">ssh prod</div>
            </div>
            <div class="flex-1 p-4 font-mono text-[13px] leading-6 overflow-hidden bg-bg-900">
              <div class="terminal-line text-txt-200" data-prefix="$">npm run dev</div>
              <div class="text-txt-400 mt-1"><span class="text-mint">✓</span> ready in 847ms</div>
              <div class="text-txt-400 mt-2"><span class="text-txt-300">➜</span> Local: &nbsp;<span class="text-brand-light">http://localhost:3000/</span></div>
              <div class="text-txt-400"><span class="text-txt-300">➜</span> Network: <span class="text-brand-light">http://192.168.1.42:3000/</span></div>
              <div class="text-txt-400 mt-2"><span class="text-mint">✓</span> 14 modules transformed.</div>
              <div class="text-txt-400"><span class="text-mint">✓</span> watching for file changes...</div>
              <div class="mt-4"><span class="text-mint">~/projects/api</span> <span class="text-brand">main</span> <span class="text-txt-400">$</span><span class="cursor-blink"></span></div>
            </div>
          </div>
          <!-- AI panel -->
          <div class="w-52 border-l border-stroke shrink-0 overflow-hidden flex flex-col">
            <div class="h-9 flex items-center border-b border-stroke px-3 shrink-0 gap-2">
              <div class="text-[10px] uppercase tracking-widest text-brand font-mono font-semibold">AI</div>
              <span class="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
            </div>
            <div class="flex-1 p-3 overflow-hidden flex flex-col gap-2">
              <div class="bg-bg-700 rounded-lg p-2 text-[11px] text-txt-300 leading-4">Why is nginx 502?</div>
              <div class="bg-brand/10 rounded-lg p-2 text-[11px] text-txt-200 leading-4">This usually means the upstream server is down or not listening on the expected port...</div>
              <div class="bg-bg-700 rounded-lg p-2 text-[11px] text-txt-300 leading-4">How do I restart it?</div>
              <div class="bg-brand/10 rounded-lg p-2 text-[11px] text-txt-200 leading-4">Run <span class="text-mint font-mono">systemctl restart nginx</span> then check logs with <span class="text-mint font-mono">journalctl -u nginx</span></div>
            </div>
            <div class="px-3 pb-3 shrink-0">
              <div class="flex items-center gap-1 bg-bg-700 rounded-lg px-2 py-1.5">
                <span class="flex-1 text-[10px] text-txt-400">Ask anything...</span>
                <span class="text-[9px] text-brand font-mono">⌘I</span>
              </div>
            </div>
          </div>

          <div class="w-64 border-l border-stroke p-4 shrink-0 overflow-hidden">
            <div class="text-[10px] uppercase tracking-widest text-txt-400 mb-3">Wiki</div>
            <div class="text-sm font-semibold text-txt-100 mb-2">Deploy Process</div>
            <div class="flex gap-1 mb-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-bg-700 text-txt-300">#deploy</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-bg-700 text-txt-300">#prod</span></div>
            <div class="text-xs text-txt-300 leading-5 space-y-2">
              <p><span class="font-medium text-txt-200">1.</span> Pull latest from main</p>
              <p><span class="font-medium text-txt-200">2.</span> Run migrations</p>
              <div class="bg-bg-900 rounded-md p-2 font-mono text-[11px] text-mint">npm run db:migrate</div>
              <p><span class="font-medium text-txt-200">3.</span> Deploy via CI</p>
              <div class="bg-bg-900 rounded-md p-2 font-mono text-[11px] text-amber">gh workflow run deploy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- THREE PILLARS -->
  <section id="features" class="px-6 pb-32">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-16" x-data x-intersect.once="$el.classList.add('is-visible')">
        <h2 class="font-display font-bold text-3xl md:text-5xl tracking-tight mb-4">
          <?= e($t['pillars_h2_1']) ?> <span class="text-gradient"><?= e($t['pillars_h2_2']) ?></span>
        </h2>
        <p class="text-txt-300 text-lg max-w-xl mx-auto"><?= e($t['pillars_sub']) ?></p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="feature-card rounded-2xl p-8" x-data x-intersect.once="$el.classList.add('is-visible')" style="transition-delay:0.05s">
          <div class="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c8aff" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16h2"/><path d="M11 12h2"/><path d="M15 8h2"/></svg></div>
          <h3 class="font-display font-semibold text-xl text-txt-100 mb-3"><?= e($t['card1_title']) ?></h3>
          <p class="text-txt-300 text-sm leading-relaxed mb-4"><?= e($t['card1_desc']) ?></p>
          <div class="text-sm text-txt-400 space-y-1.5">
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card1_f1']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card1_f2']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card1_f3']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= h($t['card1_f4']) ?></div>
          </div>
        </div>
        <div class="feature-card rounded-2xl p-8" x-data x-intersect.once="$el.classList.add('is-visible')" style="transition-delay:0.15s">
          <div class="w-12 h-12 rounded-xl bg-mint/10 flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5eebc2" stroke-width="2" stroke-linecap="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg></div>
          <h3 class="font-display font-semibold text-xl text-txt-100 mb-3"><?= e($t['card2_title']) ?></h3>
          <p class="text-txt-300 text-sm leading-relaxed mb-4"><?= e($t['card2_desc']) ?></p>
          <div class="text-sm text-txt-400 space-y-1.5">
            <div class="flex items-center gap-2"><span class="text-mint">→</span> <?= e($t['card2_f1']) ?></div>
            <div class="flex items-center gap-2"><span class="text-mint">→</span> <?= e($t['card2_f2']) ?></div>
            <div class="flex items-center gap-2"><span class="text-mint">→</span> <?= e($t['card2_f3']) ?></div>
            <div class="flex items-center gap-2"><span class="text-mint">→</span> <?= e($t['card2_f4']) ?></div>
          </div>
        </div>
        <div class="feature-card rounded-2xl p-8" x-data x-intersect.once="$el.classList.add('is-visible')" style="transition-delay:0.25s">
          <div class="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffc26e" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg></div>
          <h3 class="font-display font-semibold text-xl text-txt-100 mb-3"><?= e($t['card3_title']) ?></h3>
          <p class="text-txt-300 text-sm leading-relaxed mb-4"><?= e($t['card3_desc']) ?></p>
          <div class="text-sm text-txt-400 space-y-1.5">
            <div class="flex items-center gap-2"><span class="text-amber">→</span> <?= e($t['card3_f1']) ?></div>
            <div class="flex items-center gap-2"><span class="text-amber">→</span> <?= e($t['card3_f2']) ?></div>
            <div class="flex items-center gap-2"><span class="text-amber">→</span> <?= e($t['card3_f3']) ?></div>
            <div class="flex items-center gap-2"><span class="text-amber">→</span> <?= e($t['card3_f4']) ?></div>
          </div>
        </div>
        <div class="feature-card rounded-2xl p-8" x-data x-intersect.once="$el.classList.add('is-visible')" style="transition-delay:0.35s">
          <div class="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c8aff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg></div>
          <h3 class="font-display font-semibold text-xl text-txt-100 mb-3"><?= e($t['card4_title']) ?></h3>
          <p class="text-txt-300 text-sm leading-relaxed mb-4"><?= e($t['card4_desc']) ?></p>
          <div class="text-sm text-txt-400 space-y-1.5">
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card4_f1']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card4_f2']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= e($t['card4_f3']) ?></div>
            <div class="flex items-center gap-2"><span class="text-brand">→</span> <?= h($t['card4_f4']) ?></div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- PAIN POINTS -->
  <section class="px-6 pb-32">
    <div class="max-w-4xl mx-auto" x-data x-intersect.once="$el.classList.add('is-visible')">
      <h2 class="font-display font-bold text-3xl md:text-4xl tracking-tight text-center mb-16">
        <?= e($t['pain_h2_1']) ?> <span class="text-gradient-warm"><?= e($t['pain_h2_2']) ?></span>
      </h2>
      <div class="grid md:grid-cols-2 gap-x-16 gap-y-10">
        <div><div class="text-coral font-mono text-sm mb-2"><?= e($t['prob1_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['prob1_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['prob1_desc']) ?></p></div>
        <div><div class="text-mint font-mono text-sm mb-2"><?= e($t['fix1_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['fix1_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= h($t['fix1_desc']) ?></p></div>
        <div><div class="text-coral font-mono text-sm mb-2"><?= e($t['prob2_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['prob2_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['prob2_desc']) ?></p></div>
        <div><div class="text-mint font-mono text-sm mb-2"><?= e($t['fix2_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['fix2_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['fix2_desc']) ?></p></div>
        <div><div class="text-coral font-mono text-sm mb-2"><?= e($t['prob3_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['prob3_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['prob3_desc']) ?></p></div>
        <div><div class="text-mint font-mono text-sm mb-2"><?= e($t['fix3_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['fix3_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['fix3_desc']) ?></p></div>
        <div><div class="text-coral font-mono text-sm mb-2"><?= e($t['prob4_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['prob4_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= e($t['prob4_desc']) ?></p></div>
        <div><div class="text-mint font-mono text-sm mb-2"><?= e($t['fix4_label']) ?></div><h3 class="font-display font-semibold text-lg text-txt-100 mb-2"><?= e($t['fix4_title']) ?></h3><p class="text-txt-300 text-sm leading-relaxed"><?= h($t['fix4_desc']) ?></p></div>
      </div>
    </div>
  </section>


  <!-- TECH STACK -->
  <section id="stack" class="px-6 pb-32">
    <div class="max-w-4xl mx-auto text-center" x-data x-intersect.once="$el.classList.add('is-visible')">
      <h2 class="font-display font-bold text-3xl md:text-4xl tracking-tight mb-4">
        <?= e($t['tech_h2']) ?> <span class="text-gradient"><?= e($t['tech_h2_grad']) ?></span>
      </h2>
      <p class="text-txt-300 text-lg mb-12"><?= e($t['tech_sub']) ?></p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="feature-card rounded-xl p-5 text-center"><div class="text-3xl font-display font-bold text-brand mb-1">~20 MB</div><div class="text-xs text-txt-400"><?= e($t['stat1']) ?></div></div>
        <div class="feature-card rounded-xl p-5 text-center"><div class="text-3xl font-display font-bold text-mint mb-1">~80 MB</div><div class="text-xs text-txt-400"><?= e($t['stat2']) ?></div></div>
        <div class="feature-card rounded-xl p-5 text-center"><div class="text-3xl font-display font-bold text-amber mb-1">&lt;2s</div><div class="text-xs text-txt-400"><?= e($t['stat3']) ?></div></div>
        <div class="feature-card rounded-xl p-5 text-center"><div class="text-3xl font-display font-bold text-coral mb-1">AES-256</div><div class="text-xs text-txt-400"><?= e($t['stat4']) ?></div></div>
      </div>
      <div class="mt-10 flex flex-wrap justify-center gap-3 text-xs text-txt-400">
        <span class="px-3 py-1.5 rounded-full border border-stroke">Tauri 2.0</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">Rust</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">React</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">TypeScript</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">SQLite</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">SQLCipher</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">xterm.js</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">TipTap</span>
        <span class="px-3 py-1.5 rounded-full border border-stroke">Zustand</span>
      </div>
    </div>
  </section>


  <!-- NOT USED BY -->
  <section class="px-6 pb-32">
    <div class="max-w-5xl mx-auto text-center" x-data x-intersect.once="$el.classList.add('is-visible')">
      <p class="text-txt-400 text-xs uppercase tracking-widest mb-4 font-mono"><?= e($t['not_used_label']) ?></p>
      <h2 class="font-display font-bold text-3xl md:text-4xl tracking-tight mb-3">
        <?= e($t['not_used_h2_1']) ?> <span class="text-gradient-warm"><?= e($t['not_used_h2_2']) ?></span>
      </h2>
      <p class="text-txt-400 text-sm mb-12 max-w-lg mx-auto"><?= e($t['not_used_sub']) ?></p>

      <div class="flex flex-wrap items-center justify-center gap-10 md:gap-16">

        <!-- Apple -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="36" height="44" viewBox="0 0 814 1000" fill="#f0f2f8"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 192.7-49 31.2 0 108.2 2.6 168.7 76.4zm-120.7-235.4c-33.4 39.5-87.5 70.1-140.1 70.1-6.4 0-12.9-.6-19.3-1.9-1.3-6.4-1.9-12.9-1.9-19.3 0-39.5 17.9-81 48.4-110.8 30.5-29.9 87.5-52.5 132.8-56.5.6 6.4 1.9 13.5 1.9 20.5 0 39.5-17.3 80.4-21.8 97.9z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Apple</span>
        </div>

        <!-- Microsoft -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="40" height="40" viewBox="0 0 23 23" fill="#f0f2f8"><path d="M0 0h11v11H0zm12 0h11v11H12zM0 12h11v11H0zm12 0h11v11H12z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Microsoft</span>
        </div>

        <!-- Google -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#f0f2f8"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Google</span>
        </div>

        <!-- NVIDIA -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="50" height="30" viewBox="0 0 220 100" fill="none"><path d="M18 74V26h10v48H18zm12-48h30c11 0 18 7 18 18s-7 18-18 18H30V26zm10 27h18c5 0 9-4 9-9s-4-9-9-9H40v18z" fill="#f0f2f8"/><path d="M90 26h20l14 35 14-35h20L132 74h-20L90 26z" fill="#f0f2f8"/><path d="M160 26h10v48h-10V26z" fill="#f0f2f8"/><path d="M175 26h12l26 35V26h10v48h-12l-26-35v35h-10V26z" fill="#f0f2f8"/><path d="M3 30C8 18 20 10 34 10V0C14 0 0 14 0 34h3V30z" fill="#76b900"/><path d="M34 20v10c-6 0-12 5-12 12H12c0-12 10-22 22-22z" fill="#76b900"/></svg>
          <span class="text-txt-400 text-xs font-mono">NVIDIA</span>
        </div>

        <!-- Meta -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="44" height="24" viewBox="0 0 640 320" fill="#f0f2f8"><path d="M64 160c0-53 22-96 49-96 14 0 29 12 44 37L96 224c-20-19-32-40-32-64zm94 96l-32-56 31-54c19-32 38-50 58-50 38 0 69 56 69 124 0 35-7 63-18 83l-36-66c5-9 8-22 8-37 0-44-18-82-39-82-13 0-27 11-41 38zm72-14c15-16 28-41 35-70l39 68c-18 31-44 50-73 50-19 0-38-9-53-26l52-22zm96-168c20 0 39 16 54 44l-40 70c-14-29-29-45-44-45-7 0-15 4-22 10l-18-31c15-31 35-48 70-48zm61 48c20 38 31 82 31 118 0 26-5 47-14 62l-43-74 31-55c-5-19-13-37-21-53l16-28c-1 10 0 20 0 30z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Meta</span>
        </div>

        <!-- Amazon -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="50" height="32" viewBox="0 0 600 200" fill="#f0f2f8"><path d="M338 130c-36 24-88 37-133 37C140 167 77 143 30 100c-4-4 0-9 4-6 50 29 112 46 176 46 43 0 90-9 133-28 7-3 12 4 5 8z"/><path d="M355 111c-5-7-35-3-48-2-4 1-5-3-1-5 23-16 62-11 66-6 5 6-1 44-23 63-3 3-7 1-5-2 5-12 15-41 11-48z"/><text x="30" y="100" font-family="sans-serif" font-weight="bold" font-size="100" fill="#f0f2f8">amazon</text></svg>
          <span class="text-txt-400 text-xs font-mono">Amazon</span>
        </div>

        <!-- Tesla -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="32" height="44" viewBox="0 0 342 512" fill="#f0f2f8"><path d="M171 512L0 100c28 9 62 15 100 17L171 512zm0 0l71-395c38-2 72-8 100-17L171 512zM0 100C0 44 77 0 171 0s171 44 171 100H0zm171-64C97 36 38 62 24 92h294c-14-30-73-56-147-56z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Tesla</span>
        </div>

        <!-- Netflix -->
        <div class="not-used-logo flex flex-col items-center gap-2">
          <svg width="28" height="44" viewBox="0 0 111 190" fill="#f0f2f8"><path d="M0 0h30v190H0zM40 0l31 95L40 190h30l31-95-31-95zm31 95z"/><path d="M81 0h30v190H81z"/></svg>
          <span class="text-txt-400 text-xs font-mono">Netflix</span>
        </div>

      </div>
    </div>
  </section>


  <!-- DOWNLOAD -->
  <section id="download" class="px-6 pb-32">
    <div class="max-w-3xl mx-auto text-center" x-data="{ os: navigator.platform.toLowerCase().includes('mac') ? 'mac' : navigator.platform.toLowerCase().includes('win') ? 'win' : 'linux' }" x-intersect.once="$el.classList.add('is-visible')">
      <h2 class="font-display font-bold text-3xl md:text-5xl tracking-tight mb-4"><?= e($t['dl_h2']) ?></h2>
      <p class="text-txt-300 text-lg mb-10"><?= e($t['dl_sub']) ?></p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        <a href="#" class="btn-primary bg-brand hover:bg-brand-dark text-white font-semibold text-base px-8 py-4 rounded-xl transition-colors flex items-center gap-3 w-full sm:w-auto justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          <?php
            // Серверная сторона — определяем ОС по User-Agent
            $ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
            if (str_contains($ua, 'mac')) echo e($t['dl_mac']);
            elseif (str_contains($ua, 'win')) echo e($t['dl_win']);
            else echo e($t['dl_linux']);
          ?>
        </a>
      </div>
      <div class="flex flex-wrap justify-center gap-3 text-sm">
        <a href="#" class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 17.607c-.786 2.28-3.139 6.317-5.563 6.361-1.608.031-2.125-.953-3.963-.953-1.837 0-2.412.923-3.932.983-2.572.099-6.542-5.827-6.542-10.995 0-4.747 3.308-7.1 6.198-7.143 1.55-.028 3.014 1.045 3.959 1.045.949 0 2.727-1.29 4.596-1.101.782.033 2.979.315 4.389 2.377-3.741 2.442-3.158 7.549.858 9.426zm-5.222-17.607c-2.826.114-5.132 3.079-4.81 5.531 2.612.203 5.118-2.725 4.81-5.531z"/></svg>.dmg</a>
        <a href="#" class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>.msi</a>
        <a href="#" class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.311.015-.466.044-1.837.346-2.907 1.867-3.775 3.306-.862 1.44-1.583 3.006-2.125 3.08-.542.075-1.306-.467-2.293-.685-.987-.218-2.208-.06-3.149.78-.94.84-1.312 2.167-.948 3.471.364 1.304 1.273 2.592 2.55 3.502 1.278.91 2.433 1.2 3.38 1.83.947.63 1.594 1.674 2.363 2.584.769.91 1.715 1.713 3.092 1.988 1.377.276 2.454-.258 3.387-.976.934-.718 1.72-1.62 2.453-2.36.732-.74 1.453-1.303 2.213-1.5.76-.196 1.19.133 1.882.075.692-.058 1.65-.542 2.276-1.505.626-.963.914-2.397.505-3.631-.41-1.234-1.517-2.28-2.617-2.875-1.1-.595-2.182-.741-2.946-1.212-.764-.47-1.153-1.282-1.766-2.182-.613-.9-1.453-1.884-2.795-2.33C13.449.073 12.96 0 12.504 0z"/></svg>.AppImage</a>
        <a href="#" class="platform-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.311.015-.466.044-1.837.346-2.907 1.867-3.775 3.306-.862 1.44-1.583 3.006-2.125 3.08-.542.075-1.306-.467-2.293-.685-.987-.218-2.208-.06-3.149.78-.94.84-1.312 2.167-.948 3.471.364 1.304 1.273 2.592 2.55 3.502 1.278.91 2.433 1.2 3.38 1.83.947.63 1.594 1.674 2.363 2.584.769.91 1.715 1.713 3.092 1.988 1.377.276 2.454-.258 3.387-.976.934-.718 1.72-1.62 2.453-2.36.732-.74 1.453-1.303 2.213-1.5.76-.196 1.19.133 1.882.075.692-.058 1.65-.542 2.276-1.505.626-.963.914-2.397.505-3.631-.41-1.234-1.517-2.28-2.617-2.875-1.1-.595-2.182-.741-2.946-1.212-.764-.47-1.153-1.282-1.766-2.182-.613-.9-1.453-1.884-2.795-2.33C13.449.073 12.96 0 12.504 0z"/></svg>.deb</a>
      </div>
    </div>
  </section>


  <!-- FOOTER -->
  <footer class="border-t border-stroke px-6 py-12">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
        </div>
        <span class="font-display font-medium text-sm text-txt-200">Consoles</span>
        <span class="text-txt-400 text-xs">— consoles.work</span>
      </div>
      <div class="flex items-center gap-6 text-sm text-txt-400">
        <a href="#" class="hover:text-txt-200 transition-colors">GitHub</a>
        <a href="#" class="hover:text-txt-200 transition-colors"><?= e($t['footer_docs']) ?></a>
        <a href="#" class="hover:text-txt-200 transition-colors"><?= e($t['footer_changelog']) ?></a>
        <span class="text-txt-400/50"><?= e($t['footer_license']) ?></span>
      </div>
    </div>
  </footer>

</body>
</html>
