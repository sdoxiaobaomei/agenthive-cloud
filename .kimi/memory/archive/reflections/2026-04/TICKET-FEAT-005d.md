# Reflection: TICKET-FEAT-005d — Project 设置页 /projects/:id/settings

## 任务概述
实现项目设置页面，包含基本信息编辑、成员管理、归档与删除功能。

## 关键决策回顾

### 1. 删除确认机制
**选择**: 要求用户输入完整项目名称作为确认。

**实现**:
```typescript
const { value } = await ElMessageBox.prompt(
  `Type "${projectName}" to confirm deletion.`,
  'Delete Project',
  {
    inputValidator: (val) => {
      if (val !== projectName) return `Please type "${projectName}" to confirm`
      return true
    },
  }
)
```

**优点**: 比简单确认弹窗更安全，防止误触删除。

### 2. 权限矩阵设计
```
owner:  可改任何角色，可移除任何人（包括 admin）
admin:  只能改 member/viewer，只能移除 member/viewer
member: 无管理权限
viewer: 无管理权限
```

**实现**: 通过 computed 属性分层判断：
```typescript
const canChangeRole = (member) => {
  if (isOwner.value) return true
  if (isAdmin.value) return member.role !== 'owner' && member.role !== 'admin'
  return false
}
```

### 3. 角色更新回滚策略
**选择**: API 失败时重新 fetchMembers 恢复状态。

**理由**: 简单可靠，虽然多一次请求但确保状态一致性。

**替代方案**: 先调用 API，成功后更新本地状态（更优但代码更复杂）。

## 技术细节

### 危险区域视觉设计
```css
.danger-zone {
  border-color: #fecaca;
  background: #fef2f2;
}
```

红色边框 + 浅红背景是业界标准（GitHub/GitLab 均采用）。

### 成员邀请对话框
```vue
<el-dialog v-model="showInviteDialog" title="Invite Member">
  <el-input v-model="inviteForm.userId" placeholder="Enter user ID" />
  <el-select v-model="inviteForm.role">
    <el-option label="Admin" value="admin" />
    <el-option label="Member" value="member" />
    <el-option label="Viewer" value="viewer" />
  </el-select>
</el-dialog>
```

## 可复用模式

### 危险操作确认模式
```
Card (红色边框)
├── 操作说明
└── 操作按钮
    └── 点击 → ElMessageBox.prompt(输入确认文本)
        └── 匹配成功 → 执行操作
```

适用于任何不可逆操作（删除账户、移除资源等）。

## 后续衔接
- **FEAT-001b**: 后端成员管理 API 完善后，邀请/移除/角色变更将对接真实接口
- **Auth Store**: 当前权限判断使用简化假设（当前用户 = owner），需对接真实用户角色
