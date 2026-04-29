# Episode: Chat-Project Integration Refactor

**Date:** 2026-04-29  
**Ticket:** FRONTEND-001  
**Agent:** frontend-agent  
**Lead Review:** APPROVED (confidence 0.94)

---

## Problem

Chat session creation failed because `/chat` page relied on `projectStore.currentProject` restored from localStorage (Pinia persist). After DB reset, localStorage held stale project data. User sent message → `projectId` didn't exist in DB → FK error.

## Root Cause

Three architectural disconnects:
1. `/chat` is a standalone page with NO URL project parameter
2. `projectStore` persists `currentProject` to localStorage before any API validation
3. `/workspace/:projectId` has file editor but NO chat integration

## Solution (Dispatched to frontend-agent)

URL-first architecture:
- Workspace page (`/workspace/:projectId`) now embeds `ChatPanel` as right sidebar
- `ChatPanel` accepts `projectId` prop from URL, falls back to `currentProject`
- All navigation routes to `/workspace/:projectId` instead of `/chat`
- Removed `currentProject` from Pinia persist to eliminate stale data
- `/chat` redirects to `/workspace/:projectId` if project exists

## Files Modified

- `apps/landing/pages/workspace/[projectId].vue` — embed ChatPanel
- `apps/landing/components/ChatPanel.vue` — add projectId prop
- `apps/landing/stores/project.ts` — remove currentProject from persist
- `apps/landing/pages/projects/[id]/index.vue` — navigate to workspace
- `apps/landing/layouts/app.vue` — navigate to workspace
- `apps/landing/layouts/chat.vue` — navigate to workspace
- `apps/landing/pages/chat.vue` — redirect to workspace
- `apps/landing/pages/index.vue` — navigate to workspace

## Verification

- [x] Code review passed (Lead)
- [x] Architecture alignment confirmed
- [ ] Manual browser test pending (requires landing rebuild)

## Learnings

- **URL-first state > store-first state** for server-managed resources
- Pinia persist on deletable entities (projects, sessions) is an anti-pattern
- When refactoring navigation, grep ALL `router.push('/target')` occurrences — they hide in layouts, pages, and components

## Process Notes

This task was correctly handled via Maestro Loop:
1. Lead analyzed root cause (explore agent for code investigation)
2. Lead created Ticket FRONTEND-001 with acceptance criteria
3. Lead dispatched to frontend-agent
4. Lead reviewed output (confidence 0.94, auto-approved)
5. Lead committed and broadcasted

No Lead overreach on implementation.
