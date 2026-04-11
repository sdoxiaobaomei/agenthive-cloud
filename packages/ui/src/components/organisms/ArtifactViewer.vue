<template>
  <div class="artifact-viewer">
    <div class="artifact-header">
      <div class="artifact-meta">
        <el-icon :size="24" :color="typeColor">
          <Document v-if="artifact.type === 'prd'" />
          <Connection v-else-if="artifact.type === 'design'" />
          <DocumentCopy v-else-if="artifact.type === 'code'" />
          <Check v-else />
        </el-icon>
        <div class="meta-info">
          <div class="artifact-name">{{ artifact.name }}</div>
          <div class="artifact-type">{{ typeLabel }}</div>
        </div>
      </div>
      <el-tag :type="artifact.status === 'ready' ? 'success' : 'warning'">
        {{ artifact.status === 'ready' ? '已完成' : '进行中' }}
      </el-tag>
    </div>

    <div class="artifact-content">
      <div v-if="artifact.content" class="content-body">
        <pre><code>{{ artifact.content }}</code></pre>
      </div>
      <div v-else class="content-placeholder">
        <el-empty description="文档内容为空" />
      </div>
    </div>

    <div class="artifact-actions">
      <el-button size="small" @click="download">
        <el-icon><Download /></el-icon>
        下载
      </el-button>
      <el-button size="small" type="primary" @click="copy">
        <el-icon><Copy /></el-icon>
        复制
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document, Connection, DocumentCopy, Check, Download } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

interface Artifact {
  id: string
  name: string
  type: 'prd' | 'design' | 'code' | 'test'
  status: 'pending' | 'ready'
  content?: string
}

const props = defineProps<{
  artifact: Artifact
}>()

const typeColor = computed(() => {
  const colors: Record<string, string> = {
    prd: '#409EFF',
    design: '#67C23A',
    code: '#E6A23C',
    test: '#F56C6C'
  }
  return colors[props.artifact.type] || '#909399'
})

const typeLabel = computed(() => {
  const labels: Record<string, string> = {
    prd: '需求文档',
    design: '设计文档',
    code: '代码',
    test: '测试文档'
  }
  return labels[props.artifact.type] || '文档'
})

const download = () => {
  if (typeof window === 'undefined') return
  const blob = new Blob([props.artifact.content || ''], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.artifact.name}.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('下载成功')
}

const copy = () => {
  if (typeof window === 'undefined') return
  navigator.clipboard.writeText(props.artifact.content || '')
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.artifact-viewer {
  .artifact-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    margin-bottom: 16px;

    .artifact-meta {
      display: flex;
      align-items: center;
      gap: 12px;

      .meta-info {
        .artifact-name {
          font-weight: 500;
          font-size: 16px;
        }

        .artifact-type {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin-top: 4px;
        }
      }
    }
  }

  .artifact-content {
    min-height: 300px;
    max-height: 500px;
    overflow: auto;

    .content-body {
      background: var(--el-fill-color-light);
      border-radius: 4px;
      padding: 16px;

      pre {
        margin: 0;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }
    }

    .content-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 300px;
    }
  }

  .artifact-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-light);
    margin-top: 16px;
  }
}
</style>
