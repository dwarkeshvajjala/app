import { useRef, useState } from "react";

import { CommentsIcon, CrownIcon, MonitorIcon } from "../panel/icons";
import { useOnClickOutside } from "../../../lib/use-click-outside";

export interface ViewportOption {
  name: string;
  width: number;
  height: number;
}

// Real device presets (the same set most browser devtools ship with), not fabricated
// ones - selecting one actually resizes the canvas iframe to that device's pixel
// dimensions (see ProjectOverviewPage). The crown badges are decorative only for now
// (no real seat/plan gating exists yet), so every option is fully clickable.
// eslint-disable-next-line react-refresh/only-export-components
export const VIEWPORTS: ViewportOption[] = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone XR", width: 414, height: 896 },
  { name: "iPhone 12 Pro", width: 390, height: 844 },
  { name: "Pixel 2", width: 411, height: 731 },
  { name: "Pixel 5", width: 393, height: 851 },
  { name: "Galaxy S8+", width: 360, height: 740 },
  { name: "Galaxy S20 Ultra", width: 412, height: 915 },
  { name: "iPad Air", width: 820, height: 1180 },
  { name: "iPad Mini", width: 768, height: 1024 },
  { name: "Surface Pro 7", width: 912, height: 1368 },
  { name: "Surface Duo", width: 540, height: 720 },
  { name: "Samsung A71", width: 412, height: 914 },
  { name: "Nest Hub", width: 1024, height: 600 },
  { name: "Nest Hub Max", width: 1280, height: 800 },
];

interface ViewportMenuProps {
  viewport: ViewportOption | null;
  onChange: (viewport: ViewportOption | null) => void;
  totalComments: number;
}

export function ViewportMenu({ viewport, onChange, totalComments }: ViewportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOnClickOutside(ref, () => setOpen(false));

  function select(option: ViewportOption | null) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Viewport"
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
          viewport ? "border-accent-primary text-accent-primary" : "border-black/10 dark:border-white/10"
        }`}
      >
        <MonitorIcon width={14} height={14} />
      </button>

      {open && (
        <div className="bg-bg-surface absolute bottom-full left-0 mb-2 max-h-96 w-72 overflow-y-auto rounded-lg border border-black/10 p-2 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
          <p className="px-2 py-1.5 text-sm font-semibold">Switch Viewport</p>
          <button
            onClick={() => select(null)}
            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
              viewport === null ? "text-accent-primary bg-accent-primary/5" : "hover:bg-bg-canvas"
            }`}
          >
            <span>Desktop</span>
            <span className="text-text-muted flex items-center gap-1 text-xs">
              <CommentsIcon width={13} height={13} />
              {totalComments}
            </span>
          </button>
          {VIEWPORTS.map((option) => {
            const selected = viewport?.name === option.name;
            return (
              <button
                key={option.name}
                onClick={() => select(option)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                  selected ? "text-accent-primary bg-accent-primary/5" : "hover:bg-bg-canvas"
                }`}
              >
                <span>
                  {option.name}
                  {selected && (
                    <span className="text-text-muted">
                      {" "}
                      ({option.width}px x {option.height}px)
                    </span>
                  )}
                </span>
                <CrownIcon width={14} height={14} className="text-recovery-low-confidence shrink-0" />
              </button>
            );
          })}
          <div className="mt-2 border-t border-black/10 px-2 py-2 pt-3 dark:border-white/10">
            <p className="mb-2 text-xs font-semibold text-text-muted">Custom Size (px)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Width"
                className="bl-input w-20 px-2 py-1 text-xs"
                value={viewport?.name === "Custom" ? viewport.width : ""}
                onChange={(e) => {
                  const w = parseInt(e.target.value, 10);
                  if (w) select({ name: "Custom", width: w, height: viewport?.height || 800 });
                }}
              />
              <span className="text-text-muted">×</span>
              <input
                type="number"
                placeholder="Height"
                className="bl-input w-20 px-2 py-1 text-xs"
                value={viewport?.name === "Custom" ? viewport.height : ""}
                onChange={(e) => {
                  const h = parseInt(e.target.value, 10);
                  if (h) select({ name: "Custom", width: viewport?.width || 1200, height: h });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
