import { useEffect, useState } from "react";
import { Dialog } from "../../components/Dialog";

export interface Shortcut {
  id: string;
  label: string;
  key: string;
  editable: boolean;
}

export const defaultShortcuts: Shortcut[] = [
  { id: "comment", label: "Add Comment", key: "C", editable: true },
  { id: "draw", label: "Draw Region", key: "D", editable: true },
  { id: "browse", label: "Browse Mode", key: "V", editable: true },
  { id: "hide-dock", label: "Hide Dock", key: "Ctrl .", editable: false },
  { id: "next-page", label: "Next Page", key: "ArrowRight", editable: false },
  { id: "prev-page", label: "Previous Page", key: "ArrowLeft", editable: false },
];

const STORAGE_KEY = "bl-shortcuts";

/** Reads the reviewer's saved key bindings (falling back to the defaults above) so
 * ProjectOverviewPage's global hotkey listener honors whatever this modal saved -
 * without this, editing a shortcut here would just relabel the key, not rebind it. */
export function loadShortcuts(): Shortcut[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultShortcuts;
    const parsed = JSON.parse(saved) as Partial<Shortcut>[];
    // Merge over the defaults rather than trusting the saved list outright, so a
    // shortcut added in a later release (e.g. "draw", added after some reviewers had
    // already saved customizations) still shows up instead of silently vanishing.
    return defaultShortcuts.map((fallback) => {
      const match = parsed.find((s) => s.id === fallback.id);
      return match?.key ? { ...fallback, key: match.key } : fallback;
    });
  } catch {
    return defaultShortcuts;
  }
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    // ProjectOverviewPage's own hotkey listener only reads localStorage on mount -
    // this tells it (and any other open tab/listener) a binding just changed so
    // pressing the new key works immediately, without a reload.
    window.dispatchEvent(new CustomEvent("backline:shortcuts-changed"));
  }, [shortcuts]);

  useEffect(() => {
    // Escape-to-close when *not* editing is handled by Dialog's own native <dialog>
    // cancel behavior - only the "capture the next keypress as a binding" case (which
    // must intercept Escape too, so a reviewer can bind it) needs a listener here.
    if (!editingId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyName = (e.ctrlKey ? "Ctrl " : "") + (e.altKey ? "Alt " : "") + (e.shiftKey ? "Shift " : "") + (e.key === "Control" || e.key === "Shift" || e.key === "Alt" ? "" : e.key);
      if (keyName.trim()) {
        setShortcuts((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, key: keyName.trim().toUpperCase() } : s))
        );
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingId]);

  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 20px" }}>
        {shortcuts.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--bl-line)" }}>
            <span style={{ fontSize: "14px", color: "var(--bl-ink)" }}>{s.label}</span>
            {s.editable ? (
              <button
                type="button"
                onClick={() => setEditingId(s.id)}
                style={{
                  padding: "4px 8px",
                  background: editingId === s.id ? "var(--bl-paper)" : "transparent",
                  border: "1px solid var(--bl-line)",
                  borderRadius: "4px",
                  fontFamily: "var(--mono)",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                {editingId === s.id ? "Press any key..." : s.key}
              </button>
            ) : (
              <kbd style={{
                padding: "4px 8px",
                background: "var(--bl-paper)",
                border: "1px solid var(--bl-line)",
                borderRadius: "4px",
                fontFamily: "var(--mono)",
                fontSize: "12px",
                color: "var(--bl-muted)"
              }}>
                {s.key}
              </kbd>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
