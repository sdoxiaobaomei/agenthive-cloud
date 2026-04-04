<template>
  <div class="settings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-subtitle">配置系统参数和个人偏好</p>
      </div>
    </div>
    
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="18" :lg="16">
        <el-tabs v-model="activeTab" type="border-card" class="settings-tabs">
          <el-tab-pane label="通用" name="general">
            <el-form :model="generalForm" label-width="120px" class="settings-form">
              <el-form-item label="语言">
                <el-select v-model="generalForm.language" style="width: 200px">
                  <el-option label="简体中文" value="zh-CN" />
                  <el-option label="English" value="en" />
                </el-select>
              </el-form-item>
              
              <el-form-item label="主题">
                <el-radio-group v-model="generalForm.theme">
                  <el-radio-button label="light">
                    <el-icon><Sunny /></el-icon> 浅色
                  </el-radio-button>
                  <el-radio-button label="dark">
                    <el-icon><Moon /></el-icon> 深色
                  </el-radio-button>
                  <el-radio-button label="auto">
                    <el-icon><Monitor /></el-icon> 自动
                  </el-radio-button>
                </el-radio-group>
              </el-form-item>
              
              <el-form-item label="自动刷新">
                <el-switch v-model="generalForm.autoRefresh" />
                <span class="form-hint">每 30 秒自动刷新数据</span>
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="saveGeneral">保存设置</el-button>
                <el-button @click="resetGeneral">重置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <el-tab-pane label="通知" name="notifications">
            <el-form :model="notificationForm" label-width="160px" class="settings-form">
              <el-form-item label="桌面通知">
                <el-switch v-model="notificationForm.desktop" />
              </el-form-item>
              
              <el-form-item label="声音提醒">
                <el-switch v-model="notificationForm.sound" />
              </el-form-item>
              
              <el-form-item label="Agent 状态变更">
                <el-switch v-model="notificationForm.agentStatus" />
              </el-form-item>
              
              <el-form-item label="任务完成通知">
                <el-switch v-model="notificationForm.taskComplete" />
              </el-form-item>
              
              <el-form-item label="系统错误通知">
                <el-switch v-model="notificationForm.systemError" />
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="saveNotifications">保存设置</el-button>
                <el-button @click="resetNotifications">重置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <el-tab-pane label="代码编辑器" name="editor">
            <el-form :model="editorForm" label-width="120px" class="settings-form">
              <el-form-item label="主题">
                <el-select v-model="editorForm.theme" style="width: 200px">
                  <el-option label="VS Dark" value="vs-dark" />
                  <el-option label="VS Light" value="vs" />
                  <el-option label="High Contrast" value="hc-black" />
                </el-select>
              </el-form-item>
              
              <el-form-item label="字体大小">
                <el-slider v-model="editorForm.fontSize" :min="12" :max="20" show-stops />
              </el-form-item>
              
              <el-form-item label="自动换行">
                <el-switch v-model="editorForm.wordWrap" />
              </el-form-item>
              
              <el-form-item label="显示行号">
                <el-switch v-model="editorForm.lineNumbers" />
              </el-form-item>
              
              <el-form-item label="代码格式化">
                <el-switch v-model="editorForm.formatOnSave" />
                <span class="form-hint">保存时自动格式化代码</span>
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="saveEditor">保存设置</el-button>
                <el-button @click="resetEditor">重置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <el-tab-pane label="API 设置" name="api">
            <el-form :model="apiForm" label-width="120px" class="settings-form">
              <el-form-item label="API 地址">
                <el-input v-model="apiForm.baseUrl" placeholder="https://api.example.com" />
              </el-form-item>
              
              <el-form-item label="WebSocket 地址">
                <el-input v-model="apiForm.wsUrl" placeholder="wss://ws.example.com" />
              </el-form-item>
              
              <el-form-item label="请求超时">
                <el-input-number v-model="apiForm.timeout" :min="5000" :max="60000" :step="1000" />
                <span class="form-hint">毫秒</span>
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="testConnection">测试连接</el-button>
                <el-button @click="saveApi">保存设置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <el-tab-pane label="关于" name="about">
            <div class="about-content">
              <div class="about-logo">
                <el-icon :size="80" color="var(--el-color-primary)"><Orange /></el-icon>
                <h2>AgentHive Cloud</h2>
                <p class="version">版本 0.1.0-beta</p>
              </div>
              
              <el-descriptions :column="1" border class="about-info">
                <el-descriptions-item label="版本">v0.1.0-beta</el-descriptions-item>
                <el-descriptions-item label="构建时间">2026-03-31</el-descriptions-item>
                <el-descriptions-item label="Vue">^3.4.0</el-descriptions-item>
                <el-descriptions-item label="Element Plus">^2.5.0</el-descriptions-item>
                <el-descriptions-item label="Node.js">>= 18.0.0</el-descriptions-item>
              </el-descriptions>
              
              <div class="about-links">
                <el-link type="primary" :icon="Document">使用文档</el-link>
                <el-link type="primary" :icon="Link">GitHub</el-link>
                <el-link type="primary" :icon="Warning">报告问题</el-link>
              </div>
              
              <el-divider />
              
              <div class="about-license">
                <p>© 2026 AgentHive Cloud. All rights reserved.</p>
                <p>Licensed under MIT License</p>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sunny, Moon, Monitor, Orange, Document, Link, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { STORAGE_KEYS } from '@/utils/constants'

const activeTab = ref('general')

// 从 localStorage 加载设置
const loadSettings = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

const savedSettings = loadSettings()

const generalForm = ref({
  language: savedSettings?.general?.language || 'zh-CN',
  theme: savedSettings?.general?.theme || 'light',
  autoRefresh: savedSettings?.general?.autoRefresh ?? true,
})

const notificationForm = ref({
  desktop: savedSettings?.notification?.desktop ?? true,
  sound: savedSettings?.notification?.sound ?? false,
  agentStatus: savedSettings?.notification?.agentStatus ?? true,
  taskComplete: savedSettings?.notification?.taskComplete ?? true,
  systemError: savedSettings?.notification?.systemError ?? true,
})

const editorForm = ref({
  theme: savedSettings?.editor?.theme || 'vs-dark',
  fontSize: savedSettings?.editor?.fontSize || 14,
  wordWrap: savedSettings?.editor?.wordWrap ?? true,
  lineNumbers: savedSettings?.editor?.lineNumbers ?? true,
  formatOnSave: savedSettings?.editor?.formatOnSave ?? true,
})

const apiForm = ref({
  baseUrl: savedSettings?.api?.baseUrl || '',
  wsUrl: savedSettings?.api?.wsUrl || '',
  timeout: savedSettings?.api?.timeout || 30000,
})

const saveSettings = () => {
  const settings = {
    general: generalForm.value,
    notification: notificationForm.value,
    editor: editorForm.value,
    api: apiForm.value,
  }
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

const saveGeneral = () => {
  saveSettings()
  ElMessage.success('通用设置已保存')
  
  // 应用主题
  const isDark = generalForm.value.theme === 'dark' || 
    (generalForm.value.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

const resetGeneral = () => {
  generalForm.value = {
    language: 'zh-CN',
    theme: 'light',
    autoRefresh: true,
  }
}

const saveNotifications = () => {
  saveSettings()
  ElMessage.success('通知设置已保存')
}

const resetNotifications = () => {
  notificationForm.value = {
    desktop: true,
    sound: false,
    agentStatus: true,
    taskComplete: true,
    systemError: true,
  }
}

const saveEditor = () => {
  saveSettings()
  ElMessage.success('编辑器设置已保存')
}

const resetEditor = () => {
  editorForm.value = {
    theme: 'vs-dark',
    fontSize: 14,
    wordWrap: true,
    lineNumbers: true,
    formatOnSave: true,
  }
}

const testConnection = async () => {
  ElMessage.info('正在测试连接...')
  // 模拟测试
  setTimeout(() => {
    ElMessage.success('连接成功')
  }, 1000)
}

const saveApi = () => {
  saveSettings()
  ElMessage.success('API 设置已保存')
}

onMounted(() => {
  // 应用保存的主题
  const isDark = generalForm.value.theme === 'dark' || 
    (generalForm.value.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
})
</script>

<style scoped>
.settings-page {
  padding: 8px;
}

.page-header {
  margin-bottom: 24px;
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

.settings-tabs :deep(.el-tabs__content) {
  padding: 20px;
}

.settings-form {
  max-width: 600px;
}

.form-hint {
  margin-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.about-content {
  padding: 20px;
  max-width: 500px;
  margin: 0 auto;
}

.about-logo {
  text-align: center;
  margin-bottom: 32px;
}

.about-logo h2 {
  margin: 16px 0 8px;
  font-size: 24px;
}

.version {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.about-info {
  margin-bottom: 24px;
}

.about-links {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.about-license {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.about-license p {
  margin: 4px 0;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .settings-tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
  
  .settings-form {
    max-width: 100%;
  }
  
  .settings-form :deep(.el-form-item__label) {
    float: none;
    display: block;
    text-align: left;
    margin-bottom: 8px;
  }
  
  .about-links {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
