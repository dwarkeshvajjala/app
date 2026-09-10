import { useCallback, useEffect, useState } from "react";

// Mirrors use-locale.ts's shape: a localStorage-backed preference, no backend field yet
// (unlike notification prefs in AccountModal, which do round-trip through updateProfile).
// See docs/spec/15-Design-System.md §15.5 - this is an intentionally scoped-down version
// of "persisted as a member preference": client-side only, per browser, for now.
const THEME_KEY = "backline_theme";

export type Theme = "light" | "dark";

const THEME_EVENT = "backline:theme-change";

function storedTheme(): Theme {
  // Older builds offered a "system" value. Treat it as light so the product now
  // has the requested deterministic, legible default on every device.
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

// Also used by the anti-flash inline script in index.html (kept in sync by hand - that
// script runs before any JS module loads, so it can't import this function directly).
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0e1210" : "#f4f7f5",
  );
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The visible theme still works when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") setThemeState(next);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) setThemeState(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener(THEME_EVENT, syncTheme);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // The visible theme still works when storage is unavailable.
    }
    setThemeState(next);
    window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: next }));
  }, []);

  return { theme, setTheme };
}
