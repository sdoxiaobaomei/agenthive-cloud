# Reflection: TICKET-FEAT-005b — Project 创建向导 /projects/create

## 任务概述
实现三步创建向导页面，支持空白项目（技术栈模板）和 Git 导入两种方式。

## 关键决策回顾

### 1. 步骤设计
**选择**: 三步流程（Method → Configure → Confirm），而非一步大表单。

**理由**:
- 降低用户认知负担，每步只做少量决策
- 空白项目和 Git 导入的配置字段不同，分步可以动态展示不同表单
- 确认页让用户在提交前 review，减少误操作

### 2. 技术栈选择交互
**选择**: 图标卡片网格，选中时高亮边框 + 背景色变化。

**实现**:
```
Vue    [V]  #42b883
React  [R]  #61dafb
Node   [N]  #339933
Java   [J]  #e76f00
```

**优点**: 视觉直观，比下拉选择更友好。

### 3. 表单校验策略
**选择**: 每步切换时校验当前步骤的字段，而不是提交时一次性校验所有。

**实现**:
```typescript
const nextStep = async () => {
  if (currentStep === 1) {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
  }
  currentStep.value++
}
```

### 4. 创建成功后的跳转
**选择**: 直接跳转到 `/workspace/:projectId`。

**理由**: 用户创建项目的目的是开始编码，workspace 是最自然的落地页。

## 遇到的挑战

### 无显著挑战
本 Ticket 主要是 UI 工作，已有 store 和 BFF 基础支持，实现相对顺畅。

## 技术细节

### Store 扩展
```typescript
async createProject(data: Partial<Project> & {
  type?: 'blank' | 'git-import'
  techStack?: string
  gitUrl?: string
  gitBranch?: string
}): Promise<Project> {
  const response = await post('/api/projects', {
    name: data.name,
    description: data.description,
    type: data.type,
    tech_stack: data.techStack,
    git_url: data.gitUrl,
    git_branch: data.gitBranch,
  })
}
```

BFF `projects.post.ts` 已做 body 透传，后端未就绪时自动忽略未知字段。

### Git URL 校验
```typescript
const httpsPattern = /^https:\/\/.+\.git$/
const sshPattern = /^git@[^:]+:.+\.git$/
```

覆盖最常见的两种格式。

## 可复用模式

### 向导页面模板
```
page-header (返回 + 标题)
steps-nav
step-content (v-if 切换)
step-actions (上一步/下一步)
```

此模式可复用于任何多步骤表单场景（如注册、配置向导）。

### 创建中遮罩
```vue
<div v-if="isCreating" class="creating-overlay">
  <LoadingIcon />
  <p>Creating...</p>
</div>
```

固定定位 + backdrop-filter，防止用户在中途操作。

## 后续衔接
- **FEAT-001c**: 后端 Workspace 初始化完成后，Git 导入的 clone 进度可通过轮询接口展示
- **FEAT-005c**: `/projects/:id` Dashboard 页面可展示创建的项目
