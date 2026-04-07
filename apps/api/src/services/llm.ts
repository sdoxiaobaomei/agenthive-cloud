// LLM Service - 支持 Ollama 本地模型 和 OpenAI 兼容 API (阿里云百炼等)
import type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamChunk,
  LLMToolDefinition,
} from '@agenthive/agent-runtime'

// Provider 类型
interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk>
}

// OpenAI 兼容配置
interface OpenAIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

// Ollama 配置
interface OllamaConfig {
  baseUrl: string
  model: string
}

// OpenAI Provider 实现（兼容阿里云百炼、OpenAI等）
class OpenAIProvider implements LLMProvider {
  private config: OpenAIConfig
  
  constructor(config: OpenAIConfig) {
    this.config = config
  }

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ 
          role: m.role, 
          content: m.content,
          ...(m.tool_calls && { tool_calls: m.tool_calls }),
          ...(m.tool_call_id && { tool_call_id: m.tool_call_id })
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model || this.config.model
    }
  }

  async *stream(messages: LLMMessage[], options: LLMCompletionOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ 
          role: m.role, 
          content: m.content 
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            yield { done: true }
            return
          }
          try {
            const event = JSON.parse(data)
            const content = event.choices?.[0]?.delta?.content
            if (content) {
              yield { content, done: false }
            }
            if (event.usage) {
              yield {
                usage: {
                  promptTokens: event.usage.prompt_tokens || 0,
                  completionTokens: event.usage.completion_tokens || 0,
                  totalTokens: event.usage.total_tokens || 0
                },
                done: true
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    yield { done: true }
  }
}

// Ollama Provider 实现
class OllamaProvider implements LLMProvider {
  private config: OllamaConfig
  
  constructor(config: OllamaConfig) {
    this.config = config
  }

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const systemMessage = messages.find(m => m.role === 'system')?.content
    const chatMessages = messages.filter(m => m.role !== 'system')
    
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemMessage,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens || 4096,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`)
    }

    const data = await response.json()
    
    return {
      content: data.message?.content || '',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      model: this.config.model
    }
  }

  async *stream(messages: LLMMessage[], options: LLMCompletionOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const systemMessage = messages.find(m => m.role === 'system')?.content
    const chatMessages = messages.filter(m => m.role !== 'system')
    
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemMessage,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens || 4096,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line)
            if (event.message?.content) {
              yield { content: event.message.content, done: false }
            }
            if (event.done) {
              yield { 
                usage: {
                  promptTokens: event.prompt_eval_count || 0,
                  completionTokens: event.eval_count || 0,
                  totalTokens: (event.prompt_eval_count || 0) + (event.eval_count || 0)
                },
                done: true 
              }
              return
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    yield { done: true }
  }
}

// 创建 Provider
function createProvider(): LLMProvider {
  // 优先使用 OpenAI 兼容 API（阿里云百炼等）
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL
  const model = process.env.LLM_MODEL

  if (apiKey && baseUrl && model) {
    console.log(`[LLM] Using OpenAI-compatible API: ${baseUrl}, model: ${model}`)
    return new OpenAIProvider({ apiKey, baseUrl, model })
  }

  // 回退到 Ollama
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:14b'
  console.log(`[LLM] Using Ollama: ${ollamaUrl}, model: ${ollamaModel}`)
  return new OllamaProvider({ baseUrl: ollamaUrl, model: ollamaModel })
}

// LLM Service
class LLMService {
  private provider: LLMProvider
  
  constructor() {
    this.provider = createProvider()
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    return this.provider.complete(messages, options)
  }

  async *stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk> {
    yield* this.provider.stream(messages, options)
  }
}

// 全局实例
let globalLLMService: LLMService | null = null

// 检查连接
export async function checkLLMConnection(): Promise<{ ok: boolean; provider: string; models?: string[]; error?: string }> {
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL
  const model = process.env.LLM_MODEL

  // 检查 OpenAI 兼容 API
  if (apiKey && baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      
      if (!response.ok) {
        return { 
          ok: false, 
          provider: 'openai',
          error: `API returned ${response.status}` 
        }
      }
      
      const data = await response.json()
      const models = data.data?.map((m: any) => m.id) || []
      
      return { 
        ok: true, 
        provider: 'openai',
        models,
        error: model && !models.includes(model) 
          ? `Configured model '${model}' not in available models` 
          : undefined
      }
    } catch (error) {
      return { 
        ok: false, 
        provider: 'openai',
        error: error instanceof Error ? error.message : 'Failed to connect to API' 
      }
    }
  }

  // 检查 Ollama
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`)
    
    if (!response.ok) {
      return { 
        ok: false, 
        provider: 'ollama',
        error: `Ollama returned ${response.status}` 
      }
    }
    
    const data = await response.json()
    const models = data.models?.map((m: any) => m.name) || []
    const configuredModel = process.env.OLLAMA_MODEL || 'qwen3:14b'
    
    return { 
      ok: true, 
      provider: 'ollama',
      models,
      error: !models.includes(configuredModel) 
        ? `Model '${configuredModel}' not found` 
        : undefined
    }
  } catch (error) {
    return { 
      ok: false, 
      provider: 'ollama',
      error: error instanceof Error ? error.message : 'Failed to connect to Ollama' 
    }
  }
}

// 初始化
export async function initLLM(): Promise<void> {
  const check = await checkLLMConnection()
  
  if (check.ok) {
    console.log(`[LLM] Connected to ${check.provider}. Available models: ${check.models?.slice(0, 5).join(', ')}...`)
  } else {
    console.warn(`[LLM] Connection check: ${check.error}`)
    console.warn(`[LLM] Will retry on first request`)
  }
  
  globalLLMService = new LLMService()
  console.log(`[LLM] LLM Service initialized`)
}

// 获取服务实例
export function getLLMService(): LLMService {
  if (!globalLLMService) {
    globalLLMService = new LLMService()
  }
  return globalLLMService
}

// 导出类型
export type { LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMToolDefinition }
