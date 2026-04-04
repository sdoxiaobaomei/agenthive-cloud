<template>
  <div class="studio-execution-panel h-full flex flex-col">
    <div class="flex items-center justify-between px-1 pb-3 border-b border-gray-100">
      <h4 class="text-sm font-semibold text-gray-900">执行看板</h4>
      <div class="flex gap-2">
        <button
          class="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
          @click="loadDemo"
        >
          示例
        </button>
        <button
          v-if="!readonly"
          class="px-2 py-1 text-xs rounded-md bg-primary-500 hover:bg-primary-600 text-white"
          @click="exportLog"
        >
          导出
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto py-2">
      <ExecutionBoard />
    </div>
    <div v-if="readonly" class="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700 text-center">
      登录后即可查看真实执行进度并介入指挥
    </div>
  </div>
</template>

<script setup lang="ts">
import ExecutionBoard from '@agenthive/ui/components/execution/ExecutionBoard.vue'
import { useExecutionStore } from '@agenthive/ui/stores/execution'
import { demoPlan } from '@agenthive/ui/utils/execution-demo'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  readonly?: boolean
}>()

const store = useExecutionStore()

function loadDemo() {
  store.createSession(demoPlan)
}

function exportLog() {
  const md = store.exportSessionMarkdown()
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `way-a-session-${store.currentSession!.id}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('日志已导出')
}
</script>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
</style>
