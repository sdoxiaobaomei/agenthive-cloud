<template>
  <el-card class="agent-workflow-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <AgentAvatar :role="agent.role" :size="32" />
          <span class="agent-name">{{ agent.name }}</span>
          <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
        </div>
        <el-button text @click="toggleExpand">
          <el-icon>
            <ArrowDown v-if="!expanded" />
            <ArrowUp v-else />
          </el-icon>
        </el-button>
      </div>
    </template>

    <!-- SOP 工作流可视化 -->
    <div class="workflow-pipeline">
      <div
        v-for="(phase, index) in workflowPhases"
        :key="phase.name"
        class="phase-item"
        :class="{
          'is-active': currentPhaseIndex === index,
          'is-completed': currentPhaseIndex > index,
          'is-pending': currentPhaseIndex < index
        }"
      >
        <div class="phase-node" @click="selectPhase(phase)">
          <el-icon :size="20">
            <component :is="phase.icon" />
          </el-icon>
          <div class="phase-status-icon">
            <Check v-if="currentPhaseIndex > index" class="completed" />
            <Loading v-else-if="currentPhaseIndex === index && agent.status === 'working'" class="active animate-spin" />
          </div>
        </div>
        <div class="phase-label">{{ phase.label }}</div>
        <div v-if="index < workflowPhases.length - 1" class="phase-connector" :class="{ 'is-completed': currentPhaseIndex > index }" />
      </div>
    </div>

    <!-- 展开详情 -->
    <el-collapse-transition>
      <div v-show="expanded" class="workflow-details">
        <!-- 当前阶段输入 -->
        <div v-if="currentPhase?.inputs?.length" class="detail-section">
          <div class="section-title">输入文档</div>
          <div class="artifact-list">
            <div
              v-for="input in currentPhase.inputs"
              :key="input.id"
              class="artifact-item"
              @click="viewArtifact(input)"
            >
              <el-icon><Document /></el-icon>
              <span class="artifact-name">{{ input.name }}</span>
              <el-tag size="small" :type="input.status === 'ready' ? 'success' : 'info'">
                {{ input.status === 'ready' ? '已就绪' : '等待中' }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 当前阶段输出 -->
        <div v-if="currentPhase?.outputs?.length" class="detail-section">
          <div class="section-title">输出文档</div>
          <div class="artifact-list">
            <div
              v-for="output in currentPhase.outputs"
              :key="output.id"
              class="artifact-item"
              :class="{ 'is-ready': output.status === 'ready' }"
              @click="viewArtifact(output)"
            >
              <el-icon><DocumentChecked v-if="output.status === 'ready'" /><Document /></el-icon>
              <span class="artifact-name">{{ output.name }}</span>
              <el-tag size="small" :type="output.status === 'ready' ? 'success' : 'warning'">
                {{ output.status === 'ready' ? '已完成' : '进行中' }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 阻塞信息 -->
        <div v-if="agentWorkflow.blockedBy" class="detail-section blocked">
          <el-alert
            :title="`被 ${agentWorkflow.blockedBy.agentName} 阻塞`"
            type="warning"
            :description="agentWorkflow.blockedBy.reason"
            show-icon
            :closable="false"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <el-button type="primary" size="small" @click="viewAgentDetail">
            查看详情
          </el-button>
          <el-button v-if="canAdvance" type="success" size="small" @click="advancePhase">
            推进到下一阶段
          </el-button>
        </div>
      </div>
    </el-collapse-transition>

    <!-- 阶段切换弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="阶段文档"
      width="600px"
      destroy-on-close
    >
      <ArtifactViewer v-if="selectedArtifact" :artifact="selectedArtifact" />
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowDown, ArrowUp, Check, Loading,
  Document, DocumentChecked, Edit, Connection, SetUp, CircleCheck
} from '@element-plus/icons-vue'
import AgentAvatar from './AgentAvatar.vue'
import ArtifactViewer from './ArtifactViewer.vue'
import type { Agent, AgentRole } from '@/types'

interface WorkflowPhase {
  name: string
  label: string
  icon: any
  inputs?: Artifact[]
  outputs?: Artifact[]
}

interface Artifact {
  id: string
  name: string
  type: 'prd' | 'design' | 'code' | 'test'
  status: 'pending' | 'ready'
  content?: string
}

interface AgentWorkflow {
  currentPhase: string
  blockedBy?: {
    agentId: string
    agentName: string
    reason: string
  }
  phases: Record<string, {
    inputs: Artifact[]
    outputs: Artifact[]
  }>
}

const props = defineProps<{
  agent: Agent
}>()

const router = useRouter()
const expanded = ref(false)
const dialogVisible = ref(false)
const selectedArtifact = ref<Artifact | null>(null)

// 模拟工作流状态（实际应从后端获取）
const agentWorkflow = computed<AgentWorkflow>(() => {
  // 根据 Agent 角色返回不同的工作流状态
  const workflows: Record<AgentRole, AgentWorkflow> = {
    director: {
      currentPhase: 'planning',
      phases: {
        planning: {
          inputs: [
            { id: '1', name: '用户需求文档', type: 'prd', status: 'ready' },
            { id: '2', name: '市场调研报告', type: 'prd', status: 'ready' }
          ],
          outputs: [
            { id: '3', name: '产品需求文档 PRD', type: 'prd', status: 'ready' },
            { id: '4', name: '项目计划', type: 'design', status: 'pending' }
          ]
        },
        design: { inputs: [], outputs: [] },
        coding: { inputs: [], outputs: [] },
        review: { inputs: [], outputs: [] }
      }
    },
    tech_lead: {
      currentPhase: 'design',
      phases: {
        planning: {
          inputs: [{ id: '1', name: '产品需求文档 PRD', type: 'prd', status: 'ready' }],
          outputs: [{ id: '2', name: '架构设计文档', type: 'design', status: 'ready' }]
        },
        design: {
          inputs: [{ id: '3', name: '技术选型方案', type: 'design', status: 'ready' }],
          outputs: [
            { id: '4', name: 'API 接口定义', type: 'design', status: 'ready' },
            { id: '5', name: '数据库设计', type: 'design', status: 'pending' }
          ]
        },
        coding: { inputs: [], outputs: [] },
        review: { inputs: [], outputs: [] }
      }
    },
    frontend_dev: {
      currentPhase: 'coding',
      blockedBy: { agentId: '2', agentName: 'Tech Lead', reason: '等待 API 接口定义完成' },
      phases: {
        planning: { inputs: [], outputs: [] },
        design: {
          inputs: [{ id: '1', name: 'UI 设计稿', type: 'design', status: 'ready' }],
          outputs: [{ id: '2', name: '组件设计文档', type: 'design', status: 'ready' }]
        },
        coding: {
          inputs: [{ id: '3', name: 'API 接口定义', type: 'design', status: 'pending' }],
          outputs: [
            { id: '4', name: '页面组件代码', type: 'code', status: 'pending' },
            { id: '5', name: '单元测试', type: 'test', status: 'pending' }
          ]
        },
        review: { inputs: [], outputs: [] }
      }
    },
    backend_dev: {
      currentPhase: 'coding',
      phases: {
        planning: { inputs: [], outputs: [] },
        design: {
          inputs: [{ id: '1', name: 'API 接口定义', type: 'design', status: 'ready' }],
          outputs: [{ id: '2', name: '数据库 Schema', type: 'design', status: 'ready' }]
        },
        coding: {
          inputs: [],
          outputs: [
            { id: '3', name: 'API 实现', type: 'code', status: 'ready' },
            { id: '4', name: '服务层代码', type: 'code', status: 'pending' }
          ]
        },
        review: { inputs: [], outputs: [] }
      }
    },
    qa_engineer: {
      currentPhase: 'review',
      phases: {
        planning: { inputs: [], outputs: [] },
        design: { inputs: [], outputs: [] },
        coding: {
          inputs: [{ id: '1', name: '测试用例设计', type: 'design', status: 'ready' }],
          outputs: [{ id: '2', name: '自动化测试脚本', type: 'code', status: 'ready' }]
        },
        review: {
          inputs: [
            { id: '3', name: '前端代码', type: 'code', status: 'ready' },
            { id: '4', name: '后端代码', type: 'code', status: 'ready' }
          ],
          outputs: [
            { id: '5', name: '测试报告', type: 'test', status: 'pending' },
            { id: '6', name: 'Bug 列表', type: 'test', status: 'pending' }
          ]
        }
      }
    },
    devops_engineer: {
      currentPhase: 'coding',
      phases: {
        planning: { inputs: [], outputs: [] },
        design: {
          inputs: [{ id: '1', name: '部署架构设计', type: 'design', status: 'ready' }],
          outputs: [{ id: '2', name: 'CI/CD 流程', type: 'design', status: 'ready' }]
        },
        coding: {
          inputs: [],
          outputs: [
            { id: '3', name: 'Dockerfile', type: 'code', status: 'ready' },
            { id: '4', name: 'K8s 配置', type: 'code', status: 'pending' }
          ]
        },
        review: { inputs: [], outputs: [] }
      }
    },
    scrum_master: {
      currentPhase: 'planning',
      phases: {
        planning: {
          inputs: [
            { id: '1', name: 'Sprint 目标', type: 'prd', status: 'ready' },
            { id: '2', name: '团队容量', type: 'prd', status: 'ready' }
          ],
          outputs: [
            { id: '3', name: 'Sprint Backlog', type: 'design', status: 'ready' }
          ]
        },
        design: { inputs: [], outputs: [] },
        coding: { inputs: [], outputs: [] },
        review: { inputs: [], outputs: [] }
      }
    },
    custom: {
      currentPhase: 'coding',
      phases: {
        planning: { inputs: [], outputs: [] },
        design: { inputs: [], outputs: [] },
        coding: {
          inputs: [],
          outputs: [{ id: '1', name: '自定义任务', type: 'code', status: 'pending' }]
        },
        review: { inputs: [], outputs: [] }
      }
    }
  }
  
  return workflows[props.agent.role] || workflows.custom
})

// SOP 工作流阶段定义
const workflowPhases = computed<WorkflowPhase[]>(() => [
  { name: 'planning', label: '需求分析', icon: Edit, ...agentWorkflow.value.phases.planning },
  { name: 'design', label: '设计', icon: Connection, ...agentWorkflow.value.phases.design },
  { name: 'coding', label: '开发', icon: SetUp, ...agentWorkflow.value.phases.coding },
  { name: 'review', label: '测试评审', icon: CircleCheck, ...agentWorkflow.value.phases.review }
])

const currentPhaseIndex = computed(() => {
  const index = workflowPhases.value.findIndex(p => p.name === agentWorkflow.value.currentPhase)
  return index >= 0 ? index : 0
})

const currentPhase = computed(() => workflowPhases.value[currentPhaseIndex.value])

const statusType = computed(() => {
  const statusMap: Record<string, string> = {
    idle: 'info',
    working: 'primary',
    paused: 'warning',
    error: 'danger',
    completed: 'success'
  }
  return statusMap[props.agent.status] || 'info'
})

const statusText = computed(() => {
  const textMap: Record<string, string> = {
    idle: '空闲',
    working: '工作中',
    paused: '已暂停',
    error: '错误',
    completed: '已完成'
  }
  return textMap[props.agent.status] || props.agent.status
})

const canAdvance = computed(() => {
  // 检查当前阶段输出是否都已完成
  const outputs = currentPhase.value?.outputs || []
  return outputs.every(o => o.status === 'ready') && !agentWorkflow.value.blockedBy
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const selectPhase = (_phase: WorkflowPhase) => {
  // TODO: 展开该阶段的详情
  expanded.value = true
}

const viewArtifact = (artifact: Artifact) => {
  selectedArtifact.value = artifact
  dialogVisible.value = true
}

const viewAgentDetail = () => {
  router.push(`/agents/${props.agent.id}`)
}

const advancePhase = () => {
  // 推进到下一阶段
  // 实际应调用 API
}
</script>

<style scoped>
.agent-workflow-card {
  margin-bottom: 16px;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .agent-name {
        font-weight: 500;
        font-size: 16px;
      }
    }
  }

  .workflow-pipeline {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
    gap: 8px;

    .phase-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      flex: 1;
      max-width: 100px;

      .phase-node {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-fill-color-light);
        border: 2px solid var(--el-border-color);
        cursor: pointer;
        transition: all 0.3s;
        position: relative;

        .phase-status-icon {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          font-size: 12px;

          .completed {
            color: var(--el-color-success);
          }

          .active {
            color: var(--el-color-primary);
          }
        }
      }

      .phase-label {
        margin-top: 8px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        text-align: center;
      }

      .phase-connector {
        position: absolute;
        top: 24px;
        right: -50%;
        width: calc(100% - 24px);
        height: 2px;
        background: var(--el-border-color);
        z-index: -1;

        &.is-completed {
          background: var(--el-color-success);
        }
      }

      &.is-active {
        .phase-node {
          background: var(--el-color-primary-light-9);
          border-color: var(--el-color-primary);
          color: var(--el-color-primary);
        }

        .phase-label {
          color: var(--el-color-primary);
          font-weight: 500;
        }
      }

      &.is-completed {
        .phase-node {
          background: var(--el-color-success-light-9);
          border-color: var(--el-color-success);
          color: var(--el-color-success);
        }
      }
    }
  }

  .workflow-details {
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-light);

    .detail-section {
      margin-bottom: 16px;

      &.blocked {
        margin-top: 16px;
      }

      .section-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-regular);
        margin-bottom: 8px;
      }

      .artifact-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .artifact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--el-fill-color-light);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background: var(--el-fill-color);
          }

          &.is-ready {
            border-left: 3px solid var(--el-color-success);
          }

          .artifact-name {
            flex: 1;
            font-size: 13px;
          }
        }
      }
    }

    .detail-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 16px;
      border-top: 1px solid var(--el-border-color-light);
    }
  }
}
</style>
