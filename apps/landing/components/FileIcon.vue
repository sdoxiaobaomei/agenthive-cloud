<template>
  <div class="file-icon" :class="iconClass">
    <el-icon v-if="isFolder">
      <Folder v-if="isOpen" />
      <FolderOpened v-else />
    </el-icon>
    <el-icon v-else-if="isImage">
      <Picture />
    </el-icon>
    <el-icon v-else-if="isCode">
      <Document />
    </el-icon>
    <el-icon v-else-if="isConfig">
      <Setting />
    </el-icon>
    <el-icon v-else>
      <Document />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Folder, FolderOpened, Picture, Document, Setting } from '@element-plus/icons-vue'

const props = defineProps<{
  filename: string
  isFolder?: boolean
  isOpen?: boolean
}>()

const extension = computed(() => {
  const parts = props.filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() : ''
})

const isImage = computed(() => {
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']
  return imageExts.includes(extension.value || '')
})

const isCode = computed(() => {
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'vue', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h']
  return codeExts.includes(extension.value || '')
})

const isConfig = computed(() => {
  const configExts = ['json', 'yaml', 'yml', 'toml', 'ini', 'env']
  return configExts.includes(extension.value || '') || 
         props.filename.startsWith('.')
})

const iconClass = computed(() => {
  if (props.isFolder) return 'folder'
  if (isImage.value) return 'image'
  if (isCode.value) return 'code'
  if (isConfig.value) return 'config'
  return 'default'
})
</script>

<style scoped>
.file-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.file-icon.folder {
  color: #f59e0b;
}

.file-icon.image {
  color: #8b5cf6;
}

.file-icon.code {
  color: #3b82f6;
}

.file-icon.config {
  color: #6b7280;
}

.file-icon.default {
  color: #9ca3af;
}
</style>
