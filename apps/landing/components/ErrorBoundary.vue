<template>
  <!-- 正常渲染子组件 -->
  <slot v-if="!hasError" />
  
  <!-- 错误回退 UI -->
  <div v-else class="error-boundary">
    <div class="error-boundary__content">
      <!-- 图标 -->
      <div class="error-boundary__icon">
        <el-icon :size="64" color="#f56c6c">
          <CircleCloseFilled />
        </el-icon>
      </div>
      
      <!-- 标题 -->
      <h3 class="error-boundary__title">
        {{ title }}
      </h3>
      
      <!-- 错误描述 -->
      <p class="error-boundary__description">
        {{ description || errorMessage }}
      </p>
      
      <!-- 错误详情（仅开发环境显示） -->
      <div v-if="showDetails && errorDetails" class="error-boundary__details">
        <el-collapse>
          <el-collapse-item title="错误详情（仅开发人员可见）" name="details">
            <pre class="error-boundary__code">{{ errorDetails }}</pre>
          </el-collapse-item>
        </el-collapse>
      </div>
      
      <!-- 操作按钮 -->
      <div class="error-boundary__actions">
        <el-button 
          type="primary" 
          :icon="RefreshRight"
          @click="reset"
        >
          {{ retryText }}
        </el-button>
        
        <el-button 
          v-if="showHomeButton"
          :icon="HomeFilled"
          @click="goHome"
        >
          返回首页
        </el-button>
        
        <el-button 
          v-if="showReportButton"
          type="info"
          plain
          :icon="WarningFilled"
          @click="reportError"
        >
          反馈问题
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  CircleCloseFilled, 
  RefreshRight, 
  HomeFilled, 
  WarningFilled 
} from '@element-plus/icons-vue'
import { toAppError, ErrorCode } from '~/utils/error-handler'

// ==================== 类型定义 ====================

interface Props {
  /** 自定义标题 */
  title?: string
  /** 自定义描述 */
  description?: string
  /** 重试按钮文字 */
  retryText?: string
  /** 是否显示返回首页按钮 */
  showHomeButton?: boolean
  /** 是否显示反馈按钮 */
  showReportButton?: boolean
  /** 是否在捕获错误时停止传播 */
  stopPropagation?: boolean
  /** 自定义错误处理器 */
  onError?: (error: Error, errorInfo: string) => void
  /** 最大错误恢复次数 */
  maxRecoveryAttempts?: number
}

// ==================== Props & Emits ====================

const props = withDefaults(defineProps<Props>(), {
  title: '页面出错了',
  description: '',
  retryText: '重新加载',
  showHomeButton: true,
  showReportButton: false,
  stopPropagation: false,
  onError: undefined,
  maxRecoveryAttempts: 3,
})

const emit = defineEmits<{
  /** 错误恢复事件 */
  (e: 'reset'): void
  /** 错误捕获事件 */
  (e: 'error', error: Error, errorInfo: string): void
}>()

// ==================== 状态 ====================

const router = useRouter()

const hasError = ref(false)
const error = ref<Error | null>(null)
const errorInfo = ref('')
const recoveryAttempts = ref(0)

// ==================== 计算属性 ====================

/** 是否显示错误详情（仅在开发环境） */
const showDetails = computed(() => {
  return import.meta.dev
})

/** 格式化的错误消息 */
const errorMessage = computed(() => {
  if (!error.value) return '发生未知错误'
  
  const appError = toAppError(error.value)
  return appError.message
})

/** 详细的错误信息（用于调试） */
const errorDetails = computed(() => {
  if (!error.value) return ''
  
  const details = [
    `错误信息: ${error.value.message}`,
    `错误名称: ${error.value.name}`,
    `组件栈: ${errorInfo.value}`,
    `堆栈跟踪:`,
    error.value.stack || '无堆栈信息',
  ]
  
  return details.join('\n')
})

/** 是否还可以重试 */
const canRetry = computed(() => {
  return recoveryAttempts.value < props.maxRecoveryAttempts
})

// ==================== 方法 ====================

/**
 * 重置错误状态，重新渲染子组件
 */
function reset(): void {
  if (!canRetry.value) {
    ElMessage.warning('已达到最大重试次数，请刷新页面或返回首页')
    return
  }
  
  recoveryAttempts.value++
  hasError.value = false
  error.value = null
  errorInfo.value = ''
  
  emit('reset')
  
  // 如果重试次数较多，给出提示
  if (recoveryAttempts.value > 1) {
    ElMessage.info(`第 ${recoveryAttempts.value} 次尝试恢复...`)
  }
}

/**
 * 返回首页
 */
function goHome(): void {
  router.push('/')
}

/**
 * 报告错误
 */
function reportError(): void {
  // 这里可以集成错误反馈表单或发送到监控服务
  const errorData = {
    message: error.value?.message,
    stack: error.value?.stack,
    component: errorInfo.value,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  }
  
  // 复制到剪贴板
  navigator.clipboard.writeText(JSON.stringify(errorData, null, 2))
    .then(() => {
      ElMessage.success('错误信息已复制到剪贴板，请粘贴反馈给开发团队')
    })
    .catch(() => {
      ElMessage.info('请截图此页面并反馈给开发团队')
      console.log('Error Data:', errorData)
    })
}

/**
 * 手动设置错误（用于测试或外部控制）
 */
function setError(err: Error, info: string = ''): void {
  hasError.value = true
  error.value = err
  errorInfo.value = info
}

/**
 * 获取当前错误状态
 */
function getErrorState() {
  return {
    hasError: hasError.value,
    error: error.value,
    errorInfo: errorInfo.value,
    recoveryAttempts: recoveryAttempts.value,
  }
}

// ==================== 生命周期 ====================

/**
 * 捕获子组件错误
 */
onErrorCaptured((err: unknown, instance, info: string) => {
  // 忽略某些特定错误
  if (err instanceof Error) {
    // 忽略异步加载错误（如动态导入失败）
    if (err.message?.includes('Failed to fetch dynamically imported module')) {
      console.warn('[ErrorBoundary] 动态导入失败，忽略错误:', err)
      return false
    }
    
    // 忽略网络取消错误
    if (err.name === 'CanceledError' || err.message?.includes('cancel')) {
      return false
    }
  }

  // 记录错误
  console.error('[ErrorBoundary] 捕获到错误:', err)
  console.error('[ErrorBoundary] 组件:', instance)
  console.error('[ErrorBoundary] 信息:', info)

  // 设置错误状态
  hasError.value = true
  error.value = err instanceof Error ? err : new Error(String(err))
  errorInfo.value = info

  // 执行自定义错误处理器
  if (props.onError) {
    props.onError(error.value, info)
  }

  // 发送错误事件
  emit('error', error.value, info)

  // 上报错误（生产环境）
  if (import.meta.env.PROD) {
    // TODO: 发送到监控服务
    console.debug('[Error Report]', {
      error: error.value?.message,
      stack: error.value?.stack,
      component: info,
      url: window.location.href,
    })
  }

  // 是否阻止错误继续传播
  return props.stopPropagation
})

onMounted(() => {
  // 监听全局错误，用于恢复
  if (import.meta.client) {
    window.addEventListener('error', (event) => {
      console.error('[ErrorBoundary] 全局错误:', event.error)
    })
  }
})

// ==================== 暴露方法 ====================

defineExpose({
  reset,
  setError,
  getErrorState,
  hasError,
  error,
})
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
  background-color: var(--el-bg-color);
}

.error-boundary__content {
  max-width: 600px;
  text-align: center;
}

.error-boundary__icon {
  margin-bottom: 24px;
}

.error-boundary__title {
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.error-boundary__description {
  margin: 0 0 32px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.error-boundary__details {
  margin-bottom: 24px;
  text-align: left;
}

.error-boundary__code {
  padding: 16px;
  margin: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-boundary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .error-boundary {
    min-height: 300px;
    padding: 24px 16px;
  }
  
  .error-boundary__title {
    font-size: 20px;
  }
  
  .error-boundary__actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .error-boundary__actions .el-button {
    margin-left: 0 !important;
  }
}
</style>
