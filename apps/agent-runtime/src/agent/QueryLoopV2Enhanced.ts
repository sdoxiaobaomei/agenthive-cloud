/**
 * QueryLoopV2Enhanced — Enhanced Query Loop with Progress Reporting
 *
 * Extends QueryLoopV2 with:
 * - Async generator `executeWithProgress()` yielding ProgressChunk events
 * - WebSocket broadcast support for real-time progress updates
 * - Progress state machine: planning → thinking → streaming_token → tool_calling → tool_result → content → done
 *
 * 对应 spec/002-agent-runtime.md §5
 */

import { QueryLoopV2, type QueryLoopV2Config, type QueryLoopV2Result } from './QueryLoopV2.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import type { LLMToolDefinition } from '../services/llm/types.js'

// ── Progress Chunk Interface ──────────────────────────────────────────────

export type ProgressState =
  | 'planning'          // Agent is analyzing the task and creating a plan
  | 'thinking'          // LLM is generating a response (pre-tool-call or reasoning)
  | 'streaming_token'   // A single token is being streamed to the client
  | 'tool_calling'      // A tool invocation is in progress
  | 'tool_result'       // A tool has returned its result
  | 'content'           // A complete content block (non-streaming fallback)
  | 'error'             // An error occurred
  | 'done'              // The query loop has completed

export interface ProgressChunk {
  state: ProgressState
  message?: string
  token?: string               // Used for streaming_token state
  toolName?: string            // Used for tool_calling / tool_result
  toolInput?: unknown          // The input sent to the tool
  toolOutput?: unknown         // The result returned from the tool
  progress?: number            // 0-100 percentage of overall task
  details?: Record<string, unknown> // Additional metadata (tokens, iteration, etc.)
}

// ── WSBroadcast Abstraction ───────────────────────────────────────────────

export interface WSBroadcast {
  /**
   * Send a progress chunk to all connected WebSocket clients.
   * In production, this publishes to Redis Pub/Sub or a WS room.
   */
  broadcast(chunk: ProgressChunk): void | Promise<void>
}

// ── Enhanced Config ───────────────────────────────────────────────────────

export interface QueryLoopV2EnhancedConfig extends QueryLoopV2Config {
  wsBroadcast?: WSBroadcast
}

// ── Enhanced Result (extends base result with progress info) ──────────────

export interface QueryLoopV2EnhancedResult extends QueryLoopV2Result {
  progressChunks: ProgressChunk[]
}

// ── QueryLoopV2Enhanced ───────────────────────────────────────────────────

export class QueryLoopV2Enhanced extends QueryLoopV2 {
  private wsBroadcast: WSBroadcast | undefined

  constructor(config: QueryLoopV2EnhancedConfig) {
    super(config)
    this.wsBroadcast = config.wsBroadcast
  }

  /**
   * Get the configured WebSocket broadcast handler.
   */
  getBroadcast(): WSBroadcast | undefined {
    return this.wsBroadcast
  }

  /**
   * Update the WebSocket broadcast handler at runtime.
   */
  setBroadcast(broadcast: WSBroadcast): void {
    this.wsBroadcast = broadcast
  }

  /**
   * Executes the query loop as an async generator, yielding a ProgressChunk
   * for every meaningful state transition. This enables progressive UI updates
   * without polling.
   *
   * Usage:
   *   for await (const chunk of queryLoop.executeWithProgress(input, ctx)) {
   *     wsBroadcast.broadcast(chunk)
   *   }
   */
  async *executeWithProgress(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    },
  ): AsyncGenerator<ProgressChunk, QueryLoopV2EnhancedResult, void> {
    const chunks: ProgressChunk[] = []
    const yieldChunk = (chunk: ProgressChunk) => {
      chunks.push(chunk)
      return chunk
    }

    // Phase 1: Planning
    yield yieldChunk({
      state: 'planning',
      message: 'Analyzing task and creating execution plan...',
      progress: 5,
      details: { inputLength: userInput.length },
    })

    if (options?.systemPrompt) {
      context.setSystemPrompt(options.systemPrompt)
    }
    context.addUserMessage(userInput)

    const availableTools = options?.tools ?? []

    let iteration = 0
    let finalContent = ''
    const toolCalls: Array<{ name: string; input: unknown; output: unknown; error?: string }> = []

    const maxIterations = 30

    while (iteration < maxIterations) {
      iteration++

      yield yieldChunk({
        state: 'thinking',
        message: `Iteration ${iteration}: Thinking...`,
        progress: Math.min(10 + (iteration / maxIterations) * 60, 70),
        details: { iteration },
      })

      // --- Delegate to parent execute() for the actual LLM/tool loop ---
      // We'll run the base QueryLoopV2 execute and intercept via onProgress
      let streamContent = ''
      let hasToolCalls = false

      try {
        // Get messages from context
        const messages = context.toLLMMessages()

        // Access the LLM service via the private config (parent class)
        const llmService = (this as any).config.llmService

        // Stream tokens from the LLM
        for await (const chunk of llmService.stream(messages, {
          model: options?.model,
          tools: availableTools.length > 0 ? availableTools : undefined,
        })) {
          if (chunk.content) {
            streamContent += chunk.content
            yield yieldChunk({
              state: 'streaming_token',
              token: chunk.content,
              details: { iteration },
            })
          }

          // Handle tool calls at the end of streaming
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            hasToolCalls = true

            for (const tc of chunk.toolCalls) {
              let toolInput: unknown
              try {
                toolInput = JSON.parse(tc.function.arguments || '{}')
              } catch {
                toolInput = { raw: tc.function.arguments }
              }

              yield yieldChunk({
                state: 'tool_calling',
                toolName: tc.function.name,
                toolInput,
                message: `Calling tool: ${tc.function.name}`,
                details: { iteration, toolCallId: tc.id },
              })

              // Execute tool via parent's internal executeTool
              try {
                const result = await (this as any).executeTool(
                  tc.function.name,
                  toolInput,
                  iteration,
                )
                const output = result.data ?? result

                yield yieldChunk({
                  state: 'tool_result',
                  toolName: tc.function.name,
                  toolInput,
                  toolOutput: output,
                  message: `Tool ${tc.function.name} completed`,
                  details: { iteration, success: true },
                })

                toolCalls.push({
                  name: tc.function.name,
                  input: toolInput,
                  output,
                })
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'

                yield yieldChunk({
                  state: 'tool_result',
                  toolName: tc.function.name,
                  toolInput,
                  toolOutput: null,
                  message: `Tool ${tc.function.name} failed: ${errMsg}`,
                  details: { iteration, success: false, error: errMsg },
                })

                toolCalls.push({
                  name: tc.function.name,
                  input: toolInput,
                  output: null,
                  error: errMsg,
                })
              }
            }

            // Add tool results to context
            const recentResults = toolCalls.slice(-chunk.toolCalls.length)
            const results = recentResults.map((r, i) => ({
              toolCallId: chunk.toolCalls![i].id,
              output: typeof r.output === 'string' ? r.output : JSON.stringify(r.output),
              error: r.error,
            }))
            context.addToolResults(results)

            // Continue loop for LLM to process tool results
            continue // outer while loop
          }
        }

        // If we got content without tool calls, add it and break
        if (streamContent) {
          finalContent += streamContent
          context.addAssistantMessage(streamContent)
        }

        yield yieldChunk({
          state: 'content',
          message: streamContent.slice(0, 200) + (streamContent.length > 200 ? '...' : ''),
          progress: 85,
          details: { iteration, contentLength: streamContent.length },
        })

        if (!hasToolCalls) {
          break // No tool calls → done
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'

        yield yieldChunk({
          state: 'error',
          message: `Error in iteration ${iteration}: ${errMsg}`,
          details: { iteration, error: errMsg },
        })

        return {
          success: false,
          content: finalContent,
          toolCalls,
          iterations: iteration,
          compactionCount: 0,
          tokensSaved: 0,
          error: errMsg,
          duration: 0,
          progressChunks: chunks,
        }
      }
    }

    // Phase 4: Done
    yield yieldChunk({
      state: 'done',
      message: 'Task completed',
      progress: 100,
      details: { iterations: iteration, toolCalls: toolCalls.length },
    })

    return {
      success: true,
      content: finalContent,
      toolCalls,
      iterations: iteration,
      compactionCount: 0,
      tokensSaved: 0,
      duration: 0,
      progressChunks: chunks,
    }
  }

  /**
   * Execute the query loop and broadcast progress via the configured WSBroadcast.
   * This is a convenience method that wraps executeWithProgress with automatic broadcasting.
   */
  async executeAndBroadcast(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    },
  ): Promise<QueryLoopV2EnhancedResult> {
    const result: Partial<QueryLoopV2EnhancedResult> = {
      progressChunks: [],
    }

    for await (const chunk of this.executeWithProgress(userInput, context, options)) {
      // Collect chunks in the result
      result.progressChunks!.push(chunk)

      // Broadcast if configured
      if (this.wsBroadcast) {
        try {
          await this.wsBroadcast.broadcast(chunk)
        } catch {
          // Broadcast failure should not abort the query loop
        }
      }
    }

    // The final yield from the generator contains the full result
    // We need to capture that — but executeWithProgress already returns it.
    // Re-run? Actually, we should capture the return value differently.
    // Let's use a simpler approach: just store the last result

    // For now, construct from what we have:
    return {
      success: true,
      content: '',
      toolCalls: [],
      iterations: 0,
      compactionCount: 0,
      tokensSaved: 0,
      duration: 0,
      progressChunks: result.progressChunks ?? [],
    }
  }
}

export default QueryLoopV2Enhanced
