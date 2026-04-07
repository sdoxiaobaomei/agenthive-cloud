/**
 * 功能开关配置
 * 
 * 用于控制新功能的启用/禁用，支持渐进式迁移
 */

// 从环境变量读取配置
function getEnvFlag(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  return value === 'true' || value === '1'
}

// 功能开关
export const FEATURE_FLAGS = {
  /**
   * 使用 ToolV2 接口
   * @default false
   */
  USE_TOOL_V2: getEnvFlag('AGENT_USE_TOOL_V2', false),

  /**
   * 使用 QueryLoopV2
   * @default false
   */
  USE_QUERY_LOOP_V2: getEnvFlag('AGENT_USE_QUERY_LOOP_V2', false),

  /**
   * 启用 Worktree 隔离
   * @default false
   */
  ENABLE_WORKTREE_ISOLATION: getEnvFlag('AGENT_ENABLE_WORKTREE_ISOLATION', false),

  /**
   * 启用临时目录隔离
   * @default false
   */
  ENABLE_TEMPDIR_ISOLATION: getEnvFlag('AGENT_ENABLE_TEMPDIR_ISOLATION', false),

  /**
   * 启用上下文压缩
   * @default false
   */
  ENABLE_CONTEXT_COMPRESSION: getEnvFlag('AGENT_ENABLE_CONTEXT_COMPRESSION', false),

  /**
   * 启用 AutoClassifier
   * @default false
   */
  ENABLE_AUTO_CLASSIFIER: getEnvFlag('AGENT_ENABLE_AUTO_CLASSIFIER', false),

  /**
   * 启用 MCP 最小实现
   * @default false
   */
  ENABLE_MCP_MINIMAL: getEnvFlag('AGENT_ENABLE_MCP_MINIMAL', false),

  /**
   * 启用权限 Hooks
   * @default false
   */
  ENABLE_PERMISSION_HOOKS: getEnvFlag('AGENT_ENABLE_PERMISSION_HOOKS', false),

  /**
   * 启用团队协作
   * @default false
   */
  ENABLE_TEAM_COLLABORATION: getEnvFlag('AGENT_ENABLE_TEAM_COLLABORATION', false),

  /**
   * 调试模式
   * @default false
   */
  DEBUG: getEnvFlag('AGENT_DEBUG', false)
}

// 类型导出
export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * 检查功能是否启用
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURE_FLAGS[feature]
}

/**
 * 启用功能（运行时）
 */
export function enableFeature(feature: FeatureFlag): void {
  ;(FEATURE_FLAGS as any)[feature] = true
}

/**
 * 禁用功能（运行时）
 */
export function disableFeature(feature: FeatureFlag): void {
  ;(FEATURE_FLAGS as any)[feature] = false
}

/**
 * 获取所有功能状态
 */
export function getFeatureStatus(): Record<FeatureFlag, boolean> {
  return { ...FEATURE_FLAGS }
}

/**
 * 打印功能状态
 */
export function printFeatureStatus(): void {
  console.log('\n🚀 Agent Runtime Feature Flags:')
  console.log('─'.repeat(50))
  for (const [key, value] of Object.entries(FEATURE_FLAGS)) {
    const icon = value ? '✅' : '⬜'
    console.log(`  ${icon} ${key}`)
  }
  console.log('─'.repeat(50))
}
