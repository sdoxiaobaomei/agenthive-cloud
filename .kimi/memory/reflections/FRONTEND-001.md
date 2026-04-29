# FRONTEND-001 — Chat-Project Integration Fix

## Problem
Chat sessions were created with stale `projectId` from `localStorage`-persisted `projectStore.currentProject`, causing API errors when the project had been deleted.

## Root Cause
1. `currentProject` was in Pinia persist `pick` array → rehydrated from localStorage before any API validation
2. Navigation flows went to `/chat` (no URL param) instead of `/workspace/:projectId`
3. `/chat` page relied on store state rather than URL-bound project context

## Changes Made
1. **ChatPanel.vue**: Added `projectId?: string` prop with fallback to `currentProject?.id` for backward compatibility. `createNewSession` now uses the resolved projectId.
2. **workspace/[projectId].vue**: Embedded `<ChatPanel :project-id="projectId" embedded />` as a right sidebar panel (320px width, hidden on mobile ≤1024px).
3. **Navigation updates**: All project selection/creation flows now navigate to `/workspace/:projectId` instead of `/chat`:
   - `projects/[id]/index.vue` — "Open Chat" button
   - `layouts/app.vue` — sidebar project select + new project create
   - `layouts/chat.vue` — sidebar project select + new project create
   - `pages/index.vue` — dashboard project select + create flows
4. **chat.vue**: Added redirect on mount to `/workspace/:projectId` if `currentProject` exists; otherwise falls back to existing chat UI.
5. **stores/project.ts**: Removed `currentProject` from `persist.pick`, keeping only `viewMode`. URL now drives project selection.

## Verification
- `npm run build` (landing) passed successfully
- Pre-existing `typecheck` errors are unrelated (missing `@vueuse/core` types, plugin types, etc.)
- No new SSR-unsafe code introduced
- WebSocket logic in ChatPanel preserved unchanged

## Lessons
- **URL-first state**: For resources that can be deleted server-side, never rely solely on client-side persistence. The URL is the source of truth.
- **Prop over store**: When embedding a component in a page with URL params, pass the param directly as a prop rather than having the component read from a global store. This makes the component reusable and testable.
- **Backward compatibility**: Adding a new `projectId` prop while keeping `currentProject` prop allows gradual migration without breaking existing consumers (e.g., the standalone `/chat` page).
