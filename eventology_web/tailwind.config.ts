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
        background: "#FAF8F5", // Warm Ivory / Soft Cream Base
        surface: "#FFFFFF", // Crisp Clean White Card
        surfaceElevated: "#F5F1E8", // Warm Beige / Champagne Tint
        surfaceWarm: "#FFFDF9",
        borderLight: "#E8E2D5",
        textPrimary: "#18181B", // Deep Charcoal
        textSecondary: "#52525B", // Readable Slate
        textMuted: "#71717A",
        brand: {
          gold: "#C59B27", // Rich Royal Gold
          goldDark: "#996515",
          goldBright: "#D4AF37",
          goldLight: "#FBF3DE",
          goldCream: "#FFF9E6",
          emerald: "#059669",
          emeraldLight: "#ECFDF5",
        },
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "Outfit", "system-ui", "sans-serif"],
        playfair: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-outfit)", "Outfit", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
