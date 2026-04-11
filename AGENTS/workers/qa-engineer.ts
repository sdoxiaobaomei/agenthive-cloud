#!/usr/bin/env node
/**
 * QA Engineer Worker (阿镜)
 *
 * 演进：在静态审查基础上，增加真实测试执行（npm run type-check / test:unit）
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { runWorker } from './_base.js'
import { readFile, exists } from '../tools/file-tools.js'
import type { LLMClient } from '../tools/llm-client.js'
import type { Ticket } from './_base.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const promptPath = path.join(__dirname, '../shared/prompts/system-qa-engineer.md')
const ticketPath = process.argv[2]

if (!ticketPath) {
  console.error('Usage: tsx workers/qa-engineer.ts <ticket.json>')
  process.exit(1)
}

interface QAResult {
  review_summary: string
  status: 'approved' | 'rejected'
  issues: {
    severity: 'critical' | 'warning' | 'suggestion'
    file: string
    line?: number
    description: string
    suggestion: string
  }[]
  notes: string
}

runWorker(ticketPath, promptPath, async (client, ticket, workspaceRepo, systemPrompt) => {
  const filesContent: string[] = []
  for (const relPath of ticket.context.relevant_files || []) {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceRepo, relPath.replace(/^agenthive-cloud\//, ''))
    if (await exists(fullPath)) {
      const content = await readFile(fullPath)
      filesContent.push(`### ${relPath}\n\`\`\`\n${content}\n\`\`\``)
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Step 3: 真实测试执行
  // ───────────────────────────────────────────────────────────────
  let testOutput = ''
  let testCommand = ''

  // 优先尝试 type-check（更快，覆盖率更高），如果 package.json 有 test:unit 则也跑
  const hasPackageJson = await exists(path.join(workspaceRepo, 'package.json'))

  if (hasPackageJson) {
    // 尝试 type-check
    try {
      testCommand = 'npm run type-check'
      testOutput += `\n--- ${testCommand} ---\n`
      testOutput += execSync('npm run type-check', {
        cwd: workspaceRepo,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000,
      })
      testOutput += '\n✅ type-check passed\n'
    } catch (e: any) {
      testOutput += `\n❌ type-check failed:\n${e.stdout || ''}${e.stderr || ''}${e.message || ''}\n`
    }

    // 尝试 test:unit（如果存在脚本）
    try {
      const pkg = JSON.parse(await readFile(path.join(workspaceRepo, 'package.json')))
      if (pkg.scripts && pkg.scripts['test:unit']) {
        testCommand = 'npm run test:unit'
        testOutput += `\n--- ${testCommand} ---\n`
        testOutput += execSync('npm run test:unit', {
          cwd: workspaceRepo,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 120000,
        })
        testOutput += '\n✅ test:unit passed\n'
      }
    } catch (e: any) {
      testOutput += `\n❌ test:unit failed:\n${e.stdout || ''}${e.stderr || ''}${e.message || ''}\n`
    }
  }

  const prompt = [
    `## Review Task\n${ticket.task}`,
    `## Constraints\n${(ticket.context.constraints || []).join('\n') || 'None'}`,
    `## Files to Review\n${filesContent.join('\n\n')}`,
    `## Test Execution Results\n${testOutput || 'No tests were run.'}`,
    `\n请综合代码审查和上述测试结果给出最终评价。如果测试失败（type-check 或 test:unit），请视为需要修复的问题。`,
  ].join('\n\n')

  const res = await client.chatJson<QAResult>([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ])

  // 如果测试有失败，但 LLM 没有报出来，强制补充一个 critical issue
  const hasTestFailures = testOutput.includes('❌')
  if (hasTestFailures && res.status === 'approved') {
    console.warn('⚠️  测试存在失败，但 LLM 返回 approved，强制改为 rejected')
    res.status = 'rejected'
    res.issues.push({
      severity: 'critical',
      file: 'N/A',
      description: '自动化测试未通过（type-check 或 test:unit）',
      suggestion: '请修复上述测试输出中的错误后重新提交',
    })
  }

  // QA does not modify files, just returns review result
  return res
})
