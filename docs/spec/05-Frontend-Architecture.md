# 05 - Frontend Architecture (Agency Dashboard)

Applies to `apps/web`. The Review SDK (`apps/widget`) has its own, much smaller architecture - see `07-Review-SDK.md`; it is not a React app, it's a small vanilla-JS/Preact bundle optimized for injection size.

## 5.1 Folder Structure

```
apps/web/src/
  app/                     # App shell: providers, router, layout
    providers.tsx          # QueryClientProvider, AuthProvider, WSProvider
    router.tsx             # Route tree (React Router v6 data routers)
    layout/                # AppShell, Sidebar, TopBar
  features/
    auth/                  # Login, OTP entry, OAuth callback
    workspaces/            # Workspace switcher, settings
    projects/              # Project list/detail
    share-links/           # Create/manage share links
    comments/              # Comment thread, composer, layer toggle
    board/                 # Kanban + list views
    members/               # Team member management
    integrations/          # Slack/ClickUp/Trello connect flows
    notifications/         # In-app notification center
  hooks/                   # Cross-feature hooks (useWorkspace, usePermission)
  stores/                  # Zustand stores (14-State-Management.md)
  lib/
    api-client.ts          # Typed fetch wrapper using packages/types
    query-keys.ts          # Central React Query key factory
    ws-client.ts            # WebSocket connection manager
  styles/                  # Tailwind config, global.css
```

Each `features/*` folder is a vertical slice: its own `components/`, `hooks/`, `api.ts` (React Query hooks for that feature's endpoints), and `types.ts` (re-exports from `packages/types` plus feature-local UI types). Nothing in `features/*` imports from another feature's internals - only from `hooks/`, `stores/`, `lib/`, or `packages/ui`.

## 5.2 Route Architecture

```
/login
/auth/callback
/w/:workspaceSlug                             -> workspace home (project list)
/w/:workspaceSlug/settings
/w/:workspaceSlug/members
/w/:workspaceSlug/integrations
/w/:workspaceSlug/p/:projectId                 -> project overview
/w/:workspaceSlug/p/:projectId/board           -> kanban/list
/w/:workspaceSlug/p/:projectId/share-links
/w/:workspaceSlug/p/:projectId/pages/:pageId   -> page + comment thread detail
/review/:shareToken                            -> guest reviewer entry (outside the dashboard shell entirely)
```

`/review/:shareToken` is a separate route tree with no dashboard chrome - it renders the reviewed site through the Review SDK's dashboard-side companion (comment list/composer overlay), not the agency layout.

## 5.3 Component Architecture

Three tiers, enforced by where a component lives:
1. **`packages/ui`** - pure presentational, design-token-driven, zero data-fetching, zero business logic (buttons, inputs, modal shell, kanban card shell).
2. **`features/*/components`** - feature-aware, composed from `packages/ui`, may call feature hooks (e.g., `CommentThread` calls `useComments(pageId)`).
3. **`app/layout`** - app-wide chrome (sidebar, top bar, workspace switcher).

Rule of thumb: if a component would make sense in Storybook with mock props and no providers, it belongs in tier 1.

## 5.4 Providers (mounted once, in `app/providers.tsx`)

- `QueryClientProvider` - one `QueryClient` for the whole app; see `14-State-Management.md` for cache config.
- `AuthProvider` - holds the current session (member JWT), exposes `useAuth()`.
- `WorkspaceProvider` - resolves `:workspaceSlug` from the route into the active workspace context, exposes `useWorkspace()`.
- `WSProvider` - owns the single WebSocket connection for the active workspace, exposes `useWSEvent(type, handler)`.
- `PermissionProvider` - wraps `useWorkspace()` + `useAuth()` into `usePermission(action, resource)` (`13-Authentication.md` §13.5 permission matrix).

## 5.5 Permissions in the UI

The frontend **never** makes an authorization decision that the backend doesn't also enforce - UI-level permission checks are purely for not showing controls the user can't use, never a security boundary (Rule 6, Security Is a Feature). Pattern:

```tsx
const canChangeVisibility = usePermission('comment:toggle-layer', comment);
{canChangeVisibility && <LayerToggle comment={comment} />}
```
`usePermission` reads the workspace membership role (Owner/Admin/Member) client-side for UI purposes only; every mutating API call is re-checked server-side against the same matrix (`13-Authentication.md`).

## 5.6 Responsive Behavior

- Dashboard: desktop-first, functional down to tablet (768px); not optimized for phone - agency staff use it at a desk.
- Reviewer widget (`/review/:shareToken` and the injected SDK overlay): mobile-first, must be fully functional at 375px width - this is where the 30-second acceptance criterion (`01-Product-Vision.md`) lives or dies.
- Breakpoints and spacing scale: `15-Design-System.md`.
