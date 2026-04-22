// OpenAI / Compatible Provider
import { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk } from '../types.js'
import { Logger } from '../../../utils/logger.js'

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai'
  private apiKey: string
  private baseUrl: string
  private model: string
  private defaultOptions: Partial<LLMCompletionOptions>
  private logger: Logger

  constructor(config: { apiKey: string; baseUrl?: string; model: string; defaultOptions?: Partial<LLMCompletionOptions> }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.openai.com'
    this.model = config.model
    this.defaultOptions = config.defaultOptions || {}
    this.logger = new Logger('OpenAIProvider')
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
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature ?? 0.7,
          top_p: opts.topP,
          stop: opts.stop,
          tools: opts.tools,
          tool_choice: opts.toolChoice
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${error}`)
      }

      const data = await response.json() as any
      const choice = data.choices[0]
      
      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls?.map((t: any) => ({
          id: t.id,
          type: 'function',
          function: {
            name: t.function.name,
            arguments: t.function.arguments
          }
        })),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model
      }
    } catch (error) {
      this.logger.error('OpenAI completion failed', { error })
      throw error
    }
  }

  async *stream(messages: LLMMessage[], options: LLMCompletionOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature ?? 0.7,
          top_p: opts.topP,
          stop: opts.stop,
          tools: opts.tools,
          tool_choice: opts.toolChoice,
          stream: true
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${error}`)
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
              const delta = event.choices[0]?.delta
              
              if (delta?.content) {
                yield {
                  content: delta.content,
                  done: false
                }
              }
              
              if (delta?.tool_calls) {
                yield {
                  toolCalls: delta.tool_calls.map((t: any) => ({
                    id: t.id,
                    type: 'function',
                    function: {
                      name: t.function?.name || '',
                      arguments: t.function?.arguments || ''
                    }
                  })),
                  done: false
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      yield { done: true }
    } catch (error) {
      this.logger.error('OpenAI stream failed', { error })
      throw error
    }
  }

  private convertMessages(messages: LLMMessage[]): any[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  }
}
