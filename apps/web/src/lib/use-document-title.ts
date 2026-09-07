import { useEffect } from "react";

/**
 * Sets document.title = `${title} — Backline` while the component is mounted.
 * Resets to "Backline" on unmount.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — Backline`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
