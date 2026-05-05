# agenthive-knowledge-base

description: >
  Searchable structured knowledge base for AgentHive Cloud.
  Use this skill when an agent needs domain-specific context before coding,
  debugging, or making architectural decisions. Provides document lookup by
  topic, role, or keyword, and fast-reference cards for the most common queries.

## Trigger

Use this skill when:
- You need to understand how a subsystem works before modifying it
- You're debugging an error and need to know the correct schema / API contract
- You're unsure about a design decision ("should this go in Java or Node?")
- You need environment-specific configuration details (dev vs prod secrets, DB URLs, K8s contexts)
- You're writing a new feature and need to know existing patterns or conventions
- You see an unfamiliar error message and want to check known issues

## NOT for

- Generic programming questions (use context7-auto-research or web search)
- How to use a third-party library (read the library's own docs)
- Tasks that don't require project-specific context

---

## Query Protocol

### Step 1: Identify the domain

Map your question to one of these domains:

| Domain | Example questions |
|--------|-----------------|
| `architecture` | "What's the service boundary between Node and Java?" |
| `api` | "What's the chat session API contract?" "How do I add a new route?" |
| `database` | "What's the projects table schema?" "How to write a migration?" |
| `frontend` | "What's the SSR safety pattern?" "How are stores structured?" |
| `deployment` | "How do I deploy to k3d?" "What's the Helm secret mode?" |
| `operations` | "How do I check pod logs?" "How to rotate secrets?" |
| `security` | "Where does JWT validation happen?" "How are secrets managed?" |
| `agent-system` | "How does the orchestrator dispatch tasks?" "What's a ticket YAML?" |
| `devops` | "How does the CI pipeline work?" "What's the build optimization?" |
| `quick-ref` | "What's the command to start API dev server?" |

### Step 2: Consult the Index

Open `INDEX.md` in this skill directory. Find the section matching your domain.
Each entry has:
- **Path**: relative to project root
- **Priority**: P0 (must-read) / P1 (important) / P2 (reference)
- **One-line summary**: what this doc covers
- **Tags**: searchable keywords

### Step 3: Read the document(s)

For P0 docs: read fully before writing code.  
For P1 docs: read the relevant sections.  
For P2 docs: skim or use as reference.

### Step 4: Check reference cards

For common topics, a pre-digested reference card may exist in `references/`.
These are faster than reading the full document.

| Card | Covers |
|------|--------|
| `architecture-boundaries.md` | Node vs Java boundary, auth flow, data ownership |
| `api-contracts.md` | Key API endpoints, request/response shapes, error codes |
| `database-schema.md` | Core tables, column types, JSONB conventions, migration rules |
| `deployment-checklist.md` | K3d deploy steps, Helm values, secret modes |
| `frontend-patterns.md` | Pinia stores, SSR safety, mock data policy |
| `known-issues.md` | Active bugs, workarounds, tech debt |

---

## Fast Search Index

If you already know what you're looking for, jump directly:

**Architecture**
- System overview → `docs/architecture/01-system-overview.md`
- Node.js backend → `docs/architecture/05-backend-nodejs.md`
- Java microservices → `docs/architecture/02-java-microservices.md`
- AI Agent platform → `docs/architecture/03-ai-agent-platform.md`
- Current issues list → `docs/architecture/00-architecture-review.md`
- Architecture decisions → `docs/adr/`

**API / Backend**
- API reference → `apps/api/docs/API_REFERENCE.md`
- Database setup → `apps/api/docs/database/`
- Unit testing → `apps/api/docs/guides/UNIT_TESTING.md`
- Startup guide → `apps/api/docs/guides/STARTUP_GUIDE.md`
- Code patterns (Node) → `.kimi/memory/skills/node/official/patterns/`

**Frontend**
- Landing app → `apps/landing/README.md`
- SSR safety → `apps/landing/docs/SSR-SAFETY-GUIDE.md`
- API integration → `apps/landing/docs/API_INTEGRATION.md`
- Code patterns (Frontend) → `.kimi/memory/skills/frontend/official/patterns/`

**Database**
- Migration guide → `apps/api/docs/database/`
- Schema audit → `docs/database-architecture-audit.md`
- Maintenance architecture → `docs/DATABASE-MAINTENANCE-ARCHITECTURE.md`
- PG backup/restore → `docs/operation/postgres-backup-restore.md`

**Deployment**
- DevOps architecture → `docs/deployment/DEVOPS-ARCHITECTURE.md`
- K3s deployment → `docs/deployment/k3s-deployment.md`
- Helm chart → `chart/agenthive/README.md`
- CI/CD usage → `docs/deployment/ci-cd/CI-CD-USAGE.md`
- Secret management → `docs/deployment/external-secrets-operator.md`

**Operations**
- Quick reference → `docs/reference/quick-reference.md`
- K3s runbook → `docs/operation/runbook-k3s-ops.md`
- Secret rotation → `docs/operation/security-secret-rotation.md`
- Dev operations skill → `.agents/skills/agenthive-dev-operations/SKILL.md`

**Agent Collaboration**
- Collaboration spec → `AGENT_COLLABORATION_SPEC.md`
- Agent prompts → `AGENTS/shared/prompts/`
- Ticket system → `docs/development/workspace-management.md`

**Java**
- Java services → `apps/java/README.md`
- Code patterns (Java) → `.kimi/memory/skills/java/official/patterns/`

---

## Query Examples

### Example 1: "I'm adding a new chat message type"

1. Domain: `api` + `database`
2. Read: `apps/api/docs/API_REFERENCE.md` (chat endpoints)
3. Read: `references/api-contracts.md` (WebSocket event shapes)
4. Check: `references/database-schema.md` (chat_sessions, chat_messages tables)
5. Pattern: `.kimi/memory/skills/node/official/patterns/zod-validation.md`

### Example 2: "Should this business logic go in Java or Node?"

1. Domain: `architecture`
2. Read: `references/architecture-boundaries.md`
3. Read: `docs/architecture/01-system-overview.md` § "职责边界"
4. Rule of thumb: **transactional/complex domain = Java; AI control/BFF = Node**

### Example 3: "The deployment failed with ImagePullBackOff"

1. Domain: `deployment` + `operations`
2. Read: `references/deployment-checklist.md` § "Troubleshooting"
3. Read: `.agents/skills/agenthive-dev-operations/SKILL.md`
4. Check: `docs/deployment/k3s-deployment.md` § "镜像拉取问题"

---

## Maintenance

When you create a new document that should be discoverable by agents:
1. Add it to `INDEX.md` with correct domain, priority, and tags
2. If it supersedes an older document, update or archive the old entry
3. If it answers a common query, consider creating a reference card in `references/`

When a document moves or is deleted:
1. Update `INDEX.md`
2. Update any reference cards that link to it
3. Update this SKILL.md Fast Search Index if affected
