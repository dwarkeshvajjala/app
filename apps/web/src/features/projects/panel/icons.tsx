// Small hand-drawn stroke icons for the side panel's tab rail - the app has no icon
// library dependency yet, and five glyphs doesn't justify adding one.
import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function DetailsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function CommentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
    </Icon>
  );
}

export function McpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="9" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M10 12.5h4M17.5 11v3" />
    </Icon>
  );
}

export function IntegrationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13 2 4 13h7l-1 9 9-11h-7l1-9z" strokeLinejoin="round" />
    </Icon>
  );
}

export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5c.5 3 2.2 4.7 5.2 5.2-3 .5-4.7 2.2-5.2 5.2-.5-3-2.2-4.7-5.2-5.2 3-.5 4.7-2.2 5.2-5.2Z" />
      <path d="M18.5 15.5c.25 1.5 1.1 2.35 2.6 2.6-1.5.25-2.35 1.1-2.6 2.6-.25-1.5-1.1-2.35-2.6-2.6 1.5-.25 2.35-1.1 2.6-2.6Z" />
    </Icon>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.3 10.7 15.7 7.3M8.3 13.3l7.4 3.4" />
    </Icon>
  );
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.5L16 9.5" />
    </Icon>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </Icon>
  );
}

export function CrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 17h16l-1.3-7-4 3-2.7-5-2.7 5-4-3L4 17Z" strokeLinejoin="round" />
    </Icon>
  );
}

export function SortIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3" />
    </Icon>
  );
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" strokeLinejoin="round" />
    </Icon>
  );
}

export function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M14.5 9.5c2-2 4.5-2.5 6-2 .5 1.5 0 4-2 6l-2.5 2.5-3.5-3.5 2-2.5Z" strokeLinejoin="round" />
      <path d="M12 16.5 7.5 12c-1.5 1.5-2 5-1.5 6 1 .5 4.5 0 6-1.5Z" strokeLinejoin="round" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <path d="M9 15 6.5 17.5M6 13c-1.3 0-2.5.7-3 2 1.3.5 2.5.3 3-.5M11 18c0-1.3-.7-2.5-2-3-.5 1.3-.3 2.5.5 3" />
    </Icon>
  );
}

export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}
