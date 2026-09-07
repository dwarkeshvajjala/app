import { ATTACHMENT_ACCEPT, attachmentIcon, setupAttachments, type AttachmentResult } from "./ui-attachments";

export interface ComposerResult {
  body: string;
  attachments: AttachmentResult[];
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
