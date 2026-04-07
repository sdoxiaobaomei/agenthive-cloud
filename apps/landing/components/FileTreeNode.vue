<template>
  <div class="file-tree-node">
    <div 
      class="node-content"
      :class="{ 
        selected: isSelected,
        'is-folder': node.type === 'folder'
      }"
      :style="{ paddingLeft: level * 16 + 8 + 'px' }"
      @click="$emit('select', node)"
      @contextmenu="$emit('contextmenu', $event, node)"
      @dragstart="onDragStart"
      @dragover.prevent
      @drop="onDrop"
      draggable="true"
    >
      <button 
        v-if="node.type === 'folder'"
        class="expand-btn"
        :class="{ expanded: isExpanded }"
        @click.stop="$emit('toggle', node)"
      >
        <el-icon><ArrowRight /></el-icon>
      </button>
      <span v-else class="expand-placeholder" />
      
      <FileIcon :filename="node.name" :is-folder="node.type === 'folder'" />
      
      <span v-if="!isRenaming" class="node-name">{{ node.name }}</span>
      <input 
        v-else
        ref="renameInputRef"
        v-model="renameValue"
        class="rename-input"
        @blur="finishRename"
        @keydown.enter="finishRename"
        @keydown.esc="cancelRename"
      />
      
      <span v-if="node.gitStatus && node.gitStatus !== 'unchanged'" 
            class="git-indicator"
            :class="node.gitStatus"
      />
    </div>
    
    <div v-if="node.type === 'folder' && isExpanded && node.children" class="node-children">
      <FileTreeNode 
        v-for="child in node.children" 
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        :level="level + 1"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @contextmenu="$emit('contextmenu', $event, child)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import FileIcon from './FileIcon.vue'

// 与 stores/chat.ts 中的 FileTreeNode 类型保持一致
interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  language?: string
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged'
  children?: FileNode[]
  isExpanded?: boolean
  isOpen?: boolean
  isSelected?: boolean
}

const props = withDefaults(defineProps<{
  node: FileNode
  selectedPath?: string
  expandedPaths?: Set<string>
  level?: number
}>(), {
  level: 0,
  expandedPaths: () => new Set<string>()
})

// 计算是否展开 - 优先使用节点的 isExpanded，其次检查 expandedPaths
const isExpanded = computed(() => {
  if (props.node.isExpanded !== undefined) {
    return props.node.isExpanded
  }
  if (props.node.isOpen !== undefined) {
    return props.node.isOpen
  }
  return props.expandedPaths?.has(props.node.path) || false
})

// 计算是否选中
const isSelected = computed(() => {
  return props.node.isSelected || props.selectedPath === props.node.path
})

const emit = defineEmits<{
  select: [node: FileNode]
  toggle: [node: FileNode]
  rename: [node: FileNode]
  delete: [node: FileNode]
  contextmenu: [event: MouseEvent, node: FileNode]
}>()

const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// Focus input when renaming starts
const focusInput = async () => {
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

const onDragStart = (e: DragEvent) => {
  e.dataTransfer?.setData('text/plain', props.node.path)
}

const onDrop = (e: DragEvent) => {
  const path = e.dataTransfer?.getData('text/plain')
  if (path && props.node.type === 'folder') {
    // Handle drop logic
  }
}

const finishRename = () => {
  if (renameValue.value && renameValue.value !== props.node.name) {
    props.node.name = renameValue.value
    emit('rename', props.node)
  }
  isRenaming.value = false
}

const cancelRename = () => {
  isRenaming.value = false
  renameValue.value = props.node.name
}

// Start rename from parent
const startRename = () => {
  isRenaming.value = true
  renameValue.value = props.node.name
  focusInput()
}

defineExpose({ startRename })
</script>

<style scoped>
.file-tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.node-content:hover {
  background: #f3f4f6;
}

.node-content.selected {
  background: #eff6ff;
  color: #4f46e5;
}

.expand-btn {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: transform 0.15s;
}

.expand-btn:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-placeholder {
  width: 16px;
}

.node-name {
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-content.selected .node-name {
  color: #4f46e5;
  font-weight: 500;
}

.rename-input {
  flex: 1;
  padding: 2px 6px;
  border: 1px solid #4f46e5;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.git-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
}

.git-indicator.modified {
  background: #f59e0b;
}

.git-indicator.added {
  background: #22c55e;
}

.git-indicator.deleted {
  background: #ef4444;
}

.git-indicator.untracked {
  background: #6b7280;
}

.node-children {
  position: relative;
}

.node-children::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #e5e7eb;
}
</style>
