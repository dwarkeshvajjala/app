# TDR-0021: Light default and unified theme contract

Date: 2026-09-10
Status: Accepted

## Context

The authenticated dashboard mixed CSS custom properties with Tailwind colors compiled
to fixed light-mode values. When the operating system selected dark mode, several
navigation labels, muted labels, chips, controls, and project-board elements retained
light-theme colors on dark surfaces. The resulting low contrast was visible in the
provided dashboard and project-review screenshots. The theme also defaulted to the
operating-system preference, so a first visit could enter this inconsistent dark state
without an explicit product choice.

## Decision

Use the custom properties in `backline.css` as the single runtime color contract for
both CSS-authored and Tailwind-authored UI. Tailwind semantic utilities resolve through
those properties rather than fixed hex colors. Separate accent foreground, filled
action, and on-accent roles so a color that works as dark-mode link text is not reused
as a button background with the wrong foreground.

The default is light on every first visit. The supported explicit choices are Light and
Dark, stored per browser under the existing `backline_theme` key. A legacy `system`
value resolves to Light. Theme changes are available from the global product chrome and
the sign-in screen, update the browser color scheme and theme-color metadata, and are
synchronized across mounted controls. The account modal retains the same client-side
persistence boundary; no member preference or business record is invented.

The remaining project board is migrated from one-off Tailwind presentation to the
shared Backline surface, filter, table, segmented-control, typography, and focus-state
patterns. API calls, React Query state, URL-owned filters, routes, authorization, and
backend contracts remain unchanged.

## Consequences

Light mode is predictable and brand-led instead of dependent on device settings. Dark
mode remains a supported user choice with legible semantic text and controls. Shared
tokens reduce future theme drift, while the explicit fill/foreground split prevents
accent contrast regressions. System-following behavior is intentionally removed; it can
only return through a future product decision with complete cross-route verification.
