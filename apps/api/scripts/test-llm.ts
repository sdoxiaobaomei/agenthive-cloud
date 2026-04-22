/**
 * Test LLM connectivity to Ollama qwen3:14b
 *
 * Run: cd apps/api && npx tsx scripts/test-llm.ts
 */

import { checkLLMConnection, getLLMService, initLLM } from '../src/services/llm.js'

async function main() {
  console.log('[TestLLM] Checking LLM connectivity...')

  // Check connection
  const check = await checkLLMConnection()
  console.log('[TestLLM] Connection check:', JSON.stringify(check, null, 2))

  if (!check.ok) {
    console.error('[TestLLM] LLM is not accessible:', check.error)
    process.exit(1)
  }

  // Initialize
  await initLLM()

  // Test a simple completion
  const llm = getLLMService()
  const response = await llm.complete([
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say "Ollama qwen3:14b is ready" and nothing else.' },
  ])

  console.log('[TestLLM] Completion response:', response.content)
  console.log('[TestLLM] Model:', response.model)
  console.log('[TestLLM] Usage:', response.usage)

  if (response.content.toLowerCase().includes('ready')) {
    console.log('[TestLLM] ✅ LLM test passed!')
  } else {
    console.warn('[TestLLM] ⚠️ Unexpected response, but LLM is accessible.')
  }
}

main().catch((err) => {
  console.error('[TestLLM] Test failed:', err)
  process.exit(1)
})
