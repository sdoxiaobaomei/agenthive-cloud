// LLM 服务类型定义

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: LLMToolCall[]
  toolResults?: LLMToolResult[]
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMToolResult {
  toolCallId: string
  output: string
  error?: string
}

export interface LLMCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stop?: string[]
  tools?: LLMToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
}

export interface LLMToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

export interface LLMCompletionResult {
  content: string
  toolCalls?: LLMToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
}

export interface LLMStreamChunk {
  content?: string
  toolCalls?: LLMToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  done: boolean
}

export interface LLMProviderConfig {
  provider: 'anthropic' | 'openai' | 'ollama' | 'custom'
  apiKey?: string
  baseUrl?: string
  model: string
  defaultOptions?: Partial<LLMCompletionOptions>
}

export interface ILLMProvider {
  readonly name: string
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk>
  getModel(): string
  setModel(model: string): void
}
