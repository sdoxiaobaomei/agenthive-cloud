/**
 * Todo Tool - inspired by Claude Code
 * 
 * Allows agents to track tasks and progress within a conversation.
 * Useful for:
 * - Breaking down complex tasks into subtasks
 * - Tracking completion status
 * - Maintaining focus on remaining work
 * - Providing visibility into agent's plan
 */
import { z } from 'zod'
import { buildTool } from '../Tool.js'
import { Logger } from '../../utils/logger.js'

export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  updatedAt: number
  completedAt?: number
  parentId?: string
  subtasks: string[]
  tags: string[]
}

export interface TodoList {
  todos: Todo[]
  version: number
  lastUpdated: number
}

// In-memory storage (could be persisted to file/DB)
const todoStores = new Map<string, TodoList>()

export function getTodoStore(agentId: string): TodoList {
  if (!todoStores.has(agentId)) {
    todoStores.set(agentId, {
      todos: [],
      version: 1,
      lastUpdated: Date.now()
    })
  }
  return todoStores.get(agentId)!
}

export function setTodoStore(agentId: string, list: TodoList): void {
  todoStores.set(agentId, list)
}

export function clearTodoStore(agentId: string): void {
  todoStores.delete(agentId)
}

// Generate unique ID
function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export const TodoTool = buildTool({
  name: 'todo',
  description: `Manage a todo list to track tasks and progress.

Use this tool to:
1. Break down complex tasks into smaller, manageable subtasks
2. Track what has been completed and what remains
3. Update task status as you make progress
4. Prioritize work with high/medium/low priorities
5. Organize related tasks with tags and subtasks

The todo system helps maintain focus and provides visibility into your plan.
Always update todos as you complete work or discover new tasks.`,
  
  inputSchema: z.object({
    operation: z.enum(['create', 'update', 'close', 'list', 'clear'])
      .describe('Operation to perform on the todo list'),
    
    // For create
    content: z.string().optional()
      .describe('Content/description of the todo (for create operation)'),
    priority: z.enum(['low', 'medium', 'high']).optional()
      .describe('Priority level (default: medium)'),
    parentId: z.string().optional()
      .describe('ID of parent todo for subtasks'),
    tags: z.array(z.string()).optional()
      .describe('Tags for categorization'),
    
    // For update/close
    id: z.string().optional()
      .describe('Todo ID (for update/close operations)'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional()
      .describe('New status (for update operation)'),
    
    // For list
    filter: z.enum(['all', 'pending', 'in_progress', 'completed', 'cancelled']).optional()
      .describe('Filter for list operation (default: all)'),
    
    // For create multiple
    todos: z.array(z.object({
      content: z.string(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    })).optional()
      .describe('Create multiple todos at once')
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    todos: z.array(z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      priority: z.enum(['low', 'medium', 'high']),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
      parentId: z.string().optional(),
      subtasks: z.array(z.string()),
      tags: z.array(z.string())
    })).optional(),
    summary: z.object({
      total: z.number(),
      pending: z.number(),
      inProgress: z.number(),
      completed: z.number(),
      cancelled: z.number()
    }).optional()
  }),
  
  async execute(input, context) {
    const agentId = context.agentId
    const todoList = getTodoStore(agentId)
    const logger = new Logger('TodoTool')
    
    logger.debug(`Todo operation: ${input.operation}`, { agentId })
    
    switch (input.operation) {
      case 'create':
        return handleCreate(input, todoList, agentId)
        
      case 'update':
        return handleUpdate(input, todoList, agentId)
        
      case 'close':
        return handleClose(input, todoList, agentId)
        
      case 'list':
        return handleList(input, todoList)
        
      case 'clear':
        return handleClear(todoList, agentId)
        
      default:
        return {
          success: false,
          message: `Unknown operation: ${input.operation}`,
          todos: todoList.todos
        }
    }
  },
  
  renderToolUseMessage(input) {
    switch (input.operation) {
      case 'create':
        if (input.todos && input.todos.length > 0) {
          return `Creating ${input.todos.length} todos`
        }
        return `Creating todo: ${input.content?.substring(0, 50)}${input.content && input.content.length > 50 ? '...' : ''}`
      case 'update':
        return `Updating todo ${input.id} to status: ${input.status}`
      case 'close':
        return `Closing todo ${input.id}`
      case 'list':
        return `Listing ${input.filter || 'all'} todos`
      case 'clear':
        return 'Clearing all todos'
      default:
        return `Todo operation: ${input.operation}`
    }
  },
  
  renderToolResultMessage(result) {
    if (!result.success) {
      return `Failed: ${result.message}`
    }
    
    if (result.summary) {
      return `Todos: ${result.summary.completed}/${result.summary.total} completed (${result.summary.inProgress} in progress, ${result.summary.pending} pending)`
    }
    
    return result.message
  }
})

// Operation handlers
function handleCreate(
  input: any,
  todoList: TodoList,
  agentId: string
) {
  const now = Date.now()
  const createdTodos: Todo[] = []
  
  // Handle batch creation
  if (input.todos && input.todos.length > 0) {
    for (const todoInput of input.todos) {
      const todo: Todo = {
        id: generateId(),
        content: todoInput.content,
        status: 'pending',
        priority: todoInput.priority || 'medium',
        createdAt: now,
        updatedAt: now,
        parentId: input.parentId,
        subtasks: [],
        tags: input.tags || []
      }
      
      todoList.todos.push(todo)
      createdTodos.push(todo)
      
      // Add as subtask to parent if specified
      if (input.parentId) {
        const parent = todoList.todos.find(t => t.id === input.parentId)
        if (parent) {
          parent.subtasks.push(todo.id)
          parent.updatedAt = now
        }
      }
    }
  } else if (input.content) {
    // Single creation
    const todo: Todo = {
      id: generateId(),
      content: input.content,
      status: 'pending',
      priority: input.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      parentId: input.parentId,
      subtasks: [],
      tags: input.tags || []
    }
    
    todoList.todos.push(todo)
    createdTodos.push(todo)
    
    // Add as subtask to parent if specified
    if (input.parentId) {
      const parent = todoList.todos.find(t => t.id === input.parentId)
      if (parent) {
        parent.subtasks.push(todo.id)
        parent.updatedAt = now
      }
    }
  } else {
    return {
      success: false,
      message: 'Content is required for create operation',
      todos: todoList.todos
    }
  }
  
  todoList.version++
  todoList.lastUpdated = now
  setTodoStore(agentId, todoList)
  
  return {
    success: true,
    message: createdTodos.length === 1 
      ? `Created todo: ${createdTodos[0].content.substring(0, 50)}`
      : `Created ${createdTodos.length} todos`,
    todos: createdTodos,
    summary: calculateSummary(todoList)
  }
}

function handleUpdate(
  input: any,
  todoList: TodoList,
  agentId: string
) {
  if (!input.id) {
    return {
      success: false,
      message: 'ID is required for update operation',
      todos: todoList.todos
    }
  }
  
  const todo = todoList.todos.find(t => t.id === input.id)
  if (!todo) {
    return {
      success: false,
      message: `Todo not found: ${input.id}`,
      todos: todoList.todos
    }
  }
  
  const now = Date.now()
  
  if (input.status) {
    todo.status = input.status
    
    if (input.status === 'completed') {
      todo.completedAt = now
    } else if (input.status !== 'completed' && todo.completedAt) {
      delete todo.completedAt
    }
    
    // If marking as in_progress, check if parent should also be in_progress
    if (input.status === 'in_progress' && todo.parentId) {
      const parent = todoList.todos.find(t => t.id === todo.parentId)
      if (parent && parent.status === 'pending') {
        parent.status = 'in_progress'
        parent.updatedAt = now
      }
    }
    
    // If marking as completed, check if all siblings are completed
    if (input.status === 'completed' && todo.parentId) {
      const parent = todoList.todos.find(t => t.id === todo.parentId)
      if (parent) {
        const siblings = todoList.todos.filter(t => t.parentId === todo.parentId)
        if (siblings.every(t => t.status === 'completed')) {
          parent.status = 'completed'
          parent.completedAt = now
          parent.updatedAt = now
        }
      }
    }
  }
  
  if (input.content) {
    todo.content = input.content
  }
  
  if (input.priority) {
    todo.priority = input.priority
  }
  
  todo.updatedAt = now
  todoList.version++
  todoList.lastUpdated = now
  setTodoStore(agentId, todoList)
  
  return {
    success: true,
    message: `Updated todo ${input.id} (status: ${todo.status})`,
    todos: [todo],
    summary: calculateSummary(todoList)
  }
}

function handleClose(
  input: any,
  todoList: TodoList,
  agentId: string
) {
  if (!input.id) {
    return {
      success: false,
      message: 'ID is required for close operation',
      todos: todoList.todos
    }
  }
  
  const todo = todoList.todos.find(t => t.id === input.id)
  if (!todo) {
    return {
      success: false,
      message: `Todo not found: ${input.id}`,
      todos: todoList.todos
    }
  }
  
  const now = Date.now()
  todo.status = 'completed'
  todo.completedAt = now
  todo.updatedAt = now
  
  // Mark all subtasks as completed
  for (const subtaskId of todo.subtasks) {
    const subtask = todoList.todos.find(t => t.id === subtaskId)
    if (subtask && subtask.status !== 'completed') {
      subtask.status = 'completed'
      subtask.completedAt = now
      subtask.updatedAt = now
    }
  }
  
  todoList.version++
  todoList.lastUpdated = now
  setTodoStore(agentId, todoList)
  
  return {
    success: true,
    message: `Closed todo: ${todo.content.substring(0, 50)}`,
    todos: [todo],
    summary: calculateSummary(todoList)
  }
}

function handleList(
  input: any,
  todoList: TodoList
) {
  const filter = input.filter || 'all'
  
  let filtered = todoList.todos
  if (filter !== 'all') {
    filtered = todoList.todos.filter(t => t.status === filter)
  }
  
  // Sort by priority and creation date
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  filtered.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.createdAt - a.createdAt
  })
  
  const summary = calculateSummary(todoList)
  
  return {
    success: true,
    message: filtered.length === 0 
      ? 'No todos found'
      : `Found ${filtered.length} ${filter !== 'all' ? filter + ' ' : ''}todos`,
    todos: filtered,
    summary
  }
}

function handleClear(
  todoList: TodoList,
  agentId: string
) {
  const count = todoList.todos.length
  todoList.todos = []
  todoList.version++
  todoList.lastUpdated = Date.now()
  setTodoStore(agentId, todoList)
  
  return {
    success: true,
    message: `Cleared ${count} todos`,
    todos: [],
    summary: { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 }
  }
}

function calculateSummary(todoList: TodoList) {
  return {
    total: todoList.todos.length,
    pending: todoList.todos.filter(t => t.status === 'pending').length,
    inProgress: todoList.todos.filter(t => t.status === 'in_progress').length,
    completed: todoList.todos.filter(t => t.status === 'completed').length,
    cancelled: todoList.todos.filter(t => t.status === 'cancelled').length
  }
}
