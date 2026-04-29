<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue'

interface Props {
  visible: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info' | 'primary'
  loading?: boolean
  showClose?: boolean
  closeOnClickModal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  type: 'warning',
  loading: false,
  showClose: true,
  closeOnClickModal: false,
})

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  confirm: []
  cancel: []
}>()

const typeConfig = {
  warning: { buttonType: 'warning' as const, iconColor: 'text-amber-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  danger: { buttonType: 'danger' as const, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  info: { buttonType: 'primary' as const, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  primary: { buttonType: 'primary' as const, iconColor: 'text-primary-500', bgColor: 'bg-primary-50', borderColor: 'border-primary-200' },
}

const config = typeConfig[props.type]

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<template>
  <ElDialog
    :model-value="visible"
    :title="title"
    :show-close="showClose"
    :close-on-click-modal="closeOnClickModal"
    width="420px"
    class="confirm-dialog"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="flex items-start gap-4">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
        :class="[config.bgColor, config.borderColor]"
      >
        <ElIcon :size="20" :class="config.iconColor">
          <Warning />
        </ElIcon>
      </div>
      <div>
        <p class="text-sm text-slate-700 dark:text-slate-200">{{ message }}</p>
        <slot name="extra" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <ElButton :disabled="loading" @click="handleCancel">
          {{ cancelText }}
        </ElButton>
        <ElButton :type="config.buttonType" :loading="loading" @click="handleConfirm">
          {{ confirmText }}
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.confirm-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  padding-bottom: 8px;
}
</style>
