# 15 - Design System

This defines the tokens `packages/ui` is built from (`05-Frontend-Architecture.md` §5.3, tier 1 components). If a specific brand design system is provided later, these values are what gets swapped in the Tailwind theme config - the component API contracts below should not need to change.

## 15.1 Spacing Scale

4px base unit: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` (Tailwind default scale, used as-is - no custom spacing scale invented without a reason).

## 15.2 Typography Scale

| Token | Size | Use |
|---|---|---|
| `text-xs` | 12px | Metadata (timestamps, device labels) |
| `text-sm` | 14px | Body copy, comment text |
| `text-base` | 16px | Default UI text |
| `text-lg` | 18px | Section headers |
| `text-xl`/`2xl` | 20/24px | Page titles |
| `text-3xl` | 30px | Empty-state headlines |

Font: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`) for MVP - no custom webfont load, since the reviewer widget's performance budget (`07-Review-SDK.md` §7.7) can't absorb a font download.

## 15.3 Color Tokens

Values below are what's actually shipped (`apps/web/tailwind.config.js` and the canonical
palette in `apps/web/src/styles/backline.css`'s `:root`/`.dark` blocks, kept in sync with
each other) - a mint/green accent rather than the indigo originally sketched here, discovered
and reconciled during the `docs/implementation/audit-current-state-2026-09-09.md` theming pass.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-surface` | `#FFFFFF` | `#151515` | Cards, panels |
| `bg-canvas` | `#F1F2F0` | `#0B0B0B` | Page background |
| `text-primary` | `#0B0B0B` | `#F1F2F0` | Body text |
| `text-muted` | `#62665F` | `#9A9D99` | Metadata |
| `accent-primary` | `#0A6B4B` | `#69DEB2` | Primary actions |
| `layer-client` | `#0EA5E9` (blue) | same, adjusted contrast | Client-visible comment badge |
| `layer-team` | `#7C3AED` (purple) + lock icon | same | Team-only comment badge |
| `status-todo` | `#94A3B8` | - | Kanban column |
| `status-in-progress` | `#F59E0B` | - | Kanban column |
| `status-resolved` | `#22C55E` | - | Kanban column |
| `status-wont-fix` | `#64748B` (muted, struck-through) | - | Kanban column |
| `recovery-ok` | (no badge shown) | - | Anchor healthy |
| `recovery-low-confidence` | `#F59E0B` outline | - | Anchor uncertain |
| `recovery-orphaned` | `#EF4444` outline + icon | - | Anchor lost |

**Layer visual distinction is a hard requirement**, not a style preference: F3's acceptance criterion requires the layer to be "visually unambiguous (colour, label, lock icon)" in both the widget and dashboard - color alone is insufficient (fails colorblind users), so the lock icon + text label are mandatory alongside color, everywhere a layer badge renders.

## 15.4 Core Components (packages/ui)

`Button`, `Input`, `Textarea`, `Avatar`, `Badge` (used for layer/status), `Modal`, `Drawer`, `Tooltip`, `KanbanColumn`/`KanbanCard`, `Table`, `Tabs`, `Toast`, `EmptyState`, `PinMarker` (the widget's on-page pin, also reused in dashboard page-preview thumbnails).

Each ships with: default + hover + focus-visible + disabled states, and a Storybook entry with accessibility annotations (used for the WCAG AA audit in `19-Testing-CI.md`).

## 15.5 Dark Mode

Dashboard: a `.dark` class on `<html>` (Tailwind's `darkMode:"class"` strategy) is the single
trigger for both token systems - Tailwind's `dark:` variant *and* `backline.css`'s own
`:root.dark{...}` override, which previously drove itself independently off
`prefers-color-scheme` with no relation to Tailwind's mechanism (the bug fixed in
`docs/implementation/audit-current-state-2026-09-09.md`). User-toggleable via `useTheme()`
(`apps/web/src/lib/use-theme.ts`), surfaced as light/dark/match-system in Account settings.

Persistence is currently **`localStorage`, per browser - not yet a member preference** as
originally planned here; that's a deliberate, scoped-down decision (no backend field exists
for it yet, unlike notification preferences), not silent drift. Promoting it to a real
member-preference column, synced across devices, is open follow-up work.

Reviewer widget: **no dark mode in MVP** - it renders inside an arbitrary third-party page via Shadow DOM, and forcing a dark UI onto an unpredictable host page's context adds visual-consistency risk for a client-facing surface where trust matters more than polish; revisit post-MVP if requested.

## 15.6 Responsive Breakpoints

```
sm: 640px   md: 768px   lg: 1024px   xl: 1280px   2xl: 1536px
```
Dashboard primary breakpoint: `lg` (desktop-first, per `05-Frontend-Architecture.md` §5.6). Reviewer widget primary breakpoint: below `sm` (mobile-first).

## 15.7 Accessibility Checklist (per component, enforced in Storybook + axe-core CI check)

- Focus-visible ring on every interactive element.
- Color contrast >= 4.5:1 for body text, >= 3:1 for large text/icons.
- All icon-only buttons (layer toggle, status icons) carry an `aria-label`.
- Modal/Drawer trap focus and restore it to the trigger on close.
- Kanban drag-and-drop has a keyboard-operable equivalent (status change via a select/menu), not drag-only.
