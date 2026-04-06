<template>
  <div class="agent-team">
    <!-- Team Header -->
    <div class="team-header">
      <h3 class="team-title">AI Team</h3>
      <p class="team-desc">Select an agent to help you</p>
    </div>

    <!-- Active Agent Display -->
    <div class="active-agent" v-if="selectedAgent">
      <div class="agent-card" :class="{ expanded: showDetails }" @click="toggleDetails">
        <img :src="selectedAgent.avatar" class="agent-avatar" :alt="selectedAgent.name" />
        <div class="agent-info">
          <div class="agent-main">
            <span class="agent-name">{{ selectedAgent.name }}</span>
            <span class="agent-role">{{ selectedAgent.role }}</span>
          </div>
          <p v-if="showDetails" class="agent-bio">{{ selectedAgent.bio }}</p>
          <div v-if="showDetails" class="agent-skills">
            <span v-for="skill in selectedAgent.skills" :key="skill" class="skill-tag">
              {{ skill }}
            </span>
          </div>
        </div>
        <el-icon class="expand-icon" :class="{ rotated: showDetails }">
          <ArrowDown />
        </el-icon>
      </div>
    </div>

    <!-- Agent Selector -->
    <div class="agent-selector">
      <div class="selector-label">Switch Agent</div>
      <div class="agent-list">
        <button
          v-for="agent in agents"
          :key="agent.id"
          class="agent-btn"
          :class="{ active: selectedAgent?.id === agent.id }"
          @click="selectAgent(agent)"
          :title="`${agent.name} - ${agent.role}`"
        >
          <img :src="agent.avatar" class="btn-avatar" :alt="agent.name" />
          <span class="btn-name">{{ agent.name }}</span>
          <span v-if="agent.isNew" class="new-badge">New</span>
        </button>
      </div>
    </div>

    <!-- Team Overview -->
    <div class="team-overview">
      <div class="overview-header" @click="showTeamPanel = !showTeamPanel">
        <span>All Agents</span>
        <el-icon class="toggle-icon" :class="{ rotated: showTeamPanel }">
          <ArrowRight />
        </el-icon>
      </div>
      
      <div v-show="showTeamPanel" class="overview-grid">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="overview-card"
          :class="{ active: selectedAgent?.id === agent.id }"
          @click="selectAgent(agent)"
        >
          <img :src="agent.avatar" class="overview-avatar" :alt="agent.name" />
          <div class="overview-info">
            <span class="overview-name">{{ agent.name }}</span>
            <span class="overview-role">{{ agent.role }}</span>
          </div>
          <div class="overview-status" :class="agent.status">
            <span class="status-dot"></span>
            <span class="status-text">{{ agent.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="action-btn" @click="showAgentComparison = true">
        <el-icon><InfoFilled /></el-icon>
        <span>Compare Agents</span>
      </button>
      <button class="action-btn" @click="autoSelectAgent">
        <el-icon><Star /></el-icon>
        <span>Auto Select</span>
      </button>
    </div>

    <!-- Agent Comparison Modal -->
    <el-dialog
      v-model="showAgentComparison"
      title="AI Team Overview"
      width="600px"
      :close-on-click-modal="true"
      class="comparison-dialog"
    >
      <div class="comparison-content">
        <div class="comparison-grid">
          <div
            v-for="agent in agents"
            :key="agent.id"
            class="comparison-card"
          >
            <div class="card-header">
              <img :src="agent.avatar" class="card-avatar" :alt="agent.name" />
              <div class="card-title">
                <h4>{{ agent.name }}</h4>
                <span>{{ agent.role }}</span>
              </div>
            </div>
            <p class="card-bio">{{ agent.bio }}</p>
            <div class="card-skills">
              <span v-for="skill in agent.skills" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
            <button 
              class="select-btn" 
              :class="{ active: selectedAgent?.id === agent.id }"
              @click="selectAgent(agent); showAgentComparison = false"
            >
              {{ selectedAgent?.id === agent.id ? 'Selected' : 'Select' }}
            </button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown, ArrowRight, InfoFilled, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Agent {
  id: string
  name: string
  role: string
  avatar: string
  bio: string
  skills: string[]
  status: 'online' | 'busy' | 'offline'
  isNew?: boolean
}

const agents = ref<Agent[]>([
  {
    id: 'alex',
    name: 'Alex',
    role: 'Engineer',
    avatar: '/avatars/shiba_be.png',
    bio: 'Full-stack engineer who builds production-ready applications with clean, maintainable code.',
    skills: ['React', 'Vue', 'Node.js', 'Database', 'API Design'],
    status: 'online'
  },
  {
    id: 'emma',
    name: 'Emma',
    role: 'Product Manager',
    avatar: '/avatars/shiba_fe.png',
    bio: 'Transforms your ideas into clear product specs and user-friendly features.',
    skills: ['Product Strategy', 'User Research', 'Feature Planning', 'UX Design'],
    status: 'online'
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Architect',
    avatar: '/avatars/shiba_qa.png',
    bio: 'Designs scalable system architecture and chooses the right tech stack for your project.',
    skills: ['System Design', 'Cloud Infrastructure', 'Security', 'Performance'],
    status: 'online'
  },
  {
    id: 'sarah',
    name: 'Sarah',
    role: 'SEO Specialist',
    avatar: '/avatars/shiba_tl.png',
    bio: 'Optimizes your website for search engines to drive organic traffic.',
    skills: ['SEO', 'Content Strategy', 'Analytics', 'Keyword Research'],
    status: 'online'
  },
  {
    id: 'david',
    name: 'David',
    role: 'Data Analyst',
    avatar: '/avatars/shiba_be.png',
    bio: 'Analyzes data to uncover insights and growth opportunities for your business.',
    skills: ['Data Analysis', 'Visualization', 'SQL', 'Machine Learning'],
    status: 'online'
  },
  {
    id: 'mike',
    name: 'Mike',
    role: 'Team Leader',
    avatar: '/avatars/shiba_fe.png',
    bio: 'Coordinates the team and ensures your project is delivered on time.',
    skills: ['Project Management', 'Agile', 'Team Coordination', 'Quality Assurance'],
    status: 'busy'
  },
  {
    id: 'iris',
    name: 'Iris',
    role: 'Researcher',
    avatar: '/avatars/shiba_qa.png',
    bio: 'Deep researcher who finds market opportunities and validates your ideas.',
    skills: ['Market Research', 'Competitive Analysis', 'Trend Analysis'],
    status: 'online',
    isNew: true
  }
])

const selectedAgent = ref<Agent>(agents.value[0])
const showDetails = ref(false)
const showTeamPanel = ref(false)
const showAgentComparison = ref(false)

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

const selectAgent = (agent: Agent) => {
  selectedAgent.value = agent
  ElMessage.success(`Switched to ${agent.name}`)
}

const autoSelectAgent = () => {
  // Simple logic: select based on project needs
  const availableAgents = agents.value.filter(a => a.status === 'online')
  const randomAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)]
  selectAgent(randomAgent)
}
</script>

<style scoped>
.agent-team {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #ffffff;
  border-top: 1px solid #f3f4f6;
}

/* Team Header */
.team-header {
  text-align: center;
}

.team-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.team-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 4px 0 0;
}

/* Active Agent */
.active-agent {
  cursor: pointer;
}

.agent-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.agent-card:hover {
  background: #f3f4f6;
}

.agent-card.expanded {
  background: #eef2ff;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.agent-role {
  font-size: 12px;
  color: #6b7280;
}

.agent-bio {
  font-size: 12px;
  color: #374151;
  line-height: 1.5;
  margin: 8px 0 0;
}

.agent-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.skill-tag {
  padding: 2px 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 10px;
  color: #6b7280;
}

.expand-icon {
  font-size: 14px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* Agent Selector */
.agent-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.agent-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.agent-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.agent-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.agent-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
}

.agent-btn.active .btn-name {
  color: #ffffff;
}

.btn-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.btn-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.new-badge {
  padding: 1px 5px;
  background: #4f46e5;
  color: white;
  font-size: 9px;
  font-weight: 600;
  border-radius: 4px;
}

/* Team Overview */
.team-overview {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.toggle-icon {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.toggle-icon.rotated {
  transform: rotate(90deg);
}

.overview-grid {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow-y: auto;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid #f3f4f6;
}

.overview-card:last-child {
  border-bottom: none;
}

.overview-card:hover {
  background: #f9fafb;
}

.overview-card.active {
  background: #eef2ff;
}

.overview-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.overview-info {
  flex: 1;
  min-width: 0;
}

.overview-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.overview-role {
  display: block;
  font-size: 11px;
  color: #9ca3af;
}

.overview-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.overview-status.online .status-dot {
  background: #22c55e;
}

.overview-status.busy .status-dot {
  background: #f59e0b;
}

.overview-status.offline .status-dot {
  background: #9ca3af;
}

.overview-status.online {
  color: #22c55e;
}

.overview-status.busy {
  color: #f59e0b;
}

.overview-status.offline {
  color: #9ca3af;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Comparison Dialog */
:deep(.comparison-dialog) {
  border-radius: 16px;
}

:deep(.comparison-dialog .el-dialog__header) {
  padding: 20px 20px 0;
  border: none;
}

:deep(.comparison-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

:deep(.comparison-dialog .el-dialog__body) {
  padding: 20px;
}

.comparison-content {
  max-height: 500px;
  overflow-y: auto;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.comparison-card {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}

.comparison-card:hover {
  border-color: #e5e7eb;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.card-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.card-title h4 {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 2px;
}

.card-title span {
  font-size: 12px;
  color: #6b7280;
}

.card-bio {
  font-size: 12px;
  color: #374151;
  line-height: 1.5;
  margin: 0 0 12px;
}

.card-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}

.card-skills .skill-tag {
  background: #ffffff;
}

.select-btn {
  width: 100%;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.select-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}
</style>
