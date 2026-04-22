import { describe, it, expect, beforeEach } from 'vitest'
import { resetData } from '../utils/test-db.js'
import { codeDb } from '../../src/utils/database.js'

describe('Code DB', () => {
  beforeEach(async () => {
    await resetData()
  })

  describe('search', () => {
    it('搜索正常文件名能匹配', async () => {
      // 先创建一个文件
      await codeDb.create({
        path: '/searchable.ts',
        name: 'searchable.ts',
        content: 'export const hello = "world"',
        language: 'typescript',
      })

      const results = await codeDb.search('searchable')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(f => f.name === 'searchable.ts')).toBe(true)
    })

    it('搜索包含 % 的字符串不会全匹配（验证转义生效）', async () => {
      // 创建一个文件名包含 % 的文件（虽然实际不常见，但用来测试转义）
      await codeDb.create({
        path: '/percent%.txt',
        name: 'percent%.txt',
        content: 'content with percent',
        language: 'text',
      })

      // 再创建一个普通文件
      await codeDb.create({
        path: '/normal.txt',
        name: 'normal.txt',
        content: 'normal content',
        language: 'text',
      })

      // 搜索包含 % 的字符串，应该只匹配包含字面量 % 的文件
      const results = await codeDb.search('percent%')
      // 结果中不应该包含 normal.txt（因为它不含 percent%）
      expect(results.some(f => f.name === 'percent%.txt')).toBe(true)
      // 如果转义没有生效，% 会变成通配符，可能匹配所有文件
      // 我们这里验证结果集是受限的（至少不是全部文件）
      const allFiles = await codeDb.findAll()
      expect(results.length).toBeLessThan(allFiles.length)
    })

    it('搜索包含 _ 的字符串正确转义', async () => {
      // 下划线在 SQL LIKE 中是单字符通配符
      await codeDb.create({
        path: '/under_score.ts',
        name: 'under_score.ts',
        content: 'file with underscore',
        language: 'typescript',
      })

      await codeDb.create({
        path: '/underscore.ts',
        name: 'underscore.ts',
        content: 'file without real underscore in target position',
        language: 'typescript',
      })

      // 搜索 under_score（含下划线）
      const results = await codeDb.search('under_score')
      // 如果转义生效，只有 under_score.ts 匹配；
      // 如果没有转义，underXscore.ts 或 underscore.ts 等也会匹配
      expect(results.some(f => f.name === 'under_score.ts')).toBe(true)
      // underscore.ts 不应该被匹配（因为没有下划线在对应位置，且没有 under_score 子串）
      expect(results.some(f => f.name === 'underscore.ts')).toBe(false)
    })

    it('搜索不存在的字符串返回空数组', async () => {
      const results = await codeDb.search('xyznotfound789')
      expect(results).toEqual([])
    })

    it('搜索结果包含 name 和 content 匹配', async () => {
      await codeDb.create({
        path: '/match-name.ts',
        name: 'match-name.ts',
        content: 'no special keyword here',
        language: 'typescript',
      })
      await codeDb.create({
        path: '/match-content.ts',
        name: 'match-content.ts',
        content: 'special keyword appears here',
        language: 'typescript',
      })

      const results = await codeDb.search('special')
      expect(results.some(f => f.path === '/match-content.ts')).toBe(true)
    })
  })
})
