<template>
  <div class="project-manager">
    <!-- Projects Header -->
    <div class="projects-header">
      <div class="header-left">
        <h2>My Projects</h2>
        <span class="project-count">{{ filteredProjects.length }} projects</span>
      </div>
      <div class="header-right">
        <div class="search-box">
          <el-icon><Search /></el-icon>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search projects..."
          />
        </div>
        <button class="create-btn" @click="showCreateModal = true">
          <el-icon><Plus /></el-icon>
          New Project
        </button>
      </div>
    </div>

    <!-- Task 19: Categories/Tags Filter -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button 
          v-for="filter in projectFilters" 
          :key="filter.id"
          class="filter-tab"
          :class="{ active: activeFilter === filter.id }"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
          <span v-if="filter.count" class="filter-count">{{ filter.count }}</span>
        </button>
      </div>
      <div class="view-toggle">
        <button 
          class="view-btn" 
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
        >
          <el-icon><Grid /></el-icon>
        </button>
        <button 
          class="view-btn" 
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
        >
          <el-icon><List /></el-icon>
        </button>
      </div>
    </div>

    <!-- Task 16-18: Project Grid/List -->
    <div v-if="viewMode === 'grid'" class="projects-grid">
      <div 
        v-for="project in filteredProjects" 
        :key="project.id"
        class="project-card"
        :class="{ pinned: project.isPinned, favorite: project.isFavorite }"
        @click="openProject(project)"
      >
        <div class="project-preview">
          <img :src="project.preview || '/images/project-placeholder.png'" />
          <div class="project-overlay">
            <button class="overlay-btn" @click.stop="toggleFavorite(project)">
              <el-icon><StarFilled v-if="project.isFavorite" /><Star v-else /></el-icon>
            </button>
            <button class="overlay-btn" @click.stop="togglePin(project)">
              <el-icon><Top v-if="project.isPinned" /><Upload v-else /></el-icon>
            </button>
          </div>
        </div>
        <div class="project-info">
          <div class="project-meta">
            <span class="project-type">{{ project.type }}</span>
            <span class="project-updated">{{ project.lastUpdated }}</span>
          </div>
          <h3 class="project-name">{{ project.name }}</h3>
          <p class="project-desc">{{ project.description }}</p>
          <div class="project-tags">
            <span v-for="tag in project.tags" :key="tag" class="project-tag">{{ tag }}</span>
          </div>
          <div class="project-footer">
            <div class="project-team">
              <img 
                v-for="member in project.team.slice(0, 3)" 
                :key="member.id"
                :src="member.avatar"
                class="team-avatar"
                :title="member.name"
              />
              <span v-if="project.team.length > 3" class="team-more">+{{ project.team.length - 3 }}</span>
            </div>
            <div class="project-status" :class="project.status">
              <span class="status-dot" />
              {{ project.status }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="projects-list">
      <div 
        v-for="project in filteredProjects" 
        :key="project.id"
        class="project-list-item"
        :class="{ pinned: project.isPinned }"
        @click="openProject(project)"
      >
        <img :src="project.preview" class="list-preview" />
        <div class="list-info">
          <h3>{{ project.name }}</h3>
          <p>{{ project.description }}</p>
          <div class="list-tags">
            <span v-for="tag in project.tags" :key="tag" class="list-tag">{{ tag }}</span>
          </div>
        </div>
        <div class="list-meta">
          <span class="list-type">{{ project.type }}</span>
          <span class="list-updated">{{ project.lastUpdated }}</span>
        </div>
        <div class="list-team">
          <img 
            v-for="member in project.team.slice(0, 2)" 
            :key="member.id"
            :src="member.avatar"
            class="list-avatar"
          />
        </div>
        <div class="list-status" :class="project.status">{{ project.status }}</div>
        <div class="list-actions">
          <button @click.stop="toggleFavorite(project)">
            <el-icon><StarFilled v-if="project.isFavorite" /><Star v-else /></el-icon>
          </button>
          <button @click.stop="showProjectMenu(project)">
            <el-icon><MoreFilled /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Task 16: Create Project Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="create-modal" @click.stop>
        <div class="modal-header">
          <h3>Create New Project</h3>
          <button class="close-btn" @click="showCreateModal = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- Step 1: Template Selection -->
        <div v-if="createStep === 1" class="modal-step">
          <p class="step-desc">Choose a template to get started quickly</p>
          <div class="template-grid">
            <button 
              v-for="template in projectTemplates" 
              :key="template.id"
              class="template-card"
              :class="{ selected: selectedTemplate?.id === template.id }"
              @click="selectTemplate(template)"
            >
              <div class="template-icon">
                <el-icon><component :is="template.icon" /></el-icon>
              </div>
              <span class="template-name">{{ template.name }}</span>
              <span class="template-desc">{{ template.description }}</span>
            </button>
          </div>
          <button class="step-btn" :disabled="!selectedTemplate" @click="createStep = 2">
            Continue
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>

        <!-- Step 2: Project Details -->
        <div v-if="createStep === 2" class="modal-step">
          <div class="form-group">
            <label>Project Name</label>
            <input v-model="newProject.name" type="text" placeholder="My Awesome Project" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newProject.description" rows="3" placeholder="Brief description..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select v-model="newProject.category">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Framework</label>
              <select v-model="newProject.framework">
                <option v-for="fw in frameworks" :key="fw" :value="fw">{{ fw }}</option>
              </select>
            </div>
          </div>
          <div class="step-actions">
            <button class="step-btn secondary" @click="createStep = 1">
              <el-icon><ArrowLeft /></el-icon>
              Back
            </button>
            <button class="step-btn" @click="createProject">
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Task 25: Settings Panel -->
    <div v-if="showSettings" class="settings-drawer">
      <div class="settings-header">
        <h3>Project Settings</h3>
        <button class="close-btn" @click="showSettings = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="settings-tabs">
        <button 
          v-for="tab in settingsTabs" 
          :key="tab.id"
          class="settings-tab"
          :class="{ active: activeSettingsTab === tab.id }"
          @click="activeSettingsTab = tab.id"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          {{ tab.label }}
        </button>
      </div>
      <div class="settings-content">
        <!-- General Settings -->
        <div v-if="activeSettingsTab === 'general'" class="settings-section">
          <div class="form-group">
            <label>Project Name</label>
            <input v-model="selectedProject!.name" type="text" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="selectedProject!.description" rows="3" />
          </div>
          <div class="form-group">
            <label>Project URL</label>
            <div class="url-input">
              <span>agenthive.io/p/</span>
              <input v-model="selectedProject!.slug" type="text" />
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="selectedProject!.isPublic" type="checkbox" />
              Make project public
            </label>
          </div>
        </div>

        <!-- Members Settings -->
        <div v-if="activeSettingsTab === 'members'" class="settings-section">
          <div class="members-list">
            <div v-for="member in selectedProject?.team" :key="member.id" class="member-item">
              <img :src="member.avatar" class="member-avatar" />
              <div class="member-info">
                <span class="member-name">{{ member.name }}</span>
                <span class="member-role">{{ member.role }}</span>
              </div>
              <select v-model="member.permission" class="member-permission">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button class="remove-member" @click="removeMember(member)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
          <button class="add-member-btn" @click="showAddMember = true">
            <el-icon><Plus /></el-icon>
            Add Member
          </button>
        </div>

        <!-- Danger Zone -->
        <div v-if="activeSettingsTab === 'danger'" class="settings-section">
          <div class="danger-zone">
            <div class="danger-item">
              <div class="danger-info">
                <h4>Archive Project</h4>
                <p>Hide this project from your dashboard. You can restore it later.</p>
              </div>
              <button class="danger-btn" @click="archiveProject">Archive</button>
            </div>
            <div class="danger-item">
              <div class="danger-info">
                <h4>Delete Project</h4>
                <p>Permanently delete this project and all its data. This cannot be undone.</p>
              </div>
              <button class="danger-btn delete" @click="deleteProject">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Log -->
    <div v-if="showActivity" class="activity-panel">
      <div class="activity-header">
        <h3>Activity Log</h3>
        <button @click="showActivity = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="activity-list">
        <div v-for="activity in activityLog" :key="activity.id" class="activity-item">
          <img :src="activity.user.avatar" class="activity-avatar" />
          <div class="activity-content">
            <p class="activity-text">
              <strong>{{ activity.user.name }}</strong>
              {{ activity.action }}
              <span class="activity-target">{{ activity.target }}</span>
            </p>
            <span class="activity-time">{{ activity.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search,
  Plus,
  Grid,
  List,
  Star,
  StarFilled,
  Top,
  Upload,
  MoreFilled,
  Close,
  ArrowRight,
  ArrowLeft,
  Setting,
  User,
  Delete,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Task 19: Filters
const projectFilters = [
  { id: 'all', label: 'All Projects', count: 0 },
  { id: 'recent', label: 'Recently Updated', count: 0 },
  { id: 'favorites', label: 'Favorites', count: 0 },
  { id: 'shared', label: 'Shared with Me', count: 0 },
  { id: 'archived', label: 'Archived', count: 0 }
]

const activeFilter = ref('all')
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')

// Projects Data
interface TeamMember {
  id: string
  name: string
  avatar: string
  role: string
  permission?: 'admin' | 'editor' | 'viewer'
}

interface Project {
  id: string
  name: string
  description: string
  type: string
  status: 'active' | 'draft' | 'archived'
  preview: string
  tags: string[]
  team: TeamMember[]
  lastUpdated: string
  isPinned: boolean
  isFavorite: boolean
  isPublic?: boolean
  slug?: string
  category?: string
  framework?: string
}

const projects = ref<Project[]>([
  {
    id: '1',
    name: 'E-commerce Platform',
    description: 'Modern shopping experience with AI recommendations',
    type: 'E-commerce',
    status: 'active',
    preview: '/images/project-1.png',
    tags: ['Next.js', 'Stripe', 'AI'],
    team: [
      { id: '1', name: 'Alex', avatar: '/avatars/shiba_tl.png', role: 'Lead' },
      { id: '2', name: 'Emma', avatar: '/avatars/shiba_qa.png', role: 'Designer' }
    ],
    lastUpdated: '2 hours ago',
    isPinned: true,
    isFavorite: true
  },
  {
    id: '2',
    name: 'SaaS Dashboard',
    description: 'Analytics dashboard for subscription metrics',
    type: 'SaaS',
    status: 'active',
    preview: '/images/project-2.png',
    tags: ['Vue', 'D3.js', 'Supabase'],
    team: [
      { id: '1', name: 'Alex', avatar: '/avatars/shiba_tl.png', role: 'Lead' }
    ],
    lastUpdated: '1 day ago',
    isPinned: false,
    isFavorite: false
  },
  {
    id: '3',
    name: 'Portfolio Site',
    description: 'Personal portfolio with blog and projects',
    type: 'Portfolio',
    status: 'draft',
    preview: '/images/project-3.png',
    tags: ['React', 'Framer'],
    team: [
      { id: '2', name: 'Emma', avatar: '/avatars/shiba_qa.png', role: 'Designer' }
    ],
    lastUpdated: '3 days ago',
    isPinned: false,
    isFavorite: true
  }
])

const filteredProjects = computed(() => {
  let result = projects.value
  
  // Filter
  if (activeFilter.value === 'favorites') {
    result = result.filter(p => p.isFavorite)
  } else if (activeFilter.value === 'recent') {
    // Sort by lastUpdated
    result = [...result].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
  }
  
  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    )
  }
  
  // Sort: pinned first, then by date
  return result.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
})

// Task 16: Create Project
const showCreateModal = ref(false)
const createStep = ref(1)
const selectedTemplate = ref<any>(null)
const categories = ['Web App', 'Mobile App', 'E-commerce', 'SaaS', 'Portfolio', 'Blog']
const frameworks = ['React', 'Vue', 'Next.js', 'Nuxt', 'Svelte', 'Angular']

const newProject = ref({
  name: '',
  description: '',
  category: 'Web App',
  framework: 'React'
})

const projectTemplates = [
  { id: 'blank', name: 'Blank Project', description: 'Start from scratch', icon: 'Document' },
  { id: 'saas', name: 'SaaS Starter', description: 'Dashboard + Auth + Billing', icon: 'Grid' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Store + Cart + Checkout', icon: 'ShoppingBag' },
  { id: 'blog', name: 'Blog Platform', description: 'CMS + Comments + SEO', icon: 'Edit' },
  { id: 'portfolio', name: 'Portfolio', description: 'Showcase + Contact', icon: 'User' },
  { id: 'api', name: 'API Service', description: 'REST + GraphQL + Docs', icon: 'Connection' }
]

const selectTemplate = (template: any) => {
  selectedTemplate.value = template
}

const createProject = () => {
  const project: Project = {
    id: Date.now().toString(),
    name: newProject.value.name,
    description: newProject.value.description,
    type: newProject.value.category,
    status: 'draft',
    preview: '/images/project-placeholder.png',
    tags: [newProject.value.framework],
    team: [{ id: '1', name: 'You', avatar: '/avatars/shiba_tl.png', role: 'Owner' }],
    lastUpdated: 'Just now',
    isPinned: false,
    isFavorite: false
  }
  projects.value.unshift(project)
  showCreateModal.value = false
  createStep.value = 1
  selectedTemplate.value = null
  ElMessage.success('Project created!')
}

// Task 19: Favorites & Pins
const toggleFavorite = (project: Project) => {
  project.isFavorite = !project.isFavorite
  ElMessage.success(project.isFavorite ? 'Added to favorites' : 'Removed from favorites')
}

const togglePin = (project: Project) => {
  project.isPinned = !project.isPinned
  ElMessage.success(project.isPinned ? 'Project pinned' : 'Project unpinned')
}

// Task 25: Settings
const showSettings = ref(false)
const selectedProject = ref<Project | null>(null)
const activeSettingsTab = ref('general')
const showAddMember = ref(false)

const settingsTabs = [
  { id: 'general', label: 'General', icon: 'Setting' },
  { id: 'members', label: 'Members', icon: 'User' },
  { id: 'danger', label: 'Danger Zone', icon: 'Warning' }
]

// Activity Log
const showActivity = ref(false)
const activityLog = [
  {
    id: '1',
    user: { name: 'Alex', avatar: '/avatars/shiba_tl.png' },
    action: 'deployed',
    target: 'Production',
    time: '5 minutes ago'
  },
  {
    id: '2',
    user: { name: 'Emma', avatar: '/avatars/shiba_qa.png' },
    action: 'updated',
    target: 'Homepage design',
    time: '1 hour ago'
  }
]

const openProject = (project: Project) => {
  ElMessage.info(`Opening ${project.name}...`)
}

const showProjectMenu = (project: Project) => {
  selectedProject.value = project
  showSettings.value = true
}

const removeMember = (member: TeamMember) => {
  if (selectedProject.value) {
    selectedProject.value.team = selectedProject.value.team.filter(m => m.id !== member.id)
  }
}

const archiveProject = () => {
  ElMessage.success('Project archived')
}

const deleteProject = () => {
  ElMessage.success('Project deleted')
}
</script>

<style scoped>
.project-manager {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.projects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header-left h2 {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.project-count {
  font-size: 14px;
  color: #9ca3af;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  width: 280px;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #374151;
}

.search-box input::placeholder {
  color: #9ca3af;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: #4f46e5;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.create-btn:hover {
  background: #4338ca;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  background: #f9fafb;
  padding: 4px;
  border-radius: 10px;
}

.filter-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.filter-tab:hover {
  color: #374151;
}

.filter-tab.active {
  background: #ffffff;
  color: #111827;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.filter-count {
  padding: 2px 6px;
  background: #e5e7eb;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.view-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #f9fafb;
  border-radius: 8px;
}

.view-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-btn:hover {
  color: #6b7280;
}

.view-btn.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Project Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.project-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.project-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.project-card.pinned {
  border-color: #4f46e5;
}

.project-card.favorite .project-name {
  color: #4f46e5;
}

.project-preview {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  overflow: hidden;
}

.project-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 10px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent);
}

.project-card:hover .project-overlay {
  opacity: 1;
}

.overlay-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255,255,255,0.9);
  border-radius: 8px;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.overlay-btn:hover {
  background: #ffffff;
}

.project-info {
  padding: 16px;
}

.project-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.project-type {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #4f46e5;
}

.project-updated {
  font-size: 11px;
  color: #9ca3af;
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px;
}

.project-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.project-tag {
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 11px;
  color: #6b7280;
}

.project-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.project-team {
  display: flex;
  align-items: center;
}

.team-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  margin-left: -8px;
}

.team-avatar:first-child {
  margin-left: 0;
}

.team-more {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #6b7280;
  border: 2px solid #ffffff;
  margin-left: -8px;
}

.project-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  text-transform: capitalize;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
}

.project-status.draft .status-dot {
  background: #f59e0b;
}

/* Project List */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-list-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.project-list-item.pinned {
  border-color: #4f46e5;
}

.list-preview {
  width: 80px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
}

.list-info {
  flex: 1;
}

.list-info h3 {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.list-info p {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 8px;
}

.list-tags {
  display: flex;
  gap: 6px;
}

.list-tag {
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 10px;
  color: #6b7280;
}

.list-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.list-team {
  display: flex;
}

.list-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  margin-left: -8px;
}

.list-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
}

.list-status.active {
  background: #dcfce7;
  color: #166534;
}

.list-status.draft {
  background: #fef3c7;
  color: #92400e;
}

.list-actions {
  display: flex;
  gap: 4px;
}

.list-actions button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-actions button:hover {
  background: #f3f4f6;
  color: #6b7280;
}

/* Create Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  z-index: 100;
}

.create-modal {
  width: 600px;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #9ca3af;
  cursor: pointer;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.modal-step {
  padding: 24px;
}

.step-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  background: #f9fafb;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.template-card:hover {
  background: #f3f4f6;
}

.template-card.selected {
  border-color: #4f46e5;
  background: #eff6ff;
}

.template-icon {
  width: 48px;
  height: 48px;
  background: #ffffff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  font-size: 20px;
}

.template-name {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.template-desc {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}

.step-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.step-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-btn.secondary {
  background: #f3f4f6;
  color: #374151;
}

/* Settings Drawer */
.settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.settings-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.settings-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.settings-tab.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.settings-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.url-input {
  display: flex;
  align-items: center;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.url-input span {
  font-size: 13px;
  color: #9ca3af;
  white-space: nowrap;
}

.url-input input {
  flex: 1;
  border: none;
  padding-left: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.member-role {
  font-size: 11px;
  color: #9ca3af;
}

.member-permission {
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  background: #ffffff;
}

.remove-member {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
}

.remove-member:hover {
  background: #fee2e2;
  color: #ef4444;
}

.add-member-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: #f3f4f6;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.danger-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #991b1b;
  margin: 0 0 4px;
}

.danger-info p {
  font-size: 12px;
  color: #b91c1c;
  margin: 0;
}

.danger-btn {
  padding: 8px 16px;
  background: #ef4444;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.danger-btn:hover {
  background: #dc2626;
}

/* Activity Panel */
.activity-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 360px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  z-index: 50;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.activity-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.activity-list {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #f3f4f6;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.activity-content {
  flex: 1;
}

.activity-text {
  font-size: 13px;
  color: #374151;
  margin: 0 0 4px;
  line-height: 1.4;
}

.activity-target {
  color: #4f46e5;
  font-weight: 500;
}

.activity-time {
  font-size: 11px;
  color: #9ca3af;
}
</style>
