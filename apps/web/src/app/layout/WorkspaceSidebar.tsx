import { Avatar } from "@backline/ui";
import type { ComponentType, SVGProps } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { IntegrationsIcon } from "../../features/projects/panel/icons";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import type { WorkspaceOut } from "../../features/workspaces/api";
import {
  BillingIcon,
  ChevronDownIcon,
  ImagePdfIcon,
  McpIcon,
  MembersIcon,
  MobileIcon,
  RecentIcon,
  SettingsIcon,
  UsageIcon,
  WebAppIcon,
  WebsiteIcon,
} from "./sidebar-icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
  end?: boolean;
}

const PROJECT_TYPE_ITEMS: NavItem[] = [
  { to: "", label: "Website", icon: WebsiteIcon, end: true },
  { to: "apps", label: "Web App", icon: WebAppIcon },
  { to: "mobile", label: "Mobile", icon: MobileIcon },
  { to: "image-pdf", label: "Image & PDF", icon: ImagePdfIcon },
];

const AI_ITEMS: NavItem[] = [
  { to: "usage", label: "Usage", icon: UsageIcon },
  { to: "mcp", label: "MCP Server", icon: McpIcon },
];

const WORKSPACE_ITEMS: NavItem[] = [
  { to: "members", label: "Members", icon: MembersIcon },
  { to: "billing", label: "Billing", icon: BillingIcon },
  { to: "settings", label: "Settings", icon: SettingsIcon },
  { to: "integrations", label: "Integrations", icon: IntegrationsIcon },
];

interface WorkspaceSidebarProps {
  workspace: WorkspaceOut;
  onSignOut: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function WorkspaceSidebar({ workspace, onSignOut, isOpen, onClose }: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const base = `/w/${workspace.slug}`;

  function itemClass(isActive: boolean): string {
    return `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium ${
      isActive
        ? "bg-accent-primary/10 text-accent-primary"
        : "text-text-muted hover:bg-bg-canvas hover:text-text-primary"
    }`;
  }

  function renderItems(items: NavItem[]) {
    return items.map(({ to, label, icon: ItemIcon, end }) => (
      <NavLink key={label} to={to ? `${base}/${to}` : base} end={end} onClick={onClose} className={({ isActive }) => itemClass(isActive)}>
        <ItemIcon width={16} height={16} />
        {label}
      </NavLink>
    ));
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`bg-bg-surface h-screen w-64 shrink-0 flex-col border-r border-black/10 dark:border-white/10 dark:bg-[#0F0F14] md:flex md:static ${
          isOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          <button
            onClick={() => {
              navigate("/");
              onClose?.();
            }}
          aria-label="Switch workspace"
          className="hover:bg-bg-canvas flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1"
        >
          <Avatar name={workspace.name} size={26} />
          <span className="truncate text-sm font-semibold">{workspace.name}</span>
          <ChevronDownIcon width={14} height={14} className="text-text-muted shrink-0" />
        </button>
        <NotificationBell />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {renderItems([{ to: "", label: "Recent Projects", icon: RecentIcon, end: true }])}

        <p className="text-text-muted mt-5 mb-1 px-2.5 text-[11px] font-semibold tracking-wide uppercase">
          Project Types
        </p>
        {renderItems(PROJECT_TYPE_ITEMS)}

        <p className="text-text-muted mt-5 mb-1 flex items-center gap-1.5 px-2.5 text-[11px] font-semibold tracking-wide uppercase">
          Backline AI
          <span className="bg-accent-primary/10 text-accent-primary rounded-full px-1.5 py-0.5 text-[9px] font-semibold normal-case">
            New
          </span>
        </p>
        {renderItems(AI_ITEMS)}

        <p className="text-text-muted mt-5 mb-1 px-2.5 text-[11px] font-semibold tracking-wide uppercase">
          Workspace
        </p>
        {renderItems(WORKSPACE_ITEMS)}
      </nav>

      <div className="flex items-center justify-between border-t border-black/10 px-4 py-3 text-xs dark:border-white/10">
        <span className="text-text-muted font-semibold">Backline</span>
        <button onClick={onSignOut} className="text-text-muted underline">
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
