<template>
  <div class="code-diff-viewer">
    <div class="diff-header">
      <div class="diff-title">
        <el-icon><DocumentChecked /></el-icon>
        <span>{{ title || '代码对比' }}</span>
      </div>
      <div class="diff-stats">
        <el-tag size="small" type="success">+{{ additions }}</el-tag>
        <el-tag size="small" type="danger">-{{ deletions }}</el-tag>
      </div>
    </div>

    <div class="diff-toolbar">
      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button label="split">并排</el-radio-button>
        <el-radio-button label="unified">合并</el-radio-button>
      </el-radio-group>
      
      <el-checkbox v-model="showUnchanged" size="small">
        显示未变更行
      </el-checkbox>
      
      <el-button-group size="small">
        <el-button @click="copyOldCode">
          <el-icon><CopyDocument /></el-icon>
          原始代码
        </el-button>
        <el-button @click="copyNewCode">
          <el-icon><Copy /></el-icon>
          修改后
        </el-button>
      </el-button-group>
    </div>

    <div ref="diffContainer" class="diff-container">
      <!-- 并排模式 -->
      <template v-if="viewMode === 'split'">
        <div class="split-view">
          <div class="diff-panel old-code">
            <div class="panel-header">原始代码</div>
            <div class="panel-content">
              <div
                v-for="(line, index) in diffLines"
                :key="`old-${index}`"
                class="diff-line"
                :class="line.type"
              >
                <span class="line-number">{{ line.oldNumber || '' }}</span>
                <span class="line-content">{{ line.oldContent || '' }}</span>
              </div>
            </div>
          </div>
          
          <div class="diff-panel new-code">
            <div class="panel-header">修改后</div>
            <div class="panel-content">
              <div
                v-for="(line, index) in diffLines"
                :key="`new-${index}`"
                class="diff-line"
                :class="line.type"
              >
                <span class="line-number">{{ line.newNumber || '' }}</span>
                <span class="line-content">{{ line.newContent || '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 合并模式 -->
      <template v-else>
        <div class="unified-view">
          <div
            v-for="(line, index) in unifiedLines"
            :key="`unified-${index}`"
            class="diff-line"
            :class="line.type"
          >
            <span class="line-marker">{{ lineMarker(line.type) }}</span>
            <span class="line-number old">{{ line.oldNumber || '' }}</span>
            <span class="line-number new">{{ line.newNumber || '' }}</span>
            <span class="line-content">{{ line.content }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { DocumentChecked, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'placeholder'
  oldNumber?: number
  newNumber?: number
  oldContent?: string
  newContent?: string
  content?: string
}

const props = defineProps<{
  title?: string
  oldCode: string
  newCode: string
  oldFileName?: string
  newFileName?: string
}>()

const viewMode = ref<'split' | 'unified'>('split')
const showUnchanged = ref(true)
const diffContainer = ref<HTMLElement>()

// 计算 diff
const diffLines = computed<DiffLine[]>(() => {
  const oldLines = props.oldCode.split('\n')
  const newLines = props.newCode.split('\n')
  const result: DiffLine[] = []
  
  let oldIndex = 0
  let newIndex = 0
  
  // 简化的 diff 算法
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex]
    const newLine = newLines[newIndex]
    
    if (oldLine === newLine) {
      // 相同行
      if (showUnchanged.value) {
        result.push({
          type: 'unchanged',
          oldNumber: oldIndex + 1,
          newNumber: newIndex + 1,
          oldContent: oldLine,
          newContent: newLine
        })
      }
      oldIndex++
      newIndex++
    } else if (oldIndex < oldLines.length && !newLines.slice(newIndex).includes(oldLine)) {
      // 删除的行
      result.push({
        type: 'removed',
        oldNumber: oldIndex + 1,
        oldContent: oldLine,
        newContent: ''
      })
      oldIndex++
    } else if (newIndex < newLines.length && !oldLines.slice(oldIndex).includes(newLine)) {
      // 新增的行
      result.push({
        type: 'added',
        newNumber: newIndex + 1,
        oldContent: '',
        newContent: newLine
      })
      newIndex++
    } else {
      // 修改的行（先删后加）
      if (oldIndex < oldLines.length) {
        result.push({
          type: 'removed',
          oldNumber: oldIndex + 1,
          oldContent: oldLine,
          newContent: ''
        })
        oldIndex++
      }
      if (newIndex < newLines.length) {
        result.push({
          type: 'added',
          newNumber: newIndex + 1,
          oldContent: '',
          newContent: newLine
        })
        newIndex++
      }
    }
  }
  
  return result
})

// 合并模式的行
const unifiedLines = computed(() => {
  return diffLines.value.map(line => ({
    ...line,
    content: line.oldContent || line.newContent || ''
  }))
})

// 统计
const additions = computed(() => diffLines.value.filter(l => l.type === 'added').length)
const deletions = computed(() => diffLines.value.filter(l => l.type === 'removed').length)

// 行标记
const lineMarker = (type: string) => {
  const markers: Record<string, string> = {
    added: '+',
    removed: '-',
    unchanged: ' ',
    placeholder: ' '
  }
  return markers[type] || ' '
}

// 复制代码
const copyOldCode = () => {
  navigator.clipboard.writeText(props.oldCode)
  ElMessage.success('原始代码已复制')
}

const copyNewCode = () => {
  navigator.clipboard.writeText(props.newCode)
  ElMessage.success('修改后代码已复制')
}
</script>

<style scoped>
.code-diff-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);

  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-light);

    .diff-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .diff-stats {
      display: flex;
      gap: 8px;
    }
  }

  .diff-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-lighter);

    :deep(.el-radio-group) {
      margin-right: auto;
    }
  }

  .diff-container {
    flex: 1;
    overflow: auto;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;

    .split-view {
      display: flex;
      height: 100%;

      .diff-panel {
        flex: 1;
        overflow: auto;
        border-right: 1px solid var(--el-border-color-light);

        &:last-child {
          border-right: none;
        }

        .panel-header {
          position: sticky;
          top: 0;
          padding: 8px 16px;
          background: var(--el-fill-color-light);
          border-bottom: 1px solid var(--el-border-color-light);
          font-weight: 500;
          z-index: 1;
        }

        .panel-content {
          padding: 8px 0;
        }
      }
    }

    .unified-view {
      padding: 8px 0;
    }

    .diff-line {
      display: flex;
      align-items: stretch;
      min-height: 20px;

      &.added {
        background: rgba(103, 194, 58, 0.1);

        .line-marker {
          color: var(--el-color-success);
        }
      }

      &.removed {
        background: rgba(245, 108, 108, 0.1);

        .line-marker {
          color: var(--el-color-danger);
        }
      }

      &.unchanged {
        background: transparent;
      }

      .line-marker {
        width: 20px;
        text-align: center;
        flex-shrink: 0;
        user-select: none;
      }

      .line-number {
        width: 50px;
        text-align: right;
        padding-right: 12px;
        color: var(--el-text-color-secondary);
        flex-shrink: 0;
        user-select: none;
        border-right: 1px solid var(--el-border-color-lighter);

        &.old {
          background: rgba(245, 108, 108, 0.05);
        }

        &.new {
          background: rgba(103, 194, 58, 0.05);
        }
      }

      .line-content {
        flex: 1;
        padding-left: 12px;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}
</style>
