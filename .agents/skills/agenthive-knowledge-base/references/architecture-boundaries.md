# Reference: Architecture Boundaries

> Quick reference for "where does this belong?" decisions.

---

## Node.js ↔ Java Boundary (Immutable Rule)

| Concern | Node.js (apps/api) | Java (apps/java/) |
|---------|-------------------|-------------------|
| **Primary role** | AI control plane + BFF | Enterprise core domain |
| **Business logic** | Orchestration, routing | Transactional, complex domain |
| **Auth** | Gateway validates JWT, passes `X-User-Id` | Receives `X-User-Id`, trusts it |
| **Database** | Chat, sessions, projects (metadata) | Orders, payments, users, carts, logistics |
| **LLM integration** | ✅ Direct calls to LLM APIs | ❌ Never |
| **WebSocket** | ✅ Real-time chat, Agent events | ❌ Never |
| **Redis** | Session state, pub/sub, streams | Cache, distributed locks |

### Decision Tree

```
Is this AI/LLM related?
  → Yes → Node.js
  → No → Is it transactional / high-concurrency?
      → Yes → Java
      → No → Is it frontend-facing orchestration?
          → Yes → Node.js (BFF)
          → No → Reconsider scope
```

---

## Auth Flow

```
User → Nginx → Spring Cloud Gateway (JWT validation)
                      ↓
              X-User-Id: <uuid>  header
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    Node API     Java Services   Landing (BFF)
    (trusts)     (trusts)        (own JWT for SSR)
```

**Rule**: Downstream services NEVER parse JWT. Only `X-User-Id`.

---

## Data Ownership

| Entity | Owner | Storage |
|--------|-------|---------|
| `users` | Java | PostgreSQL (Java DB) |
| `projects` | Node | PostgreSQL (Node DB) |
| `chat_sessions` | Node | PostgreSQL (Node DB) |
| `chat_messages` | Node | PostgreSQL (Node DB) |
| `orders` | Java | PostgreSQL (Java DB) |
| `payments` | Java | PostgreSQL (Java DB) |
| `carts` | Java | PostgreSQL (Java DB) |
| `deployments` | Node | PostgreSQL (Node DB) |

---

## Communication Patterns

| Pattern | Use Case | Technology |
|---------|----------|------------|
| Sync REST | CRUD, queries | HTTP/REST (Gateway → Service) |
| Async events | Agent tasks, state changes | Redis Streams |
| Real-time | Chat, progress updates | WebSocket (Socket.IO) |
| Internal | Service-to-service in same runtime | Direct function calls |

---

## Anti-Patterns

- ❌ Node.js doing complex transactions (use Java)
- ❌ Java calling LLM directly (use Node Agent Runtime)
- ❌ Downstream service parsing JWT (use `X-User-Id`)
- ❌ Direct DB access across service boundaries (use API)
- ❌ Synchronous blocking in Agent task handlers (use Redis Streams)
