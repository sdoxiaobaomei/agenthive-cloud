---
name: ui-ux-best-practices
description: UX best practices and usability guidelines for intuitive interfaces. Use when designing user flows, improving usability, or ensuring accessibility. Covers form design, navigation patterns, feedback systems, accessibility standards, and user onboarding. Triggers on: "UX", "usability", "accessibility", "user experience", "form design", "onboarding", "a11y".
---

# UX Best Practices

Create intuitive, accessible, and user-friendly interfaces.

## Form Design

### Label Positioning

```css
/* Top-aligned labels (recommended) */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

/* Required indicator */
.form-label .required::after {
  content: " *";
  color: var(--error);
}
```

### Input Guidelines

- **Size**: Min 44px height for touch targets
- **Padding**: 12px horizontal
- **Font size**: Min 16px (prevents zoom on mobile)
- **Placeholder**: Use for hints, not labels
- **States**: Empty, Filled, Focus, Error, Disabled

```css
.input {
  height: 44px;
  padding: 0 12px;
  font-size: 16px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
  outline: none;
}

.input:disabled {
  background: var(--gray-100);
  cursor: not-allowed;
}

.input-error {
  border-color: var(--error);
}

.input-error:focus {
  box-shadow: 0 0 0 3px var(--error-light);
}
```

### Error Messages

```vue
<template>
  <div class="form-group">
    <label class="form-label">邮箱</label>
    <input 
      v-model="email" 
      :class="['input', { 'input-error': error }]"
      type="email"
    />
    <span v-if="error" class="error-text">{{ error }}</span>
    <span v-else class="help-text">我们将向您发送确认邮件</span>
  </div>
</template>

<style>
.error-text {
  font-size: 14px;
  color: var(--error);
  display: flex;
  align-items: center;
  gap: 4px;
}

.error-text::before {
  content: "⚠️";
}

.help-text {
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
```

### Form Validation Timing

- **On submit**: Always validate
- **On blur**: Validate field when user leaves
- **On input**: Only for format hints (email, phone)
- **Don't**: Validate on every keystroke initially

## Button Guidelines

### Hierarchy

```css
/* Primary - Main action */
.btn-primary {
  background: var(--primary-600);
  color: white;
}

/* Secondary - Alternative action */
.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

/* Tertiary - Less important */
.btn-tertiary {
  background: transparent;
  color: var(--primary-600);
}

/* Destructive - Dangerous action */
.btn-danger {
  background: var(--error);
  color: white;
}
```

### Button States

```css
.btn {
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
```

### Button Placement

- **Forms**: Primary right, Secondary left
- **Dialogs**: Primary right (Confirm), Secondary left (Cancel)
- **Wizards**: Next right, Back left
- **Destructive**: Danger left, Cancel right (or use confirmation)

## Feedback Systems

### Loading States

```vue
<!-- Skeleton Loading -->
<div class="skeleton-card">
  <div class="skeleton-header"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line short"></div>
</div>

<style>
.skeleton-card {
  padding: 24px;
  background: white;
  border-radius: 12px;
}

.skeleton-header {
  height: 24px;
  width: 60%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 16px;
}

.skeleton-line {
  height: 16px;
  background: #f0f0f0;
  border-radius: 4px;
  margin-bottom: 12px;
}

.skeleton-line.short {
  width: 40%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

### Toast Notifications

```typescript
// Toast positions
type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right'
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

// Toast types
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: ToastPosition;
}

// Usage
ElMessage.success('保存成功');
ElMessage.error('操作失败，请重试');
ElMessage.warning('请检查输入');
```

### Empty States

```vue
<template>
  <div class="empty-state">
    <div class="empty-icon">📭</div>
    <h3>暂无数据</h3>
    <p>点击按钮创建您的第一个项目</p>
    <el-button type="primary" @click="create">创建项目</el-button>
  </div>
</template>

<style>
.empty-state {
  text-align: center;
  padding: 64px 24px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--text-secondary);
  margin-bottom: 24px;
}
</style>
```

## Navigation Guidelines

### Breadcrumbs

```vue
<template>
  <nav class="breadcrumbs">
    <ol>
      <li><a href="/">首页</a></li>
      <li class="separator">/</li>
      <li><a href="/products">产品</a></li>
      <li class="separator">/</li>
      <li aria-current="page">详情</li>
    </ol>
  </nav>
</template>

<style>
.breadcrumbs ol {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
}

.breadcrumbs a {
  color: var(--primary);
  text-decoration: none;
}

.breadcrumbs a:hover {
  text-decoration: underline;
}

.breadcrumbs [aria-current] {
  color: var(--text-secondary);
}

.separator {
  color: var(--text-tertiary);
}
</style>
```

### Pagination

```vue
<template>
  <div class="pagination">
    <button 
      :disabled="current === 1" 
      @click="prev"
      class="btn-prev"
    >
      上一页
    </button>
    
    <span class="page-info">第 {{ current }} 页，共 {{ total }} 页</span>
    
    <button 
      :disabled="current === total" 
      @click="next"
      class="btn-next"
    >
      下一页
    </button>
  </div>
</template>
```

## Accessibility (a11y)

### Focus Management

```css
/* Visible focus indicator */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary);
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### ARIA Labels

```vue
<!-- Icon buttons -->
<button aria-label="关闭" @click="close">
  <IconClose />
</button>

<!-- Loading states -->
<button :aria-busy="loading" :disabled="loading">
  <span v-if="loading">保存中...</span>
  <span v-else>保存</span>
</button>

<!-- Current page -->
<nav aria-label="主导航">
  <a href="/" aria-current="page">首页</a>
  <a href="/about">关于</a>
</nav>

<!-- Live regions -->
<div aria-live="polite" aria-atomic="true">
  {{ notification }}
</div>
```

### Color Contrast

```css
/* Minimum 4.5:1 for normal text */
.text-primary {
  color: #1f2937; /* on white: 12:1 */
}

/* Minimum 3:1 for large text */
.text-secondary {
  color: #6b7280; /* on white: 5.7:1 */
}

/* Never rely on color alone */
.status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status.active::before { background: var(--success); }
.status.pending::before { background: var(--warning); }
```

## User Onboarding

### Progressive Disclosure

```vue
<template>
  <div class="onboarding">
    <!-- Step indicator -->
    <div class="steps">
      <div 
        v-for="step in steps" 
        :key="step.id"
        :class="['step', { active: current === step.id, completed: current > step.id }]"
      >
        <span class="step-number">{{ step.id }}</span>
        <span class="step-title">{{ step.title }}</span>
      </div>
    </div>
    
    <!-- Current step content -->
    <div class="step-content">
      <component :is="currentStepComponent" />
    </div>
    
    <!-- Navigation -->
    <div class="step-nav">
      <button @click="prev" :disabled="current === 1">上一步</button>
      <button @click="next" class="primary">
        {{ isLast ? '完成' : '下一步' }}
      </button>
    </div>
  </div>
</template>
```

### Tooltips

```vue
<template>
  <div class="tooltip-wrapper">
    <slot />
    <div class="tooltip" role="tooltip">
      {{ content }}
    </div>
  </div>
</template>

<style>
.tooltip-wrapper {
  position: relative;
}

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 8px 12px;
  background: var(--gray-800);
  color: white;
  font-size: 14px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
}

.tooltip-wrapper:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

/* Arrow */
.tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--gray-800);
}
</style>
```

## Microinteractions

### Hover Effects

```css
/* Card lift */
.card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

/* Button scale */
.btn {
  transition: transform 0.15s;
}

.btn:active {
  transform: scale(0.96);
}

/* Link underline */
.link {
  text-decoration: none;
  position: relative;
}

.link::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.2s;
}

.link:hover::after {
  width: 100%;
}
```

### Page Transitions

```vue
<template>
  <Transition name="fade" mode="out-in">
    <component :is="currentView" />
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s;
}

.slide-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>
```

## Performance Tips

1. **Reduce Motion** - Respect `prefers-reduced-motion`
2. **Lazy Loading** - Images below fold
3. **Debounce** - Search inputs (300ms)
4. **Virtual Scrolling** - Large lists (>100 items)
5. **Skeleton Screens** - Better than spinners

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Checklist

- [ ] Touch targets >= 44px
- [ ] Color contrast >= 4.5:1
- [ ] Keyboard navigable
- [ ] Focus indicators visible
- [ ] Loading states shown
- [ ] Error messages clear
- [ ] Empty states handled
- [ ] Reduced motion support
