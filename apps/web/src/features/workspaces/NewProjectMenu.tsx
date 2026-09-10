import { Button } from "@backline/ui";
import { useEffect, useRef, useState } from "react";
import { useOnClickOutside } from "../../lib/use-click-outside";

import { ChevronDownIcon, WebsiteIcon } from "../../app/layout/sidebar-icons";

interface NewProjectMenuProps {
  onCreateWebsite: () => void;
}

// The main button's own click keeps opening the real website-project modal directly
// (apps/e2e/helpers/login.ts's createProject clicks this button and expects the modal
// immediately - a menu-first design would break every test that creates a project). The
// small chevron next to it is a separate hit target that reveals the other project
// types on hover, matching the reference: only Website is real, so it's also the first
// (and pre-selected-looking) item in that menu.
export function NewProjectMenu({ onCreateWebsite }: NewProjectMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(rootRef, () => setShowMenu(false));

  useEffect(() => {
    if (!showMenu) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowMenu(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showMenu]);

  return (
    <div ref={rootRef} className="relative inline-flex" onMouseLeave={() => setShowMenu(false)}>
      <div className="inline-flex overflow-hidden rounded-md">
        <Button onClick={onCreateWebsite} className="rounded-r-none">
          + New Project
        </Button>
        <button
          onMouseEnter={() => setShowMenu(true)}
          onClick={() => setShowMenu((prev) => !prev)}
          aria-label="Choose project type"
          aria-haspopup="true"
          aria-expanded={showMenu}
          className="bg-accent-fill text-on-accent flex items-center justify-center rounded-r-md border-l border-white/20 px-2 hover:opacity-90"
        >
          <ChevronDownIcon width={14} height={14} />
        </button>
      </div>

      {showMenu && (
        <div className="bl-dropdown-pop" role="menu" aria-label="Project type" style={{ minWidth: "256px" }}>
          <button
            role="menuitem"
            className="bl-dropdown-item"
            onClick={() => {
              setShowMenu(false);
              onCreateWebsite();
            }}
          >
            <WebsiteIcon width={20} height={20} className="text-accent-primary shrink-0" />
            <span className="stack">
              <strong>Website</strong>
              <small>Review Live Websites</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
