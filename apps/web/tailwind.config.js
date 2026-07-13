/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-surface": { DEFAULT: "#FFFFFF", dark: "#14141A" },
        "bg-canvas": { DEFAULT: "#F7F7F9", dark: "#0B0B0E" },
        "text-primary": { DEFAULT: "#14141A", dark: "#F2F2F5" },
        "text-muted": { DEFAULT: "#6B6B76", dark: "#9A9AA6" },
        "accent-primary": { DEFAULT: "#4F46E5", dark: "#818CF8" },
        // #0EA5E9/#7C3AED (sky-500/violet-600) only reached 2.39:1 / ~4.5:1 as
        // `text-layer-*` against their own `bg-layer-*/15` badge background - short of
        // (or too close to trust against) WCAG AA's 4.5:1 (Milestone 12 axe-core audit,
        // apps/e2e/tests/journeys/journey-3). sky-800/violet-700 clear ~6:1 / ~5.5:1.
        "layer-client": "#075985",
        "layer-team": "#6D28D9",
        "status-todo": "#94A3B8",
        "status-in-progress": "#F59E0B",
        "status-resolved": "#22C55E",
        "status-wont-fix": "#64748B",
        "recovery-low-confidence": "#F59E0B",
        // #EF4444 (red-500) only hit 3.51:1 against bg-canvas - short of WCAG AA's 4.5:1
        // for normal text (Milestone 11 axe-core audit, docs/tdr/0010). #B91C1C (red-700)
        // clears 6:1.
        "recovery-orphaned": "#B91C1C",
      },
    },
  },
  plugins: [],
};
