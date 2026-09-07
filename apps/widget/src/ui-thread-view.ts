import { timeAgo } from "./time";
import { ATTACHMENT_ACCEPT, attachmentIcon, setupAttachments, type AttachmentInfo, type AttachmentResult } from "./ui-attachments";

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
