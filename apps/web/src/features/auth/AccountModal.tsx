import { useEffect, useState } from "react";
import { Dialog } from "../../components/Dialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAuth } from "./AuthContext";
import { updateProfile, listSessions, revokeSession, type SessionOut } from "./api";
import { useLocale } from "../../lib/use-locale";

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { user, logout, updateUser } = useAuth();
  const { locale, setLocale } = useLocale();
  const { toast } = useToast();
  const [revokeCandidate, setRevokeCandidate] = useState<SessionOut | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [name, setName] = useState(user?.name ?? "");
  const [prefs, setPrefs] = useState({
    notify_on_assignment: true,
    notify_on_mention: true,
    notify_on_reply: true,
    notify_on_status_change: true,
    daily_digest: true,
    ...user?.preferences,
  });
  
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    let active = true;
    listSessions().then(res => {
      if (active) {
        setSessions(res);
        setLoadingSessions(false);
      }
    }).catch(() => {
      if (active) setLoadingSessions(false);
    });
    return () => { active = false; };
  }, []);

  async function handleSignOut() {
    await logout();
    onClose();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateProfile({
        name,
        preferences: prefs,
      });
      updateUser(updated);
      toast("Account settings saved.");
      onClose();
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "Could not save your changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function doRevoke(familyId: string) {
    setRevoking(true);
    try {
      await revokeSession(familyId);
      setSessions(s => s.filter(x => x.id !== familyId));
      setRevokeCandidate(null);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "Could not sign out that session.", "error");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Dialog title="Your account" onClose={onClose}>
      <form onSubmit={(e) => void handleSave(e)} className="bl-form">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" }}>
          <span className="bl-mark" aria-hidden="true">
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong style={{ fontSize: "14px" }}>{user?.name ?? "Your account"}</strong>
            <p className="bl-mono" style={{ marginTop: "3px" }}>{user?.email ?? ""}</p>
          </div>
        </div>

        <section>
          <p className="bl-eyebrow" style={{ margin: "0 0 8px" }}>Profile</p>
          <div className="bl-form-field">
            <label htmlFor="account-name">Name</label>
            <input 
              id="account-name"
              type="text" 
              className="bl-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          <div className="bl-form-field" style={{ marginTop: "16px" }}>
            <label htmlFor="account-language">Language</label>
            <select
              id="account-language"
              className="bl-input"
              value={locale}
              onChange={e => setLocale(e.target.value)}
            >
              <option value="en">English (US)</option>
              <option value="hi-IN">हिन्दी (Hindi)</option>
            </select>
          </div>
        </section>

        <section>
          <p className="bl-eyebrow" style={{ margin: "0 0 8px" }}>Notification preferences</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label className="bl-form-field" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={prefs.notify_on_assignment} onChange={e => setPrefs({...prefs, notify_on_assignment: e.target.checked})} />
              <span>Notify me on assignment</span>
            </label>
            <label className="bl-form-field" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={prefs.notify_on_mention} onChange={e => setPrefs({...prefs, notify_on_mention: e.target.checked})} />
              <span>Notify me when mentioned</span>
            </label>
            <label className="bl-form-field" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={prefs.notify_on_reply} onChange={e => setPrefs({...prefs, notify_on_reply: e.target.checked})} />
              <span>Notify me on comment replies</span>
            </label>
            <label className="bl-form-field" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={prefs.notify_on_status_change} onChange={e => setPrefs({...prefs, notify_on_status_change: e.target.checked})} />
              <span>Notify me on ticket status changes</span>
            </label>
            <label className="bl-form-field" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={prefs.daily_digest} onChange={e => setPrefs({...prefs, daily_digest: e.target.checked})} />
              <span>Receive daily digest</span>
            </label>
          </div>
        </section>

        <section>
          <p className="bl-eyebrow" style={{ margin: "0 0 8px" }}>Security &amp; Sessions</p>
          {loadingSessions ? (
            <p style={{ fontSize: "12px", color: "var(--bl-muted)" }}>Loading sessions...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--bl-border)", borderRadius: "4px", padding: "8px" }}>
              {sessions.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", padding: "4px 0", borderBottom: "1px solid var(--bl-border-subtle)", paddingBottom: "8px" }}>
                  <div>
                    <strong>{s.os || "Unknown OS"}</strong> • {s.browser || "Unknown Browser"}
                    {s.current && <span style={{ marginLeft: "6px", fontSize: "11px", background: "var(--bl-border)", padding: "2px 6px", borderRadius: "12px" }}>Current</span>}
                    <p className="bl-mono" style={{ margin: "2px 0 0", color: "var(--bl-muted)" }}>
                      {s.ip_address || "Unknown IP"} • {new Date(s.last_active_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!s.current && (
                    <button type="button" onClick={() => setRevokeCandidate(s)} style={{ background: "none", border: "none", color: "var(--bl-red)", cursor: "pointer", fontSize: "12px" }}>
                      Sign out
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="bl-form-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--bl-border)" }}>
          <button
            type="button"
            className="bl-button"
            style={{ background: "var(--bl-muted)" }}
            onClick={() => void handleSignOut()}
          >
            Sign out everywhere
          </button>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="bl-button" style={{ background: "var(--bl-bg)" }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="bl-button" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </footer>
      </form>

      {revokeCandidate && (
        <ConfirmDialog
          title="Sign out session"
          message={`Sign out of the session on ${revokeCandidate.os || "Unknown OS"} • ${revokeCandidate.browser || "Unknown browser"}?`}
          confirmLabel={revoking ? "Signing out..." : "Sign out"}
          destructive
          pending={revoking}
          onCancel={() => setRevokeCandidate(null)}
          onConfirm={() => doRevoke(revokeCandidate.id)}
        />
      )}
    </Dialog>
  );
}
