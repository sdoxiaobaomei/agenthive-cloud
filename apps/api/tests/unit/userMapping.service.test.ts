// UserMapping Service 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 依赖
vi.mock('../../src/utils/database.js', () => ({
  userDb: {
    findByExternalId: vi.fn(),
    findByUsername: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    request: vi.fn(),
  },
}))

import { userDb } from '../../src/utils/database.js'
import { resolveLocalUser } from '../../src/services/userMapping.js'

const mockFindByExternalId = userDb.findByExternalId as ReturnType<typeof vi.fn>
const mockFindByUsername = userDb.findByUsername as ReturnType<typeof vi.fn>
const mockUpdate = userDb.update as ReturnType<typeof vi.fn>
const mockCreate = userDb.create as ReturnType<typeof vi.fn>

describe('UserMapping Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveLocalUser', () => {
    it('应通过 externalId 找到已有用户并返回', async () => {
      const existingUser = {
        id: 'uuid-123',
        username: 'alice',
        email: 'alice@agenthive.com',
        phone: '13800138000',
        role: 'admin',
        external_user_id: '42',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      mockFindByExternalId.mockResolvedValue(existingUser)

      const result = await resolveLocalUser({
        externalId: '42',
        username: 'alice',
        role: 'admin',
      })

      expect(result.id).toBe('uuid-123')
      expect(result.username).toBe('alice')
      expect(mockFindByExternalId).toHaveBeenCalledWith('42')
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('找到用户时应同步更新变化的字段', async () => {
      const existingUser = {
        id: 'uuid-123',
        username: 'alice',
        email: 'alice@old.com',
        phone: '13800138000',
        role: 'admin',
        avatar: 'https://cdn.agenthive.com/avatars/alice.png',
        external_user_id: '42',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      const updatedUser = { ...existingUser, email: 'alice@new.com' }
      mockFindByExternalId.mockResolvedValue(existingUser)
      mockUpdate.mockResolvedValue(updatedUser)

      const result = await resolveLocalUser({
        externalId: '42',
        username: 'alice',
        email: 'alice@new.com',
        role: 'admin',
      })

      expect(mockUpdate).toHaveBeenCalledWith('uuid-123', { email: 'alice@new.com' })
      expect(result.email).toBe('alice@new.com')
    })

    it('字段未变化时不应调用 update', async () => {
      const existingUser = {
        id: 'uuid-123',
        username: 'alice',
        email: 'alice@agenthive.com',
        role: 'admin',
        external_user_id: '42',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      mockFindByExternalId.mockResolvedValue(existingUser)

      await resolveLocalUser({
        externalId: '42',
        username: 'alice',
        email: 'alice@agenthive.com',
        role: 'admin',
      })

      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('应通过 username 关联已有本地用户（迁移兼容）', async () => {
      const localUser = {
        id: 'uuid-456',
        username: 'bob',
        email: 'bob@agenthive.com',
        role: 'user',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      const linkedUser = { ...localUser, external_user_id: '99' }
      mockFindByExternalId.mockResolvedValue(undefined)
      mockFindByUsername.mockResolvedValue(localUser)
      mockUpdate.mockResolvedValue(linkedUser)

      const result = await resolveLocalUser({
        externalId: '99',
        username: 'bob',
        role: 'user',
      })

      expect(result.id).toBe('uuid-456')
      expect(mockUpdate).toHaveBeenCalledWith('uuid-456', { external_user_id: '99' })
    })

    it('externalId 和 username 都找不到时应创建新用户', async () => {
      const newUser = {
        id: 'uuid-new',
        username: 'user_000042',
        role: 'user',
        external_user_id: '42',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      mockFindByExternalId.mockResolvedValue(undefined)
      mockFindByUsername.mockResolvedValue(undefined)
      mockCreate.mockResolvedValue(newUser)

      const result = await resolveLocalUser({
        externalId: '42',
        role: 'user',
      })

      expect(result.id).toBe('uuid-new')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'user_42',
          role: 'user',
          external_user_id: '42',
        })
      )
    })

    it('创建新用户时应使用提供的 username 和可选字段', async () => {
      const newUser = {
        id: 'uuid-new-2',
        username: 'charlie',
        email: 'charlie@agenthive.com',
        phone: '13900139000',
        role: 'developer',
        avatar: 'https://cdn.agenthive.com/avatars/charlie.png',
        external_user_id: '100',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }
      mockFindByExternalId.mockResolvedValue(undefined)
      mockFindByUsername.mockResolvedValue(undefined)
      mockCreate.mockResolvedValue(newUser)

      const result = await resolveLocalUser({
        externalId: '100',
        username: 'charlie',
        email: 'charlie@agenthive.com',
        phone: '13900139000',
        role: 'developer',
        avatar: 'https://cdn.agenthive.com/avatars/charlie.png',
      })

      expect(result.username).toBe('charlie')
      expect(mockCreate).toHaveBeenCalledWith({
        username: 'charlie',
        email: 'charlie@agenthive.com',
        phone: '13900139000',
        role: 'developer',
        avatar: 'https://cdn.agenthive.com/avatars/charlie.png',
        external_user_id: '100',
      })
    })
  })
})
