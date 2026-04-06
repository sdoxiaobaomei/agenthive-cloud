// Anthropic Claude Provider
import { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMToolDefinition } from '../types.js'
import { Logger } from '../../../utils/logger.js'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: any } | { type: 'tool_result'; tool_use_id: string; content: string }>
}

interface AnthropicTool {
  name: string
  description: string
  input_schema: object
}

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic'
  private apiKey: string
  private baseUrl: string
  private model: string
  private defaultOptions: Partial<LLMCompletionOptions>
  private logger: Logger

  constructor(config: { apiKey: string; baseUrl?: string; model: string; defaultOptions?: Partial<LLMCompletionOptions> }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com'
    this.model = config.model
    this.defaultOptions = config.defaultOptions || {}
    this.logger = new Logger('AnthropicProvider')
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
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7,
          top_p: opts.topP,
          stop_sequences: opts.stop,
          tools: opts.tools ? this.convertTools(opts.tools) : undefined
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error: ${response.status} ${error}`)
      }

      const data = await response.json()
      
      return {
        content: this.extractContent(data),
        toolCalls: this.extractToolCalls(data),
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        model: data.model
      }
    } catch (error) {
      this.logger.error('Anthropic completion failed', { error })
      throw error
    }
  }

  async *stream(messages: LLMMessage[], options: LLMCompletionOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7,
          top_p: opts.topP,
          stop_sequences: opts.stop,
          tools: opts.tools ? this.convertTools(opts.tools) : undefined,
          stream: true
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error: ${response.status} ${error}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentToolCalls: LLMStreamChunk['toolCalls'] = []

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
              
              if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                  yield {
                    content: event.delta.text,
                    done: false
                  }
                }
              } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                currentToolCalls = [{
                  id: event.content_block.id,
                  type: 'function',
                  function: {
                    name: event.content_block.name,
                    arguments: JSON.stringify(event.content_block.input)
                  }
                }]
              }
            } catch (e) {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }

      if (currentToolCalls.length > 0) {
        yield {
          toolCalls: currentToolCalls,
          done: true
        }
      } else {
        yield { done: true }
      }
    } catch (error) {
      this.logger.error('Anthropic stream failed', { error })
      throw error
    }
  }

  private convertMessages(messages: LLMMessage[]): AnthropicMessage[] {
    // Anthropic 使用 system 参数，不从 messages 中提取
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
  }

  private convertTools(tools: LLMToolDefinition[]): AnthropicTool[] {
    return tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }))
  }

  private extractContent(data: any): string {
    if (!data.content) return ''
    return data.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
  }

  private extractToolCalls(data: any): LLMCompletionResult['toolCalls'] {
    if (!data.content) return undefined
    const toolUses = data.content.filter((c: any) => c.type === 'tool_use')
    if (toolUses.length === 0) return undefined

    return toolUses.map((t: any) => ({
      id: t.id,
      type: 'function' as const,
      function: {
        name: t.name,
        arguments: JSON.stringify(t.input)
      }
    }))
  }
}
