// 用户映射服务：将 Java auth-service 用户映射到 API 本地用户
import { userDb } from '../utils/database.js'
import logger from '../utils/logger.js'
import type { User } from '../types/index.js'

export interface ExternalUser {
  externalId: string
  username?: string
  role?: string
  avatar?: string
  email?: string
  phone?: string
}

/**
 * 根据外部用户身份查找或创建本地映射用户
 * 解决 Java Long ID 与 API UUID 的兼容问题
 */
export async function resolveLocalUser(externalUser: ExternalUser): Promise<User> {
  const { externalId, username, role, avatar, email, phone } = externalUser

  // 1. 通过 external_user_id 查找
  let user = await userDb.findByExternalId(externalId)
  if (user) {
    // 同步更新可能变化的字段
    const updates: Partial<User> = {}
    if (username && username !== user.username) updates.username = username
    if (email && email !== user.email) updates.email = email
    if (phone && phone !== user.phone) updates.phone = phone
    if (avatar && avatar !== user.avatar) updates.avatar = avatar

    if (Object.keys(updates).length > 0) {
      const updated = await userDb.update(user.id, updates)
      if (updated) user = updated
    }
    return user
  }

  // 2. 迁移期兼容：通过 username 关联已有用户
  if (username) {
    user = await userDb.findByUsername(username)
    if (user) {
      logger.info('Linking existing local user to Java auth user', {
        localId: user.id,
        externalId,
        username,
      })
      const updated = await userDb.update(user.id, { external_user_id: externalId })
      if (updated) user = updated
      return user
    }
  }

  // 3. 创建新的本地映射用户
  logger.info('Creating local user mapping for external user', { externalId, username })
  return await userDb.create({
    username: username || `user_${externalId.slice(-6)}`,
    email,
    phone,
    role: role || 'user',
    avatar,
    external_user_id: externalId,
  })
}
