import { useRef, useState } from "react";
import { Dialog } from "../../components/Dialog";

interface NewProjectModalProps {
  onCreate: (name: string, targetOrigin: string) => Promise<void>;
  onClose: () => void;
}

export function NewProjectModal({ onCreate, onClose }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [targetOrigin, setTargetOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Same close-guard as ProjectForm.tsx: Escape/the header's close button shouldn't be
  // able to dismiss this while a create request is in flight.
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    setIsSubmitting(true);
    submitting.current = true;
    try {
      await onCreate(name, targetOrigin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setIsSubmitting(false);
      submitting.current = false;
    }
  }

  return (
    <Dialog title="New project" onClose={close}>
      <form className="bl-project-form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset disabled={isSubmitting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="bl-form-section">
            <label htmlFor="new-project-name">Name</label>
            <input id="new-project-name" className="bl-input" required autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="bl-form-section">
            <label htmlFor="new-project-url">Site URL</label>
            <input id="new-project-url" className="bl-input" required type="url" placeholder="https://staging.client.com" value={targetOrigin} onChange={(event) => setTargetOrigin(event.target.value)} />
          </div>
        </fieldset>
        {error && <p role="alert" className="bl-error">{error}</p>}
        <footer className="bl-dialog-actions bl-dialog-actions-in-form">
          <button type="button" className="bl-quiet" disabled={isSubmitting} onClick={close}>Cancel</button>
          <button type="submit" className="bl-button mint" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create project"}</button>
        </footer>
      </form>
    </Dialog>
  );
}
