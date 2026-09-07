import type { ReactNode } from "react";

import { Dialog } from "./Dialog";

// FE-06/FE-08: shared confirm primitive - replaces the browser's own
// confirm()/window.confirm() (no styling, no focus management, blocks the whole
// tab) with the same Dialog-based pattern ProjectMenu's archive/hard-delete
// confirmations already use.
export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <div className="p-4">
        <p className="mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button" className="bl-quiet" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`bl-button disabled:opacity-50 ${destructive ? "bg-red-600 hover:bg-red-700 border-transparent text-white" : ""}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
