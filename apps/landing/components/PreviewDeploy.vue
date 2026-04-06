<template>
  <div class="preview-deploy">
    <!-- Preview Toolbar -->
    <div class="preview-toolbar">
      <div class="toolbar-left">
        <div class="device-tabs">
          <button 
            v-for="device in devices" 
            :key="device.id"
            class="device-tab"
            :class="{ active: activeDevice === device.id }"
            @click="activeDevice = device.id"
          >
            <el-icon><component :is="device.icon" /></el-icon>
            <span>{{ device.name }}</span>
          </button>
        </div>
      </div>
      <div class="toolbar-center">
        <div class="url-bar">
          <el-icon><Lock /></el-icon>
          <input 
            v-model="previewUrl" 
            type="text" 
            readonly
          />
          <button class="copy-url" @click="copyUrl">
            <el-icon><CopyDocument /></el-icon>
          </button>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="toolbar-btn" @click="refreshPreview">
          <el-icon><Refresh /></el-icon>
        </button>
        <button class="toolbar-btn" @click="toggleHotReload" :class="{ active: hotReload }">
          <el-icon><Lightning /></el-icon>
        </button>
        <button class="toolbar-btn" @click="takeScreenshot">
          <el-icon><Camera /></el-icon>
        </button>
        <button class="toolbar-btn" @click="showShareModal = true">
          <el-icon><Share /></el-icon>
        </button>
        <button class="deploy-btn" @click="deploy">
          <el-icon><Promotion /></el-icon>
          Deploy
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="preview-main">
      <!-- Preview Area -->
      <div class="preview-area">
        <div 
          class="preview-frame"
          :class="activeDevice"
          :style="previewFrameStyle"
        >
          <div class="device-frame">
            <div class="device-header" v-if="activeDevice !== 'desktop'">
              <div class="device-notch" v-if="activeDevice === 'mobile'" />
            </div>
            <iframe 
              ref="previewIframe"
              :src="previewUrl"
              class="preview-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
            <div class="device-home-indicator" v-if="activeDevice === 'mobile'" />
          </div>
        </div>
        
        <!-- Zoom Controls -->
        <div class="zoom-controls">
          <button @click="zoomOut">
            <el-icon><ZoomOut /></el-icon>
          </button>
          <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
          <button @click="zoomIn">
            <el-icon><ZoomIn /></el-icon>
          </button>
          <button @click="resetZoom">
            <el-icon><FullScreen /></el-icon>
          </button>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="preview-sidebar">
        <!-- Deployment Status -->
        <div class="sidebar-section">
          <h4>Deployment Status</h4>
          <div class="deploy-status" :class="deployStatus">
            <el-icon class="status-icon">
              <CircleCheckFilled v-if="deployStatus === 'ready'" />
              <Loading v-else-if="deployStatus === 'building'" />
              <WarningFilled v-else />
            </el-icon>
            <div class="status-info">
              <span class="status-text">{{ deployStatusText }}</span>
              <span class="status-time">{{ lastDeployTime }}</span>
            </div>
          </div>
          <button class="view-deploy-btn" @click="showDeployHistory = true">
            View History
          </button>
        </div>

        <!-- Environment Variables -->
        <div class="sidebar-section">
          <h4>Environment Variables</h4>
          <div class="env-list">
            <div v-for="env in envVars" :key="env.key" class="env-item">
              <span class="env-key">{{ env.key }}</span>
              <span class="env-value">{{ maskValue(env.value) }}</span>
              <button class="env-edit" @click="editEnv(env)">
                <el-icon><Edit /></el-icon>
              </button>
            </div>
          </div>
          <button class="add-env-btn" @click="addEnvVar">
            <el-icon><Plus /></el-icon>
            Add Variable
          </button>
        </div>

        <!-- Domain Settings -->
        <div class="sidebar-section">
          <h4>Domain</h4>
          <div class="domain-info">
            <div class="domain-item">
              <span class="domain-url">{{ customDomain || defaultDomain }}</span>
              <span v-if="sslEnabled" class="ssl-badge">
                <el-icon><Lock /></el-icon>
                SSL
              </span>
            </div>
            <button class="domain-btn" @click="showDomainModal = true">
              Configure Domain
            </button>
          </div>
        </div>

        <!-- Build Logs -->
        <div class="sidebar-section">
          <h4>Build Logs</h4>
          <div class="build-logs" ref="buildLogsRef">
            <div 
              v-for="(log, index) in buildLogs" 
              :key="index"
              class="log-line"
              :class="log.type"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal-overlay" @click="showShareModal = false">
      <div class="share-modal" @click.stop>
        <div class="modal-header">
          <h3>Share Preview</h3>
          <button @click="showShareModal = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="share-content">
          <div class="share-option">
            <label class="checkbox-label">
              <input v-model="shareOptions.passwordProtected" type="checkbox" />
              Password Protection
            </label>
            <input 
              v-if="shareOptions.passwordProtected"
              v-model="shareOptions.password"
              type="password"
              placeholder="Set password"
              class="password-input"
            />
          </div>
          <div class="share-option">
            <label class="checkbox-label">
              <input v-model="shareOptions.expires" type="checkbox" />
              Expires After
            </label>
            <select v-if="shareOptions.expires" v-model="shareOptions.expiryDays">
              <option :value="1">1 day</option>
              <option :value="7">7 days</option>
              <option :value="30">30 days</option>
            </select>
          </div>
          <div class="share-link">
            <input :value="shareUrl" readonly />
            <button @click="copyShareUrl">
              <el-icon><CopyDocument /></el-icon>
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Domain Modal -->
    <div v-if="showDomainModal" class="modal-overlay" @click="showDomainModal = false">
      <div class="domain-modal" @click.stop>
        <div class="modal-header">
          <h3>Configure Domain</h3>
          <button @click="showDomainModal = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="domain-content">
          <div class="form-group">
            <label>Custom Domain</label>
            <input v-model="customDomain" type="text" placeholder="www.example.com" />
          </div>
          <div v-if="customDomain" class="dns-records">
            <h4>Required DNS Records</h4>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>A</td>
                  <td>@</td>
                  <td>76.76.21.21</td>
                </tr>
                <tr>
                  <td>CNAME</td>
                  <td>www</td>
                  <td>cname.agenthive.io</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="ssl-section">
            <label class="checkbox-label">
              <input v-model="sslEnabled" type="checkbox" />
              Enable SSL (HTTPS)
            </label>
            <p class="ssl-note">Free SSL certificate will be automatically provisioned</p>
          </div>
          <button class="save-domain-btn" @click="saveDomain">Save Configuration</button>
        </div>
      </div>
    </div>

    <!-- Deploy History -->
    <div v-if="showDeployHistory" class="history-drawer">
      <div class="history-header">
        <h3>Deployment History</h3>
        <button @click="showDeployHistory = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="history-list">
        <div 
          v-for="deploy in deployHistory" 
          :key="deploy.id"
          class="history-item"
          :class="deploy.status"
        >
          <div class="history-status">
            <el-icon>
              <CircleCheckFilled v-if="deploy.status === 'success'" />
              <CircleCloseFilled v-else-if="deploy.status === 'failed'" />
              <Loading v-else />
            </el-icon>
          </div>
          <div class="history-info">
            <span class="history-commit">{{ deploy.commit }}</span>
            <span class="history-time">{{ deploy.time }}</span>
          </div>
          <div class="history-actions">
            <button v-if="deploy.status === 'success'" @click="rollback(deploy)">
              Rollback
            </button>
            <button @click="viewLogs(deploy)">Logs</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications -->
    <div class="deploy-notifications">
      <div 
        v-for="notification in notifications" 
        :key="notification.id"
        class="notification"
        :class="notification.type"
      >
        <el-icon class="notification-icon">
          <CircleCheckFilled v-if="notification.type === 'success'" />
          <WarningFilled v-else-if="notification.type === 'warning'" />
          <InfoFilled v-else />
        </el-icon>
        <span class="notification-message">{{ notification.message }}</span>
        <button class="notification-close" @click="dismissNotification(notification)">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  Monitor,
  Cellphone,
  Iphone,
  Lock,
  CopyDocument,
  Refresh,
  Lightning,
  Camera,
  Share,
  Promotion,
  ZoomOut,
  ZoomIn,
  FullScreen,
  CircleCheckFilled,
  Loading,
  WarningFilled,
  Edit,
  Plus,
  Close,
  InfoFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Devices
const devices = [
  { id: 'desktop', name: 'Desktop', icon: Monitor, width: '100%', height: '100%' },
  { id: 'tablet', name: 'Tablet', icon: Cellphone, width: '768px', height: '1024px' },
  { id: 'mobile', name: 'Mobile', icon: Iphone, width: '375px', height: '812px' }
]

const activeDevice = ref('desktop')
const zoom = ref(1)
const hotReload = ref(true)
const previewUrl = ref('https://preview.agenthive.io/demo')
const previewIframe = ref<HTMLIFrameElement>()

// Deploy Status
const deployStatus = ref<'ready' | 'building' | 'error'>('ready')
const deployStatusText = computed(() => {
  const texts = { ready: 'Production Ready', building: 'Building...', error: 'Build Failed' }
  return texts[deployStatus.value]
})
const lastDeployTime = ref('Deployed 5 min ago')

// Environment Variables
interface EnvVar {
  key: string
  value: string
}

const envVars = ref<EnvVar[]>([
  { key: 'NODE_ENV', value: 'production' },
  { key: 'API_URL', value: 'https://api.example.com' },
  { key: 'STRIPE_KEY', value: 'sk_live_xxxxxxxx' }
])

const maskValue = (value: string) => {
  if (value.length <= 8) return '****'
  return value.substring(0, 4) + '****' + value.substring(value.length - 4)
}

// Domain
const defaultDomain = 'demo.agenthive.io'
const customDomain = ref('')
const sslEnabled = ref(true)

// Build Logs
interface BuildLog {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

const buildLogs = ref<BuildLog[]>([
  { time: '14:23:05', message: 'Build started...', type: 'info' },
  { time: '14:23:08', message: 'Installing dependencies...', type: 'info' },
  { time: '14:23:45', message: 'Dependencies installed', type: 'success' },
  { time: '14:23:46', message: 'Building application...', type: 'info' },
  { time: '14:24:12', message: 'Build completed successfully', type: 'success' },
  { time: '14:24:13', message: 'Deploying to edge network...', type: 'info' },
  { time: '14:24:20', message: 'Deployed to all regions', type: 'success' }
])

const buildLogsRef = ref<HTMLElement>()

// Modals
const showShareModal = ref(false)
const showDomainModal = ref(false)
const showDeployHistory = ref(false)

// Share Options
const shareOptions = ref({
  passwordProtected: false,
  password: '',
  expires: false,
  expiryDays: 7
})

const shareUrl = computed(() => {
  return `https://share.agenthive.io/p/abc123${shareOptions.value.passwordProtected ? '?protected=1' : ''}`
})

// Deploy History
interface Deploy {
  id: string
  commit: string
  status: 'success' | 'failed' | 'building'
  time: string
}

const deployHistory = ref<Deploy[]>([
  { id: '1', commit: 'feat: add new dashboard', status: 'success', time: '5 min ago' },
  { id: '2', commit: 'fix: resolve auth bug', status: 'success', time: '2 hours ago' },
  { id: '3', commit: 'chore: update deps', status: 'failed', time: '5 hours ago' }
])

// Notifications
interface Notification {
  id: string
  type: 'success' | 'warning' | 'info'
  message: string
}

const notifications = ref<Notification[]>([])

// Computed
const previewFrameStyle = computed(() => {
  const device = devices.find(d => d.id === activeDevice.value)
  if (!device) return {}
  
  if (activeDevice.value === 'desktop') {
    return { transform: `scale(${zoom.value})` }
  }
  
  return {
    width: device.width,
    height: device.height,
    transform: `scale(${zoom.value})`
  }
})

// Methods
const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 2)
}

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.5)
}

const resetZoom = () => {
  zoom.value = 1
}

const refreshPreview = () => {
  if (previewIframe.value) {
    previewIframe.value.src = previewIframe.value.src
    ElMessage.success('Preview refreshed')
  }
}

const toggleHotReload = () => {
  hotReload.value = !hotReload.value
  ElMessage.success(hotReload.value ? 'Hot reload enabled' : 'Hot reload disabled')
}

const takeScreenshot = () => {
  ElMessage.success('Screenshot saved')
}

const copyUrl = () => {
  navigator.clipboard.writeText(previewUrl.value)
  ElMessage.success('URL copied')
}

const deploy = () => {
  deployStatus.value = 'building'
  addNotification('info', 'Deployment started...')
  
  setTimeout(() => {
    deployStatus.value = 'ready'
    lastDeployTime.value = 'Just now'
    addNotification('success', 'Deployment successful!')
    addBuildLog('Deployment completed', 'success')
  }, 3000)
}

const addBuildLog = (message: string, type: BuildLog['type']) => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  buildLogs.value.push({ time, message, type })
  
  nextTick(() => {
    if (buildLogsRef.value) {
      buildLogsRef.value.scrollTop = buildLogsRef.value.scrollHeight
    }
  })
}

const addEnvVar = () => {
  const key = prompt('Variable name:')
  if (key) {
    const value = prompt('Variable value:') || ''
    envVars.value.push({ key, value })
    ElMessage.success(`Added ${key}`)
  }
}

const editEnv = (env: EnvVar) => {
  const newValue = prompt(`Value for ${env.key}:`, env.value)
  if (newValue !== null) {
    env.value = newValue
    ElMessage.success('Updated')
  }
}

const copyShareUrl = () => {
  navigator.clipboard.writeText(shareUrl.value)
  ElMessage.success('Share link copied')
}

const saveDomain = () => {
  showDomainModal.value = false
  ElMessage.success('Domain configuration saved')
}

const rollback = (deploy: Deploy) => {
  ElMessage.success(`Rolled back to ${deploy.commit}`)
}

const viewLogs = (deploy: Deploy) => {
  ElMessage.info(`Viewing logs for ${deploy.commit}`)
}

const addNotification = (type: Notification['type'], message: string) => {
  const id = Date.now().toString()
  notifications.value.push({ id, type, message })
  
  setTimeout(() => {
    dismissNotification({ id, type, message })
  }, 5000)
}

const dismissNotification = (notification: Notification) => {
  notifications.value = notifications.value.filter(n => n.id !== notification.id)
}
</script>

<style scoped>
.preview-deploy {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9fafb;
}

/* Toolbar */
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.device-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 10px;
}

.device-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.device-tab:hover {
  color: #374151;
}

.device-tab.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 500px;
  margin: 0 auto;
}

.url-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.url-bar input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #374151;
}

.copy-url {
  padding: 4px;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
}

.copy-url:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.toolbar-btn.active {
  background: #dcfce7;
  border-color: #22c55e;
  color: #16a34a;
}

.deploy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.deploy-btn:hover {
  background: #4338ca;
}

/* Main Content */
.preview-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Preview Area */
.preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: auto;
}

.preview-frame {
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-frame {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  overflow: hidden;
  position: relative;
}

.mobile .device-frame {
  width: 375px;
  height: 812px;
  border: 12px solid #1f2937;
  border-radius: 40px;
}

.tablet .device-frame {
  width: 768px;
  height: 1024px;
  border: 16px solid #1f2937;
  border-radius: 24px;
}

.device-header {
  height: 44px;
  background: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-notch {
  width: 150px;
  height: 30px;
  background: #000000;
  border-radius: 0 0 16px 16px;
}

.device-home-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 5px;
  background: #374151;
  border-radius: 3px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Zoom Controls */
.zoom-controls {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.zoom-controls button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-controls button:hover {
  background: #f3f4f6;
}

.zoom-value {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  min-width: 50px;
  text-align: center;
}

/* Sidebar */
.preview-sidebar {
  width: 320px;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  overflow-y: auto;
  padding: 20px;
}

.sidebar-section {
  margin-bottom: 24px;
}

.sidebar-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.deploy-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 12px;
}

.deploy-status.ready {
  background: #dcfce7;
}

.deploy-status.building {
  background: #fef3c7;
}

.deploy-status.error {
  background: #fee2e2;
}

.status-icon {
  font-size: 24px;
}

.deploy-status.ready .status-icon {
  color: #22c55e;
}

.deploy-status.building .status-icon {
  color: #f59e0b;
  animation: spin 1s linear infinite;
}

.deploy-status.error .status-icon {
  color: #ef4444;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.status-time {
  font-size: 12px;
  color: #6b7280;
}

.view-deploy-btn {
  width: 100%;
  padding: 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.view-deploy-btn:hover {
  background: #e5e7eb;
}

.env-list {
  margin-bottom: 12px;
}

.env-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
}

.env-key {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 500;
  color: #111827;
}

.env-value {
  flex: 1;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: #9ca3af;
}

.env-edit {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
}

.env-edit:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.add-env-btn {
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

.domain-info {
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
}

.domain-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.domain-url {
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #374151;
}

.ssl-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #dcfce7;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: #166534;
}

.domain-btn {
  width: 100%;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.build-logs {
  height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 10px;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.6;
}

.log-line {
  display: flex;
  gap: 12px;
}

.log-time {
  color: #6b7280;
  white-space: nowrap;
}

.log-message {
  color: #d4d4d4;
}

.log-line.success .log-message {
  color: #22c55e;
}

.log-line.error .log-message {
  color: #ef4444;
}

.log-line.warning .log-message {
  color: #f59e0b;
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  z-index: 100;
}

.share-modal,
.domain-modal {
  width: 480px;
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

.modal-header button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #9ca3af;
  cursor: pointer;
}

.share-content,
.domain-content {
  padding: 24px;
}

.share-option {
  margin-bottom: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.password-input,
.share-content select {
  margin-top: 8px;
  margin-left: 24px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
}

.share-link {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.share-link input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  background: #f9fafb;
}

.share-link button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
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

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.dns-records {
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.dns-records h4 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.dns-records table {
  width: 100%;
  font-size: 12px;
}

.dns-records th,
.dns-records td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.dns-records th {
  color: #9ca3af;
  font-weight: 500;
}

.dns-records td {
  font-family: 'Fira Code', monospace;
  color: #374151;
}

.ssl-section {
  margin-bottom: 20px;
}

.ssl-note {
  margin: 8px 0 0 24px;
  font-size: 12px;
  color: #6b7280;
}

.save-domain-btn {
  width: 100%;
  padding: 12px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

/* History Drawer */
.history-drawer {
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

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.history-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 10px;
}

.history-item.success {
  border-left: 3px solid #22c55e;
}

.history-item.failed {
  border-left: 3px solid #ef4444;
}

.history-status {
  font-size: 20px;
}

.history-item.success .history-status {
  color: #22c55e;
}

.history-item.failed .history-status {
  color: #ef4444;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-commit {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.history-time {
  font-size: 12px;
  color: #9ca3af;
}

.history-actions {
  display: flex;
  gap: 6px;
}

.history-actions button {
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.history-actions button:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Notifications */
.deploy-notifications {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 200;
}

.notification {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification.success {
  border-left: 4px solid #22c55e;
}

.notification.warning {
  border-left: 4px solid #f59e0b;
}

.notification.info {
  border-left: 4px solid #3b82f6;
}

.notification-icon {
  font-size: 18px;
}

.notification.success .notification-icon {
  color: #22c55e;
}

.notification.warning .notification-icon {
  color: #f59e0b;
}

.notification.info .notification-icon {
  color: #3b82f6;
}

.notification-message {
  font-size: 14px;
  color: #374151;
}

.notification-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  margin-left: 8px;
}

.notification-close:hover {
  background: #f3f4f6;
  color: #6b7280;
}
</style>
