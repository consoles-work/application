/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Основная палитра — тёмная тема в стиле IDE
        surface: {
          0: "#0d1117", // Фон приложения
          1: "#161b22", // Панели
          2: "#1c2128", // Карточки, поповеры
          3: "#2d333b", // Элементы при ховере
        },
        border: {
          DEFAULT: "#30363d",
          active: "#58a6ff",
        },
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#484f58",
        },
        accent: {
          DEFAULT: "#58a6ff",
          hover: "#79c0ff",
          subtle: "#1f3a5f",
        },
        success: "#3fb950",
        warning: "#d29922",
        danger: "#f85149",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": "0.625rem",
      },
    },
  },
  plugins: [],
};
