# Reference: API Contracts

> Quick reference for common API shapes and conventions.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local dev | `http://localhost:3001` (API), `http://localhost:3000` (Landing BFF) |
| K3d | `http://api.agenthive.local` (via Ingress) |
| Prod | `https://api.agenthive.cloud` |

---

## Auth Header

All API requests (except public endpoints):
```
Authorization: Bearer <jwt_token>
```

Downstream services receive:
```
X-User-Id: <uuid>
```

---

## Common Response Shape

```typescript
// Success
{
  "code": 200,
  "message": "ok",
  "data": { ... }
}

// Error
{
  "code": 400,
  "message": "Validation failed: name is required",
  "data": null
}
```

---

## Key Endpoints

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project detail |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

**Project JSON shape**:
```typescript
{
  id: string,           // UUID
  name: string,
  description: string,
  repo_url: string,     // Git repository URL
  tech_stack: string[], // JSONB array in DB
  status: string,       // 'active' | 'archived' | 'draft'
  created_at: string,   // ISO 8601
  updated_at: string
}
```

### Chat Sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/sessions` | Create session (returns existing if active for project) |
| GET | `/api/chat/sessions` | List sessions |
| GET | `/api/chat/sessions/:id` | Get session with messages |
| PUT | `/api/chat/sessions/:id/archive` | Archive session |

**Session JSON shape**:
```typescript
{
  id: string,           // UUID
  project_id: string | null,  // UUID or null
  title: string,
  status: 'active' | 'archived',
  created_at: string,
  updated_at: string
}
```

**Duplicate protection**: `POST /api/chat/sessions` returns existing active session if one already exists for the given `project_id`.

### Chat Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/sessions/:id/messages` | Send message (triggers Agent) |
| GET | `/api/chat/sessions/:id/messages` | Get messages |

**Message JSON shape**:
```typescript
{
  id: string,           // UUID
  session_id: string,   // UUID
  role: 'user' | 'assistant' | 'system',
  content: string,
  created_at: string
}
```

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (returns `{ ok: true }`) |

---

## UUID Validation

All `:id` path parameters must be valid UUID v4 format.
Invalid UUID → `400 Bad Request` with message `"Invalid ID format"`.

See: `apps/api/src/utils/validators.ts`

---

## JSONB Conventions

- Arrays stored as JSONB (e.g., `tech_stack`)
- Objects stored as JSONB (e.g., `config_json`)
- Always normalize before insert:
  ```typescript
  function normalizeTechStack(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null
    if (Array.isArray(value)) return JSON.stringify(value)
    if (typeof value === 'string') {
      try { JSON.parse(value); return value }
      catch { return JSON.stringify([value]) }
    }
    return null
  }
  ```

---

## WebSocket Events

Connection: `ws://<host>/ws` (Socket.IO)

| Event | Direction | Payload |
|-------|-----------|---------|
| `chat:message` | C→S | `{ sessionId, content }` |
| `chat:response` | S→C | `{ sessionId, message }` |
| `agent:status` | S→C | `{ taskId, status, progress }` |
| `agent:complete` | S→C | `{ taskId, result }` |
