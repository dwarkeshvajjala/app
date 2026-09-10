import { useState } from "react";

import { ComingSoonModal } from "./ComingSoonModal";

interface ProjectTypePlaceholderPageProps {
  label: string;
  tagline: string;
}

// Shared empty state for the project types that do not exist yet (Web App and Mobile).
// Website, image, and PDF projects use the real ProjectsPage flow.
//
// audit-batch-13 P3: this used to repurpose .bl-new-card - the compact "add a card
// to this grid" tile used inline among real project cards (ProjectsPage.tsx) - as a
// full-width page hero, which is the wrong component for the job. Every sibling
// empty state (ClientsPage, MembersPage, TicketsPage, ProjectsPage's own "no
// projects yet" state, ...) uses .bl-empty instead; this now matches them.
export function ProjectTypePlaceholderPage({ label, tagline }: ProjectTypePlaceholderPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <main className="bl-wrap">
      <div className="bl-head">
        <h1>{label} Projects</h1>
      </div>

      <div className="bl-empty">
        <h2>Create your first {label.toLowerCase()} project</h2>
        <p>{tagline}</p>
        <button
          onClick={() => setShowComingSoon(true)}
          className="bl-button mint"
          style={{ marginTop: 12 }}
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
