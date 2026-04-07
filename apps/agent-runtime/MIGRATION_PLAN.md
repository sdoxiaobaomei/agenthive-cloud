# Agent Runtime 完善计划 (已调整)

> 基于 Claude Code CLI 深度分析的功能迁移与完善计划
> **调整日期**: 2026-04-06 | **版本**: v1.1

---

## 关键调整说明

### 调整 1: MCP 策略变更
- **原**: Week 4-5 完整 MCP 集成
- **新**: Week 4 **最小化 MCP 实现** (仅 STDIO + 工具调用)
- **原因**: Skills/Agent 无法完全替代 MCP，但无需过度投入

### 调整 2: Agent 隔离优先级提升
- **原**: Week 5-6 实现
- **新**: Week 3-4 提前实现
- **原因**: 这是核心竞争力，优先确保稳定

### 调整 3: 新增向后兼容层
- **新增**: 完整的适配器系统
- **目标**: 100% 向后兼容，渐进式迁移

---

## 实施路线图（6周）

```
Week 1-2: 核心接口统一 + 测试
    ├── ToolV2 接口定义
    ├── QueryLoopV2 实现
    ├── 适配器层
    └── 向后兼容验证

Week 3-4: Agent 隔离 + 上下文压缩
    ├── Worktree 隔离实现 ⭐高优先级
    ├── 三级压缩策略
    └── 团队协作模式

Week 4-5: 权限增强 + MCP 最小实现
    ├── AutoClassifier 实现
    ├── MCP 最小集成
    └── 权限 Hooks

Week 5-6: 测试覆盖 + 发布
    ├── 集成测试
    ├── 性能优化
    └── 发布 v2.2.0
```

---

## 详细实施计划

### 阶段一：核心接口统一（Week 1-2）⭐ 当前阶段

#### 1.1 ToolV2 接口定义

**Claude Code 风格接口**:

```typescript
// src/tools/ToolV2.ts
export interface ToolV2<TInput = any, TOutput = any, TProgress = any> {
  // 基础属性
  name: string;
  aliases?: string[];
  searchHint?: string;
  category?: ToolCategory;
  
  // Schema
  inputSchema: z.ZodSchema<TInput> | LazySchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  
  // 核心方法 - Claude Code 风格 call()
  call(
    input: TInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    assistantMessage: AssistantMessage | null,
    onProgress?: ToolProgressCallback<TProgress>
  ): Promise<ToolResult<TOutput>>;
  
  // 权限控制
  checkPermissions(input: TInput, context: ToolUseContext): Promise<PermissionResult>;
  isReadOnly(input: TInput): boolean;
  isDestructive?(input: TInput): boolean;
  isConcurrencySafe(input: TInput): boolean;
  
  // 渲染方法
  renderToolUseMessage?(input: Partial<TInput>): string;
  renderToolResultMessage?(output: TOutput): string;
  
  // 分类器
  toAutoClassifierInput(input: TInput): string;
  
  // MCP 相关
  isMcp?: boolean;
  mcpInfo?: { serverName: string; toolName: string };
  shouldDefer?: boolean;
  alwaysLoad?: boolean;
}
```

**任务清单**:
- [ ] 创建 `src/tools/ToolV2.ts` 接口定义
- [ ] 创建 `src/tools/buildToolV2.ts` 工厂函数
- [ ] 实现完整的类型定义
- [ ] 编写单元测试

#### 1.2 ToolUseContext 完善

```typescript
// src/tools/ToolUseContext.ts
export interface ToolUseContext {
  // 基础属性
  agentId: string;
  workspacePath: string;
  sendLog: (message: string, isError?: boolean) => void;
  abortController: AbortController;
  
  // 应用状态管理
  getAppState(): AppState;
  setAppState(updater: (prev: AppState) => AppState): void;
  
  // 消息历史
  messages: Message[];
  
  // 查询追踪
  queryTracking?: QueryChainTracking;
  
  // 内容替换状态
  contentReplacementState?: ContentReplacementState;
  
  // MCP 集成点
  mcpClients?: MCPServerConnection[];
  
  // 父上下文
  parentContext?: ToolUseContext;
  
  // 权限检查
  checkPermission: CheckPermissionFn;
  
  // LLM 服务
  llm: {
    complete: (messages: Message[], options?: any) => Promise<LLMResult>;
    stream: (messages: Message[], options?: any) => AsyncGenerator<LLMStreamChunk>;
  };
}
```

#### 1.3 适配器层实现

```typescript
// src/tools/adapters/ToolAdapter.ts
export class ToolAdapter {
  // 旧 Tool -> 新 ToolV2
  static toV2(oldTool: Tool): ToolV2 {
    return {
      name: oldTool.name,
      description: oldTool.description,
      inputSchema: oldTool.inputSchema,
      outputSchema: oldTool.outputSchema,
      
      // 核心适配
      call: async (input, context, canUseTool, assistantMessage, onProgress) => {
        // 1. 权限预检查
        const permission = await canUseTool(oldTool.name, input);
        if (permission.behavior === 'deny') {
          return {
            data: null,
            error: 'Permission denied',
            type: 'error'
          };
        }
        
        // 2. 执行工具
        try {
          const output = await oldTool.execute(input, {
            agentId: context.agentId,
            workspacePath: context.workspacePath,
            sendLog: context.sendLog,
            signal: context.abortController.signal
          });
          
          return {
            data: output,
            type: 'result',
            resultForAssistant: formatForAssistant(output)
          };
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'error'
          };
        }
      },
      
      // 权限适配
      checkPermissions: oldTool.checkPermissions || (async () => ({ behavior: 'allow' })),
      isReadOnly: oldTool.isReadOnly || (() => false),
      isDestructive: oldTool.isDestructive,
      isConcurrencySafe: oldTool.isConcurrencySafe || (() => false),
      
      // 分类器适配
      toAutoClassifierInput: oldTool.toAutoClassifierInput || (() => '')
    };
  }
  
  // 新 ToolV2 -> 旧 Tool (向后兼容)
  static toLegacy(modernTool: ToolV2): Tool {
    return {
      name: modernTool.name,
      description: modernTool.description,
      inputSchema: modernTool.inputSchema,
      outputSchema: modernTool.outputSchema,
      
      execute: async (input, context) => {
        // 创建模拟的 canUseTool
        const canUseTool = async () => ({ behavior: 'allow' as const });
        
        // 创建模拟的 abortController
        const abortController = new AbortController();
        if (context.signal) {
          context.signal.addEventListener('abort', () => abortController.abort());
        }
        
        // 转换 context
        const toolUseContext: ToolUseContext = {
          agentId: context.agentId,
          workspacePath: context.workspacePath,
          sendLog: context.sendLog || (() => {}),
          abortController,
          getAppState: () => ({}),
          setAppState: () => {},
          messages: [],
          checkPermission: context.checkPermission || (async () => ({ behavior: 'allow' })),
          llm: context.llm || {
            complete: async () => ({ content: '' }),
            stream: async function* () {}
          }
        };
        
        const result = await modernTool.call(
          input,
          toolUseContext,
          canUseTool,
          null,
          undefined
        );
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        return result.data;
      },
      
      isReadOnly: modernTool.isReadOnly,
      isDestructive: modernTool.isDestructive,
      isConcurrencySafe: modernTool.isConcurrencySafe
    };
  }
}
```

#### 1.4 QueryLoopV2 实现

```typescript
// src/agent/QueryLoopV2.ts
export class QueryLoopV2 extends EventEmitter {
  private config: QueryLoopV2Config;
  private state: QueryState;
  private compactionEngine: CompactionEngine;
  private toolRegistry: ToolRegistryV2;
  private llmService: LLMService;
  
  constructor(config: QueryLoopV2Config) {
    super();
    this.config = config;
    this.toolRegistry = config.toolRegistry;
    this.llmService = config.llmService;
    this.compactionEngine = new CompactionEngine(config.compactionConfig);
    this.state = {
      messages: [],
      turnCount: 0,
      status: 'idle'
    };
  }
  
  async *execute(query: string, context?: ConversationContextV2): AsyncGenerator<QueryEvent> {
    // 初始化
    this.state = {
      messages: context?.getMessages() || [],
      turnCount: 0,
      status: 'running'
    };
    
    // 添加用户消息
    if (query) {
      this.state.messages.push({ role: 'user', content: query });
    }
    
    yield { type: 'start', messageCount: this.state.messages.length };
    
    // 主循环
    while (this.state.status === 'running') {
      this.state.turnCount++;
      
      // 1. 检查并执行压缩
      const compactionResult = await this.checkAndCompact();
      if (compactionResult) {
        yield { type: 'compaction', result: compactionResult };
      }
      
      // 2. 准备工具定义
      const tools = this.toolRegistry.getToolDefinitions();
      
      // 3. 调用 LLM
      yield { type: 'thinking', turn: this.state.turnCount };
      
      const response = await this.callLLM(tools);
      
      // 4. 处理内容
      if (response.content) {
        yield { type: 'content', content: response.content };
        this.state.messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls
        });
      }
      
      // 5. 执行工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          yield { type: 'tool_call', toolCall };
          
          const result = await this.executeTool(toolCall);
          yield { type: 'tool_result', result };
          
          // 添加工具结果到消息
          this.state.messages.push({
            role: 'tool',
            content: JSON.stringify(result.output),
            toolResults: [{
              toolCallId: toolCall.id,
              output: result.output,
              error: result.error
            }]
          });
        }
        // 继续下一轮
        continue;
      }
      
      // 6. 完成
      this.state.status = 'completed';
      yield { type: 'complete', turns: this.state.turnCount };
    }
  }
  
  private async checkAndCompact(): Promise<CompactionResult | null> {
    const stats = this.calculateTokenStats();
    
    // 三级压缩
    if (stats.totalTokens > COMPACT_THRESHOLD) {
      this.emit('compaction', { type: 'compact', stats });
      return this.compactionEngine.compact(this.state.messages);
    }
    
    if (stats.totalTokens > SNIP_THRESHOLD) {
      this.emit('compaction', { type: 'snip', stats });
      return this.compactionEngine.snip(this.state.messages);
    }
    
    return null;
  }
  
  private async executeTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const tool = this.toolRegistry.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        error: `Tool not found: ${toolCall.name}`,
        output: null
      };
    }
    
    try {
      // 创建权限检查函数
      const canUseTool: CanUseToolFn = async (toolName, input) => {
        // 这里可以集成 PermissionManager
        return { behavior: 'allow' };
      };
      
      // 创建上下文
      const context = this.createToolUseContext();
      
      // 执行工具
      const result = await tool.call(
        toolCall.input,
        context,
        canUseTool,
        null,
        (progress) => {
          this.emit('toolProgress', { toolCallId: toolCall.id, progress });
        }
      );
      
      return {
        toolCallId: toolCall.id,
        output: result.data,
        error: result.error
      };
      
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        output: null
      };
    }
  }
  
  stop(): void {
    this.state.status = 'stopped';
    this.emit('stopped');
  }
}
```

---

### 阶段二：Agent 隔离 + 压缩（Week 3-4）⭐ 高优先级

#### 2.1 Worktree 隔离实现

```typescript
// src/agent/isolation/WorktreeIsolation.ts
export class WorktreeIsolation implements IsolationStrategy {
  private git: SimpleGit;
  private logger: Logger;
  
  async create(options: IsolationOptions): Promise<IsolationContext> {
    const worktreeName = `agent-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const worktreePath = path.join(os.tmpdir(), 'agent-worktrees', worktreeName);
    
    this.logger.info(`Creating worktree: ${worktreeName}`);
    
    // 1. 创建目录
    await fs.mkdir(worktreePath, { recursive: true });
    
    // 2. 创建 worktree
    await this.git.worktree(['add', worktreePath, '-b', worktreeName]);
    
    // 3. 配置环境
    const env = {
      ...process.env,
      AGENT_ISOLATION: 'worktree',
      AGENT_WORKTREE_PATH: worktreePath,
      AGENT_PARENT_REPO: options.parentRepoPath,
      AGENT_ISOLATION_ID: worktreeName
    };
    
    return {
      type: 'worktree',
      path: worktreePath,
      name: worktreeName,
      env,
      cleanup: async () => this.destroy(worktreePath, worktreeName)
    };
  }
  
  async destroy(context: IsolationContext): Promise<void> {
    try {
      // 1. 移除 worktree
      await this.git.worktree(['remove', '--force', context.path]);
      
      // 2. 删除分支
      await this.git.deleteLocalBranch(context.name, true);
      
      this.logger.info(`Worktree cleaned up: ${context.name}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup worktree: ${context.name}`, { error });
    }
  }
}
```

#### 2.2 三级压缩策略

```typescript
// src/context/compact/CompactionEngine.ts
export class CompactionEngine {
  private strategies: Map<string, CompactionStrategy> = new Map();
  
  constructor(config: CompactionConfig) {
    // 注册压缩策略
    this.strategies.set('snip', new SnipStrategy(config.snip));
    this.strategies.set('compact', new CompactStrategy(config.compact));
    this.strategies.set('collapse', new CollapseStrategy(config.collapse));
  }
  
  async snip(messages: Message[]): Promise<CompactionResult> {
    const strategy = this.strategies.get('snip')!;
    return strategy.execute(messages);
  }
  
  async compact(messages: Message[]): Promise<CompactionResult> {
    const strategy = this.strategies.get('compact')!;
    return strategy.execute(messages);
  }
  
  async collapse(messages: Message[]): Promise<CompactionResult> {
    const strategy = this.strategies.get('collapse')!;
    return strategy.execute(messages);
  }
}

// Snip 策略: 截断过长消息
class SnipStrategy implements CompactionStrategy {
  async execute(messages: Message[]): Promise<CompactionResult> {
    const SNIP_LENGTH = 8000; // tokens
    const HEAD_LENGTH = 2000;
    const TAIL_LENGTH = 2000;
    
    const processed = messages.map(msg => {
      const tokens = estimateTokens(msg.content);
      if (tokens <= SNIP_LENGTH) return msg;
      
      // 截断消息
      const content = msg.content;
      const head = content.slice(0, HEAD_LENGTH);
      const tail = content.slice(-TAIL_LENGTH);
      const snipped = tokens - HEAD_LENGTH - TAIL_LENGTH;
      
      return {
        ...msg,
        content: `${head}\n\n[...${snipped} tokens snipped...]\n\n${tail}`
      };
    });
    
    return {
      type: 'snip',
      messages: processed,
      originalTokens: countTokens(messages),
      compressedTokens: countTokens(processed)
    };
  }
}
```

---

### 阶段三：权限 + MCP 最小实现（Week 4-5）

#### 3.1 MCP 最小实现

```typescript
// src/mcp/MCPClientMinimal.ts
export class MCPClientMinimal {
  private process: ChildProcess | null = null;
  private config: MCPConfig;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private tools: MCPTool[] = [];
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.process.stdout?.on('data', (data) => {
        this.handleMessage(data.toString());
      });
      
      this.process.on('error', reject);
      
      setTimeout(async () => {
        try {
          await this.initialize();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 500);
    });
  }
  
  // 只保留核心方法
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    this.tools = result.tools || [];
    return this.tools;
  }
  
  async callTool(name: string, args: any): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }
  
  // 省略: 资源订阅、通知、其他传输方式
}
```

#### 3.2 AutoClassifier 简化实现

```typescript
// src/permissions/AutoClassifierSimple.ts
export class AutoClassifierSimple {
  private llmService: LLMService;
  
  async classify(toolName: string, input: unknown): Promise<ClassifierResult> {
    const prompt = this.buildPrompt(toolName, input);
    
    const response = await this.llmService.complete(prompt, {
      model: 'claude-3-haiku-20240307',
      maxTokens: 100,
      temperature: 0
    });
    
    return this.parseResponse(response.content);
  }
  
  private buildPrompt(toolName: string, input: unknown): string {
    return `Analyze this tool call for safety:
Tool: ${toolName}
Input: ${JSON.stringify(input).slice(0, 500)}

Is this safe? Reply with ONLY: SAFE or ASK or BLOCK`;
  }
  
  private parseResponse(content: string): ClassifierResult {
    const upper = content.toUpperCase().trim();
    if (upper.includes('BLOCK')) {
      return { behavior: 'deny', confidence: 'high' };
    }
    if (upper.includes('ASK')) {
      return { behavior: 'ask', confidence: 'medium' };
    }
    return { behavior: 'allow', confidence: 'high' };
  }
}
```

---

### 阶段四：测试 + 发布（Week 5-6）

#### 4.1 测试覆盖目标

```
Module                    Target    Priority
─────────────────────────────────────────────
ToolV2                    90%       P0
QueryLoopV2               85%       P0
ToolAdapter               90%       P0
WorktreeIsolation         80%       P1
CompactionEngine          80%       P1
AutoClassifierSimple      75%       P2
MCPClientMinimal          70%       P2
```

#### 4.2 发布检查清单

- [ ] 所有测试通过
- [ ] 向后兼容验证
- [ ] 性能基准测试
- [ ] 文档更新
- [ ] 变更日志
- [ ] 版本号更新 (v2.2.0)

---

## 文件结构规划

```
src/
├── tools/
│   ├── ToolV2.ts                 # 新接口定义
│   ├── buildToolV2.ts            # 新工厂函数
│   ├── ToolUseContext.ts         # 上下文定义
│   ├── adapters/
│   │   ├── ToolAdapter.ts        # 双向适配器
│   │   └── index.ts
│   └── registry/
│       └── ToolRegistryV2.ts     # 新注册表
├── agent/
│   ├── QueryLoopV2.ts            # 新查询循环
│   ├── isolation/
│   │   ├── WorktreeIsolation.ts  # worktree 隔离
│   │   ├── TempDirIsolation.ts   # 临时目录隔离
│   │   └── types.ts
│   └── teams/
│       └── TeamManager.ts        # 团队管理
├── context/
│   └── compact/
│       ├── CompactionEngine.ts   # 压缩引擎
│       ├── SnipStrategy.ts       # 截断策略
│       ├── CompactStrategy.ts    # 摘要策略
│       └── CollapseStrategy.ts   # 折叠策略
├── permissions/
│   ├── AutoClassifierSimple.ts   # 简化版分类器
│   └── hooks/
│       └── DangerousCommandHook.ts
├── mcp/
│   └── MCPClientMinimal.ts       # 最小 MCP 实现
├── compat/
│   └── v1/                       # 向后兼容层
│       ├── index.ts
│       └── adapters.ts
└── index.ts                      # 统一导出
```

---

## 向后兼容策略

### 1. 功能开关

```typescript
// src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  USE_TOOL_V2: process.env.AGENT_USE_TOOL_V2 === 'true',
  USE_QUERY_LOOP_V2: process.env.AGENT_USE_QUERY_LOOP_V2 === 'true',
  ENABLE_WORKTREE_ISOLATION: process.env.AGENT_ENABLE_WORKTREE_ISOLATION === 'true',
  ENABLE_AUTO_CLASSIFIER: process.env.AGENT_ENABLE_AUTO_CLASSIFIER === 'true',
  ENABLE_MCP_MINIMAL: process.env.AGENT_ENABLE_MCP_MINIMAL === 'true'
};
```

### 2. 渐进式迁移

```typescript
// src/index.ts
import { ToolRegistry } from './tools/ToolClaudeCode.js';
import { ToolRegistryV2 } from './tools/registry/ToolRegistryV2.js';
import { FEATURE_FLAGS } from './config/featureFlags.js';

// 根据开关导出
export const createToolRegistry = () => {
  if (FEATURE_FLAGS.USE_TOOL_V2) {
    return new ToolRegistryV2();
  }
  return new ToolRegistry();
};
```

---

## 下一步行动

**当前阶段**: Week 1-2 核心接口统一

**立即开始**:
1. ✅ 计划已调整完成
2. 🔄 创建 `src/tools/ToolV2.ts`
3. 🔄 实现 `buildToolV2.ts`
4. 🔄 编写适配器层
5. 🔄 添加单元测试

---

*计划版本: v1.1*
*最后更新: 2026-04-06*
