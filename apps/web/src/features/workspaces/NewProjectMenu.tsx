import { Button } from "@backline/ui";
import { useState } from "react";

import { ChevronDownIcon, ImagePdfIcon, MobileIcon, WebAppIcon, WebsiteIcon } from "../../app/layout/sidebar-icons";
import { ComingSoonModal } from "./ComingSoonModal";

const OTHER_TYPES = [
  { label: "Web App", description: "Review Web Applications", icon: WebAppIcon },
  { label: "Mobile", description: "Review Mobile Applications", icon: MobileIcon },
  { label: "Image & PDF", description: "Review Images and PDFs", icon: ImagePdfIcon },
];

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
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  return (
    <div className="relative inline-flex" onMouseLeave={() => setShowMenu(false)}>
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
          className="bg-accent-primary flex items-center justify-center rounded-r-md border-l border-white/20 px-2 text-white hover:opacity-90"
        >
          <ChevronDownIcon width={14} height={14} />
        </button>
      </div>

      {showMenu && (
        <div className="bg-bg-surface absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border border-black/10 p-2 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
          <button
            onClick={() => {
              setShowMenu(false);
              onCreateWebsite();
            }}
            className="hover:bg-bg-canvas flex w-full items-start gap-3 rounded-md p-2 text-left"
          >
            <WebsiteIcon width={20} height={20} className="text-accent-primary mt-0.5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Website</span>
              <span className="text-text-muted block text-xs">Review Live Websites</span>
            </span>
          </button>
          {OTHER_TYPES.map(({ label, description, icon: TypeIcon }) => (
            <button
              key={label}
              onClick={() => {
                setShowMenu(false);
                setComingSoon(label);
              }}
              className="hover:bg-bg-canvas flex w-full items-start gap-3 rounded-md p-2 text-left"
            >
              <TypeIcon width={20} height={20} className="text-accent-primary mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="text-text-muted block text-xs">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {comingSoon && (
        <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />
      )}
    </div>
  );
}
