import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

import { ComingSoonModal } from "./ComingSoonModal";

interface ProjectTypePlaceholderPageProps {
  label: string;
  tagline: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Shared empty state for the three project types that don't exist yet (Web App,
// Mobile, Image & PDF - only Website review is actually built). Real project types
// would reuse WorkspaceHomePage's project grid instead of this once they exist.
export function ProjectTypePlaceholderPage({ label, tagline, icon: TypeIcon }: ProjectTypePlaceholderPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <main className="px-6 py-8">
      <h1 className="text-xl font-semibold">{label} Projects</h1>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <span className="bg-accent-primary/10 text-accent-primary flex h-20 w-20 items-center justify-center rounded-full">
          <TypeIcon width={36} height={36} />
        </span>
        <h2 className="text-lg font-semibold">Create your first {label.toLowerCase()} project</h2>
        <p className="text-text-muted max-w-sm text-sm">{tagline}</p>
        <button
          onClick={() => setShowComingSoon(true)}
          className="from-accent-primary mt-2 rounded-full bg-gradient-to-r to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white"
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
