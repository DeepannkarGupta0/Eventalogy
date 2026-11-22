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
        background: "#070709",
        surface: "#10131E",
        surfaceElevated: "#161B28",
        glassBorder: "rgba(212, 175, 55, 0.15)",
        brand: {
          gold: "#D4AF37",
          goldBright: "#FFD700",
          goldMuted: "#AA820A",
          emerald: "#10B981",
          crimson: "#EF4444",
          obsidian: "#070709",
          champagne: "#F5E6C8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        syne: ["var(--font-syne)", "Syne", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
