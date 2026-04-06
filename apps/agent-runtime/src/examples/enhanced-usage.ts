/**
 * Enhanced Agent Runtime Usage Example
 * 
 * Demonstrates how to use the new Claude Code-inspired features:
 * - Enhanced Query Loop with compaction
 * - Cost tracking
 * - Todo management
 * - Parallel tool execution
 * - State management
 */

import {
  EnhancedQueryLoop,
  initializeCostTracker,
  initializePermissionManager,
  initializeStateStore,
  getTodoStore,
  TodoTool
} from '../index-enhanced.js'

import {
  LLMService,
  ToolRegistry,
  ToolExecutor,
  StreamingToolExecutor,
  ConversationContextV2
} from '../index.js'

async function main() {
  // 1. Initialize services
  console.log('🚀 Initializing Enhanced Agent Runtime...\n')
  
  // Initialize cost tracker with budget
  const costTracker = initializeCostTracker({
    dailyLimit: 10, // $10 daily limit
    perRequestLimit: 1, // $1 per request limit
    alertThreshold: 0.8 // Alert at 80% of budget
  })
  
  // Listen for budget alerts
  costTracker.on('budget:alert', ({ current, limit }) => {
    console.warn(`⚠️ Budget alert: $${current.toFixed(2)} / $${limit}`)
  })
  
  // Initialize permission manager
  const permissionManager = initializePermissionManager('default')
  
  // Add custom permission rule
  permissionManager.addRule({
    name: 'Allow file reads in project',
    pattern: { tool: 'file_read' },
    decision: 'allow',
    condition: (input) => input.path?.includes('/project/')
  })
  
  // Initialize state store
  const stateStore = initializeStateStore({
    enabled: true,
    key: 'my_agent_state',
    storage: 'memory'
  })
  
  // Subscribe to state changes
  stateStore.subscribe('conversation.status', (change) => {
    console.log(`📊 Conversation status: ${change.newValue}`)
  })
  
  // 2. Setup LLM and tools
  const llmService = new LLMService({
    defaultProvider: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022'
    }
  })
  
  const toolRegistry = new ToolRegistry()
  const toolExecutor = new ToolExecutor(toolRegistry)
  
  // Register Todo tool
  toolRegistry.register(TodoTool)
  
  // 3. Create enhanced query loop
  const queryLoop = new EnhancedQueryLoop({
    llmService,
    toolRegistry,
    toolExecutor,
    streamingExecutor: new StreamingToolExecutor(toolRegistry, {
      maxConcurrency: 5
    }),
    costTracker,
    permissionManager,
    enableCompaction: true,
    enableParallelTools: true,
    maxTokens: 12000,
    targetTokens: 8000
  })
  
  // Listen to events
  queryLoop.on('start', () => console.log('▶️ Query started'))
  queryLoop.on('complete', (result) => {
    console.log('✅ Query completed')
    if (result.cost) {
      console.log(`💰 Cost: $${result.cost.totalCost.toFixed(6)}`)
    }
  })
  queryLoop.on('compaction', (result) => {
    if (result.tokensSaved > 0) {
      console.log(`🗜️ Compaction saved ${result.tokensSaved} tokens`)
    }
  })
  
  // 4. Create todos for the session
  const todoList = getTodoStore('example-session')
  console.log('\n📋 Creating initial todos...')
  
  // Simulate creating todos via tool
  await TodoTool.execute({
    operation: 'create',
    todos: [
      { content: 'Analyze project structure', priority: 'high' },
      { content: 'Read configuration files', priority: 'medium' },
      { content: 'Generate implementation plan', priority: 'high' },
      { content: 'Execute implementation', priority: 'medium' }
    ]
  }, {
    agentId: 'example-session',
    workspacePath: process.cwd(),
    sendLog: (msg) => console.log(`  ${msg}`)
  })
  
  // 5. Execute query with context
  console.log('\n🔍 Executing query...\n')
  
  const context = new ConversationContextV2({
    maxTokens: 12000,
    compressionThreshold: 10000
  })
  
  const result = await queryLoop.execute(
    'Please analyze the current project structure and create a summary of the main components.',
    context,
    {
      systemPrompt: `You are an expert software architect. Analyze codebases and provide clear, structured summaries.

Use the todo tool to track your progress through the analysis.
When you complete a task, update the todo status to 'completed'.`,
      model: 'claude-3-5-sonnet-20241022'
    }
  )
  
  // 6. Display results
  console.log('\n📊 Results:')
  console.log(`   Success: ${result.success}`)
  console.log(`   Content: ${result.content.substring(0, 200)}...`)
  console.log(`   Iterations: ${result.iterations}`)
  console.log(`   Tool calls: ${result.toolCalls.length}`)
  
  if (result.usage) {
    console.log(`   Tokens: ${result.usage.totalTokens} (${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion)`)
  }
  
  if (result.cost) {
    console.log(`   Cost: $${result.cost.totalCost.toFixed(6)}`)
  }
  
  if (result.compactionResults?.applied) {
    console.log(`   Compaction saved: ${result.compactionResults.tokensSaved} tokens`)
  }
  
  // 7. Show todo status
  console.log('\n📋 Final Todo Status:')
  const finalTodos = getTodoStore('example-session')
  const summary = {
    total: finalTodos.todos.length,
    pending: finalTodos.todos.filter(t => t.status === 'pending').length,
    inProgress: finalTodos.todos.filter(t => t.status === 'in_progress').length,
    completed: finalTodos.todos.filter(t => t.status === 'completed').length
  }
  console.log(`   Total: ${summary.total}, Pending: ${summary.pending}, In Progress: ${summary.inProgress}, Completed: ${summary.completed}`)
  
  // 8. Show cost summary
  console.log('\n💰 Cost Summary:')
  const costSummary = costTracker.getSummary()
  console.log(`   Total requests: ${costSummary.totalRequests}`)
  console.log(`   Total cost: $${costSummary.totalCost.toFixed(6)}`)
  console.log(`   Avg cost/request: $${costSummary.averageCostPerRequest.toFixed(6)}`)
  
  console.log('\n✨ Example complete!')
}

main().catch(console.error)
