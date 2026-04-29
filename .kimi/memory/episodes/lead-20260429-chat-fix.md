# Episode: Chat Session Creation 500 Fix

## Date: 2026-04-29
## Role: Lead
## Ticket: CHAT-FIX-001

---

## Problem Statement

User reported chat message send failure. Browser console showed 500 error on `POST /api/chat/sessions`.

## Root Cause Analysis

### Step 1: Read Error Log
```
insert or update on table "chat_sessions" violates foreign key constraint "chat_sessions_project_id_fkey"
```

Initial assumption: `project_id` is NULL but FK is somehow enforced. **WRONG** — PostgreSQL NULL values do not trigger FK checks.

### Step 2: Verify Schema
```sql
\d chat_sessions
-- project_id | uuid | nullable
-- FK: REFERENCES projects(id) ON DELETE SET NULL
```

Confirmed `project_id` is nullable. NULL should work.

### Step 3: Direct API Test
```bash
curl -X POST localhost:3001/api/chat/sessions -d '{"title":"Test"}'
# → 201, projectId=null ✅
```

Direct API call works. Problem must be in the frontend→nginx→API path.

### Step 4: Trace Frontend Code
- `ChatPanel.vue:289`: `projectId: props.currentProject?.id`
- `projectStore` uses Pinia `persist` → `localStorage`
- `projects` table: `COUNT(*)` = 0 (empty after DB reset)

**Aha moment**: `localStorage` held stale project data from before DB reset. `props.currentProject?.id` returned a non-existent UUID. API INSERT → FK violation.

## Fix Applied

### API Layer (apps/api/src/chat-controller/service.ts)
```typescript
async createSession(input: CreateSessionInput): Promise<ChatSession> {
  let projectId: string | null = input.projectId || null
  if (projectId) {
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId])
    if ((projectCheck.rowCount ?? 0) === 0) {
      logger.warn('Project not found for chat session, falling back to null', { projectId, userId: input.userId })
      projectId = null
    }
  }
  // ... INSERT with validated/null projectId
}
```

### Build Fix
API Dockerfile copies pre-built `dist/` from host. Forgot to run `pnpm build` after `.ts` modification → stale dist in Docker image.

## Verification

| Test | Input | Expected | Result |
|------|-------|----------|--------|
| No projectId | `{}` | 201, projectId=null | ✅ |
| Invalid projectId | `{"projectId":"0000..."}` | 201, projectId=null | ✅ |

## Learnings

1. **NULL FK behavior**: PostgreSQL NULL does not trigger FK checks. If you see FK error, the value is NOT NULL.
2. **localStorage desync**: Pinia persist + DB reset = stale state. Always consider frontend persistence when debugging "impossible" FK errors.
3. **Docker build artifacts**: `Dockerfile COPY dist/` requires host-side `pnpm build` first. Debug "changes not working" by checking artifact freshness.

## Files Modified
- `apps/api/src/chat-controller/service.ts` — added projectId validation

## Confidence: 0.95
- Fix validated with direct API tests
- Root cause clearly identified (localStorage stale state)
- Defense-in-depth approach (API validates + frontend naturally recovers)
