import { useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "../../../lib/use-click-outside";
import { ChevronIcon, MonitorIcon } from "../panel/icons";

export interface ViewportOption {
  name: string;
  width: number;
  height: number;
}

interface ViewportGroup {
  label: string;
  options: ViewportOption[];
}

// These presets resize only the safe Backline proxy frame. They do not claim to
// emulate another browser or device; the widget continues to capture the real browser
// context according to the existing contract.
export const VIEWPORT_GROUPS: ViewportGroup[] = [
  {
    label: "Desktop",
    options: [
      { name: "Desktop · 1440", width: 1440, height: 900 },
      { name: "Laptop · 1280", width: 1280, height: 800 },
      { name: "Laptop · 1024", width: 1024, height: 768 },
    ],
  },
  {
    label: "Tablet",
    options: [
      { name: "iPad Air", width: 820, height: 1180 },
      { name: "iPad Mini", width: 768, height: 1024 },
      { name: "Surface Duo", width: 540, height: 720 },
    ],
  },
  {
    label: "Mobile",
    options: [
      { name: "iPhone SE", width: 375, height: 667 },
      { name: "iPhone 12 Pro", width: 390, height: 844 },
      { name: "Pixel 5", width: 393, height: 851 },
      { name: "Galaxy S20", width: 412, height: 915 },
    ],
  },
];

// Kept as a flat export for callers that need to resolve a URL-persisted preset.
// eslint-disable-next-line react-refresh/only-export-components
export const VIEWPORTS = VIEWPORT_GROUPS.flatMap((group) => group.options);

interface ViewportMenuProps {
  viewport: ViewportOption | null;
  onChange: (viewport: ViewportOption | null) => void;
}

export function ViewportMenu({ viewport, onChange }: ViewportMenuProps) {
  const [open, setOpen] = useState(false);
  const [customWidth, setCustomWidth] = useState(String(viewport?.width ?? 1200));
  const [customHeight, setCustomHeight] = useState(String(viewport?.height ?? 800));
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsedCustomWidth = Number(customWidth);
  const parsedCustomHeight = Number(customHeight);
  const customIsValid = Number.isFinite(parsedCustomWidth)
    && Number.isFinite(parsedCustomHeight)
    && parsedCustomWidth >= 280
    && parsedCustomWidth <= 2560
    && parsedCustomHeight >= 320
    && parsedCustomHeight <= 2000;

  useOnClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (viewport?.name !== "Custom") return;
    setCustomWidth(String(viewport.width));
    setCustomHeight(String(viewport.height));
  }, [viewport]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function select(option: ViewportOption | null) {
    onChange(option);
    setOpen(false);
  }

  function applyCustom() {
    if (!customIsValid) return;
    select({ name: "Custom", width: parsedCustomWidth, height: parsedCustomHeight });
  }

  return (
    <div className="bl-review-popover-anchor" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="bl-review-control bl-viewport-trigger"
      >
        <MonitorIcon width={14} height={14} />
        <span>{viewport?.name ?? "Fit canvas"}</span>
        <ChevronIcon width={11} height={11} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="bl-review-popover bl-viewport-popover" role="menu">
          <div className="bl-review-popover-label">Switch viewport</div>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={viewport === null}
            onClick={() => select(null)}
            className="bl-review-menu-row"
          >
            <span>Fit canvas</span>
            <span>Responsive</span>
          </button>
          {VIEWPORT_GROUPS.map((group) => (
            <div key={group.label} className="bl-viewport-group">
              <div className="bl-review-popover-label">{group.label}</div>
              {group.options.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  role="menuitemradio"
                  aria-checked={viewport?.name === option.name}
                  onClick={() => select(option)}
                  className="bl-review-menu-row"
                >
                  <span>{option.name}</span>
                  <span>{option.width} × {option.height}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="bl-custom-viewport">
            <div className="bl-review-popover-label">Custom size</div>
            <div>
              <label>
                <span>Width</span>
                <input
                  type="number"
                  min="280"
                  max="2560"
                  inputMode="numeric"
                  aria-invalid={!customIsValid}
                  value={customWidth}
                  onChange={(event) => setCustomWidth(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") applyCustom(); }}
                />
              </label>
              <span aria-hidden="true">×</span>
              <label>
                <span>Height</span>
                <input
                  type="number"
                  min="320"
                  max="2000"
                  inputMode="numeric"
                  aria-invalid={!customIsValid}
                  value={customHeight}
                  onChange={(event) => setCustomHeight(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") applyCustom(); }}
                />
              </label>
              <button type="button" className="bl-review-control" onClick={applyCustom} disabled={!customIsValid}>
                Apply
              </button>
            </div>
            <p className={customIsValid ? "" : "is-invalid"}>280–2560 px wide · 320–2000 px high</p>
          </div>
        </div>
      )}
    </div>
  );
}
