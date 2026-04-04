<template>
  <div class="task-board-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">任务看板</h1>
        <p class="page-subtitle">管理和跟踪所有任务</p>
      </div>
      <div class="header-actions">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="list">
            <el-icon><List /></el-icon>
          </el-radio-button>
          <el-radio-button label="kanban">
            <el-icon><Grid /></el-icon>
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
          新建任务
        </el-button>
      </div>
    </div>
    
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索任务..."
        :prefix-icon="Search"
        clearable
        style="width: 240px"
      />
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px">
        <el-option label="全部" value="" />
        <el-option label="待处理" value="pending" />
        <el-option label="进行中" value="running" />
        <el-option label="已完成" value="completed" />
        <el-option label="失败" value="failed" />
      </el-select>
      <el-select v-model="priorityFilter" placeholder="优先级" clearable style="width: 140px">
        <el-option label="全部" value="" />
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
        <el-option label="紧急" value="critical" />
      </el-select>
      <el-button :icon="Refresh" text @click="refreshData" :loading="loading">
        刷新
      </el-button>
    </div>
    
    <!-- 列表视图 -->
    <el-card v-if="viewMode === 'list'" shadow="never" v-loading="loading">
      <TaskList :tasks="filteredTasks" />
      
      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
    
    <!-- 看板视图 -->
    <div v-else class="kanban-board" v-loading="loading">
      <div class="kanban-column" v-for="status in taskStatuses" :key="status.value">
        <div class="kanban-header" :class="status.value">
          <span class="kanban-title">{{ status.label }}</span>
          <el-tag size="small" :type="status.type">{{ getTasksByStatus(status.value).length }}</el-tag>
        </div>
        <el-scrollbar class="kanban-content">
          <div class="kanban-cards">
            <div 
              v-for="task in getTasksByStatus(status.value)" 
              :key="task.id"
              class="kanban-card"
              @click="selectTask(task)"
            >
              <div class="card-title">{{ task.title }}</div>
              <div class="card-meta">
                <el-tag size="small" :type="getPriorityType(task.priority)">
                  {{ task.priority }}
                </el-tag>
                <span class="card-time">{{ formatRelativeTime(task.createdAt) }}</span>
              </div>
              <el-progress 
                v-if="task.progress > 0" 
                :percentage="task.progress" 
                :stroke-width="4"
                :show-text="false"
              />
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, List, Grid, Search, Refresh } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
// import { useRouter } from 'vue-router'
import TaskList from '@/components/agent/TaskList.vue'
// TASK_STATUS and TASK_PRIORITIES available when needed
import { formatRelativeTime } from '@/utils/format'
import type { Task } from '@agenthive/types'

// const router = useRouter()  // reserved for future navigation
const taskStore = useTaskStore()

const loading = ref(false)
const showCreateDialog = ref(false)
const viewMode = ref('list')
const searchQuery = ref('')
const statusFilter = ref('')
const priorityFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const tasks = computed(() => taskStore.tasks)
const total = computed(() => taskStore.total)

const taskStatuses = [
  { value: 'pending', label: '待处理', type: 'info' },
  { value: 'running', label: '进行中', type: 'warning' },
  { value: 'completed', label: '已完成', type: 'success' },
  { value: 'failed', label: '失败', type: 'danger' },
]

const filteredTasks = computed(() => {
  let result = tasks.value
  
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
  
  if (priorityFilter.value) {
    result = result.filter(t => t.priority === priorityFilter.value)
  }
  
  return result
})

const getTasksByStatus = (status: string) => {
  return filteredTasks.value.filter(t => t.status === status)
}

const getPriorityType = (priority: string) => {
  const map: Record<string, string> = {
    low: 'info',
    medium: 'primary',
    high: 'warning',
    critical: 'danger',
  }
  return map[priority] || 'info'
}

const refreshData = async () => {
  loading.value = true
  try {
    await taskStore.fetchTasks({
      page: currentPage.value,
      pageSize: pageSize.value,
    })
  } finally {
    loading.value = false
  }
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  refreshData()
}

const handlePageChange = (val: number) => {
  currentPage.value = val
  refreshData()
}

const selectTask = (task: Task) => {
  // TODO: 打开任务详情对话框或跳转
  console.log('Selected task:', task)
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.task-board-page {
  padding: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

/* 看板视图 */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  height: calc(100vh - 220px);
}

.kanban-column {
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: 3px solid transparent;
}

.kanban-header.pending { border-bottom-color: var(--el-color-info); }
.kanban-header.running { border-bottom-color: var(--el-color-warning); }
.kanban-header.completed { border-bottom-color: var(--el-color-success); }
.kanban-header.failed { border-bottom-color: var(--el-color-danger); }

.kanban-title {
  font-weight: 600;
}

.kanban-content {
  flex: 1;
  padding: 12px;
}

.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kanban-card {
  padding: 16px;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-title {
  font-weight: 500;
  margin-bottom: 12px;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .kanban-board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .filter-bar {
    flex-direction: column;
  }
  
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100% !important;
  }
  
  .kanban-board {
    grid-template-columns: 1fr;
  }
}
</style>
