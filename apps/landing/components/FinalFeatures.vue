<template>
  <div class="final-features">
    <!-- Category 5: Design System (61-70) -->
    <div v-if="activeCategory === 'design'" class="category-panel">
      <div class="panel-header">
        <h3>Design System</h3>
        <div class="theme-toggle">
          <button 
            :class="{ active: theme === 'light' }" 
            @click="theme = 'light'"
          >
            <el-icon><Sunny /></el-icon>
          </button>
          <button 
            :class="{ active: theme === 'dark' }" 
            @click="theme = 'dark'"
          >
            <el-icon><Moon /></el-icon>
          </button>
        </div>
      </div>

      <!-- Colors -->
      <div class="design-section">
        <h4>Colors</h4>
        <div class="color-grid">
          <div 
            v-for="color in designColors" 
            :key="color.name"
            class="color-item"
            @click="selectColor(color)"
          >
            <div class="color-preview" :style="{ background: color.value }" />
            <span class="color-name">{{ color.name }}</span>
            <span class="color-value">{{ color.value }}</span>
          </div>
        </div>
        <div v-if="selectedColor" class="color-picker-panel">
          <input v-model="selectedColor.value" type="color" />
          <input v-model="selectedColor.value" type="text" />
        </div>
      </div>

      <!-- Typography -->
      <div class="design-section">
        <h4>Typography</h4>
        <div class="font-selector">
          <label>Heading Font</label>
          <select v-model="designTokens.fontHeading">
            <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
          </select>
        </div>
        <div class="font-selector">
          <label>Body Font</label>
          <select v-model="designTokens.fontBody">
            <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
          </select>
        </div>
        <div class="type-scale">
          <div v-for="size in typeScale" :key="size.name" class="type-item">
            <span class="type-label">{{ size.name }}</span>
            <span class="type-sample" :style="{ fontSize: size.value }">
              Aa
            </span>
            <input v-model="size.value" type="text" class="type-input" />
          </div>
        </div>
      </div>

      <!-- Spacing & Radius -->
      <div class="design-section">
        <h4>Spacing & Radius</h4>
        <div class="token-row">
          <label>Base Spacing</label>
          <input v-model="designTokens.spacing" type="range" min="4" max="16" />
          <span>{{ designTokens.spacing }}px</span>
        </div>
        <div class="token-row">
          <label>Border Radius</label>
          <input v-model="designTokens.radius" type="range" min="0" max="24" />
          <span>{{ designTokens.radius }}px</span>
        </div>
        <div class="preview-box" :style="previewBoxStyle">
          Preview
        </div>
      </div>

      <!-- Components -->
      <div class="design-section">
        <h4>Components</h4>
        <div class="component-grid">
          <button v-for="comp in componentLibrary" :key="comp.name" class="comp-card">
            <el-icon><component :is="comp.icon" /></el-icon>
            <span>{{ comp.name }}</span>
          </button>
        </div>
      </div>

      <!-- Animation Preview -->
      <div class="design-section">
        <h4>Animations</h4>
        <div class="animation-list">
          <div v-for="anim in animations" :key="anim.name" class="anim-item">
            <div class="anim-preview" :class="anim.class" />
            <span>{{ anim.name }}</span>
            <button @click="previewAnimation(anim)">Preview</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Category 6: Backend & Database (71-80) -->
    <div v-if="activeCategory === 'backend'" class="category-panel">
      <div class="panel-header">
        <h3>Backend & Database</h3>
      </div>

      <!-- Database Schema -->
      <div class="backend-section">
        <h4>Database Schema</h4>
        <div class="schema-visualizer">
          <div 
            v-for="table in databaseSchema" 
            :key="table.name"
            class="table-card"
          >
            <div class="table-header">
              <el-icon><Grid /></el-icon>
              <span>{{ table.name }}</span>
            </div>
            <div class="table-fields">
              <div 
                v-for="field in table.fields" 
                :key="field.name"
                class="field-row"
                :class="{ primary: field.isPrimary, foreign: field.isForeign }"
              >
                <span class="field-name">{{ field.name }}</span>
                <span class="field-type">{{ field.type }}</span>
                <el-icon v-if="field.isPrimary"><Key /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Endpoints -->
      <div class="backend-section">
        <h4>API Endpoints</h4>
        <div class="api-list">
          <div v-for="api in apiEndpoints" :key="api.path" class="api-item">
            <span class="api-method" :class="api.method">{{ api.method }}</span>
            <span class="api-path">{{ api.path }}</span>
            <button @click="testEndpoint(api)">Test</button>
          </div>
        </div>
      </div>

      <!-- Auth Config -->
      <div class="backend-section">
        <h4>Authentication</h4>
        <div class="auth-providers">
          <label v-for="provider in authProviders" :key="provider.id" class="auth-item">
            <input v-model="provider.enabled" type="checkbox" />
            <el-icon><component :is="provider.icon" /></el-icon>
            <span>{{ provider.name }}</span>
          </label>
        </div>
      </div>

      <!-- Storage -->
      <div class="backend-section">
        <h4>File Storage</h4>
        <div class="storage-stats">
          <div class="storage-bar">
            <div class="storage-used" :style="{ width: storageUsedPercent + '%' }" />
          </div>
          <span>{{ storageUsed }} / {{ storageTotal }} GB</span>
        </div>
        <div class="storage-files">
          <div v-for="file in storageFiles" :key="file.name" class="storage-file">
            <el-icon><Document /></el-icon>
            <span>{{ file.name }}</span>
            <span>{{ file.size }}</span>
          </div>
        </div>
      </div>

      <!-- Realtime -->
      <div class="backend-section">
        <h4>Realtime Subscriptions</h4>
        <div class="subscription-list">
          <div v-for="sub in subscriptions" :key="sub.table" class="sub-item">
            <span>{{ sub.table }}</span>
            <span class="sub-status" :class="sub.status">{{ sub.status }}</span>
            <button @click="toggleSubscription(sub)">
              {{ sub.status === 'active' ? 'Pause' : 'Resume' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Category 7: Marketing & Growth (81-90) -->
    <div v-if="activeCategory === 'marketing'" class="category-panel">
      <div class="panel-header">
        <h3>Marketing & Growth</h3>
      </div>

      <!-- SEO -->
      <div class="marketing-section">
        <h4>SEO Score: {{ seoScore }}/100</h4>
        <div class="seo-gauge">
          <div class="gauge-fill" :style="{ width: seoScore + '%' }" />
        </div>
        <div class="seo-checks">
          <div v-for="check in seoChecks" :key="check.name" class="seo-item">
            <el-icon :class="check.passed ? 'passed' : 'failed'">
              <CircleCheckFilled v-if="check.passed" />
              <WarningFilled v-else />
            </el-icon>
            <span>{{ check.name }}</span>
            <button v-if="!check.passed" @click="fixSeo(check)">Fix</button>
          </div>
        </div>
      </div>

      <!-- Meta Tags -->
      <div class="marketing-section">
        <h4>Meta Tags</h4>
        <div class="meta-editor">
          <div class="meta-field">
            <label>Title</label>
            <input v-model="metaTags.title" type="text" maxlength="60" />
            <span class="char-count">{{ metaTags.title.length }}/60</span>
          </div>
          <div class="meta-field">
            <label>Description</label>
            <textarea v-model="metaTags.description" maxlength="160" />
            <span class="char-count">{{ metaTags.description.length }}/160</span>
          </div>
          <div class="meta-preview">
            <h5>Google Preview</h5>
            <div class="google-preview">
              <div class="google-title">{{ metaTags.title || 'Page Title' }}</div>
              <div class="google-url">example.com/page</div>
              <div class="google-desc">{{ metaTags.description || 'Page description...' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Social Preview -->
      <div class="marketing-section">
        <h4>Social Media Preview</h4>
        <div class="social-tabs">
          <button 
            v-for="platform in socialPlatforms" 
            :key="platform.id"
            :class="{ active: activeSocial === platform.id }"
            @click="activeSocial = platform.id"
          >
            {{ platform.name }}
          </button>
        </div>
        <div class="social-preview" :class="activeSocial">
          <img :src="socialImage" />
          <div class="social-content">
            <h5>{{ metaTags.title }}</h5>
            <p>{{ metaTags.description }}</p>
          </div>
        </div>
      </div>

      <!-- Analytics -->
      <div class="marketing-section">
        <h4>Analytics</h4>
        <div class="analytics-grid">
          <div v-for="metric in analyticsMetrics" :key="metric.name" class="metric-card">
            <span class="metric-label">{{ metric.name }}</span>
            <span class="metric-value">{{ metric.value }}</span>
            <span class="metric-change" :class="metric.trend">
              {{ metric.change }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Category 8: User System (91-100) -->
    <div v-if="activeCategory === 'user'" class="category-panel">
      <div class="panel-header">
        <h3>User Settings</h3>
      </div>

      <!-- Profile -->
      <div class="user-section">
        <div class="profile-header">
          <img :src="userProfile.avatar" class="profile-avatar" />
          <div class="profile-info">
            <h4>{{ userProfile.name }}</h4>
            <p>{{ userProfile.email }}</p>
            <span class="plan-badge">{{ userProfile.plan }}</span>
          </div>
        </div>
      </div>

      <!-- Credits -->
      <div class="user-section">
        <h4>Credits</h4>
        <div class="credits-display">
          <div class="credits-circle">
            <span class="credits-value">{{ credits.remaining }}</span>
            <span class="credits-label">remaining</span>
          </div>
          <div class="credits-info">
            <p>{{ credits.used }} used this month</p>
            <p>Resets in {{ credits.resetDays }} days</p>
            <button @click="upgradePlan">Upgrade Plan</button>
          </div>
        </div>
        <div class="usage-chart">
          <div v-for="day in usageHistory" :key="day.date" class="usage-bar">
            <div class="usage-fill" :style="{ height: (day.usage / 100) * 100 + '%' }" />
            <span>{{ day.date }}</span>
          </div>
        </div>
      </div>

      <!-- Subscription -->
      <div class="user-section">
        <h4>Subscription</h4>
        <div class="plan-cards">
          <div 
            v-for="plan in subscriptionPlans" 
            :key="plan.id"
            class="plan-card"
            :class="{ active: plan.id === userProfile.plan, recommended: plan.recommended }"
          >
            <h5>{{ plan.name }}</h5>
            <div class="plan-price">
              <span class="currency">$</span>
              <span class="amount">{{ plan.price }}</span>
              <span class="period">/mo</span>
            </div>
            <ul class="plan-features">
              <li v-for="feature in plan.features" :key="feature">
                <el-icon><Check /></el-icon>
                {{ feature }}
              </li>
            </ul>
            <button v-if="plan.id !== userProfile.plan" @click="selectPlan(plan)">
              {{ plan.price === 0 ? 'Get Started' : 'Upgrade' }}
            </button>
            <button v-else class="current">Current Plan</button>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="user-section">
        <h4>Notifications</h4>
        <div class="notification-settings">
          <label v-for="setting in notificationSettings" :key="setting.id" class="notif-item">
            <div class="notif-info">
              <span class="notif-name">{{ setting.name }}</span>
              <span class="notif-desc">{{ setting.description }}</span>
            </div>
            <input v-model="setting.enabled" type="checkbox" />
          </label>
        </div>
      </div>

      <!-- Keyboard Shortcuts -->
      <div class="user-section">
        <h4>Keyboard Shortcuts</h4>
        <div class="shortcuts-list">
          <div v-for="shortcut in keyboardShortcuts" :key="shortcut.action" class="shortcut-row">
            <span>{{ shortcut.action }}</span>
            <kbd v-for="key in shortcut.keys" :key="key">{{ key }}</kbd>
          </div>
        </div>
      </div>

      <!-- Security -->
      <div class="user-section">
        <h4>Security</h4>
        <div class="security-items">
          <div class="security-item">
            <div>
              <span>Two-Factor Authentication</span>
              <p>Add an extra layer of security</p>
            </div>
            <button @click="enable2FA">Enable</button>
          </div>
          <div class="security-item">
            <div>
              <span>API Keys</span>
              <p>Manage your API access</p>
            </div>
            <button @click="manageApiKeys">Manage</button>
          </div>
          <div class="security-item danger">
            <div>
              <span>Delete Account</span>
              <p>Permanently delete your account</p>
            </div>
            <button @click="deleteAccount">Delete</button>
          </div>
        </div>
      </div>

      <!-- Help -->
      <div class="user-section">
        <h4>Help & Support</h4>
        <div class="help-links">
          <button v-for="link in helpLinks" :key="link.name" @click="openHelp(link)">
            <el-icon><component :is="link.icon" /></el-icon>
            {{ link.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Category Navigation -->
    <div class="category-nav">
      <button 
        v-for="cat in categories" 
        :key="cat.id"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id"
      >
        <el-icon><component :is="cat.icon" /></el-icon>
        {{ cat.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Sunny, Moon, Grid, Key, Document, CircleCheckFilled, WarningFilled,
  Check, Message, QuestionFilled, VideoPlay, Lock, Unlock,
  Brush, Coin, TrendCharts, User
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const categories = [
  { id: 'design', name: 'Design', icon: Brush },
  { id: 'backend', name: 'Backend', icon: Coin },
  { id: 'marketing', name: 'Marketing', icon: TrendCharts },
  { id: 'user', name: 'User', icon: User }
]

const activeCategory = ref('design')

// Category 5: Design System (61-70)
const theme = ref<'light' | 'dark'>('light')
const selectedColor = ref<any>(null)

const designColors = ref([
  { name: 'Primary', value: '#4f46e5' },
  { name: 'Secondary', value: '#7c3aed' },
  { name: 'Success', value: '#22c55e' },
  { name: 'Warning', value: '#f59e0b' },
  { name: 'Error', value: '#ef4444' },
  { name: 'Background', value: '#ffffff' },
  { name: 'Surface', value: '#f9fafb' },
  { name: 'Text Primary', value: '#111827' }
])

const fonts = ['Inter', 'Roboto', 'Poppins', 'SF Pro', 'System']

const designTokens = ref({
  fontHeading: 'Inter',
  fontBody: 'Inter',
  spacing: 8,
  radius: 8
})

const typeScale = ref([
  { name: 'xs', value: '12px' },
  { name: 'sm', value: '14px' },
  { name: 'base', value: '16px' },
  { name: 'lg', value: '18px' },
  { name: 'xl', value: '20px' },
  { name: '2xl', value: '24px' }
])

const componentLibrary = [
  { name: 'Button', icon: 'CircleButton' },
  { name: 'Card', icon: 'Postcard' },
  { name: 'Input', icon: 'Edit' },
  { name: 'Modal', icon: 'FullScreen' },
  { name: 'Dropdown', icon: 'ArrowDown' },
  { name: 'Tabs', icon: 'Grid' }
]

const animations = [
  { name: 'Fade In', class: 'anim-fade' },
  { name: 'Slide Up', class: 'anim-slide-up' },
  { name: 'Scale', class: 'anim-scale' },
  { name: 'Bounce', class: 'anim-bounce' }
]

const previewBoxStyle = computed(() => ({
  padding: `${designTokens.value.spacing * 2}px`,
  borderRadius: `${designTokens.value.radius}px`,
  background: '#4f46e5',
  color: 'white',
  textAlign: 'center' as const
}))

const selectColor = (color: any) => {
  selectedColor.value = color
}

const previewAnimation = (anim: any) => {
  ElMessage.success(`Previewing ${anim.name}`)
}

// Category 6: Backend (71-80)
const databaseSchema = ref([
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'uuid', isPrimary: true },
      { name: 'email', type: 'varchar', isPrimary: false },
      { name: 'created_at', type: 'timestamp', isPrimary: false }
    ]
  },
  {
    name: 'projects',
    fields: [
      { name: 'id', type: 'uuid', isPrimary: true },
      { name: 'user_id', type: 'uuid', isForeign: true },
      { name: 'name', type: 'varchar', isPrimary: false }
    ]
  }
])

const apiEndpoints = ref([
  { method: 'GET', path: '/api/users' },
  { method: 'POST', path: '/api/users' },
  { method: 'GET', path: '/api/projects' },
  { method: 'DELETE', path: '/api/projects/:id' }
])

const authProviders = ref([
  { id: 'email', name: 'Email/Password', icon: 'Message', enabled: true },
  { id: 'google', name: 'Google', icon: 'Google', enabled: true },
  { id: 'github', name: 'GitHub', icon: 'Link', enabled: false }
])

const storageUsed = ref(2.4)
const storageTotal = ref(5)
const storageUsedPercent = computed(() => (storageUsed.value / storageTotal.value) * 100)

const storageFiles = ref([
  { name: 'logo.png', size: '24 KB' },
  { name: 'banner.jpg', size: '156 KB' }
])

const subscriptions = ref([
  { table: 'users', status: 'active' },
  { table: 'projects', status: 'paused' }
])

const testEndpoint = (api: any) => {
  ElMessage.success(`Testing ${api.method} ${api.path}`)
}

const toggleSubscription = (sub: any) => {
  sub.status = sub.status === 'active' ? 'paused' : 'active'
}

// Category 7: Marketing (81-90)
const seoScore = ref(87)

const seoChecks = ref([
  { name: 'Meta title present', passed: true },
  { name: 'Meta description present', passed: true },
  { name: 'Open Graph tags', passed: false },
  { name: 'Twitter Cards', passed: false },
  { name: 'Sitemap.xml', passed: true }
])

const metaTags = ref({
  title: 'AgentHive - AI-Powered Development Platform',
  description: 'Build, deploy, and scale your applications with AI assistance.'
})

const socialPlatforms = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'twitter', name: 'Twitter' },
  { id: 'linkedin', name: 'LinkedIn' }
]

const activeSocial = ref('facebook')
const socialImage = '/images/social-preview.png'

const analyticsMetrics = ref([
  { name: 'Visitors', value: '12.5K', change: '+12%', trend: 'up' },
  { name: 'Page Views', value: '45.2K', change: '+8%', trend: 'up' },
  { name: 'Bounce Rate', value: '32%', change: '-5%', trend: 'down' },
  { name: 'Avg Time', value: '2m 34s', change: '+15%', trend: 'up' }
])

const fixSeo = (check: any) => {
  check.passed = true
  ElMessage.success(`Fixed: ${check.name}`)
}

// Category 8: User (91-100)
const userProfile = ref({
  name: 'Alex Chen',
  email: 'alex@example.com',
  avatar: '/avatars/shiba_tl.png',
  plan: 'Pro'
})

const credits = ref({
  remaining: 2847,
  used: 7153,
  resetDays: 12
})

const usageHistory = ref([
  { date: 'M', usage: 65 },
  { date: 'T', usage: 80 },
  { date: 'W', usage: 45 },
  { date: 'T', usage: 90 },
  { date: 'F', usage: 70 },
  { date: 'S', usage: 30 },
  { date: 'S', usage: 50 }
])

const subscriptionPlans = ref([
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['3 projects', 'Community support', 'Basic AI features'],
    recommended: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    features: ['Unlimited projects', 'Priority support', 'Advanced AI', 'Custom domains'],
    recommended: true
  },
  {
    id: 'team',
    name: 'Team',
    price: 99,
    features: ['Everything in Pro', 'Team collaboration', 'SSO', 'Dedicated support'],
    recommended: false
  }
])

const notificationSettings = ref([
  { id: 'deploy', name: 'Deploy notifications', description: 'Get notified when deployments complete', enabled: true },
  { id: 'mentions', name: 'Team mentions', description: 'When someone mentions you in comments', enabled: true },
  { id: 'updates', name: 'Product updates', description: 'New features and improvements', enabled: false }
])

const keyboardShortcuts = ref([
  { action: 'Save', keys: ['Ctrl', 'S'] },
  { action: 'Find', keys: ['Ctrl', 'F'] },
  { action: 'Command Palette', keys: ['Ctrl', 'K'] },
  { action: 'Toggle Sidebar', keys: ['Ctrl', 'B'] }
])

const helpLinks = ref([
  { name: 'Documentation', icon: 'Document' },
  { name: 'Video Tutorials', icon: 'VideoPlay' },
  { name: 'Community Forum', icon: 'Message' },
  { name: 'Contact Support', icon: 'QuestionFilled' }
])

const upgradePlan = () => {
  ElMessage.info('Opening upgrade dialog...')
}

const selectPlan = (plan: any) => {
  ElMessage.success(`Selected ${plan.name} plan`)
}

const enable2FA = () => {
  ElMessage.success('2FA enabled')
}

const manageApiKeys = () => {
  ElMessage.info('Opening API keys...')
}

const deleteAccount = () => {
  if (confirm('Are you sure? This cannot be undone.')) {
    ElMessage.success('Account deleted')
  }
}

const openHelp = (link: any) => {
  ElMessage.info(`Opening ${link.name}...`)
}
</script>

<style scoped>
.final-features {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.category-panel {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.panel-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 8px;
}

.theme-toggle button {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle button.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Design Sections */
.design-section,
.backend-section,
.marketing-section,
.user-section {
  margin-bottom: 32px;
}

.design-section h4,
.backend-section h4,
.marketing-section h4,
.user-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Colors */
.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.color-item {
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  cursor: pointer;
}

.color-preview {
  width: 100%;
  height: 60px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.color-name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #111827;
}

.color-value {
  font-size: 11px;
  color: #9ca3af;
  font-family: 'Fira Code', monospace;
}

.color-picker-panel {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

/* Typography */
.font-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.font-selector label {
  width: 100px;
  font-size: 13px;
  color: #374151;
}

.font-selector select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
}

.type-scale {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
}

.type-label {
  width: 60px;
  font-size: 12px;
  color: #6b7280;
  font-family: 'Fira Code', monospace;
}

.type-sample {
  flex: 1;
  color: #111827;
}

.type-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
}

/* Tokens */
.token-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.token-row label {
  width: 100px;
  font-size: 13px;
  color: #374151;
}

.token-row input[type="range"] {
  flex: 1;
}

.preview-box {
  margin-top: 16px;
}

/* Components */
.component-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.comp-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: #f9fafb;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.comp-card:hover {
  background: #f3f4f6;
}

/* Schema */
.schema-visualizer {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.table-card {
  width: 200px;
  background: #f9fafb;
  border-radius: 10px;
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #4f46e5;
  color: white;
  font-weight: 500;
}

.table-fields {
  padding: 8px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
}

.field-name {
  font-family: 'Fira Code', monospace;
  color: #111827;
}

.field-type {
  color: #9ca3af;
  margin-left: auto;
}

.field-row.primary {
  background: #fef3c7;
  border-radius: 4px;
}

/* API */
.api-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.api-method {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.api-method.GET { background: #dbeafe; color: #1d4ed8; }
.api-method.POST { background: #dcfce7; color: #15803d; }
.api-method.DELETE { background: #fee2e2; color: #b91c1c; }

.api-path {
  flex: 1;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
}

.api-item button {
  padding: 4px 12px;
  background: #4f46e5;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: white;
  cursor: pointer;
}

/* Storage */
.storage-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.storage-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.storage-used {
  height: 100%;
  background: #4f46e5;
  border-radius: 4px;
  transition: width 0.3s;
}

/* SEO */
.seo-gauge {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.gauge-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.seo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.seo-item .el-icon.passed {
  color: #22c55e;
}

.seo-item .el-icon.failed {
  color: #f59e0b;
}

/* Meta Editor */
.meta-field {
  margin-bottom: 16px;
}

.meta-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.meta-field input,
.meta-field textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.meta-field textarea {
  resize: vertical;
  min-height: 80px;
}

.char-count {
  float: right;
  font-size: 11px;
  color: #9ca3af;
}

.google-preview {
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.google-title {
  font-size: 18px;
  color: #1a0dab;
  margin-bottom: 4px;
}

.google-url {
  font-size: 13px;
  color: #006621;
  margin-bottom: 4px;
}

.google-desc {
  font-size: 13px;
  color: #545454;
  line-height: 1.4;
}

/* Analytics */
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric-card {
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.metric-change {
  font-size: 12px;
  font-weight: 500;
}

.metric-change.up {
  color: #22c55e;
}

.metric-change.down {
  color: #ef4444;
}

/* Profile */
.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.profile-info h4 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.profile-info p {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 8px;
}

.plan-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #4f46e5;
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
}

/* Credits */
.credits-display {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  margin-bottom: 20px;
}

.credits-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}

.credits-value {
  font-size: 28px;
  font-weight: 700;
}

.credits-label {
  font-size: 11px;
  text-transform: uppercase;
  opacity: 0.8;
}

.credits-info button {
  margin-top: 12px;
  padding: 8px 16px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: white;
  cursor: pointer;
}

.usage-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 100px;
}

.usage-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.usage-fill {
  width: 100%;
  background: #4f46e5;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}

.usage-bar span {
  font-size: 11px;
  color: #9ca3af;
}

/* Plans */
.plan-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.plan-card {
  padding: 20px;
  background: #f9fafb;
  border: 2px solid transparent;
  border-radius: 12px;
  text-align: center;
}

.plan-card.recommended {
  border-color: #4f46e5;
  background: #eff6ff;
}

.plan-card.active {
  border-color: #22c55e;
}

.plan-card h5 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.plan-price {
  margin-bottom: 16px;
}

.plan-price .currency {
  font-size: 20px;
  color: #6b7280;
  vertical-align: top;
}

.plan-price .amount {
  font-size: 36px;
  font-weight: 700;
  color: #111827;
}

.plan-price .period {
  font-size: 14px;
  color: #9ca3af;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  text-align: left;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  color: #374151;
}

.plan-features li .el-icon {
  color: #22c55e;
}

.plan-card button {
  width: 100%;
  padding: 10px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.plan-card button.current {
  background: #22c55e;
}

/* Notifications */
.notif-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
}

.notif-info {
  display: flex;
  flex-direction: column;
}

.notif-name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.notif-desc {
  font-size: 12px;
  color: #6b7280;
}

/* Shortcuts */
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.shortcut-row span {
  font-size: 13px;
  color: #374151;
}

.shortcut-row kbd {
  padding: 4px 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Fira Code', monospace;
}

/* Security */
.security-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.security-item.danger {
  background: #fef2f2;
}

.security-item span {
  display: block;
  font-weight: 500;
  color: #111827;
  margin-bottom: 4px;
}

.security-item p {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.security-item button {
  padding: 8px 16px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: white;
  cursor: pointer;
}

.security-item.danger button {
  background: #ef4444;
}

/* Help */
.help-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.help-links button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #f9fafb;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.help-links button:hover {
  background: #f3f4f6;
}

/* Category Nav */
.category-nav {
  display: flex;
  gap: 4px;
  padding: 8px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.category-nav button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.category-nav button:hover {
  background: #f3f4f6;
  color: #374151;
}

.category-nav button.active {
  background: #4f46e5;
  color: white;
}
</style>
