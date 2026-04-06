<template>
  <ClientOnly>
    <slot />
    <template #fallback>
      <slot name="fallback">
        <!-- 默认占位内容 -->
        <div 
          v-if="showPlaceholder" 
          :style="{ width: placeholderWidth, height: placeholderHeight }"
          :class="placeholderClass"
        >
          <slot name="loading">
            <div v-if="showLoading" class="client-render-loading">
              <div class="loading-spinner" />
              <span v-if="loadingText" class="loading-text">{{ loadingText }}</span>
            </div>
          </slot>
        </div>
      </slot>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * ClientRender - SSR 安全客户端渲染包装组件
 * 
 * 使用场景:
 * 1. 包裹使用浏览器 API 的组件 (window/document/localStorage)
 * 2. 包裹 Element Plus 下拉菜单、弹窗等交互组件
 * 3. 包裹第三方客户端库 (图表、地图等)
 * 4. 需要动态生成 ID/随机数/日期的组件
 * 
 * 示例:
 * <ClientRender>
 *   <el-dropdown>...</el-dropdown>
 * </ClientRender>
 * 
 * <ClientRender placeholder-height="200px" loading-text="加载中...">
 *   <ChartComponent />
 * </ClientRender>
 */

withDefaults(defineProps<{
  /** 是否显示占位容器 */
  showPlaceholder?: boolean
  /** 占位容器宽度 */
  placeholderWidth?: string
  /** 占位容器高度 */
  placeholderHeight?: string
  /** 占位容器 CSS 类 */
  placeholderClass?: string
  /** 是否显示加载动画 */
  showLoading?: boolean
  /** 加载提示文字 */
  loadingText?: string
}>(), {
  showPlaceholder: true,
  placeholderWidth: '100%',
  placeholderHeight: 'auto',
  placeholderClass: '',
  showLoading: false,
  loadingText: ''
})
</script>

<style scoped>
.client-render-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  gap: 8px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--ah-beige-200, #ebeae5);
  border-top-color: var(--ah-primary, #4267ff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 12px;
  color: var(--ah-grey-500, #58585a);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
