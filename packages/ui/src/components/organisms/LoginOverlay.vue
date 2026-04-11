<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="login-overlay fixed inset-0 z-[60] flex items-center justify-center bg-white/40 backdrop-blur-sm"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl border border-gray-100 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <span class="text-2xl">🐕</span>
        </div>
        <h3 class="mb-1 text-lg font-semibold text-gray-900">加入柴犬装修队</h3>
        <p class="mb-6 text-sm text-gray-500">登录后即可介入 Agent 团队的工作，实时指挥开发流程</p>
        <div class="flex flex-col gap-3">
          <button
            class="w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
            @click="$emit('login')"
          >
            登录 / 注册
          </button>
          <button
            class="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            @click="$emit('update:modelValue', false)"
          >
            继续以访客模式浏览
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'login'): void
}>()
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.bg-primary-50 { background-color: #eff6ff; }
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
</style>
