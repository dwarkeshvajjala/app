import { timeAgo } from "./time";

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

// F7 (01-Product-Vision.md, 07-Review-SDK.md §7.2): "single tooltip, dismissed after
// first successful comment" - the timeout is just a fallback for a reviewer who never
// comments at all; `dismiss()` is what the empty-state requirement actually describes,
// called the moment a comment successfully posts (index.ts).
export function showTooltip(shadow: ShadowRoot): { dismiss: () => void } {
  const tooltip = document.createElement("div");
  tooltip.className = "bl-tooltip";
  tooltip.textContent = "Tap anywhere on the page to leave feedback.";
  shadow.appendChild(tooltip);
  const timer = setTimeout(() => tooltip.remove(), 6000);
  return {
    dismiss: () => {
      clearTimeout(timer);
      tooltip.remove();
    },
  };
}

export function showToast(shadow: ShadowRoot, text: string): void {
  const toast = document.createElement("div");
  toast.className = "bl-toast";
  toast.textContent = text;
  shadow.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

export function promptForName(shadow: ShadowRoot): Promise<string> {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    form.className = "bl-name-form";
    form.innerHTML = `
      <label for="bl-name-input" style="font-size:13px;font-weight:600;">Your name</label>
      <input id="bl-name-input" type="text" required placeholder="Jamie" />
      <button type="submit">Continue</button>
    `;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input")!;
      const value = input.value.trim();
      if (!value) return;
      form.remove();
      resolve(value);
    });
    shadow.appendChild(form);
  });
}

/** x/y are page (document) coordinates - e.g. MouseEvent.pageX/pageY, not clientX/
 * clientY - so the pin scrolls with the content instead of drifting off the element
 * it marks the moment the reviewer scrolls (.bl-pin is position: absolute). */
export function renderPin(shadow: ShadowRoot, x: number, y: number): HTMLElement {
  const pin = document.createElement("div");
  pin.className = "bl-pin";
  pin.style.left = `${x}px`;
  pin.style.top = `${y}px`;
  shadow.appendChild(pin);
  return pin;
}

export interface ComposerResult {
  body: string;
  attachments: AttachmentResult[];
}

export interface AttachmentResult {
  key: string;
  filename: string;
  content_type: string;
}

// The shape a *display-ready* attachment takes (mirrors the backend's AttachmentOut) -
// a fetchable url, not the upload-time key. Distinct from AttachmentResult above (what
// uploadFile returns while composing) since the widget never re-derives one from the
// other; they're just used in different places (composing vs. rendering an existing
// message).
export interface AttachmentInfo {
  filename: string;
  url: string;
  content_type: string;
}

// "for now" support (images, PDF, Word/Excel docs, Markdown) - matches the backend
// allowlist (backend/app/modules/storage/schemas.py) exactly; the `accept` attribute is
// just a UI hint (the browser's own file picker still lets a user override it), the real
// enforcement is server-side.
const ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/markdown,.md";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function attachmentIcon(): string {
  return `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true"><path d="M11.5 5.5 6.8 10.2a2 2 0 1 1-2.8-2.8l5-5a3 3 0 1 1 4.2 4.2l-5.2 5.2a1 1 0 1 1-1.4-1.4L11 5.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * Uploaded eagerly, one at a time, the moment each file is picked - not deferred until
 * submit - so a reviewer sees per-file upload failures immediately (a chip that just
 * won't leave its pending state) rather than the whole comment silently failing to post
 * later. `uploadFile` does the actual network work (index.ts owns the API client; ui.ts
 * doesn't import it, same separation as everywhere else in this file) and returns null
 * on failure, which removes the chip and never gets included in the submitted result.
 */
function setupAttachments(
  composer: HTMLElement,
  uploadFile: (file: File) => Promise<AttachmentResult | null>,
): { getAttachments: () => AttachmentResult[]; disable: () => void; reset: () => void } {
  const attachmentsEl = composer.querySelector<HTMLDivElement>(".bl-attachments")!;
  const fileInput = composer.querySelector<HTMLInputElement>(".bl-attach-input")!;
  const attachButton = composer.querySelector<HTMLButtonElement>(".bl-attach-button")!;
  const uploaded: AttachmentResult[] = [];

  attachButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = "";
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) continue;

      const chip = document.createElement("span");
      chip.className = "bl-attachment-chip bl-attachment-pending";
      chip.innerHTML = `${attachmentIcon()}<span class="bl-attachment-name"></span><button type="button" class="bl-attachment-remove" aria-label="Remove attachment">&times;</button>`;
      chip.querySelector(".bl-attachment-name")!.textContent = file.name;
      attachmentsEl.appendChild(chip);

      const removeButton = chip.querySelector<HTMLButtonElement>(".bl-attachment-remove")!;
      let result: AttachmentResult | null = null;
      removeButton.addEventListener("click", () => {
        chip.remove();
        if (result) {
          const idx = uploaded.indexOf(result);
          if (idx !== -1) uploaded.splice(idx, 1);
        }
      });

      void uploadFile(file).then((uploadedResult) => {
        if (!uploadedResult) {
          chip.remove();
          return;
        }
        result = uploadedResult;
        uploaded.push(uploadedResult);
        chip.classList.remove("bl-attachment-pending");
      });
    }
  });

  return {
    getAttachments: () => uploaded,
    disable: () => {
      attachButton.setAttribute("disabled", "true");
      fileInput.setAttribute("disabled", "true");
    },
    reset: () => {
      uploaded.length = 0;
      attachmentsEl.innerHTML = "";
    },
  };
}

/**
 * x/y are page (document) coordinates, same as renderPin. The off-screen clamp has to
 * account for the current scroll position too, since window.innerWidth/innerHeight are
 * viewport-sized but x/y are measured from the top of the document.
 *
 * `onCancel` fires exactly once whenever the composer is dismissed *without* a
 * successful submit - the explicit "x" button, or a click elsewhere on the page - never
 * after a real submit. The caller (index.ts) uses it to remove this attempt's pin, the
 * other half of a real bug found by hand: every click created a pin with no cleanup
 * path at all, so an abandoned or click-elsewhere-cancelled comment left a permanent,
 * unremovable stray pin behind - clicking around a page a few times filled it with pins
 * nothing could ever get rid of.
 */
export function openComposer(
  shadow: ShadowRoot,
  x: number,
  y: number,
  onSubmit: (result: ComposerResult) => void,
  onCancel: () => void,
  uploadFile: (file: File) => Promise<AttachmentResult | null>,
): { setStatus: (text: string) => void; close: () => void } {
  const composer = document.createElement("div");
  composer.className = "bl-composer";
  const maxLeft = window.scrollX + window.innerWidth - 280;
  const maxTop = window.scrollY + window.innerHeight - 220;
  composer.style.left = `${Math.min(x + 16, maxLeft)}px`;
  composer.style.top = `${Math.min(y + 16, maxTop)}px`;
  composer.innerHTML = `
    <div class="bl-composer-header">
      <button type="button" class="bl-cancel" aria-label="Cancel comment">&times;</button>
    </div>
    <textarea rows="3" placeholder="What's the issue here?" required aria-label="Comment"></textarea>
    <div class="bl-attachments"></div>
    <div class="bl-composer-toolbar">
      <button type="button" class="bl-attach-button" aria-label="Attach a file" title="Attach a file">${attachmentIcon()}</button>
      <input type="file" class="bl-attach-input" accept="${ATTACHMENT_ACCEPT}" multiple hidden aria-label="Choose files to attach" />
      <button type="button" class="bl-submit">Capture &amp; prepare comment</button>
    </div>
    <div class="bl-status"></div>
  `;
  shadow.appendChild(composer);

  const statusEl = composer.querySelector<HTMLDivElement>(".bl-status")!;
  const submitButton = composer.querySelector<HTMLButtonElement>(".bl-submit")!;
  const cancelButton = composer.querySelector<HTMLButtonElement>(".bl-cancel")!;
  const textarea = composer.querySelector("textarea")!;
  const attachments = setupAttachments(composer, uploadFile);
  let submitted = false;

  function removeOutsideClickListener(): void {
    document.removeEventListener("click", outsideClickHandler, true);
  }

  function cancel(): void {
    removeOutsideClickListener();
    composer.remove();
    if (!submitted) onCancel();
  }

  cancelButton.addEventListener("click", cancel);

  submitButton.addEventListener("click", () => {
    const body = textarea.value.trim();
    if (!body) return;
    submitted = true;
    submitButton.setAttribute("disabled", "true");
    cancelButton.setAttribute("disabled", "true");
    attachments.disable();
    onSubmit({ body, attachments: attachments.getAttachments() });
  });

  const outsideClickHandler = (event: MouseEvent) => {
    // event.target is retargeted to the shadow host when observed from outside the
    // shadow tree (Shadow DOM's event retargeting), so `composer.contains(event.target)`
    // is always false here - even for clicks genuinely inside the composer. composedPath()
    // returns the real, un-retargeted path, which is what this check actually needs.
    if (!event.composedPath().includes(composer)) {
      cancel();
    }
  };
  setTimeout(() => document.addEventListener("click", outsideClickHandler, true), 0);

  return {
    setStatus: (text: string) => {
      statusEl.textContent = text;
    },
    close: () => {
      removeOutsideClickListener();
      composer.remove();
    },
  };
}

export interface ThreadViewMessage {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
  canDelete: boolean;
  attachments: AttachmentInfo[];
}

export interface ThreadViewHandlers {
  onReply: (body: string, attachments: AttachmentResult[]) => Promise<void>;
  onEditMessage: (id: string, body: string) => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  onDeleteThread: () => Promise<void>;
  onClose: () => void;
}

export interface ThreadViewControls {
  close: () => void;
  setMessages: (messages: ThreadViewMessage[]) => void;
  setReplyError: (text: string) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Same 4-color brand palette as the dashboard's own Avatar (packages/ui/src/Avatar.tsx),
// hand-copied as hex since the widget can't reach into a Tailwind-themed React package -
// hashed by name so the same author always lands on the same color across both surfaces.
const AVATAR_COLORS = ["#6D28D9", "#075985", "#4F46E5", "#F59E0B"];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function avatarHtml(label: string): string {
  const initial = (label.trim()[0] ?? "?").toUpperCase();
  return `<span class="bl-avatar" style="background:${colorFor(label)}">${escapeHtml(initial)}</span>`;
}

/**
 * The view opened by clicking an *existing* pin (as opposed to openComposer, which is
 * for starting a brand new one): the original message, every reply beneath it, a reply
 * box, and - per-message, only where canDelete is true (the widget's own author-only
 * delete rule, comments/service.py's _require_own_comment mirrored client-side for the
 * UI, re-checked server-side regardless) - a delete affordance. canDeleteThread gates a
 * second, header-level "delete this whole thread" action.
 */
export function openThreadView(
  shadow: ShadowRoot,
  x: number,
  y: number,
  initialMessages: ThreadViewMessage[],
  canDeleteThread: boolean,
  handlers: ThreadViewHandlers,
  uploadFile: (file: File) => Promise<AttachmentResult | null>,
): ThreadViewControls {
  const thread = document.createElement("div");
  thread.className = "bl-thread";
  const maxLeft = window.scrollX + window.innerWidth - 300;
  const maxTop = window.scrollY + window.innerHeight - 380;
  thread.style.left = `${Math.min(x + 16, maxLeft)}px`;
  thread.style.top = `${Math.min(y + 16, maxTop)}px`;
  thread.innerHTML = `
    <div class="bl-thread-header">
      <span>Comment</span>
      <div class="bl-thread-header-actions">
        ${
          canDeleteThread
            ? `<div class="bl-menu bl-thread-menu">
                 <button type="button" class="bl-menu-trigger" aria-label="Thread options" aria-haspopup="true">&#8943;</button>
                 <div class="bl-menu-dropdown" hidden>
                   <button type="button" class="bl-menu-item bl-danger bl-delete-thread">Delete thread</button>
                 </div>
               </div>`
            : ""
        }
      </div>
    </div>
    <div class="bl-thread-messages"></div>
    <div class="bl-attachments bl-reply-attachments"></div>
    <div class="bl-thread-reply">
      <button type="button" class="bl-attach-button bl-reply-attach" aria-label="Attach a file" title="Attach a file">${attachmentIcon()}</button>
      <input type="file" class="bl-attach-input" accept="${ATTACHMENT_ACCEPT}" multiple hidden aria-label="Choose files to attach" />
      <textarea rows="1" placeholder="Reply..." aria-label="Reply"></textarea>
      <button type="button" class="bl-reply-submit">Reply</button>
    </div>
    <div class="bl-thread-error" hidden></div>
  `;
  shadow.appendChild(thread);

  const messagesEl = thread.querySelector<HTMLDivElement>(".bl-thread-messages")!;
  const deleteThreadButton = thread.querySelector<HTMLButtonElement>(".bl-delete-thread");
  const replyTextarea = thread.querySelector<HTMLTextAreaElement>("textarea")!;
  const replySubmit = thread.querySelector<HTMLButtonElement>(".bl-reply-submit")!;
  const errorEl = thread.querySelector<HTMLDivElement>(".bl-thread-error")!;
  // setupAttachments looks up ".bl-attachments"/".bl-attach-input"/".bl-attach-button"
  // scoped to the element it's given - `thread` works here since the reply row is the
  // only attach affordance anywhere in this panel, so each class has exactly one match.
  const replyAttachments = setupAttachments(thread, uploadFile);

  // Delegated at the panel level (not per-button) so it keeps working across paint()
  // re-rendering the message list's innerHTML wholesale, and so opening one message's
  // "..." menu closes any other menu already open (including the header's own thread
  // menu) instead of stacking.
  function closeAllMenus(): void {
    thread.querySelectorAll<HTMLElement>(".bl-menu-dropdown").forEach((el) => {
      el.hidden = true;
    });
  }
  thread.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const trigger = target.closest<HTMLElement>(".bl-menu-trigger");
    if (trigger) {
      const dropdown = trigger.nextElementSibling as HTMLElement;
      const wasHidden = dropdown.hidden;
      closeAllMenus();
      if (wasHidden) {
        // .bl-menu-dropdown is position:fixed now (see its CSS comment) precisely so
        // it can't be clipped by .bl-thread/.bl-thread-messages' own overflow - which
        // means it needs its position computed here, from the trigger's own current
        // viewport rect, rather than the CSS `top: 22px; right: 0` a relatively
        // positioned dropdown could rely on.
        const rect = trigger.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 4}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
      }
      dropdown.hidden = !wasHidden;
      return;
    }
    if (!target.closest(".bl-menu-dropdown")) closeAllMenus();
  });
  // A dropdown is viewport-anchored (fixed) but the thread panel itself is
  // page-anchored (absolute) - if the page scrolls while a menu is open, the two would
  // visually drift apart. Simplest correct behavior: close any open menu on scroll,
  // same as most menu implementations do.
  window.addEventListener("scroll", closeAllMenus, true);

  // editingId is local, transient UI state (which message, if any, is showing its
  // inline edit textarea right now) - separate from currentMessages, the last
  // authoritative data this panel was given. paint() re-renders both together;
  // setMessages (below, called with fresh server data after a reply/edit/delete)
  // always drops out of edit mode, since by then the save it was for has either
  // completed or been superseded.
  let currentMessages: ThreadViewMessage[] = initialMessages;
  let editingId: string | null = null;

  function messageHtml(message: ThreadViewMessage): string {
    if (message.id === editingId) {
      return `
        <div class="bl-thread-message" data-id="${message.id}">
          ${avatarHtml(message.authorLabel)}
          <div class="bl-thread-message-main">
            <div class="bl-thread-edit">
              <textarea class="bl-edit-textarea">${escapeHtml(message.body)}</textarea>
              <div class="bl-thread-edit-actions">
                <button type="button" class="bl-edit-cancel">Cancel</button>
                <button type="button" class="bl-edit-save">Save</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div class="bl-thread-message" data-id="${message.id}">
        ${avatarHtml(message.authorLabel)}
        <div class="bl-thread-message-main">
          <div class="bl-thread-message-header">
            <span class="bl-thread-message-meta">
              <span class="bl-thread-message-author">${escapeHtml(message.authorLabel)}</span>
              <span class="bl-thread-message-time">${escapeHtml(timeAgo(message.createdAt))}</span>
            </span>
            ${
              message.canDelete
                ? `<div class="bl-menu bl-message-menu">
                     <button type="button" class="bl-menu-trigger" aria-label="Message options" aria-haspopup="true">&#8943;</button>
                     <div class="bl-menu-dropdown" hidden>
                       <button type="button" class="bl-menu-item bl-edit-message">Edit...</button>
                       <button type="button" class="bl-menu-item bl-danger bl-delete-message">Delete comment</button>
                     </div>
                   </div>`
                : ""
            }
          </div>
          <p class="bl-thread-message-body">${escapeHtml(message.body)}</p>
          ${
            message.attachments.length > 0
              ? `<div class="bl-message-attachments">${message.attachments
                  .map(
                    (attachment) =>
                      `<a class="bl-attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">${attachmentIcon()}<span class="bl-attachment-name">${escapeHtml(attachment.filename)}</span></a>`,
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function paint(): void {
    messagesEl.innerHTML = currentMessages.map(messageHtml).join("");

    messagesEl.querySelectorAll<HTMLButtonElement>(".bl-delete-message").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.closest<HTMLElement>("[data-id]")?.dataset.id;
        if (id) void handlers.onDeleteMessage(id);
      });
    });
    messagesEl.querySelectorAll<HTMLButtonElement>(".bl-edit-message").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.closest<HTMLElement>("[data-id]")?.dataset.id;
        if (!id) return;
        editingId = id;
        paint();
        messagesEl
          .querySelector<HTMLTextAreaElement>(`[data-id="${id}"] .bl-edit-textarea`)
          ?.focus();
      });
    });
    messagesEl.querySelectorAll<HTMLButtonElement>(".bl-edit-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingId = null;
        paint();
      });
    });
    messagesEl.querySelectorAll<HTMLButtonElement>(".bl-edit-save").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>("[data-id]");
        const id = row?.dataset.id;
        const textarea = row?.querySelector<HTMLTextAreaElement>(".bl-edit-textarea");
        const newBody = textarea?.value.trim();
        if (!id || !newBody) return;
        button.setAttribute("disabled", "true");
        try {
          await handlers.onEditMessage(id, newBody);
          // On success the caller responds with a fresh setMessages() call (below),
          // which exits edit mode itself - nothing more to do here.
        } catch {
          button.removeAttribute("disabled");
          errorEl.textContent = "Could not save your edit. Please try again.";
          errorEl.hidden = false;
        }
      });
    });
  }
  paint();

  function removeOutsideClickListener(): void {
    document.removeEventListener("click", outsideClickHandler, true);
  }

  function close(): void {
    removeOutsideClickListener();
    window.removeEventListener("scroll", closeAllMenus, true);
    thread.remove();
  }

  deleteThreadButton?.addEventListener("click", () => void handlers.onDeleteThread());

  replySubmit.addEventListener("click", async () => {
    const body = replyTextarea.value.trim();
    if (!body) return;
    errorEl.hidden = true;
    replySubmit.setAttribute("disabled", "true");
    try {
      await handlers.onReply(body, replyAttachments.getAttachments());
      replyTextarea.value = "";
      replyAttachments.reset();
    } catch {
      errorEl.textContent = "Could not post your reply. Please try again.";
      errorEl.hidden = false;
    } finally {
      replySubmit.removeAttribute("disabled");
    }
  });

  const outsideClickHandler = (event: MouseEvent) => {
    // Same event-retargeting reasoning as openComposer's own outside-click handler.
    if (!event.composedPath().includes(thread)) {
      close();
      handlers.onClose();
    }
  };
  setTimeout(() => document.addEventListener("click", outsideClickHandler, true), 0);

  return {
    close,
    setMessages: (messages: ThreadViewMessage[]) => {
      currentMessages = messages;
      editingId = null;
      paint();
    },
    setReplyError: (text: string) => {
      errorEl.textContent = text;
      errorEl.hidden = false;
    },
  };
}
