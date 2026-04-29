# Ticket: FRONTEND-002 — Chat UI Polish (Post-Integration)

## Type: refactor
## Priority: P2
## Risk: low

---

## Problem

After FRONTEND-001 (chat-project integration), two UI inconsistencies remain:

1. **Duplicate buttons on project detail page**: `pages/projects/[id]/index.vue` has both "Open Workspace" and "Open Chat" buttons, but both now navigate to `/workspace/:projectId`. They should be merged into a single button.

2. **Chat session title shows "New Chat" instead of project name**: In `ChatPanel.vue`, `createNewSession` uses `props.currentProject?.name` for the session title. But when embedded in workspace, only `projectId` prop is passed (not the full `currentProject` object), so title always falls back to "New Chat".

## Acceptance Criteria

- [ ] `pages/projects/[id]/index.vue`: Merge "Open Workspace" and "Open Chat" into a single primary button labeled "Open Workspace" (or equivalent). Remove the redundant second button. Update the mobile/table view variant as well.

- [ ] `ChatPanel.vue`: When `projectId` prop is provided but `currentProject` is not, the session title should use the project name. Options:
  - (A) ChatPanel fetches project info via API (`GET /api/projects/:id`) when only `projectId` is given
  - (B) Workspace page passes project name as an additional prop (e.g., `projectName`)
  - (C) Workspace page passes the full `currentProject` object (but this reintroduces store coupling)
  
  **Recommended: Option A** — ChatPanel is self-contained and doesn't depend on parent to know project details. Fetch once on mount if `projectId` is given without `currentProject`.

- [ ] Verify no console errors after changes

## Relevant Files

- `apps/landing/pages/projects/[id]/index.vue`
- `apps/landing/components/ChatPanel.vue`
- `apps/landing/pages/workspace/[projectId].vue` (if Option B or C)

## Constraints

- Do NOT reintroduce `projectStore.currentProject` dependency in ChatPanel
- Keep ChatPanel reusable (it may be used in other contexts without a project)
- Minimal changes only
