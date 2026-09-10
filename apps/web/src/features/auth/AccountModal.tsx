import { useEffect, useState } from "react";
import { Dialog } from "../../components/Dialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAuth } from "./AuthContext";
import { updateProfile, listSessions, revokeSession, type SessionOut } from "./api";
import { useLocale } from "../../lib/use-locale";
import { useTheme, type Theme } from "../../lib/use-theme";

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { user, logout, updateUser } = useAuth();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
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
  const [sessionError, setSessionError] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => loadSessions(), []);

  function loadSessions() {
    let active = true;
    setLoadingSessions(true);
    setSessionError(false);
    listSessions().then(res => {
      if (active) {
        setSessions(res);
        setLoadingSessions(false);
      }
    }).catch(() => {
      if (active) { setLoadingSessions(false); setSessionError(true); }
    });
    return () => { active = false; };
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "Could not sign out.", "error");
      setSigningOut(false);
    }
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
      <form onSubmit={(e) => void handleSave(e)} className="bl-account-form">
        
        <div className="bl-account-layout">
          
          <aside className="bl-account-summary">
            <div className="bl-account-identity">
              <span className="bl-mark" aria-hidden="true">
                {(user?.name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user?.name ?? "Your account"}</strong>
                <p className="bl-mono">{user?.email ?? ""}</p>
              </div>
            </div>
            <p>Manage your profile, appearance, notifications, and active sessions.</p>
          </aside>
          
          <div className="bl-account-content">
            
            <section className="bl-account-section">
              <p className="bl-eyebrow">Profile</p>
              <div className="bl-account-fields">
                <label className="bl-account-field">
                  <span>Name</span>
                  <input 
                    type="text" 
                    className="bl-input" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required
                  />
                </label>
                <label className="bl-account-field">
                  <span>Language</span>
                  <select
                    className="bl-select"
                    value={locale}
                    onChange={e => setLocale(e.target.value)}
                  >
                    <option value="en">English (US)</option>
                    <option value="hi-IN">हिन्दी (Hindi)</option>
                  </select>
                </label>
              </div>
            </section>

            {/* Client-side only for now (see use-theme.ts) - unlike the fields above,
                there's no backend member-preference column for this yet. */}
            <section className="bl-account-section">
              <p className="bl-eyebrow">Appearance</p>
              <div className="bl-account-field">
                <span>Theme</span>
                <div className="bl-theme-options" role="group" aria-label="Color theme">
                  {(["light", "dark"] as Theme[]).map((option) => (
                    <button key={option} type="button" aria-pressed={theme === option} onClick={() => setTheme(option)}>
                      {option === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="bl-account-section">
              <p className="bl-eyebrow">Notification preferences</p>
              <div className="bl-account-checks">
                <label className="bl-check">
                  <input type="checkbox" checked={prefs.notify_on_assignment} onChange={e => setPrefs({...prefs, notify_on_assignment: e.target.checked})} />
                  <span>Notify me on assignment</span>
                </label>
                <label className="bl-check">
                  <input type="checkbox" checked={prefs.notify_on_mention} onChange={e => setPrefs({...prefs, notify_on_mention: e.target.checked})} />
                  <span>Notify me when mentioned</span>
                </label>
                <label className="bl-check">
                  <input type="checkbox" checked={prefs.notify_on_reply} onChange={e => setPrefs({...prefs, notify_on_reply: e.target.checked})} />
                  <span>Notify me on comment replies</span>
                </label>
                <label className="bl-check">
                  <input type="checkbox" checked={prefs.notify_on_status_change} onChange={e => setPrefs({...prefs, notify_on_status_change: e.target.checked})} />
                  <span>Notify me on ticket status changes</span>
                </label>
                <label className="bl-check">
                  <input type="checkbox" checked={prefs.daily_digest} onChange={e => setPrefs({...prefs, daily_digest: e.target.checked})} />
                  <span>Receive daily digest</span>
                </label>
              </div>
            </section>
            
            <section className="bl-account-section">
              <p className="bl-eyebrow">Security &amp; Sessions</p>
              {sessionError ? (
                <p role="alert" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  Sessions could not load.
                  <button type="button" className="bl-quiet" onClick={loadSessions}>Try again</button>
                </p>
              ) : loadingSessions ? (
                <p className="bl-mono">Loading sessions...</p>
              ) : (
                <div className="bl-session-list">
                  {sessions.map(s => (
                    <div key={s.id} className="bl-session-row">
                      <div>
                        <strong>{s.os || "Unknown OS"}</strong> • {s.browser || "Unknown Browser"}
                        {s.current && <span className="bl-session-current">Current</span>}
                        <p className="bl-mono" style={{ margin: "4px 0 0" }}>
                          {s.ip_address || "Unknown IP"} • {new Date(s.last_active_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!s.current && (
                        <button type="button" className="bl-quiet" onClick={() => setRevokeCandidate(s)} style={{ color: "var(--bl-error)", borderColor: "transparent" }}>
                          Sign out
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            
          </div>
          
        </div>
        
        <footer className="bl-account-actions">
          <button
            type="button"
            className="bl-quiet"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            {signingOut ? "Signing out..." : "Sign out this session"}
          </button>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" className="bl-quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="bl-button mint" disabled={saving}>
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
