# Reflection: FRONTEND-002 — Chat UI Polish (Post-Integration)

## What Changed

### Task 1: Merge duplicate buttons on project detail page
- File: `apps/landing/pages/projects/[id]/index.vue`
- Removed the second "Open Chat" button that duplicated the navigation of "Open Workspace"
- Removed unused `openChat()` function and `ChatDotRound` icon import

### Task 2: Chat session title shows project name
- File: `apps/landing/components/ChatPanel.vue`
- Added `resolvedProjectName` ref to store fetched project name
- Added `fetchProjectName()` that calls `GET /api/projects/${projectId}` via `useApi().get`
- Priority: `currentProject?.name` → fetched name → "New Chat"
- Triggered on `onMounted` and via `watch(() => props.projectId, ...)`

## Decisions Made

- Chose **Option A** (fetch locally) over Option B (add prop) because it keeps the workspace page simpler and avoids prop drilling. The workspace page already loads the project in its own store; duplicating that data through props is unnecessary coupling.

## Verification

- `nuxt build` for `apps/landing` passed with no errors
- No new `window`/`document`/`localStorage` access introduced
- `watch` is used without `immediate: true`, so it won't trigger during SSR
- `fetchProjectName` is also called in `onMounted` which is client-only

## Patterns to Remember

1. **ID-only props → local fetch**: When a child component needs metadata beyond an ID, local fetching is often cleaner than prop drilling.
2. **SSR-safe reactive loading**: `onMounted` + `watch` (without `immediate`) is a safe pattern for client-side data fetching that reacts to prop changes.
3. **Clean removal**: When removing UI elements, also remove their event handlers and unused imports to keep the codebase tidy.
