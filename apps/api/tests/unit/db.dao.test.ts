// DAO 层单元测试 — mock pool.query
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/config/database', () => ({ pool: { query: vi.fn() } }))
vi.mock('../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { pool } from '../../src/config/database'
import { userDb, agentDb, taskDb, projectDb, chatSessionDb, chatMessageDb, agentTaskDb, logDb } from '../../src/db/index'

const mockQuery = pool.query as ReturnType<typeof vi.fn>

function makeRows(rows: any[], rowCount?: number) { return { rows, rowCount: rowCount ?? rows.length } }
function uuidErr() { return Object.assign(new Error("invalid uuid"), { code: "22P02" }) }

const NOW = '2024-01-15T10:30:00Z'
const USER = { id: '550e8400-e29b-41d4-a716-446655440000', username: 'alice', email: 'alice@test.com', role: 'user', created_at: NOW, updated_at: NOW }
const AGENT = { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Dev Agent', role: 'backend', status: 'idle', created_at: NOW, updated_at: NOW }
const TASK = { id: '550e8400-e29b-41d4-a716-446655440002', title: 'Build API', type: 'feature', status: 'pending', priority: 'medium', progress: 0, assigned_to: null, project_id: null, input: '{}', output: '{}', created_at: NOW }
const PROJECT = { id: '550e8400-e29b-41d4-a716-446655440003', name: 'My Project', owner_id: USER.id, status: 'active', created_at: NOW, updated_at: NOW }
const SESSION = { id: '550e8400-e29b-41d4-a716-446655440004', user_id: USER.id, status: 'active', created_at: NOW, updated_at: NOW }
const MESSAGE = { id: '550e8400-e29b-41d4-a716-446655440005', session_id: SESSION.id, role: 'user', content: 'hello', metadata: '{}', created_at: NOW }
const AGENT_TASK = { id: '550e8400-e29b-41d4-a716-446655440006', session_id: SESSION.id, ticket_id: 'TK-001', worker_role: 'backend', status: 'pending', created_at: NOW }

describe('userDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findById returns user when found', async () => { mockQuery.mockResolvedValue(makeRows([USER])); expect(await userDb.findById(USER.id)).toEqual(USER) })
  it('findById returns undefined when not found', async () => { mockQuery.mockResolvedValue(makeRows([])); expect(await userDb.findById('550e8400-e29b-41d4-a716-446655440099')).toBeUndefined() })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await userDb.findById('not-a-uuid')).toBeUndefined() })
  it('findByPhone returns user', async () => { mockQuery.mockResolvedValue(makeRows([USER])); expect(await userDb.findByPhone('13800138000')).toEqual(USER) })
  it('findByUsername returns user', async () => { mockQuery.mockResolvedValue(makeRows([USER])); expect(await userDb.findByUsername('alice')).toEqual(USER) })
  it('findByExternalId queries external_user_id column', async () => { mockQuery.mockResolvedValue(makeRows([USER])); await userDb.findByExternalId('42'); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('external_user_id'), ['42']) })
  it('create inserts and returns user', async () => { mockQuery.mockResolvedValue(makeRows([USER])); expect(await userDb.create({ username: 'alice', email: 'alice@test.com', role: 'user' })).toEqual(USER) })
  it('update updates and returns updated user', async () => { const updated = { ...USER, email: 'new@test.com' }; mockQuery.mockResolvedValue(makeRows([updated])); expect(await userDb.update(USER.id, { email: 'new@test.com' })).toEqual(updated) })
  it('update returns undefined when user not found', async () => { mockQuery.mockResolvedValue(makeRows([])); expect(await userDb.update(USER.id, { email: 'x@x.com' })).toBeUndefined() })
  it('delete returns true when deleted', async () => { mockQuery.mockResolvedValue(makeRows([], 1)); expect(await userDb.delete(USER.id)).toBe(true) })
  it('delete returns false when no rows affected', async () => { mockQuery.mockResolvedValue(makeRows([], 0)); expect(await userDb.delete('550e8400-e29b-41d4-a716-446655440099')).toBe(false) })
  it('getAll returns all users', async () => { mockQuery.mockResolvedValue(makeRows([USER])); expect(await userDb.getAll()).toEqual([USER]) })
})

describe('agentDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findById returns agent when found', async () => { mockQuery.mockResolvedValue(makeRows([AGENT])); expect(await agentDb.findById(AGENT.id)).toEqual(AGENT) })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await agentDb.findById('bad-uuid')).toBeUndefined() })
  it('findAll returns all agents', async () => { mockQuery.mockResolvedValue(makeRows([AGENT])); expect(await agentDb.findAll()).toEqual([AGENT]) })
  it('create inserts and returns agent', async () => { mockQuery.mockResolvedValue(makeRows([AGENT])); expect(await agentDb.create({ name: 'Dev Agent', role: 'backend', status: 'idle' })).toEqual(AGENT) })
  it('update updates agent fields', async () => { const updated = { ...AGENT, status: 'working' }; mockQuery.mockResolvedValue(makeRows([updated])); expect(await agentDb.update(AGENT.id, { status: 'working' })).toEqual(updated) })
  it('update returns undefined when agent not found', async () => { mockQuery.mockResolvedValue(makeRows([])); expect(await agentDb.update(AGENT.id, { status: 'idle' })).toBeUndefined() })
  it('delete returns true when deleted', async () => { mockQuery.mockResolvedValue(makeRows([], 1)); expect(await agentDb.delete(AGENT.id)).toBe(true) })
})

describe('taskDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findById returns task when found', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); expect((await taskDb.findById(TASK.id))?.id).toBe(TASK.id) })
  it('findById maps snake_case to camelCase', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); const r = await taskDb.findById(TASK.id); expect(r).toHaveProperty('assignedTo'); expect(r).toHaveProperty('projectId') })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await taskDb.findById('bad')).toBeUndefined() })
  it('findAll returns all tasks without filters', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); expect((await taskDb.findAll()).length).toBeGreaterThan(0) })
  it('findAll filters by status', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); await taskDb.findAll({ status: 'pending' }); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('status ='), expect.arrayContaining(['pending'])) })
  it('findAll filters by assignedTo with valid UUID', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); await taskDb.findAll({ assignedTo: AGENT.id }); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('assigned_to'), expect.arrayContaining([AGENT.id])) })
  it('findAll returns [] for invalid assignedTo UUID', async () => { expect(await taskDb.findAll({ assignedTo: 'not-a-uuid' })).toEqual([]); expect(mockQuery).not.toHaveBeenCalled() })
  it('create inserts task', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); expect(await taskDb.create({ title: 'Build API', type: 'feature' })).toBeDefined() })
  it('create sets null for invalid assignedTo UUID', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); await taskDb.create({ title: 'T', type: 'x', assignedTo: 'bad' }); expect(mockQuery.mock.calls[0][1]).toContain(null) })
  it('update sets completed_at when status becomes completed', async () => { mockQuery.mockResolvedValue(makeRows([{ ...TASK, status: 'completed' }])); await taskDb.update(TASK.id, { status: 'completed' }); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('completed_at = CASE'), expect.any(Array)) })
  it('update returns undefined when task not found', async () => { mockQuery.mockResolvedValue(makeRows([])); expect(await taskDb.update(TASK.id, { title: 'New' })).toBeUndefined() })
  it('delete returns true when deleted', async () => { mockQuery.mockResolvedValue(makeRows([], 1)); expect(await taskDb.delete(TASK.id)).toBe(true) })
  it('findSubtasks returns subtasks', async () => { mockQuery.mockResolvedValue(makeRows([TASK])); expect((await taskDb.findSubtasks(TASK.id))).toBeInstanceOf(Array); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('project_id'), [TASK.id]) })
})

describe('projectDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findById returns project when found', async () => { mockQuery.mockResolvedValue(makeRows([PROJECT])); expect(await projectDb.findById(PROJECT.id)).toEqual(PROJECT) })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await projectDb.findById('bad')).toBeUndefined() })
  it('findAll excludes deleted projects and orders by updated_at', async () => { mockQuery.mockResolvedValue(makeRows([PROJECT])); await projectDb.findAll(); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('status !='), expect.arrayContaining(['deleted'])) })
  it('findAll filters by owner_id when userId provided', async () => { mockQuery.mockResolvedValue(makeRows([PROJECT])); await projectDb.findAll(USER.id); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('owner_id'), expect.arrayContaining([USER.id])) })
  it('create inserts and returns project', async () => { mockQuery.mockResolvedValue(makeRows([PROJECT])); expect(await projectDb.create({ name: 'My Project', owner_id: USER.id })).toEqual(PROJECT) })
  it('update updates project fields', async () => { const updated = { ...PROJECT, name: 'New Name' }; mockQuery.mockResolvedValue(makeRows([updated])); expect(await projectDb.update(PROJECT.id, { name: 'New Name' })).toEqual(updated) })
  it('update returns undefined when project not found', async () => { mockQuery.mockResolvedValue(makeRows([])); expect(await projectDb.update(PROJECT.id, { name: 'X' })).toBeUndefined() })
  it('delete returns true when deleted', async () => { mockQuery.mockResolvedValue(makeRows([], 1)); expect(await projectDb.delete(PROJECT.id)).toBe(true) })
})

describe('chatSessionDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findById returns session when found', async () => { mockQuery.mockResolvedValue(makeRows([SESSION])); expect(await chatSessionDb.findById(SESSION.id)).toEqual(SESSION) })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await chatSessionDb.findById('bad')).toBeUndefined() })
  it('findAllByUser queries by user_id AND status=active', async () => { mockQuery.mockResolvedValue(makeRows([SESSION])); await chatSessionDb.findAllByUser(USER.id); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('user_id'), expect.arrayContaining([USER.id, 'active'])) })
  it('create inserts session with user_id and project_id', async () => { mockQuery.mockResolvedValue(makeRows([SESSION])); expect(await chatSessionDb.create({ userId: USER.id, projectId: null, title: 'Chat' })).toEqual(SESSION) })
  it('update returns updated session', async () => { const updated = { ...SESSION, status: 'archived' }; mockQuery.mockResolvedValue(makeRows([updated])); expect(await chatSessionDb.update(SESSION.id, { status: 'archived' })).toEqual(updated) })
  it('delete returns true when deleted', async () => { mockQuery.mockResolvedValue(makeRows([], 1)); expect(await chatSessionDb.delete(SESSION.id)).toBe(true) })
})

describe('chatMessageDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findBySession returns messages in reverse order', async () => { mockQuery.mockResolvedValue(makeRows([MESSAGE])); expect(await chatMessageDb.findBySession(SESSION.id)).toBeInstanceOf(Array) })
  it('findBySession respects limit and offset', async () => { mockQuery.mockResolvedValue(makeRows([MESSAGE])); await chatMessageDb.findBySession(SESSION.id, 20, 10); const call = mockQuery.mock.calls[0]; expect(call[0]).toContain('LIMIT'); expect(call[0]).toContain('OFFSET'); expect(call[1]).toContain(SESSION.id); expect(call[1]).toContain(20); expect(call[1]).toContain(10) })
  it('create inserts message with metadata field', async () => { mockQuery.mockResolvedValue(makeRows([MESSAGE])); const result = await chatMessageDb.create({ sessionId: SESSION.id, role: 'user', content: 'hello', metadata: { foo: 'bar' } }); expect(result).toEqual(MESSAGE) })
})

describe('agentTaskDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('findBySession returns agent tasks', async () => { mockQuery.mockResolvedValue(makeRows([AGENT_TASK])); expect(await agentTaskDb.findBySession(SESSION.id)).toEqual([AGENT_TASK]) })
  it('findById returns agent task', async () => { mockQuery.mockResolvedValue(makeRows([AGENT_TASK])); expect(await agentTaskDb.findById(AGENT_TASK.id)).toEqual(AGENT_TASK) })
  it('findById returns undefined on UUID error', async () => { mockQuery.mockRejectedValue(uuidErr()); expect(await agentTaskDb.findById('bad')).toBeUndefined() })
  it('create inserts agent task', async () => { mockQuery.mockResolvedValue(makeRows([AGENT_TASK])); expect(await agentTaskDb.create({ sessionId: SESSION.id, ticketId: 'TK-001', workerRole: 'backend' })).toEqual(AGENT_TASK) })
  it('update returns updated agent task', async () => { const updated = { ...AGENT_TASK, status: 'running' }; mockQuery.mockResolvedValue(makeRows([updated])); expect(await agentTaskDb.update(AGENT_TASK.id, { status: 'running' })).toEqual(updated) })
})

describe('logDb', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('getLogs returns string array', async () => { mockQuery.mockResolvedValue({ rows: [{ message: 'started' }], rowCount: 1 }); const result = await logDb.getLogs(AGENT.id); expect(result).toEqual(['started']); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('agent_id'), [AGENT.id, 100]) })
  it('getLogs respects limit parameter', async () => { mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); await logDb.getLogs(AGENT.id, 50); expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [AGENT.id, 50]) })
  it('addLog inserts log entry', async () => { mockQuery.mockResolvedValue(makeRows([])); await logDb.addLog(AGENT.id, 'test message', 'info'); expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO agent_logs'), expect.arrayContaining([AGENT.id, 'test message', 'info'])) })
  it('addLog defaults level to info', async () => { mockQuery.mockResolvedValue(makeRows([])); await logDb.addLog(AGENT.id, 'test'); expect(mockQuery.mock.calls[0][1][2]).toBe('info') })
  it('clearLogs returns void', async () => { mockQuery.mockResolvedValue(makeRows([], 5)); const result = await logDb.clearLogs(AGENT.id); expect(result).toBeUndefined() })
})
