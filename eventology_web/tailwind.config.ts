import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070709", // Deepest Midnight (from Flutter AppColors)
        surface: "#141416", // Elevated Midnight
        surfaceLight: "#1F1F22", // Interactive surface
        surfaceHighlight: "#2A2A2D", // Surface highlight
        glassBorder: "rgba(255, 215, 0, 0.15)",
        brand: {
          gold: "#FFD700", // Brilliant Gold (AppColors.primary)
          goldLight: "#FFF0A8", // Champagne Gold (AppColors.primaryLight)
          goldWarm: "#D4AF37", // Royal Gold
          goldDark: "#AA820A", // Deep Gold
          emerald: "#10B981",
          crimson: "#EF4444",
          obsidian: "#070709",
          champagne: "#FDF6E2",
          cardDark: "#10131E",
        },
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "Outfit", "system-ui", "sans-serif"],
        playfair: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-outfit)", "Outfit", "system-ui", "sans-serif"],
        syne: ["var(--font-syne)", "Syne", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
