import { useCallback, useEffect, useState } from "react";

// Mirrors use-locale.ts's shape: a localStorage-backed preference, no backend field yet
// (unlike notification prefs in AccountModal, which do round-trip through updateProfile).
// See docs/spec/15-Design-System.md §15.5 - this is an intentionally scoped-down version
// of "persisted as a member preference": client-side only, per browser, for now.
const THEME_KEY = "backline_theme";

export type Theme = "light" | "dark" | "system";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(theme: Theme): boolean {
  return theme === "system" ? systemPrefersDark() : theme === "dark";
}

// Also used by the anti-flash inline script in index.html (kept in sync by hand - that
// script runs before any JS module loads, so it can't import this function directly).
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", isDark(theme));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme | null) ?? "system"
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);

    if (theme !== "system") return;
    // Only "system" needs to keep listening - an explicit light/dark choice shouldn't
    // silently move when the OS setting changes underneath it.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme: useCallback((next: Theme) => setTheme(next), []) };
}
