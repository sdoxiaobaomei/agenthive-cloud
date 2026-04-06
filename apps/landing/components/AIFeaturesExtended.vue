<template>
  <div class="ai-features-extended">
    <!-- Task 9: Contextual Conversations -->
    <div v-if="activeFeature === 'context'" class="feature-panel">
      <div class="context-header">
        <h3>Conversation Context</h3>
        <span class="context-count">{{ contextMessages.length }} messages</span>
      </div>
      
      <div class="context-timeline">
        <div 
          v-for="(ctx, index) in contextMessages" 
          :key="ctx.id"
          class="context-item"
          :class="{ active: ctx.isCurrent }"
        >
          <div class="context-marker" />
          <div class="context-content">
            <div class="context-meta">
              <img :src="ctx.agentAvatar" class="ctx-avatar" />
              <span class="ctx-agent">{{ ctx.agentName }}</span>
              <span class="ctx-time">{{ ctx.timestamp }}</span>
            </div>
            <p class="ctx-text">{{ ctx.text }}</p>
            <div v-if="ctx.codeSnippet" class="ctx-code-preview">
              <code>{{ ctx.codeSnippet }}</code>
            </div>
          </div>
          <div class="context-actions">
            <button class="ctx-btn" @click="jumpToContext(ctx.id)">
              <el-icon><ArrowUp /></el-icon>
            </button>
            <button class="ctx-btn" @click="removeContext(ctx.id)">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <div class="context-controls">
        <button class="ctx-control-btn" @click="clearContext">
          <el-icon><Delete /></el-icon>
          Clear All
        </button>
        <button class="ctx-control-btn primary" @click="summarizeContext">
          <el-icon><Document /></el-icon>
          Summarize
        </button>
      </div>
    </div>

    <!-- Task 10: Performance Analysis -->
    <div v-if="activeFeature === 'performance'" class="feature-panel">
      <div class="perf-header">
        <h3>Performance Analysis</h3>
        <div class="perf-score">
          <span class="score-value" :style="{ color: getPerfColor(performanceScore) }">
            {{ performanceScore }}
          </span>
          <span class="score-label">/100</span>
        </div>
      </div>

      <div class="perf-metrics">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><Timer /></el-icon>
          </div>
          <div class="metric-info">
            <span class="metric-value">{{ loadTime }}s</span>
            <span class="metric-label">Load Time</span>
          </div>
          <div class="metric-status" :class="getMetricStatus(loadTime, 2)">
            {{ getMetricStatus(loadTime, 2) }}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><FirstAidKit /></el-icon>
          </div>
          <div class="metric-info">
            <span class="metric-value">{{ bundleSize }}KB</span>
            <span class="metric-label">Bundle Size</span>
          </div>
          <div class="metric-status" :class="getMetricStatus(bundleSize, 500, true)">
            {{ getMetricStatus(bundleSize, 500, true) }}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><View /></el-icon>
          </div>
          <div class="metric-info">
            <span class="metric-value">{{ renderTime }}ms</span>
            <span class="metric-label">Render Time</span>
          </div>
          <div class="metric-status" :class="getMetricStatus(renderTime, 16)">
            {{ getMetricStatus(renderTime, 16) }}
          </div>
        </div>
      </div>

      <div class="perf-suggestions">
        <h4>Optimization Suggestions</h4>
        <div 
          v-for="suggestion in perfSuggestions" 
          :key="suggestion.id"
          class="perf-suggestion"
          :class="suggestion.priority"
        >
          <div class="suggestion-header">
            <el-icon class="suggestion-icon">
              <WarningFilled v-if="suggestion.priority === 'high'" />
              <InfoFilled v-else />
            </el-icon>
            <span class="suggestion-title">{{ suggestion.title }}</span>
            <span class="suggestion-impact">{{ suggestion.impact }}</span>
          </div>
          <p class="suggestion-desc">{{ suggestion.description }}</p>
          <button class="apply-opt-btn" @click="applyOptimization(suggestion)">
            Apply Optimization
          </button>
        </div>
      </div>
    </div>

    <!-- Task 11: Security Scan -->
    <div v-if="activeFeature === 'security'" class="feature-panel">
      <div class="sec-header">
        <h3>Security Scan</h3>
        <div class="sec-badge" :class="securityLevel">
          {{ securityLevel.toUpperCase() }}
        </div>
      </div>

      <div class="sec-summary">
        <div class="sec-stat">
          <span class="stat-value critical">{{ criticalIssues }}</span>
          <span class="stat-label">Critical</span>
        </div>
        <div class="sec-stat">
          <span class="stat-value warning">{{ warningIssues }}</span>
          <span class="stat-label">Warnings</span>
        </div>
        <div class="sec-stat">
          <span class="stat-value info">{{ infoIssues }}</span>
          <span class="stat-label">Info</span>
        </div>
      </div>

      <div class="sec-issues">
        <div 
          v-for="issue in securityIssues" 
          :key="issue.id"
          class="sec-issue"
          :class="issue.severity"
        >
          <div class="issue-header">
            <el-icon class="issue-icon">
              <CircleCloseFilled v-if="issue.severity === 'critical'" />
              <WarningFilled v-else-if="issue.severity === 'warning'" />
              <InfoFilled v-else />
            </el-icon>
            <span class="issue-type">{{ issue.type }}</span>
            <span class="issue-cwe">{{ issue.cwe }}</span>
          </div>
          <p class="issue-desc">{{ issue.description }}</p>
          <div class="issue-location">
            <el-icon><Document /></el-icon>
            <span>{{ issue.file }}:{{ issue.line }}</span>
          </div>
          <div class="issue-fix">
            <h5>Recommended Fix:</h5>
            <code>{{ issue.fix }}</code>
          </div>
          <button class="fix-sec-btn" @click="fixSecurityIssue(issue)">
            Auto-Fix
          </button>
        </div>
      </div>
    </div>

    <!-- Task 12: Test Generation -->
    <div v-if="activeFeature === 'tests'" class="feature-panel">
      <div class="test-header">
        <h3>Test Case Generator</h3>
        <button class="gen-all-btn" @click="generateAllTests">
          <el-icon><VideoPlay /></el-icon>
          Generate All Tests
        </button>
      </div>

      <div class="test-coverage">
        <div class="coverage-chart">
          <svg viewBox="0 0 36 36" class="circular-chart">
            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path 
              class="circle" 
              :stroke-dasharray="`${testCoverage}, 100`"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
            />
          </svg>
          <div class="coverage-text">
            <span class="coverage-value">{{ testCoverage }}%</span>
            <span class="coverage-label">Coverage</span>
          </div>
        </div>
        <div class="coverage-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background: #22c55e" />
            <span>Unit Tests ({{ unitTests.length }})</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #3b82f6" />
            <span>Integration ({{ integrationTests.length }})</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #f59e0b" />
            <span>E2E Tests ({{ e2eTests.length }})</span>
          </div>
        </div>
      </div>

      <div class="test-tabs">
        <button 
          v-for="tab in testTabs" 
          :key="tab.id"
          class="test-tab"
          :class="{ active: activeTestTab === tab.id }"
          @click="activeTestTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="test-list">
        <div 
          v-for="test in filteredTests" 
          :key="test.id"
          class="test-item"
          :class="{ generated: test.generated }"
        >
          <div class="test-info">
            <el-icon class="test-status" :class="test.status">
              <CircleCheckFilled v-if="test.status === 'pass'" />
              <CircleCloseFilled v-else-if="test.status === 'fail'" />
              <Loading v-else />
            </el-icon>
            <div class="test-details">
              <span class="test-name">{{ test.name }}</span>
              <span class="test-desc">{{ test.description }}</span>
            </div>
          </div>
          <div class="test-actions">
            <button v-if="!test.generated" class="gen-test-btn" @click="generateTest(test)">
              Generate
            </button>
            <button v-else class="run-test-btn" @click="runTest(test)">
              <el-icon><VideoPlay /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Task 13: API Doc Generation -->
    <div v-if="activeFeature === 'api-docs'" class="feature-panel">
      <div class="api-header">
        <h3>API Documentation</h3>
        <div class="api-actions">
          <button class="api-action-btn" @click="exportDocs">
            <el-icon><Download /></el-icon>
            Export
          </button>
          <button class="api-action-btn primary" @click="regenerateDocs">
            <el-icon><Refresh /></el-icon>
            Regenerate
          </button>
        </div>
      </div>

      <div class="api-endpoints">
        <div 
          v-for="endpoint in apiEndpoints" 
          :key="endpoint.id"
          class="api-endpoint"
        >
          <div class="endpoint-header" @click="toggleEndpoint(endpoint.id)">
            <span class="endpoint-method" :class="endpoint.method">{{ endpoint.method }}</span>
            <span class="endpoint-path">{{ endpoint.path }}</span>
            <span class="endpoint-name">{{ endpoint.name }}</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedEndpoint === endpoint.id }">
              <ArrowDown />
            </el-icon>
          </div>
          
          <div v-if="expandedEndpoint === endpoint.id" class="endpoint-details">
            <p class="endpoint-desc">{{ endpoint.description }}</p>
            
            <div class="endpoint-section">
              <h5>Parameters</h5>
              <table class="params-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="param in endpoint.params" :key="param.name">
                    <td><code>{{ param.name }}</code></td>
                    <td>{{ param.type }}</td>
                    <td>
                      <span class="badge" :class="param.required ? 'required' : 'optional'">
                        {{ param.required ? 'Yes' : 'No' }}
                      </span>
                    </td>
                    <td>{{ param.description }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="endpoint-section">
              <h5>Response</h5>
              <pre class="code-block"><code>{{ endpoint.response }}</code></pre>
            </div>

            <div class="endpoint-section">
              <h5>Example</h5>
              <div class="example-code">
                <div class="example-tabs">
                  <span v-for="lang in ['curl', 'js', 'python']" :key="lang" class="example-tab">
                    {{ lang }}
                  </span>
                </div>
                <pre class="code-block"><code>{{ endpoint.example }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Task 14: Complexity Analysis -->
    <div v-if="activeFeature === 'complexity'" class="feature-panel">
      <div class="complex-header">
        <h3>Code Complexity Analysis</h3>
        <div class="complex-summary">
          <div class="summary-item">
            <span class="summary-value">{{ avgComplexity }}</span>
            <span class="summary-label">Avg Complexity</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ totalFunctions }}</span>
            <span class="summary-label">Functions</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ highComplexityCount }}</span>
            <span class="summary-label">High Risk</span>
          </div>
        </div>
      </div>

      <div class="complex-chart">
        <div class="chart-bars">
          <div 
            v-for="item in complexityDistribution" 
            :key="item.range"
            class="chart-bar"
          >
            <div class="bar" :style="{ height: item.percentage + '%', background: item.color }" />
            <span class="bar-label">{{ item.range }}</span>
            <span class="bar-value">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <div class="complex-functions">
        <h4>Most Complex Functions</h4>
        <div 
          v-for="func in complexFunctions" 
          :key="func.id"
          class="complex-function"
          :class="getComplexityLevel(func.score)"
        >
          <div class="function-info">
            <span class="function-name">{{ func.name }}</span>
            <span class="function-location">{{ func.file }}:{{ func.line }}</span>
          </div>
          <div class="function-score">
            <div class="score-bar">
              <div class="score-fill" :style="{ width: (func.score / 20) * 100 + '%' }" />
            </div>
            <span class="score-text">{{ func.score }}</span>
          </div>
          <div class="function-metrics">
            <span class="metric" title="Cyclomatic Complexity">
              <el-icon><Share /></el-icon>
              {{ func.cyclomatic }}
            </span>
            <span class="metric" title="Cognitive Complexity">
              <el-icon><Cpu /></el-icon>
              {{ func.cognitive }}
            </span>
            <span class="metric" title="Lines of Code">
              <el-icon><Document /></el-icon>
              {{ func.loc }}
            </span>
          </div>
          <button class="refactor-btn" @click="suggestRefactor(func)">
            Simplify
          </button>
        </div>
      </div>
    </div>

    <!-- Feature Navigation -->
    <div class="features-nav">
      <button 
        v-for="feature in features" 
        :key="feature.id"
        class="feature-nav-btn"
        :class="{ active: activeFeature === feature.id }"
        @click="activeFeature = feature.id"
      >
        <el-icon><component :is="feature.icon" /></el-icon>
        <span>{{ feature.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowUp,
  Close,
  Delete,
  Document,
  Timer,
  FirstAidKit,
  View,
  WarningFilled,
  InfoFilled,
  CircleCloseFilled,
  CircleCheckFilled,
  Loading,
  VideoPlay,
  Download,
  Refresh,
  ArrowDown,
  Share,
  Cpu
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Feature navigation
const features = [
  { id: 'context', label: 'Context', icon: Document },
  { id: 'performance', label: 'Performance', icon: Timer },
  { id: 'security', label: 'Security', icon: WarningFilled },
  { id: 'tests', label: 'Tests', icon: VideoPlay },
  { id: 'api-docs', label: 'API Docs', icon: Document },
  { id: 'complexity', label: 'Complexity', icon: Cpu }
]

const activeFeature = ref('context')

// Task 9: Context
interface ContextMessage {
  id: string
  agentAvatar: string
  agentName: string
  timestamp: string
  text: string
  codeSnippet?: string
  isCurrent: boolean
}

const contextMessages = ref<ContextMessage[]>([
  {
    id: '1',
    agentAvatar: '/avatars/shiba_tl.png',
    agentName: 'Alex',
    timestamp: '2 min ago',
    text: 'I need to create a user authentication system with JWT tokens and refresh token rotation.',
    isCurrent: false
  },
  {
    id: '2',
    agentAvatar: '/avatars/shiba_qa.png',
    agentName: 'Emma',
    timestamp: '1 min ago',
    text: 'Based on the requirements, here is the initial implementation:',
    codeSnippet: 'const authMiddleware = (req, res, next) => { ... }',
    isCurrent: true
  }
])

const jumpToContext = (id: string) => {
  ElMessage.info(`Jumped to context ${id}`)
}

const removeContext = (id: string) => {
  contextMessages.value = contextMessages.value.filter(c => c.id !== id)
}

const clearContext = () => {
  contextMessages.value = []
  ElMessage.success('Context cleared')
}

const summarizeContext = () => {
  ElMessage.success('Context summarized: Building auth system with JWT')
}

// Task 10: Performance
const performanceScore = ref(78)
const loadTime = ref(1.2)
const bundleSize = ref(245)
const renderTime = ref(12)

interface PerfSuggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: string
}

const perfSuggestions = ref<PerfSuggestion[]>([
  {
    id: '1',
    title: 'Implement code splitting',
    description: 'Split large components into separate chunks to reduce initial bundle size',
    priority: 'high',
    impact: '-45% bundle'
  },
  {
    id: '2',
    title: 'Add image lazy loading',
    description: 'Defer loading of below-the-fold images',
    priority: 'medium',
    impact: '-200ms LCP'
  }
])

const getPerfColor = (score: number) => {
  if (score >= 90) return '#22c55e'
  if (score >= 70) return '#f59e0b'
  return '#ef4444'
}

const getMetricStatus = (value: number, threshold: number, lowerIsBetter = false) => {
  const isGood = lowerIsBetter ? value < threshold : value > threshold
  return isGood ? 'good' : 'poor'
}

const applyOptimization = (suggestion: PerfSuggestion) => {
  ElMessage.success(`Applied: ${suggestion.title}`)
}

// Task 11: Security
const securityLevel = ref('warning')
const criticalIssues = ref(1)
const warningIssues = ref(3)
const infoIssues = ref(5)

interface SecurityIssue {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  cwe: string
  description: string
  file: string
  line: number
  fix: string
}

const securityIssues = ref<SecurityIssue[]>([
  {
    id: '1',
    type: 'SQL Injection',
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'User input is directly used in SQL query without parameterization',
    file: 'src/api/users.ts',
    line: 45,
    fix: 'const query = "SELECT * FROM users WHERE id = ?";\ndb.query(query, [userId]);'
  }
])

const fixSecurityIssue = (issue: SecurityIssue) => {
  ElMessage.success(`Fixed: ${issue.type}`)
  criticalIssues.value--
}

// Task 12: Tests
const testCoverage = ref(67)
const activeTestTab = ref('unit')

const testTabs = [
  { id: 'unit', label: 'Unit Tests' },
  { id: 'integration', label: 'Integration' },
  { id: 'e2e', label: 'E2E' }
]

interface Test {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e'
  generated: boolean
  status: 'pass' | 'fail' | 'pending'
}

const unitTests = ref<Test[]>([
  { id: '1', name: 'should validate user input', description: 'Tests input validation logic', type: 'unit', generated: true, status: 'pass' },
  { id: '2', name: 'should hash password', description: 'Tests password hashing', type: 'unit', generated: false, status: 'pending' }
])

const integrationTests = ref<Test[]>([
  { id: '3', name: 'should create user', description: 'Tests user creation flow', type: 'integration', generated: true, status: 'pass' }
])

const e2eTests = ref<Test[]>([
  { id: '4', name: 'user registration flow', description: 'Complete registration E2E', type: 'e2e', generated: false, status: 'pending' }
])

const filteredTests = computed(() => {
  switch (activeTestTab.value) {
    case 'unit': return unitTests.value
    case 'integration': return integrationTests.value
    case 'e2e': return e2eTests.value
    default: return []
  }
})

const generateAllTests = () => {
  ElMessage.success('Generating all missing tests...')
}

const generateTest = (test: Test) => {
  test.generated = true
  ElMessage.success(`Generated: ${test.name}`)
}

const runTest = (test: Test) => {
  test.status = 'pass'
  ElMessage.success(`Passed: ${test.name}`)
}

// Task 13: API Docs
const expandedEndpoint = ref<string | null>(null)

interface ApiEndpoint {
  id: string
  method: 'get' | 'post' | 'put' | 'delete' | 'patch'
  path: string
  name: string
  description: string
  params: {
    name: string
    type: string
    required: boolean
    description: string
  }[]
  response: string
  example: string
}

const apiEndpoints = ref<ApiEndpoint[]>([
  {
    id: '1',
    method: 'post',
    path: '/api/users',
    name: 'Create User',
    description: 'Creates a new user account with the provided information',
    params: [
      { name: 'email', type: 'string', required: true, description: 'User email address' },
      { name: 'password', type: 'string', required: true, description: 'User password (min 8 chars)' }
    ],
    response: JSON.stringify({ id: '123', email: 'user@example.com', createdAt: '2024-01-06' }, null, 2),
    example: 'curl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"user@example.com","password":"secret"}\''
  }
])

const toggleEndpoint = (id: string) => {
  expandedEndpoint.value = expandedEndpoint.value === id ? null : id
}

const exportDocs = () => {
  ElMessage.success('Documentation exported as OpenAPI spec')
}

const regenerateDocs = () => {
  ElMessage.success('API documentation regenerated')
}

// Task 14: Complexity
const avgComplexity = ref(4.2)
const totalFunctions = ref(23)
const highComplexityCount = ref(3)

const complexityDistribution = [
  { range: '1-3', count: 12, percentage: 52, color: '#22c55e' },
  { range: '4-6', count: 8, percentage: 35, color: '#3b82f6' },
  { range: '7-10', count: 2, percentage: 9, color: '#f59e0b' },
  { range: '>10', count: 1, percentage: 4, color: '#ef4444' }
]

interface ComplexFunction {
  id: string
  name: string
  file: string
  line: number
  score: number
  cyclomatic: number
  cognitive: number
  loc: number
}

const complexFunctions = ref<ComplexFunction[]>([
  { id: '1', name: 'processPayment', file: 'payments.ts', line: 45, score: 18, cyclomatic: 12, cognitive: 15, loc: 89 },
  { id: '2', name: 'validateForm', file: 'forms.ts', line: 23, score: 14, cyclomatic: 9, cognitive: 11, loc: 56 }
])

const getComplexityLevel = (score: number) => {
  if (score > 15) return 'critical'
  if (score > 10) return 'high'
  return 'medium'
}

const suggestRefactor = (func: ComplexFunction) => {
  ElMessage.success(`Refactoring suggestions for ${func.name}`)
}
</script>

<style scoped>
.ai-features-extended {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

/* Feature Panel */
.feature-panel {
  padding: 20px;
  min-height: 400px;
}

/* Task 9: Context */
.context-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.context-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.context-count {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 20px;
}

.context-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.context-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  border-left: 3px solid transparent;
}

.context-item.active {
  background: #eff6ff;
  border-left-color: #4f46e5;
}

.context-marker {
  width: 8px;
  height: 8px;
  background: #d1d5db;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.context-item.active .context-marker {
  background: #4f46e5;
}

.context-content {
  flex: 1;
}

.context-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ctx-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.ctx-agent {
  font-size: 12px;
  font-weight: 500;
  color: #111827;
}

.ctx-time {
  font-size: 11px;
  color: #9ca3af;
}

.ctx-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  margin: 0;
}

.ctx-code-preview {
  margin-top: 8px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #d4d4d4;
}

.context-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ctx-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctx-btn:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.context-controls {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.ctx-control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.ctx-control-btn:hover {
  background: #f3f4f6;
}

.ctx-control-btn.primary {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.ctx-control-btn.primary:hover {
  background: #4338ca;
}

/* Task 10: Performance */
.perf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.perf-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.perf-score {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
}

.score-label {
  font-size: 14px;
  color: #9ca3af;
}

.perf-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
}

.metric-icon {
  width: 36px;
  height: 36px;
  background: #ffffff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.metric-label {
  font-size: 11px;
  color: #9ca3af;
}

.metric-status {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
}

.metric-status.good {
  background: #dcfce7;
  color: #166534;
}

.metric-status.poor {
  background: #fee2e2;
  color: #991b1b;
}

.perf-suggestions h4 {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.perf-suggestion {
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 10px;
}

.perf-suggestion.high {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.suggestion-icon {
  font-size: 14px;
  color: #f59e0b;
}

.perf-suggestion.high .suggestion-icon {
  color: #ef4444;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.suggestion-impact {
  margin-left: auto;
  padding: 2px 8px;
  background: #4f46e5;
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.suggestion-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
}

.apply-opt-btn {
  padding: 6px 12px;
  background: #4f46e5;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.apply-opt-btn:hover {
  background: #4338ca;
}

/* Task 11: Security */
.sec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sec-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.sec-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sec-badge.secure {
  background: #dcfce7;
  color: #166534;
}

.sec-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.sec-badge.critical {
  background: #fee2e2;
  color: #991b1b;
}

.sec-summary {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 16px;
}

.sec-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.stat-value.critical {
  color: #ef4444;
}

.stat-value.warning {
  color: #f59e0b;
}

.stat-value.info {
  color: #3b82f6;
}

.stat-label {
  font-size: 11px;
  color: #9ca3af;
}

.sec-issue {
  padding: 14px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 10px;
}

.sec-issue.critical {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.sec-issue.warning {
  background: #fffbeb;
  border: 1px solid #fcd34d;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.issue-icon {
  font-size: 16px;
}

.sec-issue.critical .issue-icon {
  color: #ef4444;
}

.sec-issue.warning .issue-icon {
  color: #f59e0b;
}

.issue-type {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.issue-cwe {
  margin-left: auto;
  font-size: 10px;
  color: #9ca3af;
  font-family: 'Fira Code', monospace;
}

.issue-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 8px;
  line-height: 1.5;
}

.issue-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 10px;
}

.issue-fix {
  background: #ffffff;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}

.issue-fix h5 {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 6px;
}

.issue-fix code {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #374151;
}

.fix-sec-btn {
  width: 100%;
  padding: 8px;
  background: #ef4444;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.fix-sec-btn:hover {
  background: #dc2626;
}

/* Task 12: Tests */
.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.test-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.gen-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.gen-all-btn:hover {
  background: #4338ca;
}

.test-coverage {
  display: flex;
  gap: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 16px;
}

.coverage-chart {
  position: relative;
  width: 80px;
  height: 80px;
}

.circular-chart {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 250px;
}

.circle-bg {
  fill: none;
  stroke: #e5e7eb;
  stroke-width: 3.8;
}

.circle {
  fill: none;
  stroke: #4f46e5;
  stroke-width: 2.8;
  stroke-linecap: round;
  animation: progress 1s ease-out forwards;
}

@keyframes progress {
  0% { stroke-dasharray: 0 100; }
}

.coverage-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.coverage-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.coverage-label {
  font-size: 10px;
  color: #9ca3af;
}

.coverage-legend {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #374151;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.test-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 12px;
}

.test-tab {
  padding: 6px 12px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
}

.test-tab:hover {
  background: #f3f4f6;
}

.test-tab.active {
  background: #4f46e5;
  color: white;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
}

.test-item.generated {
  background: #eff6ff;
  border: 1px solid #dbeafe;
}

.test-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.test-status {
  font-size: 18px;
}

.test-status.pass {
  color: #22c55e;
}

.test-status.fail {
  color: #ef4444;
}

.test-status:not(.pass):not(.fail) {
  color: #f59e0b;
}

.test-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.test-name {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.test-desc {
  font-size: 11px;
  color: #9ca3af;
}

.gen-test-btn {
  padding: 6px 12px;
  background: #4f46e5;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.run-test-btn {
  width: 28px;
  height: 28px;
  background: #22c55e;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Task 13: API Docs */
.api-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.api-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.api-actions {
  display: flex;
  gap: 8px;
}

.api-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.api-action-btn:hover {
  background: #f3f4f6;
}

.api-action-btn.primary {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.api-endpoints {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.api-endpoint {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f9fafb;
  cursor: pointer;
}

.endpoint-method {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.endpoint-method.get {
  background: #dbeafe;
  color: #1d4ed8;
}

.endpoint-method.post {
  background: #dcfce7;
  color: #15803d;
}

.endpoint-method.put {
  background: #fef3c7;
  color: #b45309;
}

.endpoint-method.delete {
  background: #fee2e2;
  color: #b91c1c;
}

.endpoint-path {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: #111827;
}

.endpoint-name {
  margin-left: auto;
  font-size: 12px;
  color: #6b7280;
}

.expand-icon {
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.endpoint-details {
  padding: 14px;
  border-top: 1px solid #e5e7eb;
}

.endpoint-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 14px;
  line-height: 1.5;
}

.endpoint-section h5 {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 10px;
}

.params-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
}

.params-table th,
.params-table td {
  text-align: left;
  padding: 8px;
  font-size: 11px;
  border-bottom: 1px solid #f3f4f6;
}

.params-table th {
  color: #9ca3af;
  font-weight: 500;
}

.params-table td {
  color: #374151;
}

.params-table code {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.badge.required {
  background: #fee2e2;
  color: #991b1b;
}

.badge.optional {
  background: #f3f4f6;
  color: #6b7280;
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  border-radius: 6px;
  overflow-x: auto;
}

/* Task 14: Complexity */
.complex-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.complex-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.complex-summary {
  display: flex;
  gap: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #4f46e5;
}

.summary-label {
  font-size: 10px;
  color: #9ca3af;
}

.complex-chart {
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 16px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 120px;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.bar {
  width: 40px;
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
}

.bar-label {
  font-size: 11px;
  color: #6b7280;
}

.bar-value {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}

.complex-functions h4 {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.complex-function {
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 10px;
}

.complex-function.critical {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.complex-function.high {
  background: #fffbeb;
  border: 1px solid #fcd34d;
}

.function-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.function-name {
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.function-location {
  font-size: 11px;
  color: #9ca3af;
}

.function-score {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.score-bar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.complex-function.critical .score-fill {
  background: #ef4444;
}

.complex-function.high .score-fill {
  background: #f59e0b;
}

.score-text {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}

.function-metrics {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.function-metrics .metric {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6b7280;
}

.refactor-btn {
  width: 100%;
  padding: 6px;
  background: #4f46e5;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.refactor-btn:hover {
  background: #4338ca;
}

/* Feature Navigation */
.features-nav {
  display: flex;
  gap: 4px;
  padding: 8px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.feature-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.feature-nav-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.feature-nav-btn.active {
  background: #4f46e5;
  color: white;
}
</style>
