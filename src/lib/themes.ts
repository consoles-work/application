// ══════════════════════════════════════════════
// themes.ts — определения тем приложения
// ══════════════════════════════════════════════

export interface XtermTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string; red: string; green: string; yellow: string;
  blue: string; magenta: string; cyan: string; white: string;
  brightBlack: string; brightRed: string; brightGreen: string; brightYellow: string;
  brightBlue: string; brightMagenta: string; brightCyan: string; brightWhite: string;
}

// Водяной знак в правом нижнем углу терминала. Прозрачность задаётся в
// TerminalPanel, здесь только чистые цвета: prod — для консолей с галочкой
// «опасный», plain — для остальных. На тёмных темах берутся яркие варианты
// палитры (brightRed/brightWhite), на светлых — red и цвет текста.
export interface WatermarkColors {
  prod: string;
  plain: string;
}

export interface AppTheme {
  id: string;
  label: string;
  dark: boolean;
  watermark: WatermarkColors;
  xterm: XtermTheme;
}

export const THEMES: AppTheme[] = [
  {
    id: "dark",
    label: "GitHub Dark",
    dark: true,
    watermark: { prod: "#ff7b72", plain: "#f0f6fc" },
    xterm: {
      background: "#0d1117", foreground: "#e6edf3", cursor: "#58a6ff",
      selectionBackground: "#264f78",
      black: "#484f58", red: "#f85149", green: "#3fb950", yellow: "#d29922",
      blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#b1bac4",
      brightBlack: "#6e7681", brightRed: "#ff7b72", brightGreen: "#56d364", brightYellow: "#e3b341",
      brightBlue: "#79c0ff", brightMagenta: "#d2a8ff", brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
    },
  },
  {
    id: "light",
    label: "GitHub Light",
    dark: false,
    watermark: { prod: "#cf222e", plain: "#1f2328" },
    xterm: {
      background: "#ffffff", foreground: "#1f2328", cursor: "#0969da",
      selectionBackground: "#b6d7ff",
      black: "#24292f", red: "#cf222e", green: "#116329", yellow: "#9a6700",
      blue: "#0969da", magenta: "#8250df", cyan: "#1b7c83", white: "#6e7781",
      brightBlack: "#57606a", brightRed: "#a40e26", brightGreen: "#1a7f37", brightYellow: "#633c01",
      brightBlue: "#0550ae", brightMagenta: "#622cbc", brightCyan: "#1b7c83", brightWhite: "#8c959f",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    dark: true,
    watermark: { prod: "#ff6e6e", plain: "#ffffff" },
    xterm: {
      background: "#282a36", foreground: "#f8f8f2", cursor: "#bd93f9",
      selectionBackground: "#44475a",
      black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
      blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
      brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94", brightYellow: "#ffffa5",
      brightBlue: "#d6acff", brightMagenta: "#ff92df", brightCyan: "#a4ffff", brightWhite: "#ffffff",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    dark: true,
    watermark: { prod: "#ff4f6d", plain: "#f9f8f5" },
    xterm: {
      background: "#272822", foreground: "#f8f8f2", cursor: "#a6e22e",
      selectionBackground: "#49483e",
      black: "#272822", red: "#f92672", green: "#a6e22e", yellow: "#f4bf75",
      blue: "#66d9e8", magenta: "#ae81ff", cyan: "#a1efe4", white: "#f8f8f2",
      brightBlack: "#75715e", brightRed: "#f92672", brightGreen: "#a6e22e", brightYellow: "#f4bf75",
      brightBlue: "#66d9e8", brightMagenta: "#ae81ff", brightCyan: "#a1efe4", brightWhite: "#f9f8f5",
    },
  },
  {
    id: "nord",
    label: "Nord",
    dark: true,
    watermark: { prod: "#e0727c", plain: "#eceff4" },
    xterm: {
      background: "#2e3440", foreground: "#eceff4", cursor: "#88c0d0",
      selectionBackground: "#4c566a",
      black: "#3b4252", red: "#bf616a", green: "#a3be8c", yellow: "#ebcb8b",
      blue: "#81a1c1", magenta: "#b48ead", cyan: "#88c0d0", white: "#e5e9f0",
      brightBlack: "#4c566a", brightRed: "#bf616a", brightGreen: "#a3be8c", brightYellow: "#ebcb8b",
      brightBlue: "#81a1c1", brightMagenta: "#b48ead", brightCyan: "#8fbcbb", brightWhite: "#eceff4",
    },
  },
  {
    id: "solarized",
    label: "Solarized Dark",
    dark: true,
    watermark: { prod: "#ff5c57", plain: "#fdf6e3" },
    xterm: {
      background: "#002b36", foreground: "#839496", cursor: "#268bd2",
      selectionBackground: "#073642",
      black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
      blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
      brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
      brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
    },
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    dark: true,
    watermark: { prod: "#f7768e", plain: "#c0caf5" },
    xterm: {
      background: "#1a1b2e", foreground: "#c0caf5", cursor: "#7aa2f7",
      selectionBackground: "#292e42",
      black: "#15161e", red: "#f7768e", green: "#9ece6a", yellow: "#e0af68",
      blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
      brightBlack: "#414868", brightRed: "#f7768e", brightGreen: "#9ece6a", brightYellow: "#e0af68",
      brightBlue: "#7aa2f7", brightMagenta: "#bb9af7", brightCyan: "#7dcfff", brightWhite: "#c0caf5",
    },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    dark: true,
    watermark: { prod: "#f38ba8", plain: "#cdd6f4" },
    xterm: {
      background: "#1e1e2e", foreground: "#cdd6f4", cursor: "#89b4fa",
      selectionBackground: "#45475a",
      black: "#45475a", red: "#f38ba8", green: "#a6e3a1", yellow: "#f9e2af",
      blue: "#89b4fa", magenta: "#cba6f7", cyan: "#89dceb", white: "#bac2de",
      brightBlack: "#585b70", brightRed: "#f38ba8", brightGreen: "#a6e3a1", brightYellow: "#f9e2af",
      brightBlue: "#89b4fa", brightMagenta: "#cba6f7", brightCyan: "#89dceb", brightWhite: "#a6adc8",
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    dark: true,
    watermark: { prod: "#e06c75", plain: "#ffffff" },
    xterm: {
      background: "#282c34", foreground: "#abb2bf", cursor: "#61afef",
      selectionBackground: "#3e4452",
      black: "#3f4451", red: "#e06c75", green: "#98c379", yellow: "#e5c07b",
      blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
      brightBlack: "#4f5666", brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
      brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2", brightWhite: "#ffffff",
    },
  },
  {
    id: "gruvbox",
    label: "Gruvbox Dark",
    dark: true,
    watermark: { prod: "#fb4934", plain: "#ebdbb2" },
    xterm: {
      background: "#282828", foreground: "#ebdbb2", cursor: "#fabd2f",
      selectionBackground: "#504945",
      black: "#282828", red: "#cc241d", green: "#98971a", yellow: "#d79921",
      blue: "#458588", magenta: "#b16286", cyan: "#689d6a", white: "#a89984",
      brightBlack: "#928374", brightRed: "#fb4934", brightGreen: "#b8bb26", brightYellow: "#fabd2f",
      brightBlue: "#83a598", brightMagenta: "#d3869b", brightCyan: "#8ec07c", brightWhite: "#ebdbb2",
    },
  },
  // ── Светлые темы ──────────────────────────────
  {
    id: "solarized-light",
    label: "Solarized Light",
    dark: false,
    watermark: { prod: "#dc322f", plain: "#657b83" },
    xterm: {
      background: "#fdf6e3", foreground: "#657b83", cursor: "#586e75",
      selectionBackground: "#eee8d5",
      black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
      blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
      brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
      brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
    },
  },
  {
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    dark: false,
    watermark: { prod: "#d20f39", plain: "#4c4f69" },
    xterm: {
      background: "#eff1f5", foreground: "#4c4f69", cursor: "#dc8a78",
      selectionBackground: "#bcc0cc",
      black: "#5c5f77", red: "#d20f39", green: "#40a02b", yellow: "#df8e1d",
      blue: "#1e66f5", magenta: "#8839ef", cyan: "#179299", white: "#acb0be",
      brightBlack: "#6c6f85", brightRed: "#d20f39", brightGreen: "#40a02b", brightYellow: "#df8e1d",
      brightBlue: "#1e66f5", brightMagenta: "#8839ef", brightCyan: "#179299", brightWhite: "#bcc0cc",
    },
  },
  {
    id: "one-light",
    label: "One Light",
    dark: false,
    watermark: { prod: "#e45649", plain: "#383a42" },
    xterm: {
      background: "#fafafa", foreground: "#383a42", cursor: "#4078f2",
      selectionBackground: "#e5e5e5",
      black: "#383a42", red: "#e45649", green: "#50a14f", yellow: "#c18401",
      blue: "#4078f2", magenta: "#a626a4", cyan: "#0184bc", white: "#d4d4d4",
      brightBlack: "#4f525e", brightRed: "#e45649", brightGreen: "#50a14f", brightYellow: "#c18401",
      brightBlue: "#4078f2", brightMagenta: "#a626a4", brightCyan: "#0184bc", brightWhite: "#ffffff",
    },
  },
  {
    id: "gruvbox-light",
    label: "Gruvbox Light",
    dark: false,
    watermark: { prod: "#cc241d", plain: "#3c3836" },
    xterm: {
      background: "#fbf1c7", foreground: "#3c3836", cursor: "#076678",
      selectionBackground: "#d5c4a1",
      black: "#3c3836", red: "#cc241d", green: "#98971a", yellow: "#d79921",
      blue: "#458588", magenta: "#b16286", cyan: "#689d6a", white: "#7c6f64",
      brightBlack: "#928374", brightRed: "#9d0006", brightGreen: "#79740e", brightYellow: "#b57614",
      brightBlue: "#076678", brightMagenta: "#8f3f71", brightCyan: "#427b58", brightWhite: "#504945",
    },
  },
  {
    id: "everforest-light",
    label: "Everforest Light",
    dark: false,
    watermark: { prod: "#f85552", plain: "#4c5960" },
    xterm: {
      background: "#f5f0da", foreground: "#4c5960", cursor: "#8da101",
      selectionBackground: "#dbd6bb",
      black: "#5c6a72", red: "#f85552", green: "#8da101", yellow: "#dfa000",
      blue: "#3a94c5", magenta: "#df69ba", cyan: "#35a77c", white: "#939f91",
      brightBlack: "#829181", brightRed: "#e66868", brightGreen: "#93b259", brightYellow: "#dfa000",
      brightBlue: "#3a94c5", brightMagenta: "#df69ba", brightCyan: "#35a77c", brightWhite: "#4c5960",
    },
  },
  {
    id: "rose-pine-dawn",
    label: "Rosé Pine Dawn",
    dark: false,
    watermark: { prod: "#b4637a", plain: "#575279" },
    xterm: {
      background: "#fffaf3", foreground: "#575279", cursor: "#286983",
      selectionBackground: "#dfdad9",
      black: "#575279", red: "#b4637a", green: "#286983", yellow: "#ea9d34",
      blue: "#56949f", magenta: "#907aa9", cyan: "#d7827e", white: "#797593",
      brightBlack: "#9893a5", brightRed: "#b4637a", brightGreen: "#286983", brightYellow: "#ea9d34",
      brightBlue: "#56949f", brightMagenta: "#907aa9", brightCyan: "#d7827e", brightWhite: "#575279",
    },
  },
  {
    id: "ayu-light",
    label: "Ayu Light",
    dark: false,
    watermark: { prod: "#e65050", plain: "#5c6773" },
    xterm: {
      background: "#fcfcfc", foreground: "#5c6773", cursor: "#fa8d3e",
      selectionBackground: "#d1e4f4",
      black: "#000000", red: "#ea6c6d", green: "#6cbf43", yellow: "#eca944",
      blue: "#3199e1", magenta: "#9e75c7", cyan: "#46ba94", white: "#8a9199",
      brightBlack: "#686868", brightRed: "#f07171", brightGreen: "#86b300", brightYellow: "#f2ae49",
      brightBlue: "#399ee6", brightMagenta: "#a37acc", brightCyan: "#4cbf99", brightWhite: "#5c6773",
    },
  },
  {
    id: "tokyo-day",
    label: "Tokyo Night Day",
    dark: false,
    watermark: { prod: "#f52a65", plain: "#343b58" },
    xterm: {
      background: "#e9eaef", foreground: "#343b58", cursor: "#2e7de9",
      selectionBackground: "#b7c1e3",
      black: "#343b58", red: "#f52a65", green: "#587539", yellow: "#8c6c3e",
      blue: "#2e7de9", magenta: "#9854f1", cyan: "#007197", white: "#6172b0",
      brightBlack: "#a1a6c5", brightRed: "#f52a65", brightGreen: "#587539", brightYellow: "#8c6c3e",
      brightBlue: "#2e7de9", brightMagenta: "#9854f1", brightCyan: "#007197", brightWhite: "#343b58",
    },
  },
];

// Темы доступные для случайного выбора (все)
export const SELECTABLE_THEMES = THEMES;

let _randomThemeId: string | null = null;

export function resolveThemeId(settingValue: string): string {
  if (settingValue !== "random") {
    _randomThemeId = null;
    return settingValue;
  }
  // Для random: выбираем один раз за сессию
  if (!_randomThemeId) {
    _randomThemeId = SELECTABLE_THEMES[Math.floor(Math.random() * SELECTABLE_THEMES.length)].id;
  }
  return _randomThemeId;
}

export function getThemeById(id: string): AppTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(settingValue: string) {
  const id = resolveThemeId(settingValue);
  document.documentElement.setAttribute("data-theme", id);
}
