// Ollama Provider - 本地 LLM 支持
import { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMToolDefinition } from '../types.js'
import { Logger } from '../../../utils/logger.js'

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

export class OllamaProvider implements ILLMProvider {
  readonly name = 'ollama'
  private baseUrl: string
  private model: string
  private defaultOptions: Partial<LLMCompletionOptions>
  private logger: Logger

  constructor(config: { baseUrl?: string; model: string; defaultOptions?: Partial<LLMCompletionOptions> }) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434'
    this.model = config.model
    this.defaultOptions = config.defaultOptions || {}
    this.logger = new Logger('OllamaProvider')
  }

  getModel(): string {
    return this.model
  }

  setModel(model: string): void {
    this.model = model
  }

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      // 将消息转换为 Ollama 格式
      const ollamaMessages = this.convertMessages(messages)
      
      // 提取系统消息
      const systemMessage = messages.find(m => m.role === 'system')?.content

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          system: systemMessage,
          stream: false,
          options: {
            temperature: opts.temperature ?? 0.7,
            num_predict: opts.maxTokens || 4096,
            top_p: opts.topP ?? 0.9,
            stop: opts.stop,
          }
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${response.status} ${error}`)
      }

      const data = await response.json() as any
      
      return {
        content: data.message?.content || '',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: this.model
      }
    } catch (error) {
      this.logger.error('Ollama completion failed', { error })
      throw error
    }
  }

  async *stream(messages: LLMMessage[], options: LLMCompletionOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      // 将消息转换为 Ollama 格式
      const ollamaMessages = this.convertMessages(messages)
      
      // 提取系统消息
      const systemMessage = messages.find(m => m.role === 'system')?.content

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          system: systemMessage,
          stream: true,
          options: {
            temperature: opts.temperature ?? 0.7,
            num_predict: opts.maxTokens || 4096,
            top_p: opts.topP ?? 0.9,
            stop: opts.stop,
          }
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${response.status} ${error}`)
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
                yield {
                  content: event.message.content,
                  done: false
                }
              }
              
              // 检查是否完成
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
              // Ignore parse errors for malformed chunks
              this.logger.debug('Parse error', { line, error: e })
            }
          }
        }
      }

      yield { done: true }
    } catch (error) {
      this.logger.error('Ollama stream failed', { error })
      throw error
    }
  }

  // 检查 Ollama 是否可用
  async checkConnection(): Promise<{ available: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      })

      if (!response.ok) {
        return { 
          available: false, 
          error: `Ollama returned ${response.status}` 
        }
      }

      const data = await response.json() as any
      const models = data.models?.map((m: any) => m.name) || []
      
      return {
        available: true,
        models
      }
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Ollama'
      }
    }
  }

  // 列出可用模型
  async listModels(): Promise<string[]> {
    const result = await this.checkConnection()
    return result.models || []
  }

  private convertMessages(messages: LLMMessage[]): OllamaMessage[] {
    return messages
      .filter(m => m.role !== 'system') // system 通过单独的参数传递
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
  }

  private convertTools(tools: LLMToolDefinition[]): OllamaTool[] {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }
    }))
  }
}
