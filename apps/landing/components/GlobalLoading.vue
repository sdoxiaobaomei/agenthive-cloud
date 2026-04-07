<template>
  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="isLoading" 
        class="global-loading-overlay"
        role="alert"
        aria-busy="true"
        aria-label="加载中"
      >
        <div class="global-loading-content">
          <!-- Loading 图标 -->
          <div class="loading-spinner">
            <svg class="spinner-svg" viewBox="0 0 50 50">
              <circle
                class="spinner-track"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke-width="4"
              />
              <circle
                class="spinner-indicator"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke-width="4"
              />
            </svg>
          </div>
          
          <!-- Loading 文本 -->
          <p class="loading-text">{{ loadingText }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 全局 Loading 组件
 * 
 * 特性:
 * - 使用 Teleport 将遮罩层渲染到 body，避免 z-index 问题
 * - 使用 Element Plus 风格的加载动画
 * - 支持淡入淡出过渡动画
 * - 完全响应式，适配移动端
 */

const { isLoading, loadingText } = useLoading()
</script>

<style scoped>
/* 遮罩层 */
.global-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(2px);
}

/* 内容容器 */
.global-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: white;
  border-radius: 12px;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* Loading 图标容器 */
.loading-spinner {
  width: 40px;
  height: 40px;
}

/* SVG 动画 */
.spinner-svg {
  width: 100%;
  height: 100%;
  animation: rotate 2s linear infinite;
}

.spinner-track {
  stroke: #e5e7eb;
}

.spinner-indicator {
  stroke: #3b82f6;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

/* Loading 文本 */
.loading-text {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  letter-spacing: 0.025em;
}

/* 旋转动画 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 描边动画 */
@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

/* 淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .global-loading-content {
    padding: 24px 32px;
    margin: 0 16px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
  }

  .loading-text {
    font-size: 13px;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .global-loading-overlay {
    background-color: rgba(0, 0, 0, 0.6);
  }

  .global-loading-content {
    background: #1f2937;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.3),
      0 2px 4px -2px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .spinner-track {
    stroke: #374151;
  }

  .spinner-indicator {
    stroke: #60a5fa;
  }

  .loading-text {
    color: #d1d5db;
  }
}
</style>
