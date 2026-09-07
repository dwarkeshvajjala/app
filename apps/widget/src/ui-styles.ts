const HOST_STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .bl-tooltip {
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483000;
    background: #14141A; color: #F2F2F5; padding: 10px 14px; border-radius: 8px;
    font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); max-width: 220px;
  }
  .bl-name-form {
    position: fixed; z-index: 2147483000; background: #FFFFFF; color: #14141A;
    border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); padding: 16px;
    width: 260px; border: 1px solid rgba(0,0,0,0.08);
    top: 50%; left: 50%; transform: translate(-50%, -50%);
  }
  .bl-composer {
    /* absolute (document coordinates), not fixed (viewport coordinates): the composer
       opens at the point the reviewer clicked, on an already-scrolled page - fixed
       positioning would leave it glued to that screen position as the page scrolls
       underneath it, drifting away from the element it's actually about. */
    position: absolute; z-index: 2147483000; background: #FFFFFF; color: #14141A;
    border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); padding: 16px;
    width: 260px; border: 1px solid rgba(0,0,0,0.08);
  }
  .bl-composer input, .bl-composer textarea, .bl-name-form input {
    width: 100%; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; padding: 8px;
    font-size: 13px; margin-top: 6px; margin-bottom: 10px;
  }
  .bl-composer button, .bl-name-form button {
    background: #4F46E5; color: #fff; border: none; border-radius: 6px; padding: 8px 12px;
    font-size: 13px; cursor: pointer; width: 100%;
  }
  .bl-composer-header { display: flex; justify-content: flex-end; margin-bottom: -4px; }
  .bl-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .bl-attachment-chip {
    display: flex; align-items: center; gap: 5px; background: #F5F5F7; border-radius: 6px;
    padding: 4px 6px 4px 8px; font-size: 12px; max-width: 100%; border: 1px solid rgba(0,0,0,0.06);
  }
  .bl-attachment-chip.bl-attachment-pending { opacity: 0.6; }
  .bl-attachment-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;
  }
  .bl-attachment-link {
    display: flex; align-items: center; gap: 5px; background: #F5F5F7; border-radius: 6px;
    padding: 4px 8px; font-size: 12px; color: #14141A; text-decoration: none; max-width: 100%;
    border: 1px solid rgba(0,0,0,0.06);
  }
  .bl-attachment-link:hover { background: #EBEBEF; }
  .bl-composer-toolbar { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  /* Two classes (this container + .bl-submit) beats ".bl-composer button"'s one-class
     -plus-element on specificity outright - no source-order trick needed here, unlike
     button.bl-attach-button below. Without this, width:100% from the general rule would
     fight the flex row instead of sharing it with the attach button beside it. */
  .bl-composer-toolbar .bl-submit { flex: 1; width: auto; }
  .bl-message-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  /* .bl-composer button (above) also matches this element (it's a button inside
     .bl-composer) and beats a bare .bl-cancel class on specificity alone regardless of
     source order - the extra "button" qualifier here is what makes this win instead. */
  button.bl-cancel {
    background: none; color: #6B6B76; width: auto; padding: 2px 4px; font-size: 16px;
    line-height: 1; border-radius: 4px;
  }
  button.bl-cancel:hover { background: rgba(0,0,0,0.06); }
  .bl-thread {
    position: absolute; z-index: 2147483000; background: #FFFFFF; color: #14141A;
    border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
    width: 300px; max-height: 400px; border: 1px solid rgba(0,0,0,0.06);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .bl-thread-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 8px 10px 14px; border-bottom: 1px solid rgba(0,0,0,0.06); font-weight: 600;
    font-size: 13px; flex-shrink: 0;
  }
  .bl-thread-header-actions { display: flex; align-items: center; gap: 2px; }
  .bl-thread-messages {
    overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 14px;
  }
  .bl-thread-message { display: flex; gap: 10px; }
  .bl-avatar {
    flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600; line-height: 1;
  }
  .bl-thread-message-main { flex: 1; min-width: 0; }
  .bl-thread-message-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 4px;
  }
  .bl-thread-message-meta {
    font-size: 12px; display: flex; align-items: baseline; gap: 6px; min-width: 0;
    padding-top: 2px;
  }
  .bl-thread-message-author { font-weight: 600; color: #14141A; }
  .bl-thread-message-time { color: #9A9AA6; font-size: 11px; white-space: nowrap; }
  .bl-thread-message-body {
    font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word;
    margin-top: 3px;
  }
  .bl-menu { position: relative; flex-shrink: 0; }
  .bl-menu-trigger {
    background: none; border: none; color: #9A9AA6; width: 22px; height: 20px; padding: 0;
    border-radius: 4px; cursor: pointer; font-size: 15px; line-height: 1; letter-spacing: 1px;
  }
  .bl-menu-trigger:hover { background: rgba(0,0,0,0.06); color: #14141A; }
  .bl-menu-dropdown {
    /* fixed (viewport coordinates, positioned via JS from the trigger's own
       getBoundingClientRect() - see openThreadView), not absolute: .bl-thread has
       overflow:hidden and .bl-thread-messages scrolls its own overflow, so an
       absolutely-positioned dropdown opened on a message near the panel's bottom edge
       got silently clipped - invisible or cut off instead of just floating over
       whatever's actually behind the panel, which fixed positioning correctly does. */
    position: fixed; background: #fff; border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18); border: 1px solid rgba(0,0,0,0.06);
    min-width: 150px; padding: 4px; z-index: 2147483001;
  }
  .bl-menu-item {
    display: block; width: 100%; text-align: left; background: none; border: none;
    padding: 7px 10px; font-size: 13px; border-radius: 5px; cursor: pointer; color: #14141A;
  }
  .bl-menu-item:hover { background: rgba(0,0,0,0.05); }
  .bl-menu-item.bl-danger { color: #EF4444; }
  .bl-thread-edit textarea {
    width: 100%; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; background: #F5F5F7;
    padding: 8px 10px; font-size: 13px; resize: vertical; min-height: 60px;
  }
  .bl-thread-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  .bl-thread-edit-actions button {
    border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; border: none;
  }
  .bl-thread-edit-actions button:disabled { opacity: 0.5; cursor: default; }
  /* button.bl-edit-cancel, not bare .bl-edit-cancel: same specificity reasoning as
     button.bl-cancel above - needs to beat .bl-thread-edit-actions button's own
     border:none to actually render a visible outline. */
  .bl-thread-edit-actions button.bl-edit-cancel {
    background: #fff; border: 1px solid rgba(0,0,0,0.15); color: #14141A;
  }
  .bl-edit-save { background: #4F46E5; color: #fff; }
  .bl-thread-reply {
    border-top: 1px solid rgba(0,0,0,0.06); padding: 10px 14px 12px; flex-shrink: 0;
    display: flex; gap: 8px; align-items: flex-end;
  }
  .bl-thread-reply textarea {
    flex: 1; min-width: 0; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; resize: none; max-height: 80px;
  }
  .bl-thread-reply button {
    background: #4F46E5; color: #fff; border: none; border-radius: 8px; padding: 8px 12px;
    font-size: 13px; cursor: pointer; flex-shrink: 0;
  }
  .bl-thread-reply button:disabled { opacity: 0.5; cursor: default; }
  .bl-thread-error { color: #EF4444; font-size: 11px; padding: 0 14px 8px; }
  .bl-pin {
    /* absolute (document coordinates): must scroll with the page to stay attached to
       the element it marks, the same reasoning as .bl-composer above. */
    position: absolute; width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
    background: #4F46E5; transform: rotate(-45deg) translate(-50%, -50%);
    z-index: 2147482999; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .bl-status { font-size: 12px; color: #6B6B76; margin-top: 8px; }
  .bl-toast {
    position: fixed; bottom: 24px; left: 24px; z-index: 2147483000;
    background: #14141A; color: #F2F2F5; padding: 10px 14px; border-radius: 8px;
    font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); max-width: 240px;
  }
  /* button.bl-attach-button / button.bl-attachment-remove, not the bare classes: both
     ".bl-composer button" and ".bl-thread-reply button" above already match these
     elements (they're buttons inside those containers) at equal specificity (one class
     + one element each) - the extra "button" qualifier here ties that instead of
     losing to it, and being declared last in this stylesheet is what wins the tie
     (same trick as button.bl-cancel above). Without this, both rendered as a full-width
     purple bar (the composer's own submit-button styling bleeding onto them) instead of
     a small, borderless icon - a real bug found by hand, not just a specificity nitpick.
  */
  button.bl-attach-button {
    background: none; border: none; color: #6B6B76; width: 26px; height: 26px;
    border-radius: 6px; cursor: pointer; display: flex; align-items: center;
    justify-content: center; padding: 0; flex-shrink: 0;
  }
  button.bl-attach-button:hover { background: rgba(0,0,0,0.06); color: #14141A; }
  button.bl-attachment-remove {
    background: none; border: none; color: #6B6B76; cursor: pointer; width: auto;
    padding: 0 2px; font-size: 14px; line-height: 1; flex-shrink: 0;
  }
  button.bl-attachment-remove:hover { color: #EF4444; }
`;

export function createShadowRoot(): ShadowRoot {
  const host = document.createElement("div");
  host.setAttribute("data-backline-root", "true");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = HOST_STYLES;
  shadow.appendChild(style);
  return shadow;
}
