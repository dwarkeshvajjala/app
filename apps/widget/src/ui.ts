const HOST_STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .bl-tooltip {
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483000;
    background: #14141A; color: #F2F2F5; padding: 10px 14px; border-radius: 8px;
    font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); max-width: 220px;
  }
  .bl-name-form, .bl-composer {
    position: fixed; z-index: 2147483000; background: #FFFFFF; color: #14141A;
    border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); padding: 16px;
    width: 260px; border: 1px solid rgba(0,0,0,0.08);
  }
  .bl-name-form { top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .bl-composer input, .bl-composer textarea, .bl-name-form input {
    width: 100%; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; padding: 8px;
    font-size: 13px; margin-top: 6px; margin-bottom: 10px;
  }
  .bl-composer button, .bl-name-form button {
    background: #4F46E5; color: #fff; border: none; border-radius: 6px; padding: 8px 12px;
    font-size: 13px; cursor: pointer; width: 100%;
  }
  .bl-pin {
    position: absolute; width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
    background: #4F46E5; transform: rotate(-45deg) translate(-50%, -50%);
    z-index: 2147482999; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .bl-status { font-size: 12px; color: #6B6B76; margin-top: 8px; }
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

export function showTooltip(shadow: ShadowRoot): void {
  const tooltip = document.createElement("div");
  tooltip.className = "bl-tooltip";
  tooltip.textContent = "Tap anywhere on the page to leave feedback.";
  shadow.appendChild(tooltip);
  setTimeout(() => tooltip.remove(), 6000);
}

export function promptForName(shadow: ShadowRoot): Promise<string> {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    form.className = "bl-name-form";
    form.innerHTML = `
      <label style="font-size:13px;font-weight:600;">Your name</label>
      <input type="text" required placeholder="Jamie" />
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
}

export function openComposer(
  shadow: ShadowRoot,
  x: number,
  y: number,
  onSubmit: (result: ComposerResult) => void,
): { setStatus: (text: string) => void; close: () => void } {
  const composer = document.createElement("div");
  composer.className = "bl-composer";
  composer.style.left = `${Math.min(x + 16, window.innerWidth - 280)}px`;
  composer.style.top = `${Math.min(y + 16, window.innerHeight - 220)}px`;
  composer.innerHTML = `
    <textarea rows="3" placeholder="What's the issue here?" required></textarea>
    <button type="button">Capture &amp; prepare comment</button>
    <div class="bl-status"></div>
  `;
  shadow.appendChild(composer);

  const statusEl = composer.querySelector<HTMLDivElement>(".bl-status")!;
  const button = composer.querySelector("button")!;
  const textarea = composer.querySelector("textarea")!;

  button.addEventListener("click", () => {
    const body = textarea.value.trim();
    if (!body) return;
    button.setAttribute("disabled", "true");
    onSubmit({ body });
  });

  const outsideClickHandler = (event: MouseEvent) => {
    // event.target is retargeted to the shadow host when observed from outside the
    // shadow tree (Shadow DOM's event retargeting), so `composer.contains(event.target)`
    // is always false here - even for clicks genuinely inside the composer. composedPath()
    // returns the real, un-retargeted path, which is what this check actually needs.
    if (!event.composedPath().includes(composer)) {
      composer.remove();
      document.removeEventListener("click", outsideClickHandler, true);
    }
  };
  setTimeout(() => document.addEventListener("click", outsideClickHandler, true), 0);

  return {
    setStatus: (text: string) => {
      statusEl.textContent = text;
    },
    close: () => composer.remove(),
  };
}
