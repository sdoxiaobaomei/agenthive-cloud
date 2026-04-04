<template>
  <div 
    class="agent-avatar" 
    :style="{ width: size + 'px', height: size + 'px' }"
    :class="[`role-${role}`, `status-${status}`]"
  >
    <img
      v-if="shibaSrc"
      :src="shibaSrc"
      alt="agent avatar"
      class="avatar-img"
    />
    <div v-else class="avatar-inner" :style="{ fontSize: iconSize + 'px' }">
      <el-icon>
        <component :is="roleIcon" />
      </el-icon>
    </div>
    <div v-if="showStatusRing" class="status-ring"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  VideoCamera, Management, Cpu, Monitor, 
  Picture, CircleCheck, Cloudy, User 
} from '@element-plus/icons-vue'
import type { AgentRole, AgentStatus } from '@/types'

const props = withDefaults(defineProps<{
  role: AgentRole
  status?: AgentStatus
  size?: number
}>(), {
  status: 'idle',
  size: 40,
})

const roleIcon = computed(() => {
  const iconMap: Record<AgentRole, any> = {
    director: VideoCamera,
    scrum_master: Management,
    tech_lead: Cpu,
    backend_dev: Monitor,
    frontend_dev: Picture,
    qa_engineer: CircleCheck,
    devops_engineer: Cloudy,
    custom: User,
  }
  return iconMap[props.role] || User
})

const iconSize = computed(() => Math.floor(props.size * 0.5))

const showStatusRing = computed(() => props.status === 'working')

const shibaSrc = computed(() => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const map: Record<string, string> = {
    tech_lead: `${base}/avatars/shiba_tl.png`,
    frontend_dev: `${base}/avatars/shiba_fe.png`,
    backend_dev: `${base}/avatars/shiba_be.png`,
    qa_engineer: `${base}/avatars/shiba_qa.png`,
  }
  return map[props.role] || ''
})

const roleColor = computed(() => {
  const colorMap: Record<AgentRole, string> = {
    director: '#722ed1',
    scrum_master: '#13c2c2',
    tech_lead: '#1890ff',
    backend_dev: '#52c41a',
    frontend_dev: '#eb2f96',
    qa_engineer: '#fa8c16',
    devops_engineer: '#f5222d',
    custom: '#8c8c8c',
  }
  return colorMap[props.role] || '#8c8c8c'
})
</script>

<style scoped>
.agent-avatar {
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: v-bind('roleColor + "20"');
  color: v-bind('roleColor');
}

.avatar-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.status-ring {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid var(--agent-working);
  border-radius: 50%;
  animation: rotate 2s linear infinite;
}

.status-ring::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  background: var(--agent-working);
  border-radius: 50%;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
