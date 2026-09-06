import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="bl-dialog" aria-label={title} onCancel={onClose}>
    <header className="bl-dialog-head"><h2>{title}</h2><button type="button" className="bl-icon" aria-label="Close dialog" onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}
