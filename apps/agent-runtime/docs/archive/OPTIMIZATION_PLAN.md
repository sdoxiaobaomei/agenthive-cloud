# Agent Runtime Optimization Plan

Based on analysis of Claude Code CLI source code, this document outlines optimizations for the local agent runtime.

## Current State Analysis

### Strengths (Preserve)
- Kubernetes-native, cloud-first architecture
- WebSocket-based communication
- Multi-provider LLM support (Anthropic + OpenAI)
- Basic MCP support
- Event-driven design
- Good tool system foundation with Zod validation

### Gaps vs Claude Code

| Feature | Claude Code | Agent Runtime | Priority |
|---------|-------------|---------------|----------|
| Context Compaction | 4 strategies (snip, microcompact, collapse, autocompact) | Basic summarization | High |
| Tool Parallelism | StreamingToolExecutor with parallel execution | Sequential execution | High |
| Permission System | Multi-layered with pattern matching | Basic rules | Medium |
| Prompt Caching | Cache breakpoints, sophisticated TTL | Simple memory cache | Medium |
| State Management | Custom store with pub-sub | None | Medium |
| Todo/Tasks | Built-in todo tool | None | High |
| Cost Tracking | Per-request cost tracking | None | Medium |
| Tool Count | 40+ tools | 15 tools | Medium |
| LSP Support | Built-in | None | Low |

## Optimization Roadmap

### Phase 1: Core Loop Improvements (High Priority)

1. **Advanced Context Compaction**
   - Implement `SnipCompaction` - Remove intermediate tool progress
   - Implement `Microcompact` - Remove non-essential messages between turns
   - Implement `ContextCollapse` - Archive message ranges
   - Implement `Autocompact` - LLM-based summarization at token thresholds

2. **Streaming Tool Executor**
   - Parallel tool execution
   - Progress tracking
   - Result ordering

3. **Todo Tool**
   - Task tracking within conversations
   - Progress persistence

### Phase 2: Enhanced Systems (Medium Priority)

4. **Permission System Enhancement**
   - Pattern-based tool matching
   - Pre/post execution hooks
   - Permission caching

5. **Prompt Caching with Breakpoints**
   - Cache breakpoint management
   - Multi-level caching (memory + Redis)
   - Provider-specific cache hints

6. **State Store**
   - Pub-sub pattern for state changes
   - Persistent state storage
   - Cross-agent state sharing

7. **Cost Tracking**
   - Per-request cost calculation
   - Usage analytics
   - Budget enforcement

### Phase 3: Additional Tools (Lower Priority)

8. **LSP Integration**
9. **Browser Automation**
10. **Image Processing**
11. **Additional Developer Tools**

## Implementation Details

### 1. Context Compaction Strategies

```typescript
// New file: src/context/compaction/
// - SnipCompaction.ts
// - Microcompact.ts  
// - ContextCollapse.ts
// - Autocompact.ts
// - index.ts (compaction pipeline)
```

### 2. Streaming Tool Executor

```typescript
// New file: src/tools/StreamingToolExecutor.ts
// Features:
// - Parallel execution of independent tools
// - Progress callback support
// - Result ordering by call ID
// - Concurrency limiting
```

### 3. Todo Tool

```typescript
// New file: src/tools/impl/TodoTool.ts
// Features:
// - Create/update/close todos
// - Progress tracking
// - Integration with QueryLoop events
```

### 4. Enhanced Permission System

```typescript
// Update: src/permissions/PermissionManager.ts
// Add:
// - Pattern matching for tool names
// - Pre-execution hooks
// - Post-execution validation
// - Permission decision caching
```

### 5. Prompt Caching

```typescript
// Update: src/services/llm/LLMService.ts
// Add:
// - Cache breakpoint support
// - Multi-level caching
// - Cost-based cache eviction
```

### 6. State Store

```typescript
// New file: src/state/StateStore.ts
// Features:
// - Event-driven state updates
// - Persistence layer
// - Selective subscription
```

### 7. Cost Tracking

```typescript
// New file: src/services/llm/CostTracker.ts
// Features:
// - Per-model pricing
// - Usage aggregation
// - Budget alerts
```

## Success Metrics

- **Context Compaction**: Reduce token usage by 30-50% in long conversations
- **Tool Parallelism**: Reduce multi-tool latency by 40-60%
- **Cache Hit Rate**: Achieve 20%+ cache hit rate for repeated operations
- **Cost Visibility**: 100% visibility into LLM usage costs

## Risk Mitigation

1. **Backward Compatibility**: All changes must maintain API compatibility
2. **Testing**: Comprehensive unit tests for new compaction strategies
3. **Feature Flags**: Use feature flags for gradual rollout
4. **Performance Monitoring**: Track before/after metrics
