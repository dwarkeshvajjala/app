import { Button } from "@backline/ui";
import { useEffect, useRef, useState } from "react";

interface NewProjectModalProps {
  onCreate: (name: string, targetOrigin: string) => Promise<void>;
  onClose: () => void;
}

export function NewProjectModal({ onCreate, onClose }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [targetOrigin, setTargetOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate(name, targetOrigin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-sm flex-col gap-3 rounded-lg p-5 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">New project</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              ref={nameInputRef}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Site URL
            <input
              required
              type="url"
              placeholder="https://staging.client.com"
              value={targetOrigin}
              onChange={(event) => setTargetOrigin(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
          {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Create project
          </Button>
        </form>
      </div>
    </div>
  );
}
