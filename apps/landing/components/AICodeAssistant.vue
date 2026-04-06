<template>
  <div class="ai-code-assistant">
    <!-- Quick Actions Toolbar -->
    <div class="assistant-toolbar">
      <button 
        v-for="action in quickActions" 
        :key="action.id"
        class="toolbar-btn"
        :class="{ active: activeAction === action.id }"
        @click="executeAction(action)"
      >
        <el-icon><component :is="action.icon" /></el-icon>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <!-- Code Generation Panel -->
    <div v-if="showCodePanel" class="code-panel">
      <div class="panel-header">
        <span class="panel-title">{{ panelTitle }}</span>
        <button class="close-btn" @click="showCodePanel = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      
      <div class="panel-content">
        <!-- Natural Language Input -->
        <div v-if="activeAction === 'generate'" class="nl-input-section">
          <textarea
            v-model="nlPrompt"
            placeholder="Describe what you want to build in plain English..."
            class="nl-input"
            rows="3"
          />
          <div class="nl-examples">
            <span class="example-label">Examples:</span>
            <button 
              v-for="example in codeExamples" 
              :key="example"
              class="example-chip"
              @click="nlPrompt = example"
            >
              {{ example }}
            </button>
          </div>
          <button class="generate-btn" :disabled="!nlPrompt.trim()" @click="generateCode">
            <el-icon><Star /></el-icon>
            <span>Generate Code</span>
          </button>
        </div>

        <!-- Generated Code -->
        <div v-if="generatedCode" class="generated-code">
          <div class="code-header">
            <span class="code-filename">{{ generatedFileName }}</span>
            <div class="code-actions">
              <button class="code-action-btn" @click="copyCode">
                <el-icon><CopyDocument /></el-icon>
              </button>
              <button class="code-action-btn" @click="applyCode">
                <el-icon><Check /></el-icon>
                <span>Apply</span>
              </button>
            </div>
          </div>
          <pre class="code-block"><code>{{ generatedCode }}</code></pre>
        </div>

        <!-- Explanation Panel -->
        <div v-if="activeAction === 'explain' && codeExplanation" class="explanation-content">
          <div class="explanation-section">
            <h4>Summary</h4>
            <p>{{ codeExplanation.summary }}</p>
          </div>
          <div class="explanation-section">
            <h4>Key Components</h4>
            <ul>
              <li v-for="component in codeExplanation.components" :key="component">
                {{ component }}
              </li>
            </ul>
          </div>
          <div class="explanation-section">
            <h4>How it works</h4>
            <p>{{ codeExplanation.howItWorks }}</p>
          </div>
        </div>

        <!-- Bug Fix Panel -->
        <div v-if="activeAction === 'fix' && bugFixes.length" class="bug-fix-content">
          <div v-for="(fix, index) in bugFixes" :key="index" class="fix-item">
            <div class="fix-header">
              <el-icon class="fix-icon"><Warning /></el-icon>
              <span class="fix-issue">{{ fix.issue }}</span>
            </div>
            <div class="fix-solution">
              <div class="diff-block">
                <div class="diff-line removed">
                  <span class="diff-marker">-</span>
                  <code>{{ fix.oldCode }}</code>
                </div>
                <div class="diff-line added">
                  <span class="diff-marker">+</span>
                  <code>{{ fix.newCode }}</code>
                </div>
              </div>
            </div>
            <button class="apply-fix-btn" @click="applyBugFix(fix)">
              Apply Fix
            </button>
          </div>
        </div>

        <!-- Refactor Panel -->
        <div v-if="activeAction === 'refactor' && refactorSuggestions.length" class="refactor-content">
          <div v-for="(suggestion, index) in refactorSuggestions" :key="index" class="refactor-item">
            <div class="refactor-type">{{ suggestion.type }}</div>
            <p class="refactor-desc">{{ suggestion.description }}</p>
            <div class="refactor-preview">
              <pre><code>{{ suggestion.code }}</code></pre>
            </div>
            <div class="refactor-benefits">
              <span v-for="benefit in suggestion.benefits" :key="benefit" class="benefit-tag">
                {{ benefit }}
              </span>
            </div>
            <button class="apply-refactor-btn" @click="applyRefactor(suggestion)">
              Apply Refactor
            </button>
          </div>
        </div>

        <!-- Review Panel -->
        <div v-if="activeAction === 'review' && reviewResults" class="review-content">
          <div class="review-score">
            <div class="score-circle" :style="{ background: getScoreColor(reviewResults.score) }">
              <span class="score-value">{{ reviewResults.score }}</span>
            </div>
            <span class="score-label">Code Quality Score</span>
          </div>
          
          <div class="review-categories">
            <div 
              v-for="(score, category) in reviewResults.categories" 
              :key="category"
              class="review-category"
            >
              <span class="category-name">{{ category }}</span>
              <div class="category-bar">
                <div class="category-fill" :style="{ width: score + '%' }"></div>
              </div>
              <span class="category-score">{{ score }}</span>
            </div>
          </div>

          <div class="review-issues">
            <h4>Issues Found</h4>
            <div 
              v-for="(issue, index) in reviewResults.issues" 
              :key="index"
              class="review-issue"
              :class="issue.severity"
            >
              <el-icon class="issue-icon">
                <CircleClose v-if="issue.severity === 'error'" />
                <Warning v-else-if="issue.severity === 'warning'" />
                <InfoFilled v-else />
              </el-icon>
              <div class="issue-content">
                <span class="issue-message">{{ issue.message }}</span>
                <span class="issue-line">Line {{ issue.line }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Suggestions -->
    <div v-if="inlineSuggestions.length" class="inline-suggestions">
      <div class="suggestions-header">
        <el-icon><Star /></el-icon>
        <span>AI Suggestions</span>
        <button class="dismiss-all" @click="dismissAllSuggestions">Dismiss all</button>
      </div>
      <div 
        v-for="suggestion in inlineSuggestions" 
        :key="suggestion.id"
        class="suggestion-item"
      >
        <div class="suggestion-preview">
          <code>{{ suggestion.preview }}</code>
        </div>
        <div class="suggestion-actions">
          <button class="suggestion-btn accept" @click="acceptSuggestion(suggestion)">
            <el-icon><Check /></el-icon>
          </button>
          <button class="suggestion-btn reject" @click="rejectSuggestion(suggestion)">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isProcessing" class="processing-overlay">
      <div class="processing-spinner">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <p class="processing-text">{{ processingText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Star,
  DocumentCopy,
  Warning,
  Refresh,
  Search,
  Close,
  CopyDocument,
  Check,
  InfoFilled,
  Loading
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface QuickAction {
  id: string
  label: string
  icon: any
}

interface BugFix {
  issue: string
  oldCode: string
  newCode: string
}

interface RefactorSuggestion {
  type: string
  description: string
  code: string
  benefits: string[]
}

interface ReviewIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  line: number
}

interface ReviewResults {
  score: number
  categories: Record<string, number>
  issues: ReviewIssue[]
}

interface InlineSuggestion {
  id: string
  preview: string
  fullCode: string
}

// Quick actions
const quickActions: QuickAction[] = [
  { id: 'generate', label: 'Generate', icon: Star },
  { id: 'explain', label: 'Explain', icon: DocumentCopy },
  { id: 'fix', label: 'Fix Bugs', icon: Warning },
  { id: 'refactor', label: 'Refactor', icon: Refresh },
  { id: 'review', label: 'Review', icon: Search }
]

const activeAction = ref('')
const showCodePanel = ref(false)
const panelTitle = ref('')
const isProcessing = ref(false)
const processingText = ref('')

// Code generation
const nlPrompt = ref('')
const generatedCode = ref('')
const generatedFileName = ref('')

const codeExamples = [
  'Create a login form with email and password',
  'Build a todo list with add/delete/complete',
  'Create a responsive navigation bar',
  'Build a data table with sorting'
]

// Explanation
const codeExplanation = ref<{
  summary: string
  components: string[]
  howItWorks: string
} | null>(null)

// Bug fixes
const bugFixes = ref<BugFix[]>([])

// Refactor
const refactorSuggestions = ref<RefactorSuggestion[]>([])

// Review
const reviewResults = ref<ReviewResults | null>(null)

// Inline suggestions
const inlineSuggestions = ref<InlineSuggestion[]>([])

const executeAction = (action: QuickAction) => {
  activeAction.value = action.id
  panelTitle.value = action.label
  showCodePanel.value = true
  
  // Reset content
  generatedCode.value = ''
  codeExplanation.value = null
  bugFixes.value = []
  refactorSuggestions.value = []
  reviewResults.value = null
  
  // Auto-execute for certain actions
  if (action.id === 'explain') {
    explainCode()
  } else if (action.id === 'fix') {
    findBugs()
  } else if (action.id === 'refactor') {
    suggestRefactors()
  } else if (action.id === 'review') {
    reviewCode()
  }
}

const generateCode = async () => {
  isProcessing.value = true
  processingText.value = 'Generating code...'
  
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  generatedFileName.value = 'GeneratedComponent.tsx'
  generatedCode.value = `import React, { useState } from 'react';

export default function GeneratedComponent() {
  const [data, setData] = useState([]);
  
  // ${nlPrompt.value}
  const handleAction = () => {
    // Implementation here
  };
  
  return (
    <div className="component">
      {/* Generated based on: ${nlPrompt.value} */}
    </div>
  );
}`
  
  isProcessing.value = false
  ElMessage.success('Code generated successfully')
}

const explainCode = async () => {
  isProcessing.value = true
  processingText.value = 'Analyzing code...'
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  codeExplanation.value = {
    summary: 'This component implements a user authentication flow with form validation and error handling.',
    components: [
      'useAuth hook - Manages authentication state',
      'LoginForm component - Handles user input',
      'Validation logic - Email and password validation',
      'Error boundary - Catches and displays errors'
    ],
    howItWorks: 'The component uses React hooks to manage form state. When submitted, it validates inputs and calls the authentication API. Errors are displayed inline, and successful logins redirect to the dashboard.'
  }
  
  isProcessing.value = false
}

const findBugs = async () => {
  isProcessing.value = true
  processingText.value = 'Scanning for bugs...'
  
  await new Promise(resolve => setTimeout(resolve, 1200))
  
  bugFixes.value = [
    {
      issue: 'Missing dependency in useEffect hook',
      oldCode: 'useEffect(() => { fetchData() }, [])',
      newCode: 'useEffect(() => { fetchData() }, [fetchData])'
    },
    {
      issue: 'Potential null reference error',
      oldCode: 'const name = user.profile.name',
      newCode: 'const name = user?.profile?.name ?? \'Guest\''
    }
  ]
  
  isProcessing.value = false
}

const suggestRefactors = async () => {
  isProcessing.value = true
  processingText.value = 'Analyzing code patterns...'
  
  await new Promise(resolve => setTimeout(resolve, 1300))
  
  refactorSuggestions.value = [
    {
      type: 'Extract Component',
      description: 'Move the form section into a separate component for better reusability.',
      code: `const FormSection = ({ onSubmit }) => (
  <form onSubmit={onSubmit}>
    {/* Form content */}
  </form>
);`,
      benefits: ['Reusability', 'Testability', 'Maintainability']
    },
    {
      type: 'Custom Hook',
      description: 'Extract form logic into a custom hook.',
      code: `const useForm = (initialValues) => {
  const [values, setValues] = useState(initialValues);
  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };
  return { values, handleChange };
};`,
      benefits: ['Separation of concerns', 'Reusable logic']
    }
  ]
  
  isProcessing.value = false
}

const reviewCode = async () => {
  isProcessing.value = true
  processingText.value = 'Reviewing code quality...'
  
  await new Promise(resolve => setTimeout(resolve, 1400))
  
  reviewResults.value = {
    score: 87,
    categories: {
      'Readability': 92,
      'Performance': 85,
      'Security': 90,
      'Maintainability': 88,
      'Best Practices': 80
    },
    issues: [
      { severity: 'warning', message: 'Missing error handling in async function', line: 23 },
      { severity: 'info', message: 'Consider using TypeScript for better type safety', line: 1 },
      { severity: 'warning', message: 'Unused import detected', line: 5 }
    ]
  }
  
  isProcessing.value = false
}

const copyCode = () => {
  navigator.clipboard.writeText(generatedCode.value)
  ElMessage.success('Code copied to clipboard')
}

const applyCode = () => {
  ElMessage.success('Code applied to editor')
  showCodePanel.value = false
}

const applyBugFix = (fix: BugFix) => {
  ElMessage.success(`Applied fix: ${fix.issue}`)
}

const applyRefactor = (suggestion: RefactorSuggestion) => {
  ElMessage.success(`Applied refactor: ${suggestion.type}`)
}

const getScoreColor = (score: number): string => {
  if (score >= 90) return '#22c55e'
  if (score >= 70) return '#f59e0b'
  return '#ef4444'
}

const dismissAllSuggestions = () => {
  inlineSuggestions.value = []
}

const acceptSuggestion = (suggestion: InlineSuggestion) => {
  ElMessage.success('Suggestion accepted')
  inlineSuggestions.value = inlineSuggestions.value.filter(s => s.id !== suggestion.id)
}

const rejectSuggestion = (suggestion: InlineSuggestion) => {
  inlineSuggestions.value = inlineSuggestions.value.filter(s => s.id !== suggestion.id)
}

// Simulate receiving inline suggestions
setTimeout(() => {
  inlineSuggestions.value = [
    {
      id: '1',
      preview: 'useCallback(() => { ... }, [])',
      fullCode: 'const handleClick = useCallback(() => { doSomething() }, [])'
    }
  ]
}, 5000)
</script>

<style scoped>
.ai-code-assistant {
  position: relative;
}

/* Toolbar */
.assistant-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.toolbar-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

/* Code Panel */
.code-panel {
  position: absolute;
  top: 48px;
  right: 16px;
  width: 480px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.panel-content {
  max-height: 600px;
  overflow-y: auto;
  padding: 16px;
}

/* NL Input */
.nl-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nl-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}

.nl-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.nl-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.example-label {
  font-size: 12px;
  color: #9ca3af;
}

.example-chip {
  padding: 4px 10px;
  background: #f3f4f6;
  border: none;
  border-radius: 20px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.example-chip:hover {
  background: #e5e7eb;
  color: #374151;
}

.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.generate-btn:hover:not(:disabled) {
  background: #4338ca;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Generated Code */
.generated-code {
  margin-top: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.code-filename {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.code-actions {
  display: flex;
  gap: 6px;
}

.code-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
}

.code-action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
}

/* Explanation */
.explanation-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.explanation-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.explanation-section p {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

.explanation-section ul {
  margin: 0;
  padding-left: 16px;
}

.explanation-section li {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

/* Bug Fixes */
.bug-fix-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fix-item {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.fix-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.fix-icon {
  color: #ef4444;
}

.fix-issue {
  font-size: 13px;
  font-weight: 500;
  color: #991b1b;
}

.diff-block {
  background: #ffffff;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 10px;
}

.diff-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
}

.diff-line.removed {
  background: #fee2e2;
  color: #dc2626;
}

.diff-line.added {
  background: #dcfce7;
  color: #16a34a;
}

.diff-marker {
  font-weight: 600;
}

.apply-fix-btn {
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

.apply-fix-btn:hover {
  background: #dc2626;
}

/* Refactor */
.refactor-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.refactor-item {
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}

.refactor-type {
  display: inline-block;
  padding: 2px 8px;
  background: #22c55e;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
  margin-bottom: 8px;
}

.refactor-desc {
  font-size: 12px;
  color: #374151;
  margin: 0 0 10px;
}

.refactor-preview {
  background: #ffffff;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}

.refactor-preview pre {
  margin: 0;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.refactor-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.benefit-tag {
  padding: 2px 8px;
  background: #dcfce7;
  color: #166534;
  font-size: 10px;
  border-radius: 4px;
}

.apply-refactor-btn {
  width: 100%;
  padding: 8px;
  background: #22c55e;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.apply-refactor-btn:hover {
  background: #16a34a;
}

/* Review */
.review-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
  color: white;
}

.score-label {
  font-size: 13px;
  color: #6b7280;
}

.review-categories {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-category {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-name {
  width: 100px;
  font-size: 12px;
  color: #374151;
}

.category-bar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.category-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.category-score {
  width: 24px;
  font-size: 12px;
  font-weight: 500;
  color: #111827;
  text-align: right;
}

.review-issues h4 {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 10px;
}

.review-issue {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
}

.review-issue.error {
  background: #fef2f2;
}

.review-issue.warning {
  background: #fffbeb;
}

.review-issue.info {
  background: #eff6ff;
}

.issue-icon {
  font-size: 14px;
}

.review-issue.error .issue-icon {
  color: #ef4444;
}

.review-issue.warning .issue-icon {
  color: #f59e0b;
}

.review-issue.info .issue-icon {
  color: #3b82f6;
}

.issue-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.issue-message {
  font-size: 12px;
  color: #374151;
}

.issue-line {
  font-size: 10px;
  color: #9ca3af;
}

/* Inline Suggestions */
.inline-suggestions {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 320px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 50;
}

.suggestions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.suggestions-header .el-icon {
  color: #4f46e5;
}

.dismiss-all {
  margin-left: auto;
  padding: 2px 8px;
  background: transparent;
  border: none;
  font-size: 11px;
  color: #9ca3af;
  cursor: pointer;
}

.dismiss-all:hover {
  color: #6b7280;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-preview {
  flex: 1;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #374151;
  background: #f9fafb;
  padding: 6px 10px;
  border-radius: 6px;
}

.suggestion-actions {
  display: flex;
  gap: 4px;
}

.suggestion-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.suggestion-btn.accept {
  background: #dcfce7;
  color: #16a34a;
}

.suggestion-btn.reject {
  background: #fee2e2;
  color: #ef4444;
}

/* Processing Overlay */
.processing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.processing-spinner {
  font-size: 24px;
  color: #4f46e5;
}

.processing-text {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}
</style>
