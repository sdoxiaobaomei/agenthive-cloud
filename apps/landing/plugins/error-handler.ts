/**
 * 全局错误处理插件
 * 处理 Vue 全局错误、未捕获的 Promise 错误、网络错误等
 */

import { 
  handleApiError, 
  toAppError, 
  ErrorCode, 
  installErrorHandler,
  showSuccessMessage,
  showWarningMessage,
} from '~/utils/error-handler'

export default defineNuxtPlugin((nuxtApp) => {
  // ==================== Vue 全局错误处理 ====================
  
  // 安装 Vue 错误处理器
  installErrorHandler(nuxtApp.vueApp)
  
  // ==================== Nuxt 应用生命周期错误 ====================
  
  // 处理 Vue 渲染错误
  nuxtApp.hook('vue:error', (error, instance, info) => {
    console.error('[Nuxt Vue Error]', error)
    
    if (import.meta.dev) {
      console.group('🔴 Vue 渲染错误详情')
      console.error('Error:', error)
      console.error('Component:', instance)
      console.error('Info:', info)
      console.groupEnd()
    }
    
    // 转换并处理错误
    const appError = toAppError(error)
    
    // 严重错误需要特殊处理
    if (appError.severity === 'fatal') {
      // 可以在这里触发全屏错误页面
      console.error('[Fatal Error] 发生致命错误:', appError)
    }
  })
  
  // 处理应用启动错误
  nuxtApp.hook('app:error', (error) => {
    console.error('[Nuxt App Error]', error)
    
    if (import.meta.client) {
      handleApiError(error, {
        showMessage: true,
        redirectOnAuth: true,
      })
    }
  })
  
  // 处理数据获取错误
  // 处理数据获取错误
  nuxtApp.hook('app:data:refresh', () => {
    // 数据刷新完成
  })
  
  // ==================== 客户端特定错误处理 ====================
  
  if (import.meta.client) {
    // ----- 全局错误事件 -----
    window.addEventListener('error', (event) => {
      const { error, filename, lineno, colno, message } = event
      
      console.error('[Global Error]', {
        message,
        filename,
        line: lineno,
        column: colno,
        error,
      })
      
      // 处理特定类型的错误
      if (message?.includes('ResizeObserver')) {
        // ResizeObserver 循环错误通常是良性的，可以忽略
        event.preventDefault()
        return
      }
      
      if (message?.includes('Script error')) {
        // 跨域脚本错误，信息有限
        console.warn('[Script Error] 可能是跨域脚本错误')
      }
      
      // 转换并处理
      const appError = toAppError(error || new Error(message))
      
      // 不显示已处理的错误消息，避免重复
      if (appError.code !== ErrorCode.UNKNOWN_ERROR) {
        // 已在其他位置处理
      }
    }, true)
    
    // ----- 未处理的 Promise 拒绝 -----
    window.addEventListener('unhandledrejection', (event) => {
      const { reason } = event
      
      console.error('[Unhandled Promise Rejection]', reason)
      
      // 忽略某些特定的 Promise 错误
      if (reason?.name === 'CanceledError' || reason?.code === 'ERR_CANCELED') {
        // 请求取消是预期行为，不处理
        event.preventDefault()
        return
      }
      
      if (reason?.message?.includes('aborted')) {
        // 请求中止
        event.preventDefault()
        return
      }
      
      // 处理 API 错误
      const appError = handleApiError(reason, {
        showMessage: true,
        redirectOnAuth: true,
      })
      
      // 阻止默认处理（浏览器控制台会显示错误）
      // event.preventDefault()
    })
    
    // ----- 网络状态监控 -----
    let wasOffline = !navigator.onLine
    
    window.addEventListener('online', () => {
      if (wasOffline) {
        console.log('[Network] 网络已恢复')
        // 显示网络恢复提示
        showSuccessMessage('网络已连接')
        wasOffline = false
      }
    })
    
    window.addEventListener('offline', () => {
      console.log('[Network] 网络已断开')
      wasOffline = true
      
      // 显示网络断开提示
      showWarningMessage({
        message: '网络已断开，请检查网络连接',
        duration: 0, // 不自动关闭
        showClose: true,
      })
    })
    
    // ----- 资源加载错误 -----
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement
      
      // 检查是否是资源加载错误
      if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        console.error('[Resource Load Error]', {
          tag: target.tagName,
          src: (target as any).src || (target as any).href,
        })
        
        // 可以在这里添加资源加载失败的 fallback 处理
      }
    }, true)
    
    // ----- 日志拦截（开发环境）-----
    if (import.meta.dev) {
      const originalConsoleError = console.error
      console.error = (...args: any[]) => {
        // 可以在这里添加错误日志的收集逻辑
        originalConsoleError.apply(console, args)
      }
    }
  }
  
  // ==================== 服务端特定错误处理 ====================
  
  if (import.meta.server) {
    // 服务端渲染错误
    nuxtApp.hook('app:rendered', (context) => {
      if (context.ssrContext?.error) {
        console.error('[SSR Render Error]', context.ssrContext.error)
      }
    })
  }
  
  // ==================== 提供全局工具 ====================
  
  return {
    provide: {
      // 全局错误处理函数
      handleError: handleApiError,
      
      // 错误转换函数
      toAppError,
      
      // 全局错误报告函数
      reportError: (error: any, context?: Record<string, any>) => {
        const appError = toAppError(error)
        
        if (import.meta.client) {
          console.error('[Error Report]', {
            error: appError.toJSON(),
            context,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          })
          
          // TODO: 发送到错误监控服务
        }
        
        return appError
      },
    },
  }
})
