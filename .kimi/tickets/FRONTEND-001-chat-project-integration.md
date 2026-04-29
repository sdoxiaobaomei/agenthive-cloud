# Ticket: FRONTEND-001 — Chat-Project Integration Fix

## Type: bugfix + refactor
## Priority: P1
## Risk: medium

---

## Problem

Chat session creation fails because `/chat` page relies on `projectStore.currentProject` (restored from localStorage via Pinia persist), which may reference a deleted/non-existent project. Additionally, the user experience is broken:

- `/workspace/:projectId` has file editor but NO chat
- `/chat` has chat but NO file editor and NO URL-based project binding
- User must navigate through disconnected pages

## Root Cause

1. `pages/chat.vue` binds to `projectStore.currentProject` (computed from store), not a URL parameter
2. `stores/project.ts` uses `persist: { pick: ['currentProject', 'viewMode'] }` → rehydrates stale data from localStorage before any API validation
3. `pages/workspace/[projectId].vue` does not embed `<ChatPanel>`

## Expected Behavior

User path: `/projects` → click project → `/workspace/:projectId` (integrated workspace with file tree + editor + chat)

Chat in workspace:
- Uses `projectId` from URL parameter (`useRoute().params.projectId`)
- Calls API to fetch project info (or receives validated prop)
- Creates chat sessions with validated `projectId`
- Shows project name in header

## Acceptance Criteria

- [ ] `pages/workspace/[projectId].vue` embeds `<ChatPanel>` with `:project-id="route.params.projectId"`
- [ ] `ChatPanel.vue` accepts `projectId` as a primary prop (string from URL), validates it via API or parent
- [ ] If `projectId` is invalid/missing, show clear UI state ("Select a project" or redirect)
- [ ] `projectStore` persist configuration reviewed: `currentProject` should NOT be blindly persisted without API validation, OR persist should be removed for `currentProject`
- [ ] Navigation from `/projects/:id` "Open Chat" button redirects to `/workspace/:projectId` instead of `/chat`
- [ ] Navigation from `layouts/app.vue` sidebar "select project" redirects to `/workspace/:projectId` instead of `/chat`
- [ ] `/chat` standalone page: either (a) redirects to `/workspace/:projectId` if currentProject exists, or (b) shows "Select a project" prompt
- [ ] Test: create project → open workspace → send chat message → session created with correct projectId

## Relevant Files

- `apps/landing/pages/workspace/[projectId].vue`
- `apps/landing/pages/chat.vue`
- `apps/landing/pages/projects/[id]/index.vue`
- `apps/landing/layouts/app.vue`
- `apps/landing/layouts/chat.vue`
- `apps/landing/components/ChatPanel.vue`
- `apps/landing/stores/project.ts`
- `apps/landing/stores/chat.ts`

## Constraints

- Do NOT break existing chat functionality for users without a project (if applicable)
- Preserve WebSocket connection logic in ChatPanel
- `projectStore.fetchProjects()` must still work for the project list page

## Depends On

- None (API defensive fix already deployed: `service.ts` falls back to null for invalid projectId)

## Security Implications

- None
