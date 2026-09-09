import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

import { ComingSoonModal } from "./ComingSoonModal";

interface ProjectTypePlaceholderPageProps {
  label: string;
  tagline: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Shared empty state for the project types that do not exist yet (Web App and Mobile).
// Website, image, and PDF projects use the real ProjectsPage flow.
export function ProjectTypePlaceholderPage({ label, tagline, icon: TypeIcon }: ProjectTypePlaceholderPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <main className="bl-wrap">
      <div className="bl-head">
        <h1>{label} Projects</h1>
      </div>

      <div className="bl-new-card">
        <span className="bl-mark">
          <TypeIcon width={24} height={24} />
        </span>
        <strong>Create your first {label.toLowerCase()} project</strong>
        <small>{tagline}</small>
        <button
          onClick={() => setShowComingSoon(true)}
          className="bl-button mint"
        >
          + New {label} Project
        </button>
      </div>

      {showComingSoon && (
        <ComingSoonModal feature={label} onClose={() => setShowComingSoon(false)} />
      )}
    </main>
  );
}
