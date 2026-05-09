# AgentHive Cloud Testing Strategy Specification

**Document ID**: SPEC-007
**Version**: 1.0.0
**Status**: Final
**Last Updated**: 2026-05-09
**Source of Truth**: Code as of commit `2c0de00` on `develop` branch

---

## Table of Contents

1. [Testing Philosophy and Principles](#1-testing-philosophy-and-principles)
2. [Unit Test Catalog -- Node.js (Vitest)](#2-unit-test-catalog--nodejs-vitest)
3. [Unit Test Catalog -- Java (JUnit 5)](#3-unit-test-catalog--java-junit-5)
4. [Integration Tests](#4-integration-tests)
5. [E2E Tests (Playwright)](#5-e2e-tests-playwright)
6. [Test Scenarios Matrix](#6-test-scenarios-matrix)
7. [CI Testing Pipeline](#7-ci-testing-pipeline)
8. [Per-Phase Verification Checklist](#8-per-phase-verification-checklist)
9. [Test Data Management](#9-test-data-management)

---

## 1. Testing Philosophy and Principles

### 1.1 Test Pyramid for AgentHive

```
            /\
           /  \      E2E (Playwright)
          /    \     ~5 scenarios, CI + pre-release
         /------\
        /        \   Integration (Supertest + DB)
       /          \  ~3 suites, full workflow verification
      /------------\
     /              \
    /   UNIT TESTS   \  Vitest (Node.js) + JUnit 5 (Java)
   /   ~70 test files \  Every service, every tool, every store
  /____________________\
```

### 1.2 Per-Layer Testing Strategy

| Layer | Framework | Scope | Mock Strategy | Run Frequency |
|-------|-----------|-------|---------------|---------------|
| **Unit** | Vitest (Node) / JUnit 5 (Java) | Single class/function | All collaborators mocked | Every push |
| **Integration** | Vitest + Supertest | API endpoint flow, DB interaction | Real test DB, mocked external APIs | Every push |
| **E2E** | Playwright | Complete user journey | Real backend, seeded DB | Pre-release + nightly |

### 1.3 Coverage Targets per Component

| Component | Target Coverage | Critical Paths Require |
|-----------|----------------|----------------------|
| Node.js API services | 80% line, 90% branch | Auth, credits, chat, generation |
| Node.js API controllers | 75% line | All route handlers |
| Agent Runtime | 80% line | QueryLoopV2, ToolRegistryV2, CompactionEngine |
| Landing stores | 70% line | chat, project, credits, workspace |
| Java gateway-service | 80% line, 90% branch | JWT validation, rate limiting |
| Java auth-service | 80% line | Registration, login, token issuance |
| Java payment-service | 85% line, 90% branch | Credits debit/credit, withdrawal |

### 1.4 Naming Conventions

- **Vitest**: `describe('FeatureName', () => { it('should do X when Y', ...) })`
- **JUnit 5**: `@DisplayName("中文描述")` on each `@Test` method
- **File naming**: `{module}.test.ts` (Vitest), `{Class}Test.java` (JUnit)

---

## 2. Unit Test Catalog -- Node.js (Vitest)

### 2.1 API Service Tests

All located under `apps/api/tests/` with vitest config at `apps/api/vitest.config.ts`:
- globals enabled, node environment, fileParallelism disabled, coverage v8 provider
- setup file: `apps/api/tests/setup.ts`
- alias `@` mapped to `apps/api/src/`

#### 2.1.1 `apps/api/tests/unit/redis.config.test.ts` (2.8 KB)
- Redis connection configuration validation
- Environment variable fallback for REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- Sentinel mode config parsing
- Cluster mode config parsing

#### 2.1.2 `apps/api/tests/unit/websocket.hub.test.ts` (845 B)
- Room join/leave operations
- Broadcast to room filtering
- Connection count tracking

#### 2.1.3 `apps/api/tests/unit/visitor.middleware.test.ts` (3.9 KB)
- Anonymous user ID assignment (UUIDv7 generation)
- Returning user ID from cookie
- Cookie expiration and `maxAge` setting
- res.locals population for downstream handlers

#### 2.1.4 `apps/api/tests/unit/redis-cache.test.ts` (7.9 KB)
- `get`/`set`/`del` key-value operations
- TTL-based expiration
- Cache miss fallback via factory function
- `mset`/`mget` batch operations
- JSON serialization/deserialization round-trip

#### 2.1.5 `apps/api/tests/unit/request-logger.middleware.test.ts` (3.1 KB)
- Request method, URL, status code logging
- Response time calculation
- Error case logging (status >= 400)
- Skipped paths (health check, static assets)

#### 2.1.6 `apps/api/tests/unit/userMapping.service.test.ts` (6.0 KB)
- Map visitor ID to user ID after login
- Map visitor ID to user ID after registration
- Lookup user by visitor ID
- Handle duplicate mapping gracefully
- Cleanup on user deletion

#### 2.1.7 `apps/api/tests/unit/project.service.test.ts` (9.0 KB)
- Create project with owner assignment
- List projects filtered by user ID
- Update project name, description, status
- Delete project with cascade cleanup
- Soft-delete and restore flow

#### 2.1.8 `apps/api/tests/unit/traffic.service.test.ts` (5.6 KB)
- Record page visit event
- Aggregate daily/hourly traffic stats
- Unique visitor counting per project
- Traffic limit check and quota enforcement

#### 2.1.9 `apps/api/tests/unit/workspace.controller.test.ts` (12.7 KB)
- Create workspace via `POST /api/workspaces`
- List workspaces filtered by project
- Get workspace by ID with file tree
- Upload file to workspace
- Workspace archive and restore
- Invalid UUID rejection (400 response)

#### 2.1.10 `apps/api/tests/unit/agents.controller.test.ts` (6.8 KB)
- `GET /api/agents` returns agent list
- `POST /api/agents/:id/start` transitions to running
- `POST /api/agents/:id/pause` transitions to paused
- `POST /api/agents/:id/resume` transitions back to running
- `POST /api/agents/:id/stop` transitions to idle
- Invalid state transition errors (e.g., stop already-idle agent)

#### 2.1.11 `apps/api/tests/unit/auth.middleware.test.ts` (5.4 KB)
- Valid JWT token populates `req.user`
- Missing Authorization header returns 401
- Expired token returns 401
- Malformed token returns 401
- Public route bypass (whitelist matching)
- `X-User-Id` header injection from decoded token

#### 2.1.12 `apps/api/tests/unit/billingRetry.service.test.ts` (7.3 KB)
- Retry failed billing attempts with exponential backoff
- Max retry count enforcement (3 attempts)
- Successful retry clears pending flag
- Permanent failure after max retries
- Idempotency: duplicate billing events produce single charge

#### 2.1.13 `apps/api/tests/unit/chat.controller.test.ts` (11.3 KB)
- `POST /api/chat/sessions` creates new chat session
- `GET /api/chat/sessions` lists user sessions
- `POST /api/chat/sessions/:id/messages` appends message
- WebSocket message forwarding on new message
- `POST /api/chat/sessions/:id/versions` creates version snapshot
- `POST /api/chat/sessions/:id/versions/switch` switches active version

#### 2.1.14 `apps/api/tests/unit/chat.migration.test.ts` (5.2 KB)
- Migration script version tracking
- Up-migration adds columns/tables
- Down-migration reverts changes
- Idempotent migration (re-run safe)
- Migration failure rolls back transaction

#### 2.1.15 `apps/api/tests/unit/chat.service.test.ts` (14.9 KB)
- `createSession` with workspaceId and projectId
- `createSession` falls back when project not found
- `getSession` returns undefined for nonexistent ID
- `listSessions` filters by user and active status
- `addMessage` stores messageType and versionId
- `getSessionMessages` filters by versionId
- `getSessionMessages` excludes invisible messages by default
- `approveTask` updates approvalStatus to 'approved'
- `approveTask` throws when message not found in session
- `selectRecommend` updates selectedOptionId
- `dismissRecommend` marks message as invisible
- `createVersion` increments version_number per session
- `switchVersion` uses transaction (BEGIN/COMMIT/ROLLBACK)
- `listVersions` returns version_number-ordered list

```typescript
// Pattern from apps/api/tests/unit/chat.service.test.ts
vi.mock('../../src/config/database', () => ({
  pool: {
    query: (...args: any[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
})

it('createSession with workspaceId and projectId', async () => {
  mockQuery
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'proj-1' }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ws-1' }] })
    .mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'sess-1', workspace_id: 'ws-1', project_id: 'proj-1', status: 'active' }],
    })
  const session = await chatService.createSession({
    userId: 'u-1', workspaceId: 'ws-1', projectId: 'proj-1', title: 'Test',
  })
  expect(session.id).toBe('sess-1')
})
```

#### 2.1.16 `apps/api/tests/unit/code.controller.test.ts` (1.9 KB)
- `POST /api/code/workspace/files/save` saves file content
- `GET /api/code/workspace/search` searches files by query
- File path sanitization (prevent directory traversal)

#### 2.1.17 `apps/api/tests/unit/code.db.test.ts` (291 B)
- Foundation for code DB layer tests (minimal, needs expansion)

#### 2.1.18 `apps/api/tests/unit/credits.service.test.ts` (5.0 KB)
- Check balance returns sufficient/insufficient
- Debit credits reduces balance atomically
- Credit addition via admin action
- Transaction history recording
- Insufficient balance error for debit

#### 2.1.19 `apps/api/tests/unit/db.dao.test.ts` (14.5 KB)
- `userDb.findById` returns user / returns undefined / handles UUID error
- `userDb.findByPhone`, `userDb.findByUsername`, `userDb.findByExternalId`
- `userDb.create`, `userDb.update`, `userDb.delete`
- `agentDb.findById`, `agentDb.findAll`, `agentDb.create`, `agentDb.update`, `agentDb.delete`
- `taskDb` CRUD operations
- `projectDb` CRUD operations
- `chatSessionDb` / `chatMessageDb` / `agentTaskDb` / `logDb`
- UUID validation on all ID parameters (uses `22P02` error code)

```typescript
// Pattern from apps/api/tests/unit/db.dao.test.ts
function uuidErr() { return Object.assign(new Error("invalid uuid"), { code: "22P02" }) }

it('findById returns undefined on UUID error', async () => {
  mockQuery.mockRejectedValue(uuidErr())
  expect(await userDb.findById('not-a-uuid')).toBeUndefined()
})
```

#### 2.1.20 `apps/api/tests/unit/hosting.service.test.ts` (5.7 KB)
- Create hosted website record
- Subdomain availability check
- DNS record generation
- SSL certificate provisioning status tracking

#### 2.1.21 `apps/api/tests/unit/taskExecution.service.test.ts` (10.3 KB)
- Task creation and assignment to agent
- Task status transitions (pending -> in_progress -> completed)
- Task progress update (percentage and message)
- Agent availability check before assignment
- Task timeout handling

#### 2.1.22 `apps/api/tests/unit/tasks.controller.test.ts` (4.9 KB)
- `POST /api/tasks` creates task with assignedTo
- `GET /api/tasks` lists tasks with pagination
- `GET /api/tasks/:id` returns task detail
- `PATCH /api/tasks/:id` updates task status
- `DELETE /api/tasks/:id` soft-deletes

### 2.2 Agent Runtime Tests

All located under `apps/agent-runtime/tests/` with vitest config at `apps/agent-runtime/vitest.config.ts`:
- globals enabled, node environment, coverage v8 provider
- setup file: `apps/agent-runtime/tests/setup.ts`

#### 2.2.1 `apps/agent-runtime/tests/agent/QueryLoopV2.test.ts` (16.8 KB)
- Basic execution: simple query without tools, tool calls, already-running guard, maxIterations
- Error handling: LLM errors, tool execution errors, unknown tools
- Context compaction: threshold exceeded triggers compaction, disabled compaction skips, compaction errors handled gracefully
- State management: idle/running/completed tracking, iteration count
- Stop functionality: mid-execution stop
- Progress callbacks: onProgress for each event, event emission (start/complete/content)
- Streaming: streaming execution, stream error handling
- System prompt: sets system prompt when provided

#### 2.2.2 `apps/agent-runtime/tests/unit/QueryLoopV2.permission.test.ts` (7.5 KB)
- Tool permission check before execution
- Read-only tool allowed without permission
- Write tool blocked when not authorized
- Permission grant mid-session
- Permission revocation mid-execution

#### 2.2.3 `apps/agent-runtime/tests/context/compact/CompactionEngine.test.ts` (13.2 KB)
- SimpleTokenEstimator token counting
- SnipCompactionStrategy: removes oldest messages, preserves system prompt
- CompactConversationStrategy: LLM-based summarization
- ContextCollapseStrategy: collapses tool outputs
- Configurable compaction threshold and retention
- Token estimation accuracy within 20% margin

#### 2.2.4 `apps/agent-runtime/tests/unit/BaseAgentRuntime.test.ts` (7.8 KB)
- Agent initialization with role and tools
- `executeTask` lifecycle hooks (before/after)
- Error boundary: task failure isolation
- Tool resolution from registry

#### 2.2.5 `apps/agent-runtime/tests/unit/ConversationContextV2.test.ts` (3.4 KB)
- Add user/assistant/system/tool messages
- `toLLMMessages()` format conversion
- Token counting (estimateTokens)
- Context window overflow detection
- Message history truncation

#### 2.2.6 `apps/agent-runtime/tests/unit/featureFlags.test.ts` (5.2 KB)
- Flag evaluation with targeting rules
- Percentage rollout calculation
- Environment-specific flag overrides
- Flag caching with TTL

#### 2.2.7 `apps/agent-runtime/tests/unit/FileReadTool.test.ts` (3.3 KB)
- Read file within workspace boundary
- Path traversal prevention (../ rejection)
- File not found error
- Binary file detection and rejection

#### 2.2.8 `apps/agent-runtime/tests/unit/LLMService.test.ts` (6.2 KB)
- `complete()` returns LLMCompletionResult with usage
- `stream()` yields content chunks
- Provider failover (primary -> secondary)
- Rate limit retry with exponential backoff

#### 2.2.9 `apps/agent-runtime/tests/unit/PermissionManager.test.ts` (7.9 KB)
- Permission grant/revoke for tool+scope
- `canUse(toolName, scope)` check
- Default deny for unregistered tools
- Permission inheritance from role

#### 2.2.10 `apps/agent-runtime/tests/unit/ToolAdapter.test.ts` (12.0 KB)
- V1-to-V2 tool wrapping
- Input schema adaptation
- Result format conversion
- Error propagation through adapter

#### 2.2.11 `apps/agent-runtime/tests/unit/ToolRegistry.test.ts` (6.5 KB)
- Register/unregister tools
- `getByName()` lookup
- `listTools()` returns all registered
- Duplicate registration error
- Tool filtering by category

#### 2.2.12 `apps/agent-runtime/tests/unit/ToolRegistryV2.test.ts` (11.5 KB)
- Register with Zod schema validation
- `execute(name, input)` calls tool
- Tool `canUse` callback invocation
- Schema mismatch returns validation error
- Async tool execution with timeout

#### 2.2.13 `apps/agent-runtime/tests/unit/ToolV2.test.ts` (8.8 KB)
- `buildToolV2()` factory function
- `isReadOnly` property
- `call()` with context and permission check
- Input validation via Zod
- Result type discrimination ('result' | 'error' | 'permission_denied')

### 2.3 Frontend Tests (Landing)

Located under `apps/landing/` with vitest config at `apps/landing/vitest.config.ts`:
- jsdom environment, `@vitejs/plugin-vue`, globals enabled
- Test file pattern: `components/**/*.spec.{js,ts}`, `stores/**/*.spec.{js,ts}`, `composables/**/*.spec.{js,ts}`

#### 2.3.1 `apps/landing/stores/__tests__/chat.spec.ts` (12.9 KB)
- Session creation and listing
- Message sending and receiving
- Version snapshot creation
- Real-time message sync via mock WebSocket
- Session persistence across page reload

#### 2.3.2 `apps/landing/stores/__tests__/creator.spec.ts` (4.0 KB)
- Product creation form validation
- Product status transitions (DRAFT -> PUBLISHED)
- Earnings dashboard data
- Product listing with pagination

#### 2.3.3 `apps/landing/stores/__tests__/credits.spec.ts` (4.6 KB)
- Credits balance fetch
- Transaction history pagination
- Credits top-up flow
- Insufficient balance warning

#### 2.3.4 `apps/landing/stores/__tests__/marketplace.spec.ts` (6.0 KB)
- Product listing with category filter
- Product detail fetch
- Purchase flow state machine
- Clone-to-workspace action

#### 2.3.5 `apps/landing/stores/__tests__/project.spec.ts` (5.8 KB)
- Project CRUD operations
- Project list with owner filter
- Project status (active/archived)
- Project tech stack metadata

#### 2.3.6 `apps/landing/stores/__tests__/workspace.spec.ts` (8.4 KB)
- Workspace file tree rendering
- File creation, rename, delete
- Workspace archive/restore
- Multi-workspace switching

#### 2.3.7 `apps/landing/stores/__tests__/visibleMessages.spec.ts` (8.5 KB)
- Message visibility filtering by version
- Invisible message exclusion
- System event message grouping
- Message pagination (cursor-based)

#### 2.3.8 `apps/landing/composables/__tests__/useMockApi.spec.ts` (3.8 KB)
- Mock API response interception
- Request/response logging
- Latency simulation
- Error injection for testing

#### 2.3.9 `apps/landing/components/chat/__tests__/chat-components.spec.ts` (10.5 KB)
- ChatMessage component rendering
- Message role styling (user vs assistant)
- Task approval buttons visibility
- Recommend option selection
- Code block syntax highlighting
- Markdown content rendering

### 2.4 NEW Tests Required for Generation Pipeline

These tests cover the app generation pipeline defined in SPEC-001.

#### 2.4.1 `apps/api/tests/unit/templates.service.test.ts` (NEW)

```typescript
// apps/api/tests/unit/templates.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/config/database', () => ({ pool: { query: vi.fn() } }))

import { templatesService } from '../../src/services/templates.service'
import { pool } from '../../src/config/database'

const mockQuery = pool.query as ReturnType<typeof vi.fn>

describe('Templates Service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('listTemplates', () => {
    it('returns all active templates', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 't-1', name: 'react-vite', category: 'frontend', is_active: true },
          { id: 't-2', name: 'dashboard', category: 'fullstack', is_active: true },
        ],
      })
      const result = await templatesService.listTemplates({ activeOnly: true })
      expect(result).toHaveLength(2)
    })

    it('filters by category', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 't-1', name: 'react-vite', category: 'frontend' }],
      })
      const result = await templatesService.listTemplates({ category: 'frontend' })
      expect(result[0].category).toBe('frontend')
    })
  })

  describe('selectTemplate', () => {
    it('returns template with full file manifest', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 't-1', name: 'react-vite', manifest: { files: 12 } }] })
      const template = await templatesService.selectTemplate('t-1')
      expect(template.name).toBe('react-vite')
    })

    it('throws on invalid template ID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      await expect(templatesService.selectTemplate('bad-id')).rejects.toThrow('Template not found')
    })
  })

  describe('validateTemplate', () => {
    it('returns valid=true when all required files present', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ manifest: { requiredFiles: ['package.json', 'tsconfig.json'] } }] })
      const result = await templatesService.validateTemplate('t-1', ['package.json', 'tsconfig.json', 'src/App.tsx'])
      expect(result.valid).toBe(true)
    })

    it('returns valid=false with missing files list', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ manifest: { requiredFiles: ['package.json', 'tsconfig.json'] } }] })
      const result = await templatesService.validateTemplate('t-1', ['src/App.tsx'])
      expect(result.valid).toBe(false)
      expect(result.missingFiles).toContain('package.json')
    })
  })
})
```

#### 2.4.2 `apps/api/tests/unit/verification.service.test.ts` (NEW)

```typescript
// apps/api/tests/unit/verification.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execAsync } from '../../src/utils/exec'

vi.mock('../../src/utils/exec', () => ({ execAsync: vi.fn() }))
vi.mock('../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { verificationService } from '../../src/services/verification.service'

describe('Verification Service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('verifyProject', () => {
    it('returns success when npm install + build pass', async () => {
      vi.mocked(execAsync)
        .mockResolvedValueOnce({ stdout: 'installed', stderr: '' })   // npm install
        .mockResolvedValueOnce({ stdout: 'built', stderr: '' })       // npm run build

      const result = await verificationService.verifyProject('/workspace/test-app')
      expect(result.passed).toBe(true)
      expect(result.steps.npmInstall.success).toBe(true)
      expect(result.steps.npmBuild.success).toBe(true)
    })

    it('returns failure with error output when build fails', async () => {
      vi.mocked(execAsync)
        .mockResolvedValueOnce({ stdout: 'installed', stderr: '' })
        .mockRejectedValueOnce(new Error('Build failed: TS2322 type error'))

      const result = await verificationService.verifyProject('/workspace/test-app')
      expect(result.passed).toBe(false)
      expect(result.steps.npmBuild.error).toContain('TS2322')
    })
  })

  describe('verifyWithRetry', () => {
    it('succeeds on 2nd attempt after first failure', async () => {
      vi.mocked(execAsync)
        .mockRejectedValueOnce(new Error('Build failed'))     // attempt 1
        .mockResolvedValueOnce({ stdout: 'installed', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'built', stderr: '' })  // attempt 2 passes
        .mockResolvedValueOnce({ stdout: 'installed', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'built', stderr: '' })

      const result = await verificationService.verifyWithRetry('/workspace/test-app', 3)
      expect(result.passed).toBe(true)
      expect(result.attempts).toBe(2)
    })

    it('triggers rollback after 3 consecutive failures', async () => {
      vi.mocked(execAsync).mockRejectedValue(new Error('Build failed'))

      const rollbackSpy = vi.spyOn(verificationService, 'rollback')
      const result = await verificationService.verifyWithRetry('/workspace/test-app', 3)
      expect(result.passed).toBe(false)
      expect(rollbackSpy).toHaveBeenCalledWith('/workspace/test-app')
    })

    it('commits to git on success', async () => {
      vi.mocked(execAsync)
        .mockResolvedValueOnce({ stdout: 'installed', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'built', stderr: '' })

      const result = await verificationService.verifyWithRetry('/workspace/test-app', 3)
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('git add -A'),
        expect.any(Object)
      )
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('git commit'),
        expect.any(Object)
      )
    })
  })
})
```

#### 2.4.3 `apps/api/tests/unit/preview-server.service.test.ts` (NEW)

```typescript
// apps/api/tests/unit/preview-server.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { previewServerService } from '../../src/services/preview-server.service'
import http from 'http'

describe('Preview Server Service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('port allocation', () => {
    it('allocates unique ports for each project', async () => {
      const port1 = await previewServerService.allocatePort('proj-1')
      const port2 = await previewServerService.allocatePort('proj-2')
      expect(port1).not.toBe(port2)
      expect(port1).toBeGreaterThanOrEqual(3000)
      expect(port1).toBeLessThanOrEqual(3999)
    })

    it('reuses port for same project', async () => {
      const port1 = await previewServerService.allocatePort('proj-1')
      const port2 = await previewServerService.allocatePort('proj-1')
      expect(port1).toBe(port2)
    })
  })

  describe('server lifecycle', () => {
    it('starts and stops preview server', async () => {
      const { url, pid } = await previewServerService.start('proj-1', '/workspace/test-app')
      expect(url).toMatch(/^http:\/\/localhost:\d+/)
      expect(pid).toBeGreaterThan(0)

      await previewServerService.stop('proj-1')
      const status = await previewServerService.getStatus('proj-1')
      expect(status.running).toBe(false)
    })

    it('health check returns 200 when server is up', async () => {
      await previewServerService.start('proj-health', '/workspace/healthy-app')
      const health = await previewServerService.healthCheck('proj-health')
      expect(health.healthy).toBe(true)
      expect(health.statusCode).toBe(200)
    })
  })

  describe('LRU eviction', () => {
    it('evicts least recently used when exceeding max (10)', async () => {
      const spy = vi.spyOn(previewServerService, 'stop')

      // Start 11 previews
      for (let i = 1; i <= 11; i++) {
        await previewServerService.start(`proj-${i}`, `/workspace/app-${i}`)
      }

      expect(spy).toHaveBeenCalledWith('proj-1') // LRU evicted
      const running = await previewServerService.listRunning()
      expect(running).toHaveLength(10)
    })
  })
})
```

#### 2.4.4 `apps/api/tests/unit/supabase-manager.service.test.ts` (NEW)

```typescript
// apps/api/tests/unit/supabase-manager.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/exec', () => ({ execAsync: vi.fn() }))

import { supabaseManagerService } from '../../src/services/supabase-manager.service'

describe('Supabase Manager Service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('createSchema', () => {
    it('generates correct SQL for a TODO app schema', async () => {
      const schema = await supabaseManagerService.createSchema({
        tables: [
          { name: 'todos', columns: ['id uuid', 'title text', 'completed boolean'] },
        ],
      })
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS todos')
      expect(schema).toContain('id uuid PRIMARY KEY DEFAULT gen_random_uuid()')
    })
  })

  describe('generateMigration', () => {
    it('creates timestamped migration file', async () => {
      const path = await supabaseManagerService.generateMigration('add_todos_table', 'CREATE TABLE todos (...)')
      expect(path).toMatch(/\d{14}_add_todos_table\.sql$/)
    })
  })

  describe('applyRLSPolicies', () => {
    it('adds owner-based RLS policy', async () => {
      const policies = await supabaseManagerService.applyRLSPolicies('todos', 'authenticated')
      expect(policies).toContain('ALTER TABLE todos ENABLE ROW LEVEL SECURITY')
      expect(policies).toContain('USING (auth.uid() = user_id)')
    })
  })
})
```

#### 2.4.5 `apps/landing/stores/__tests__/generation.spec.ts` (NEW)

```typescript
// apps/landing/stores/__tests__/generation.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGenerationStore } from '../../stores/generation'

describe('Generation Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts in idle state', () => {
    const store = useGenerationStore()
    expect(store.phase).toBe('idle')
    expect(store.progress).toBe(0)
  })

  it('transitions through states during generation', async () => {
    const store = useGenerationStore()

    await store.startGeneration({ intent: 'Create a TODO app', templateId: 'react-vite' })
    expect(store.phase).toBe('initializing')

    // Simulate WebSocket event: workspace created
    store.handleWebSocketEvent({ type: 'workspace.created', workspaceId: 'ws-1' })
    expect(store.phase).toBe('generating')

    // Simulate WebSocket event: generation progress
    store.handleWebSocketEvent({ type: 'generation.progress', progress: 50 })
    expect(store.progress).toBe(50)

    // Simulate WebSocket event: verification
    store.handleWebSocketEvent({ type: 'verification.start' })
    expect(store.phase).toBe('verifying')

    store.handleWebSocketEvent({ type: 'verification.complete', passed: true })
    expect(store.phase).toBe('completed')
  })

  it('handles verification failure with retry notification', () => {
    const store = useGenerationStore()
    store.handleWebSocketEvent({
      type: 'verification.failed',
      attempt: 1,
      maxAttempts: 3,
      error: 'Build failed',
    })
    expect(store.verificationStatus).toBe('retrying')
    expect(store.retryMessage).toContain('Attempt 1/3')
  })

  it('transitions to error state on max retries exceeded', () => {
    const store = useGenerationStore()
    store.handleWebSocketEvent({
      type: 'verification.failed',
      attempt: 3,
      maxAttempts: 3,
      error: 'Build failed persistently',
    })
    expect(store.phase).toBe('error')
    expect(store.errorMessage).toContain('persistently')
  })

  describe('template selection', () => {
    it('sets selected template', () => {
      const store = useGenerationStore()
      store.selectTemplate({ id: 't-1', name: 'react-vite', category: 'frontend' })
      expect(store.selectedTemplateId).toBe('t-1')
    })
  })

  describe('design scheme selection', () => {
    it('applies design scheme to current project', () => {
      const store = useGenerationStore()
      store.selectDesignScheme({
        primaryColor: '#3B82F6',
        fontFamily: 'Inter',
        borderRadius: '8px',
      })
      expect(store.designScheme.primaryColor).toBe('#3B82F6')
    })
  })
})
```

---

## 3. Unit Test Catalog -- Java (JUnit 5)

All located under `apps/java/*/src/test/java/com/agenthive/`.

### 3.1 Gateway Service Tests

#### 3.1.1 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/filter/JwtValidationFilterTest.java` (9.3 KB)

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtValidationFilter JWT 验证过滤器测试")
class JwtValidationFilterTest {

    @Test @DisplayName("白名单路径应直接放行")
    void filter_shouldBypassWhiteListedPaths() { /* ... */ }

    @Test @DisplayName("无 Authorization header 返回 401")
    void filter_shouldReturn401_whenNoAuthHeader() { /* ... */ }

    @Test @DisplayName("Bearer token 格式错误返回 401")
    void filter_shouldReturn401_whenMalformedToken() { /* ... */ }

    @Test @DisplayName("过期 token 返回 401")
    void filter_shouldReturn401_whenExpiredToken() { /* ... */ }

    @Test @DisplayName("有效 token 应注入 X-User-Id 并放行")
    void filter_shouldInjectUserIdAndProceed_whenValidToken() { /* ... */ }
}
```

#### 3.1.2 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/filter/RateLimitFilterTest.java` (4.3 KB)
- Redis Lua script invocation verification
- Rate limit bucket initialization
- Within-limit request proceeds normally
- Over-limit request returns 429 Too Many Requests
- Rate limit key construction from IP + path

#### 3.1.3 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/filter/TraceIdFilterTest.java` (4.0 KB)
- X-Trace-Id generation when missing
- X-Trace-Id propagation when present
- MDC context population
- Cleanup after response

#### 3.1.4 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/config/CorsConfigDevTest.java` (4.9 KB)
- Development CORS: allow all origins
- Preflight OPTIONS handling
- Allowed methods and headers

#### 3.1.5 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/config/CorsConfigProdTest.java` (5.0 KB)
- Production CORS: restricted origins only
- Non-whitelisted origin returns 403
- Credentials allowed with specific origin

#### 3.1.6 `apps/java/gateway-service/src/test/java/com/agenthive/gateway/config/JwtConfigTest.java` (3.4 KB)
- JWT secret loading from environment
- Secret key minimum length validation
- Signature algorithm HS256 configuration

### 3.2 Auth Service Tests

#### 3.2.1 `apps/java/auth-service/src/test/java/com/agenthive/auth/service/impl/AuthServiceImplTest.java` (14.3 KB)

```java
@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Test void register_shouldSucceed_whenValidRequest() { /* ... */ }
    @Test void register_shouldThrow_whenPhoneAlreadyExists() { /* ... */ }
    @Test void login_shouldReturnTokens_whenValidCredentials() { /* ... */ }
    @Test void login_shouldThrow_whenWrongPassword() { /* ... */ }
    @Test void smsLogin_shouldSendCode_whenPhoneExists() { /* ... */ }
    @Test void smsLogin_shouldAutoRegister_whenPhoneNotExists() { /* ... */ }
    @Test void refreshToken_shouldIssueNewAccessToken() { /* ... */ }
    @Test void refreshToken_shouldThrow_whenTokenRevoked() { /* ... */ }
    @Test void logout_shouldRevokeRefreshToken() { /* ... */ }
}
```

#### 3.2.2 `apps/java/auth-service/src/test/java/com/agenthive/auth/controller/AuthControllerTest.java` (7.9 KB)
- `POST /auth/register` success/validation failure
- `POST /auth/login` returns TokenResponse
- `POST /auth/sms/send` triggers SMS dispatch
- `POST /auth/sms/login` verifies code and returns tokens
- `POST /auth/refresh` returns new access token

#### 3.2.3 `apps/java/auth-service/src/test/java/com/agenthive/auth/controller/SmsControllerTest.java` (6.7 KB)
- SMS code generation (6 digits)
- Code storage in Redis with TTL
- Verification code validation
- Rate limit per phone number (1/minute)
- Code expiration (5 minutes)

#### 3.2.4 `apps/java/auth-service/src/test/java/com/agenthive/auth/service/impl/SmsServiceImplTest.java` (10.1 KB)
- SMS provider selection (Aliyun/Tencent Cloud)
- Template variable substitution
- Send failure retry (up to 2 retries)
- Provider circuit breaker after 3 consecutive failures

#### 3.2.5 `apps/java/auth-service/src/test/java/com/agenthive/auth/config/JwtConfigTest.java` (3.4 KB)
- Access token expiration configuration
- Refresh token expiration (7 days)
- Token signing key validation

#### 3.2.6 `apps/java/auth-service/src/test/java/com/agenthive/auth/controller/UserControllerTest.java` (3.1 KB)
- `GET /auth/users/me` returns current user profile
- `PUT /auth/users/me` updates profile fields
- Avatar upload URL generation

#### 3.2.7 `apps/java/auth-service/src/test/java/com/agenthive/auth/domain/entity/SysUserSecurityTest.java` (1.4 KB)
- Password encoding verification
- Sensitive field serialization exclusion
- Account lock after N failed attempts

### 3.3 Payment Service Tests

#### 3.3.1 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/CreditsAccountServiceImplTest.java` (11.5 KB)

```java
@ExtendWith(MockitoExtension.class)
class CreditsAccountServiceImplTest {

    @Test void getBalance_existingAccount_returnsBalance() { /* ... */ }
    @Test void getBalance_newAccount_createsAndReturnsZero() { /* ... */ }
    @Test void credit_success_addsBalanceAndCreatesTransaction() { /* ... */ }
    @Test void credit_idempotent_skipsDuplicateSource() { /* ... */ }
    @Test void debit_success_deductsBalance_whenSufficient() { /* ... */ }
    @Test void debit_fails_whenInsufficientBalance() { /* ... */ }
    @Test void debit_optimisticLock_retriesOnVersionConflict() { /* ... */ }
    @Test void freeze_marksAmountAsFrozen() { /* ... */ }
    @Test void unfreeze_releasesFrozenBalance() { /* ... */ }
}
```

#### 3.3.2 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/CreditsAgentServiceImplTest.java` (9.2 KB)
- Generation cost calculation (per-token pricing)
- Agent task billing event processing
- Monthly credits grant (new user)
- Credits expiration check

#### 3.3.3 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/HostedWebsiteServiceImplTest.java` (7.9 KB)
- Create hosted website record
- Subdomain uniqueness check
- DNS record generation
- SSL provisioning via ACME

#### 3.3.4 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/MarketplaceOrderServiceImplTest.java` (8.8 KB)
- Create order with 20% platform fee calculation
- Order status transitions (PENDING -> PAID -> COMPLETED)
- Seller earnings credit (80% of price)
- Order refund flow

#### 3.3.5 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/TrafficSettlementServiceImplTest.java` (12.2 KB)
- Traffic usage aggregation per project
- Billing cycle settlement
- Overage charge calculation
- Settlement report generation

#### 3.3.6 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/WithdrawalServiceImplTest.java` (13.9 KB)

```java
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WithdrawalServiceImplTest {

    @Test void apply_success_whenBalanceSufficient() { /* ... */ }
    @Test void apply_fails_whenBalanceInsufficient() { /* ... */ }
    @Test void apply_fails_whenDailyLimitExceeded() { /* ... */ }
    @Test void approve_changesStatusToProcessing() { /* ... */ }
    @Test void complete_transfersToExternalAccount() { /* ... */ }
    @Test void reject_restoresBalance() { /* ... */ }
    @Test void accountEncryption_masksSensitiveFields() { /* ... */ }
}
```

#### 3.3.7 `apps/java/payment-service/src/test/java/com/agenthive/payment/config/InternalApiConfigTest.java` (2.0 KB)
- Internal API key validation
- Request source verification

#### 3.3.8 `apps/java/payment-service/src/test/java/com/agenthive/payment/config/WithdrawalAccountEncryptorTest.java` (2.0 KB)
- Encrypt/decrypt bank account numbers
- Masked display format (e.g., `****1234`)

### 3.4 Common Module Tests

#### 3.4.1 `apps/java/common/common-core/src/test/java/com/agenthive/common/core/result/ResultTest.java` (3.3 KB)
- `Result.success(data)` returns 200 with data
- `Result.fail(code, msg)` returns error code
- Paginated result wrapping

#### 3.4.2 `apps/java/common/common-core/src/test/java/com/agenthive/common/core/exception/AgentHiveExceptionTest.java` (2.8 KB)
- Exception with ResultCode
- Exception chaining
- Custom error message

#### 3.4.3 `apps/java/common/common-security/src/test/java/com/agenthive/common/security/util/JwtUtilsTest.java` (6.2 KB)
- Generate access token with claims
- Validate token and extract userId
- Token expiration verification
- Signature tampering detection

### 3.5 NEW Java Tests Required

#### 3.5.1 `apps/java/payment-service/src/test/java/com/agenthive/payment/service/impl/CreatorProductServiceTest.java` (NEW)

```java
@ExtendWith(MockitoExtension.class)
class CreatorProductServiceTest {

    @Test @DisplayName("创建商品 - 验证必填字段")
    void createProduct_shouldValidateRequiredFields() {
        // title, description, price, category 全部必填
    }

    @Test @DisplayName("发布商品 - DRAFT 转 PUBLISHED")
    void publishProduct_shouldTransitionFromDraftToPublished() { /* ... */ }

    @Test @DisplayName("下架商品 - PUBLISHED 转 DRAFT")
    void unpublishProduct_shouldTransitionFromPublishedToDraft() { /* ... */ }

    @Test @DisplayName("Dashboard 统计 - 返回销售额、订单数、访客数")
    void getDashboardStats_shouldReturnSalesOrdersAndVisitors() { /* ... */ }

    @Test @DisplayName("收益计算 - 平台抽成 20% 后剩余 80%")
    void calculateEarnings_shouldDeduct20PercentPlatformFee() { /* ... */ }
}
```

#### 3.5.2 Gateway Route Config Test (NEW)

Verify gateway routes for the new economy-service and removal of deprecated services:

```java
@Test @DisplayName("路由配置 - economy-service 路由存在")
void routes_shouldContainEconomyService() {
    // 验证 economy-service 的 lb://economy-service 路由
}

@Test @DisplayName("路由配置 - 已移除 cart/logistics/order 路由")
void routes_shouldNotContainDeprecatedServices() {
    // 验证 cart-service, logistics-service, order-service 路由不存在
}
```

---

## 4. Integration Tests

### 4.1 Existing: `apps/api/tests/integration/api.workflow.test.ts` (4.0 KB)

Covers 4 integration-level flows via Supertest against the real Express app:

| Test | Flow | Assertions |
|------|------|-----------|
| 完整业务工作流程 | GET /api/agents -> POST /api/tasks -> GET /api/tasks/:id | 200/201 status, data consistency |
| Agent 状态管理流程 | POST start -> pause -> resume -> stop | All return 200 |
| 代码编辑工作流程 | POST save file -> POST update file -> GET search | 200, content matches |
| 错误处理 | GET nonexistent -> 404; POST invalid -> 400 | Correct error codes |
| 健康检查 | GET /api/health | `{ ok: true }` |

```typescript
// Pattern from apps/api/tests/integration/api.workflow.test.ts
import app from '../../src/app'
import { resetData } from '../utils/test-db'

describe('API Workflow Integration Tests', () => {
  beforeEach(async () => {
    await resetData()
    await mkdir(MOCK_BASE, { recursive: true })
  })

  it('应该完成获取 Agents -> 创建任务 -> 分配任务 的流程', async () => {
    const agentsRes = await request(app).get('/api/agents')
    expect(agentsRes.status).toBe(200)
    const agentId = agentsRes.body.data.items[0].id

    const createTaskRes = await request(app)
      .post('/api/tasks')
      .send({ title: 'WF Task', type: 'feature', assignedTo: agentId })
    expect(createTaskRes.status).toBe(201)
  })
})
```

### 4.2 NEW: `apps/api/tests/integration/pipeline.integration.test.ts` (NEEDED)

Full integration flow from intent to preview:

```typescript
describe('Generation Pipeline Integration', () => {
  it('complete flow: intent -> template -> workspace -> verify -> preview', async () => {
    // Step 1: Submit generation intent
    const intentRes = await request(app)
      .post('/api/generation/intent')
      .send({ description: 'Create a simple TODO app with React' })
    expect(intentRes.status).toBe(200)
    expect(intentRes.body.data.suggestedTemplates).toHaveLength.above(0)

    // Step 2: Select template
    const templateRes = await request(app)
      .post('/api/generation/template')
      .send({ templateId: intentRes.body.data.suggestedTemplates[0].id })
    expect(templateRes.status).toBe(200)

    // Step 3: Start generation (async)
    const genRes = await request(app)
      .post('/api/generation/start')
      .send({ templateId: templateRes.body.data.id, intent: 'Create a TODO app' })
    expect(genRes.status).toBe(202)
    const generationId = genRes.body.data.id

    // Step 4: Wait for completion (poll status)
    let status;
    for (let i = 0; i < 30; i++) {
      const statusRes = await request(app).get(`/api/generation/${generationId}/status`)
      status = statusRes.body.data
      if (status.phase === 'completed' || status.phase === 'error') break
      await new Promise(r => setTimeout(r, 2000))
    }
    expect(status.phase).toBe('completed')

    // Step 5: Preview URL is available
    expect(status.previewUrl).toMatch(/^http:\/\/localhost:\d+/)
    const previewCheck = await fetch(status.previewUrl)
    expect(previewCheck.status).toBe(200)
  })
})
```

### 4.3 NEW: `apps/api/tests/integration/economy.integration.test.ts` (NEEDED)

```typescript
describe('Economy Integration', () => {
  it('charges credits after generation and verifies balance', async () => {
    // Given: user with 100 credits
    const balanceBefore = await request(app).get('/api/credits/balance')
    expect(balanceBefore.body.data.balance).toBe(100)

    // When: complete a generation
    await runFullGeneration({ templateId: 'react-vite', intent: 'TODO app' })

    // Then: credits are deducted
    const balanceAfter = await request(app).get('/api/credits/balance')
    expect(balanceAfter.body.data.balance).toBeLessThan(100)
  })

  it('marketplace purchase: browse -> view -> purchase -> clone', async () => {
    // Browse products
    const listRes = await request(app).get('/api/marketplace/products')
    expect(listRes.body.data.items.length).toBeGreaterThan(0)

    // View product detail
    const detailRes = await request(app).get(`/api/marketplace/products/${listRes.body.data.items[0].id}`)
    expect(detailRes.body.data.title).toBeDefined()

    // Purchase
    const purchaseRes = await request(app)
      .post('/api/marketplace/orders')
      .send({ productId: detailRes.body.data.id })
    expect(purchaseRes.status).toBe(201)

    // Clone to workspace
    const cloneRes = await request(app)
      .post(`/api/marketplace/orders/${purchaseRes.body.data.id}/clone`)
    expect(cloneRes.body.data.workspaceId).toBeDefined()
  })
})
```

---

## 5. E2E Tests (Playwright)

### 5.1 Existing Tests

#### 5.1.1 `apps/landing/e2e/chat.spec.ts` (9.6 KB)
- Open landing page and navigate to chat
- Send a message and verify response appears
- Task approval interaction
- Session switching
- Responsive layout (mobile viewport)

#### 5.1.2 `apps/landing/e2e/landing.spec.ts` (4.6 KB)
- Landing page hero section visibility
- Navigation menu interactions
- CTA button clicks
- Pricing page render
- Footer link navigation

### 5.2 NEW E2E Scenarios

#### 5.2.1 `apps/landing/e2e/app-generation.spec.ts` (NEEDED)

```typescript
import { test, expect } from '@playwright/test'

test.describe('App Generation Flow', () => {
  test('complete flow: describe -> select template -> watch progress -> preview -> deploy', async ({ page }) => {
    await page.goto('/app/chat')

    // Step 1: Type app description
    await page.fill('[data-testid="chat-input"]', 'I want a TODO app with React and TypeScript')
    await page.click('[data-testid="send-button"]')

    // Step 2: Wait for template suggestions and select one
    await expect(page.locator('[data-testid="template-card"]').first()).toBeVisible({ timeout: 15000 })
    await page.locator('[data-testid="template-card"]').filter({ hasText: 'react-vite' }).click()
    await page.click('[data-testid="confirm-template"]')

    // Step 3: Watch generation progress
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible()
    await expect(page.locator('[data-testid="verification-step"]')).toBeVisible({ timeout: 60000 })

    // Step 4: Preview is available
    const previewFrame = page.frameLocator('[data-testid="preview-iframe"]')
    await expect(previewFrame.locator('body')).not.toBeEmpty({ timeout: 30000 })

    // Step 5: Deploy
    await page.click('[data-testid="deploy-button"]')
    await expect(page.locator('[data-testid="deploy-success"]')).toBeVisible({ timeout: 30000 })
  })
})
```

#### 5.2.2 `apps/landing/e2e/marketplace-purchase.spec.ts` (NEEDED)

```typescript
test.describe('Marketplace Purchase Flow', () => {
  test('browse -> view -> purchase -> clone to workspace', async ({ page }) => {
    await page.goto('/marketplace')

    // Browse
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible()

    // View product
    await page.locator('[data-testid="product-card"]').first().click()
    await expect(page.locator('[data-testid="product-detail-title"]')).toBeVisible()

    // Purchase
    await page.click('[data-testid="purchase-button"]')
    await expect(page.locator('[data-testid="purchase-confirm-dialog"]')).toBeVisible()
    await page.click('[data-testid="confirm-purchase"]')
    await expect(page.locator('[data-testid="purchase-success"]')).toBeVisible()

    // Clone to workspace
    await page.click('[data-testid="clone-to-workspace"]')
    await expect(page.locator('[data-testid="workspace-url"]')).toHaveText(/\/workspace\//)
  })
})
```

#### 5.2.3 `apps/landing/e2e/creator-publish.spec.ts` (NEEDED)

```typescript
test.describe('Creator Publish Flow', () => {
  test('create product -> publish -> view in marketplace', async ({ page }) => {
    await page.goto('/creator')

    // Create product
    await page.click('[data-testid="create-product"]')
    await page.fill('[data-testid="product-title"]', 'My Custom Dashboard')
    await page.fill('[data-testid="product-description"]', 'A beautiful dashboard template')
    await page.fill('[data-testid="product-price"]', '19.99')
    await page.click('[data-testid="save-product"]')

    // Publish
    await page.click('[data-testid="publish-product"]')
    await expect(page.locator('[data-testid="publish-success"]')).toBeVisible()

    // View in marketplace
    await page.click('[data-testid="view-in-marketplace"]')
    await expect(page).toHaveURL(/\/marketplace\//)
    await expect(page.locator('[data-testid="product-detail-title"]')).toHaveText('My Custom Dashboard')
  })
})
```

---

## 6. Test Scenarios Matrix

### 6.1 Generation Pipeline (6 scenarios)

| # | Scenario | Precondition | Steps | Expected Result |
|---|----------|-------------|-------|-----------------|
| 1 | **Happy path: simple TODO app** | User has 100 credits, react-vite template exists | Intent "Create TODO app" -> Select react-vite -> Generate -> Verify -> Preview | Workspace populated with react-vite template files, preview accessible, credits deducted |
| 2 | **Verification failure + retry success** | Template has minor issue, fixable in 1 retry | Generate -> npm install fails (missing dep) -> auto-fix -> retry -> passes | 2nd attempt succeeds, git commit created |
| 3 | **Verification failure x3 -> rollback** | Template has unfixable issue | Generate -> fail -> retry -> fail -> retry -> fail | After 3rd failure, workspace rolled back, user notified with error details |
| 4 | **Incremental modification** | Existing generated app in workspace | Send "Add a dark mode toggle" -> agent modifies files -> verify | Only changed files modified, dark mode toggle functional |
| 5 | **Design scheme switch** | Generated app with default colors | Select new design scheme (blue -> green) -> regenerate styles | All color variables updated, preview reflects new scheme |
| 6 | **Large app: dashboard template** | User has sufficient credits, dashboard template exists | Select dashboard template -> multi-page generation -> verify each page | All pages generated, routing works, responsive layout verified |

### 6.2 Java Economy System (8 scenarios)

| # | Scenario | API Calls | Expected Result |
|---|----------|-----------|-----------------|
| 1 | **Credits balance -> debit on generation -> verify** | `GET /api/credits/balance` -> generation -> `GET /api/credits/balance` | Balance decreased by estimated cost |
| 2 | **Credits insufficient** | Set balance=5, attempt generation costing 10 | `POST /api/generation/start` returns 402 |
| 3 | **Marketplace purchase -> 20% platform fee** | Purchase product priced at $10.00 | Seller earns $8.00, platform earns $2.00 |
| 4 | **Product status toggle** | PUBLISHED -> DRAFT -> PUBLISHED | Each status change successful, marketplace listing reflects status |
| 5 | **HostedWebsite subdomain collision** | Two projects request same subdomain | Second request auto-retries with timestamp suffix |
| 6 | **Withdrawal: apply -> approve -> complete** | Apply 50 credits -> admin approve -> process | Credits deducted, external transfer triggered, status=COMPLETED |
| 7 | **Withdrawal: apply -> reject** | Apply 50 credits -> admin reject | Credits restored to balance, status=REJECTED |
| 8 | **Daily withdrawal limit exceeded** | Apply 1000 credits (limit=500/day) | 400 response: "Daily withdrawal limit exceeded" |

### 6.3 Frontend (7 scenarios)

| # | Scenario | Component(s) | Verification |
|---|----------|-------------|-------------|
| 1 | **ChatPage tab auto-switching** | ChatPage.vue | During generation, chat tab shows progress; "Preview" tab becomes active automatically when ready |
| 2 | **PreviewPanel device toggle** | PreviewPanel.vue | Click mobile/tablet/desktop icons; iframe resizes to correct dimensions (375px / 768px / 100%) |
| 3 | **Token usage bar color transitions** | TokenUsage.vue | < 50% green, 50-80% yellow, > 80% red with smooth CSS transition |
| 4 | **Template selection card grid** | TemplateCard.vue | 3-column grid on desktop, 1-column on mobile; hover effect, selected state border |
| 5 | **Design scheme picker interaction** | DesignPicker.vue | Click color swatch applies instantly; preview updates within 500ms |
| 6 | **Verification step progress checklist** | VerificationSteps.vue | Steps appear sequentially (npm install -> build -> lint -> test), checkmarks on pass, X on fail |
| 7 | **Deploy/Export button visibility** | DeployPanel.vue | Hidden during generation, visible after success; shows "Deploy" when not deployed, "Redeploy" after |

---

## 7. CI Testing Pipeline

### 7.1 Current CI: `.github/workflows/ci.yml`

```
┌─────────────────────────────────────────────────────┐
│                   Stage 1: Code Quality              │
│  typecheck (packages + api + landing)                │
│  lint (pnpm run lint)                                │
│  env security (API keys, CORS origin, Nacos token)   │
│  Runtime: ubuntu-latest, timeout 15min               │
└───────────────────────┬─────────────────────────────┘
                        │ needs: [code-quality]
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Stage 2: Build & Test               │
│  pnpm install --frozen-lockfile                      │
│  build workspace packages                            │
│  build API (tsc)                                     │
│  build Landing (nuxt build)                          │
│  pnpm test              <-- single command, all tests │
│  upload build artifacts                              │
│  Runtime: ubuntu-latest, timeout 30min               │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Stage 3: Build Summary              │
│  Report code-quality + build-test status             │
└─────────────────────────────────────────────────────┘
```

### 7.2 Develop CI: `.github/workflows/develop-ci.yml`

- **Job 0**: `detect-changes` -- uses `tj-actions/changed-files` to determine which services changed
- **Job 1**: `build-and-push` -- matrix build (api, landing, auth-service, payment-service, gateway-service, etc.)
  - Java services build with `mvn clean install -pl <service> -am -DskipTests -B -q` (tests skipped for speed)
- **Job 2**: `update-manifest` -- updates Helm values with new image tags, ArgoCD sync

### 7.3 Proposed Test Execution Matrix (Future Enhancement)

Split the single `pnpm test` into parallel jobs:

```yaml
# In .github/workflows/ci.yml, replace single "Build & Test" with matrix:
test-matrix:
  name: 🧪 Test (${{ matrix.suite }})
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: [code-quality]
  strategy:
    fail-fast: false
    matrix:
      suite: [api-tests, agent-runtime-tests, landing-tests, java-tests]
  steps:
    # ... checkout, install deps ...
    - name: Run tests
      run: |
        case "${{ matrix.suite }}" in
          api-tests)         cd apps/api && pnpm test ;;
          agent-runtime-tests) cd apps/agent-runtime && pnpm test ;;
          landing-tests)     cd apps/landing && pnpm test ;;
          java-tests)        cd apps/java && mvn test -B ;;
        esac
```

### 7.4 Coverage Reporting

```yaml
# Vitest coverage (v8 provider)
- name: Generate coverage (Node.js)
  run: |
    cd apps/api && pnpm vitest run --coverage
    cd apps/agent-runtime && pnpm vitest run --coverage
    cd apps/landing && pnpm vitest run --coverage

# JaCoCo coverage (Java)
- name: Generate coverage (Java)
  run: cd apps/java && mvn test jacoco:report -B

# Combined report
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: |
      apps/api/coverage/coverage-final.json
      apps/agent-runtime/coverage/coverage-final.json
      apps/landing/coverage/coverage-final.json
      apps/java/*/target/site/jacoco/jacoco.xml
```

### 7.5 Quality Gates

| Threshold | Action | Implementation |
|-----------|--------|---------------|
| Coverage < 60% | **Fail** build | `codecov.yml` with `target: 60%` |
| Coverage < 70% | **Warn** in PR | Codecov PR comment + status check (informational) |
| Any failed test | **Fail** build | Default CI behavior |
| Flaky test (>2 retries in 7 days) | **Ticket** auto-created | GitHub issue via `flaky-test-detector` action |

---

## 8. Per-Phase Verification Checklist

### 8.1 Phase 1: Foundation

| # | Verification Item | How to Verify | Expected |
|---|------------------|---------------|----------|
| 1 | API typecheck passes | `cd apps/api && npx tsc --noEmit` | Zero errors |
| 2 | Agent Runtime typecheck passes | `cd apps/agent-runtime && npx tsc --noEmit` | Zero errors |
| 3 | All Node.js unit tests pass | `pnpm test` from root | 46 test files pass |
| 4 | All Java unit tests pass | `cd apps/java && mvn test` | 25 tests pass |
| 5 | CI pipeline green on PR | Open draft PR to master | All 3 stages pass |

### 8.2 Phase 2: Stability

| # | Verification Item | How to Verify | Expected |
|---|------------------|---------------|----------|
| 1 | Generation pipeline integration test passes | Run `pipeline.integration.test.ts` | Full flow completes |
| 2 | Preview server lifecycle test passes | Run `preview-server.service.test.ts` | Start/stop/evict all pass |
| 3 | Verification retry/rollback test passes | Run `verification.service.test.ts` | 3-fail rollback works |
| 4 | No flaky tests after 10 CI runs | Check CI history | 100% pass rate |
| 5 | Coverage above 70% on new code | Check Codecov report | `diff: 70%` gate passes |

### 8.3 Phase 3: Deploy & Monetize

| # | Verification Item | How to Verify | Expected |
|---|------------------|---------------|----------|
| 1 | Economy integration test passes | Run `economy.integration.test.ts` | Credits flow correct |
| 2 | Credits debit after generation verified | Integration test + manual check in dev | Balance decremented |
| 3 | Marketplace purchase flow E2E passes | Run `marketplace-purchase.spec.ts` | Purchase + clone works |
| 4 | Withdrawal flow unit + integration tests pass | Java `WithdrawalServiceImplTest` + integration | All states covered |
| 5 | Helm deployment with new services succeeds | `helm template --debug` + `helm lint` | No errors |

### 8.4 Phase 4: Polish

| # | Verification Item | How to Verify | Expected |
|---|------------------|---------------|----------|
| 1 | All E2E scenarios pass | `pnpm run test:e2e` in landing | 5 specs pass |
| 2 | Responsive layout tests pass | E2E with mobile/tablet/desktop viewports | No layout breakage |
| 3 | Accessibility audit passes | Lighthouse a11y score | >= 90 |
| 4 | Performance budget met | Lighthouse performance score | >= 80 |
| 5 | Full regression suite passes | Run all tests (Node + Java + E2E) | 100% pass rate |

---

## 9. Test Data Management

### 9.1 Fixture Conventions for Node.js

```
apps/api/tests/
├── fixtures/
│   ├── users.json             # Pre-built user records
│   ├── projects.json          # Test project data
│   ├── templates.json         # Template fixture data
│   ├── chat-sessions.json     # Chat session seed data
│   ├── workspace-trees/       # File tree snapshots
│   │   ├── react-vite.json
│   │   └── dashboard.json
│   └── responses/
│       ├── llm-completion.json    # Mock LLM responses
│       └── supabase-schema.json   # Schema generation outputs
├── setup.ts                  # Global test setup (env, mocks)
└── utils/
    └── test-db.ts            # resetData(), seedFixtures()
```

### 9.2 Fixture Usage Pattern

```typescript
// apps/api/tests/setup.ts
import { config } from 'dotenv'
config({ path: '.env.test' })

// apps/api/tests/utils/test-db.ts
import { pool } from '../../src/config/database'

export async function resetData(): Promise<void> {
  await pool.query('TRUNCATE TABLE users, projects, tasks, agents CASCADE')
}

export async function seedFixtures(fixtureName: string): Promise<void> {
  const data = await import(`../fixtures/${fixtureName}.json`)
  // Insert fixture data into test DB
}
```

### 9.3 Seeding Strategy for Java

```sql
-- apps/java/auth-service/src/test/resources/db/migration/V999__test_seed.sql
-- Inserted by Flyway before each test class

INSERT INTO sys_user (id, phone, username, password_hash, status)
VALUES (999001, '13800000001', 'testuser', '$2a$10$...', 'ACTIVE');

INSERT INTO sys_role (id, role_code, role_name)
VALUES (999001, 'ROLE_USER', '普通用户');

INSERT INTO sys_user_role (user_id, role_id)
VALUES (999001, 999001);
```

```java
// Test base class
@SpringBootTest
@Sql(scripts = "/db/migration/V999__test_seed.sql",
     executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/db/cleanup.sql",
     executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
public abstract class BaseServiceTest { }
```

### 9.4 Mock Patterns

#### LLM Mock (Node.js)

```typescript
// Mock LLM service - returns predictable responses
vi.mock('../../src/services/llm', () => ({
  getLLMService: vi.fn(() => ({
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ files: [{ path: 'src/App.tsx', content: '...' }] }),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    }),
  })),
}))
```

#### Redis Mock (Node.js)

```typescript
// Mock Redis - in-memory map
vi.mock('../../src/config/redis', () => {
  const store = new Map<string, string>()
  return {
    default: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
      set: vi.fn((key: string, val: string) => { store.set(key, val); return Promise.resolve('OK') }),
      setex: vi.fn((key: string, _ttl: number, val: string) => { store.set(key, val); return Promise.resolve('OK') }),
      del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(1) }),
    },
    key: (...parts: string[]) => parts.join(':'),
  }
})
```

#### Database Mock (Node.js)

```typescript
// Mock PostgreSQL pool - used by db.dao.test.ts
const mockQuery = vi.fn()

vi.mock('../../src/config/database', () => ({
  pool: {
    query: (...args: any[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}))

// Helper to construct mock query results
function makeRows(rows: any[], rowCount?: number) {
  return { rows, rowCount: rowCount ?? rows.length }
}

// UUID error helper
function uuidErr() {
  return Object.assign(new Error("invalid uuid"), { code: "22P02" })
}
```

#### External API Mock (Node.js) -- nock pattern

```typescript
import nock from 'nock'

beforeEach(() => {
  nock('https://api.openai.com')
    .post('/v1/chat/completions')
    .reply(200, {
      choices: [{ message: { content: 'Generated code here...' } }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    })
})

afterEach(() => {
  nock.cleanAll()
})
```

#### Java Mock Pattern (Mockito)

```java
@ExtendWith(MockitoExtension.class)
class ExampleTest {

    @Mock private UserMapper userMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @InjectMocks private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void shouldReturnUser_whenUserExists() {
        when(userMapper.selectOne(any())).thenReturn(testUser);

        UserDTO result = authService.getUserById(1L);

        assertThat(result.getUsername()).isEqualTo("testuser");
        verify(userMapper, times(1)).selectOne(any());
    }
}
```

---

## Appendix: Test File Index

### Node.js (Vitest) -- 36 test files

| # | File | Size | Type |
|---|------|------|------|
| 1 | `apps/api/tests/unit/redis.config.test.ts` | 2.8 KB | Unit |
| 2 | `apps/api/tests/unit/websocket.hub.test.ts` | 845 B | Unit |
| 3 | `apps/api/tests/unit/visitor.middleware.test.ts` | 3.9 KB | Unit |
| 4 | `apps/api/tests/unit/redis-cache.test.ts` | 7.9 KB | Unit |
| 5 | `apps/api/tests/unit/request-logger.middleware.test.ts` | 3.1 KB | Unit |
| 6 | `apps/api/tests/unit/userMapping.service.test.ts` | 6.0 KB | Unit |
| 7 | `apps/api/tests/unit/project.service.test.ts` | 9.0 KB | Unit |
| 8 | `apps/api/tests/unit/traffic.service.test.ts` | 5.6 KB | Unit |
| 9 | `apps/api/tests/unit/workspace.controller.test.ts` | 12.7 KB | Unit |
| 10 | `apps/api/tests/unit/agents.controller.test.ts` | 6.8 KB | Unit |
| 11 | `apps/api/tests/unit/auth.middleware.test.ts` | 5.4 KB | Unit |
| 12 | `apps/api/tests/unit/billingRetry.service.test.ts` | 7.3 KB | Unit |
| 13 | `apps/api/tests/unit/chat.controller.test.ts` | 11.3 KB | Unit |
| 14 | `apps/api/tests/unit/chat.migration.test.ts` | 5.2 KB | Unit |
| 15 | `apps/api/tests/unit/chat.service.test.ts` | 14.9 KB | Unit |
| 16 | `apps/api/tests/unit/code.controller.test.ts` | 1.9 KB | Unit |
| 17 | `apps/api/tests/unit/code.db.test.ts` | 291 B | Unit |
| 18 | `apps/api/tests/unit/credits.service.test.ts` | 5.0 KB | Unit |
| 19 | `apps/api/tests/unit/db.dao.test.ts` | 14.5 KB | Unit |
| 20 | `apps/api/tests/unit/hosting.service.test.ts` | 5.7 KB | Unit |
| 21 | `apps/api/tests/unit/taskExecution.service.test.ts` | 10.3 KB | Unit |
| 22 | `apps/api/tests/unit/tasks.controller.test.ts` | 4.9 KB | Unit |
| 23 | `apps/api/tests/integration/api.workflow.test.ts` | 4.0 KB | Integration |
| 24 | `apps/agent-runtime/tests/agent/QueryLoopV2.test.ts` | 16.8 KB | Unit |
| 25 | `apps/agent-runtime/tests/unit/QueryLoopV2.permission.test.ts` | 7.5 KB | Unit |
| 26 | `apps/agent-runtime/tests/context/compact/CompactionEngine.test.ts` | 13.2 KB | Unit |
| 27 | `apps/agent-runtime/tests/unit/BaseAgentRuntime.test.ts` | 7.8 KB | Unit |
| 28 | `apps/agent-runtime/tests/unit/ConversationContextV2.test.ts` | 3.4 KB | Unit |
| 29 | `apps/agent-runtime/tests/unit/featureFlags.test.ts` | 5.2 KB | Unit |
| 30 | `apps/agent-runtime/tests/unit/FileReadTool.test.ts` | 3.3 KB | Unit |
| 31 | `apps/agent-runtime/tests/unit/LLMService.test.ts` | 6.2 KB | Unit |
| 32 | `apps/agent-runtime/tests/unit/PermissionManager.test.ts` | 7.9 KB | Unit |
| 33 | `apps/agent-runtime/tests/unit/ToolAdapter.test.ts` | 12.0 KB | Unit |
| 34 | `apps/agent-runtime/tests/unit/ToolRegistry.test.ts` | 6.5 KB | Unit |
| 35 | `apps/agent-runtime/tests/unit/ToolRegistryV2.test.ts` | 11.5 KB | Unit |
| 36 | `apps/agent-runtime/tests/unit/ToolV2.test.ts` | 8.8 KB | Unit |

### Frontend (Vitest + Playwright) -- 9 test files

| # | File | Size | Type |
|---|------|------|------|
| 37 | `apps/landing/stores/__tests__/chat.spec.ts` | 12.9 KB | Unit |
| 38 | `apps/landing/stores/__tests__/creator.spec.ts` | 4.0 KB | Unit |
| 39 | `apps/landing/stores/__tests__/credits.spec.ts` | 4.6 KB | Unit |
| 40 | `apps/landing/stores/__tests__/marketplace.spec.ts` | 6.0 KB | Unit |
| 41 | `apps/landing/stores/__tests__/project.spec.ts` | 5.8 KB | Unit |
| 42 | `apps/landing/stores/__tests__/workspace.spec.ts` | 8.4 KB | Unit |
| 43 | `apps/landing/stores/__tests__/visibleMessages.spec.ts` | 8.5 KB | Unit |
| 44 | `apps/landing/composables/__tests__/useMockApi.spec.ts` | 3.8 KB | Unit |
| 45 | `apps/landing/components/chat/__tests__/chat-components.spec.ts` | 10.5 KB | Unit |
| 46 | `apps/landing/e2e/chat.spec.ts` | 9.6 KB | E2E |
| 47 | `apps/landing/e2e/landing.spec.ts` | 4.6 KB | E2E |

### Java (JUnit 5) -- 23 test files

| # | File | Size | Type |
|---|------|------|------|
| 48 | `apps/java/gateway-service/.../filter/JwtValidationFilterTest.java` | 9.3 KB | Unit |
| 49 | `apps/java/gateway-service/.../filter/RateLimitFilterTest.java` | 4.3 KB | Unit |
| 50 | `apps/java/gateway-service/.../filter/TraceIdFilterTest.java` | 4.0 KB | Unit |
| 51 | `apps/java/gateway-service/.../config/CorsConfigDevTest.java` | 4.9 KB | Unit |
| 52 | `apps/java/gateway-service/.../config/CorsConfigProdTest.java` | 5.0 KB | Unit |
| 53 | `apps/java/gateway-service/.../config/JwtConfigTest.java` | 3.4 KB | Unit |
| 54 | `apps/java/auth-service/.../impl/AuthServiceImplTest.java` | 14.3 KB | Unit |
| 55 | `apps/java/auth-service/.../impl/SmsServiceImplTest.java` | 10.1 KB | Unit |
| 56 | `apps/java/auth-service/.../controller/AuthControllerTest.java` | 7.9 KB | Unit |
| 57 | `apps/java/auth-service/.../controller/SmsControllerTest.java` | 6.7 KB | Unit |
| 58 | `apps/java/auth-service/.../controller/UserControllerTest.java` | 3.1 KB | Unit |
| 59 | `apps/java/auth-service/.../config/JwtConfigTest.java` | 3.4 KB | Unit |
| 60 | `apps/java/auth-service/.../entity/SysUserSecurityTest.java` | 1.4 KB | Unit |
| 61 | `apps/java/payment-service/.../impl/CreditsAccountServiceImplTest.java` | 11.5 KB | Unit |
| 62 | `apps/java/payment-service/.../impl/CreditsAgentServiceImplTest.java` | 9.2 KB | Unit |
| 63 | `apps/java/payment-service/.../impl/HostedWebsiteServiceImplTest.java` | 7.9 KB | Unit |
| 64 | `apps/java/payment-service/.../impl/MarketplaceOrderServiceImplTest.java` | 8.8 KB | Unit |
| 65 | `apps/java/payment-service/.../impl/TrafficSettlementServiceImplTest.java` | 12.2 KB | Unit |
| 66 | `apps/java/payment-service/.../impl/WithdrawalServiceImplTest.java` | 13.9 KB | Unit |
| 67 | `apps/java/payment-service/.../config/InternalApiConfigTest.java` | 2.0 KB | Unit |
| 68 | `apps/java/payment-service/.../config/WithdrawalAccountEncryptorTest.java` | 2.0 KB | Unit |
| 69 | `apps/java/common/common-core/.../result/ResultTest.java` | 3.3 KB | Unit |
| 70 | `apps/java/common/common-core/.../exception/AgentHiveExceptionTest.java` | 2.8 KB | Unit |
| 71 | `apps/java/common/common-security/.../util/JwtUtilsTest.java` | 6.2 KB | Unit |

---

> **Document History**: Initial version capturing 46 existing test files and defining 15+ new test files for the generation pipeline, economy system, and E2E scenarios.
