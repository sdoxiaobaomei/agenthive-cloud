<template>
  <div class="version-switcher">
    <el-dropdown trigger="click" @command="handleSwitch">
      <div class="version-trigger">
        <el-icon><Clock /></el-icon>
        <span class="version-label">{{ currentVersionLabel }}</span>
        <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="version in versions"
            :key="version.id"
            :command="version.id"
            :class="{ active: version.id === currentVersionId }"
          >
            <div class="version-item">
              <span class="version-title">{{ version.title }}</span>
              <el-tag v-if="version.isActive" size="small" type="success">当前</el-tag>
            </div>
          </el-dropdown-item>
          <el-dropdown-item divided command="__new">
            <div class="version-item new-version">
              <el-icon><Plus /></el-icon>
              <span>创建新版本</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, ArrowDown, Plus } from '@element-plus/icons-vue'
import type { ChatVersion } from '~/stores/chat'

interface Props {
  versions: ChatVersion[]
  currentVersionId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  switch: [versionId: string]
  create: []
}>()

const currentVersionLabel = computed(() => {
  if (!props.currentVersionId) return '当前版本'
  const v = props.versions.find(v => v.id === props.currentVersionId)
  return v?.title || `版本 ${props.currentVersionId}`
})

function handleSwitch(command: string) {
  if (command === '__new') {
    emit('create')
  } else {
    emit('switch', command)
  }
}
</script>

<style scoped>
.version-switcher {
  padding: 6px 12px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.version-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s ease;
}

.version-trigger:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.version-label {
  font-weight: 500;
}

.dropdown-icon {
  margin-left: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.version-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-version {
  color: #4f46e5;
  font-weight: 500;
}
</style>
