<template>
  <div class="task-list">
    <div class="list-header">
      <el-input
        v-model="searchQuery"
        placeholder="搜索任务..."
        :prefix-icon="Search"
        clearable
        style="width: 240px"
      />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px">
        <el-option label="全部" value="" />
        <el-option label="待处理" value="pending" />
        <el-option label="进行中" value="running" />
        <el-option label="已完成" value="completed" />
        <el-option label="失败" value="failed" />
      </el-select>
    </div>
    
    <el-table :data="filteredTasks" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="100">
        <template #default="{ row }">
          <code>{{ row.id.slice(0, 8) }}</code>
        </template>
      </el-table-column>
      
      <el-table-column prop="title" label="标题" min-width="200">
        <template #default="{ row }">
          <div class="task-title">{{ row.title }}</div>
          <div class="task-desc">{{ row.description || '暂无描述' }}</div>
        </template>
      </el-table-column>
      
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="progress" label="进度" width="150">
        <template #default="{ row }">
          <el-progress 
            :percentage="row.progress" 
            :status="row.status === 'failed' ? 'exception' : undefined"
            :stroke-width="6"
          />
        </template>
      </el-table-column>
      
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatRelativeTime(row.createdAt) }}
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button 
            v-if="row.status === 'running'" 
            type="danger" 
            link 
            size="small"
            @click="handleCancel(row)"
          >
            取消
          </el-button>
          <el-button link type="primary" size="small" @click="handleView(row)">
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <div class="list-footer">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filteredTasks.length"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { Task } from '@/types'
import { formatRelativeTime } from '@/utils/format'
import { TASK_STATUS } from '@/utils/constants'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '@/stores/task'

const props = defineProps<{
  tasks: Task[]
  agentId?: string
  loading?: boolean
}>()

const taskStore = useTaskStore()

const searchQuery = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const filteredTasks = computed(() => {
  let result = props.tasks
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t => 
      t.title.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    )
  }
  
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value)
  }
  
  return result
})

const getStatusType = (status: string) => {
  return TASK_STATUS[status as keyof typeof TASK_STATUS]?.type || 'info'
}

const handleCancel = async (task: Task) => {
  try {
    await taskStore.cancelTask(task.id)
    ElMessage.success('任务已取消')
  } catch {
    ElMessage.error('取消失败')
  }
}

const handleView = (task: Task) => {
  ElMessage.info(`查看任务: ${task.title}`)
}
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-header {
  display: flex;
  gap: 12px;
}

.task-title {
  font-weight: 500;
}

.task-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.list-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
