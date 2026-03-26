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

export interface AppTheme {
  id: string;
  label: string;
  xterm: XtermTheme;
}

export const THEMES: AppTheme[] = [
  {
    id: "dark",
    label: "GitHub Dark",
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
    xterm: {
      background: "#282828", foreground: "#ebdbb2", cursor: "#fabd2f",
      selectionBackground: "#504945",
      black: "#282828", red: "#cc241d", green: "#98971a", yellow: "#d79921",
      blue: "#458588", magenta: "#b16286", cyan: "#689d6a", white: "#a89984",
      brightBlack: "#928374", brightRed: "#fb4934", brightGreen: "#b8bb26", brightYellow: "#fabd2f",
      brightBlue: "#83a598", brightMagenta: "#d3869b", brightCyan: "#8ec07c", brightWhite: "#ebdbb2",
    },
  },
];

// Темы доступные для случайного выбора (все 10)
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
