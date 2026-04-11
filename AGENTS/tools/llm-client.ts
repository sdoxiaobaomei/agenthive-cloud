/**
 * Generic OpenAI-compatible LLM client.
 * Defaults to DashScope (Qwen) but works with any OpenAI-compatible endpoint.
 */

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class LLMClient {
  private baseUrl: string
  private apiKey: string
  private model: string

  constructor() {
    this.baseUrl = (process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
    this.apiKey = process.env.LLM_API_KEY || ''
    this.model = process.env.LLM_MODEL || 'qwen-coder-plus-latest'

    if (!this.apiKey) {
      throw new Error('LLM_API_KEY is not set. Please copy .env.example to .env and fill your key.')
    }
  }

  async chat(
    messages: Message[],
    options: { temperature?: number; response_format?: { type: 'json_object' } } = {}
  ): Promise<LLMResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        ...(options.response_format ? { response_format: options.response_format } : {}),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LLM API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as any
    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('LLM returned no choices')
    }

    return {
      content: choice.message?.content || '',
      usage: data.usage,
    }
  }

  /**
   * Convenience wrapper that forces JSON output.
   */
  async chatJson<T>(messages: Message[], temperature = 0.2): Promise<T> {
    const res = await this.chat(messages, {
      temperature,
      response_format: { type: 'json_object' },
    })
    try {
      return JSON.parse(res.content) as T
    } catch (e) {
      console.error('Failed to parse LLM response as JSON:\n', res.content)
      throw e
    }
  }
}
