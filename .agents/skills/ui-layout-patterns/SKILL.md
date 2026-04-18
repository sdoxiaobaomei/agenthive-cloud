---
name: ui-layout-patterns
description: Modern UI layout patterns and responsive design solutions. Use when creating page layouts, organizing content, or implementing responsive designs. Covers grid systems, flexbox patterns, card layouts, dashboards, and responsive breakpoints. Triggers on: "layout", "responsive", "grid", "flexbox", "card layout", "dashboard layout", "page structure".
---

# UI Layout Patterns

Build modern, responsive layouts with proven patterns.

## Grid System

### 12-Column Grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
}

/* Column spans */
.col-1 { grid-column: span 1; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.col-4 { grid-column: span 4; }
.col-6 { grid-column: span 6; }
.col-8 { grid-column: span 8; }
.col-12 { grid-column: span 12; }
```

### Auto-Fit Grid (Responsive Cards)

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

/* Variant: Fixed min width */
.card-grid-fixed {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
```

### Masonry Layout

```css
.masonry {
  column-count: 3;
  column-gap: 24px;
}

.masonry > * {
  break-inside: avoid;
  margin-bottom: 24px;
}

@media (max-width: 1024px) { .masonry { column-count: 2; } }
@media (max-width: 640px) { .masonry { column-count: 1; } }
```

## Flexbox Patterns

### Centering

```css
/* Perfect center */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Vertical center */
.center-y {
  display: flex;
  align-items: center;
}

/* Horizontal center */
.center-x {
  display: flex;
  justify-content: center;
}
```

### Split Layout

```css
.split {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* With gap */
.split-gap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
```

### Sidebar Layout

```css
.sidebar-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
}

.main {
  flex: 1;
  min-width: 0; /* Important for flex children */
}
```

### Sticky Footer

```css
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content {
  flex: 1;
}

.footer {
  flex-shrink: 0;
}
```

## Common Layout Patterns

### Holy Grail Layout

```css
.holy-grail {
  display: grid;
  grid-template:
    "header header header" auto
    "nav    main   aside" 1fr
    "footer footer footer" auto
    / 200px 1fr 200px;
  min-height: 100vh;
}

.header { grid-area: header; }
.nav { grid-area: nav; }
.main { grid-area: main; }
.aside { grid-area: aside; }
.footer { grid-area: footer; }
```

### Bento Grid (Modern)

```css
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 20px;
}

.bento-item {
  border-radius: 16px;
  padding: 24px;
}

.bento-item.large {
  grid-column: span 2;
  grid-row: span 2;
}

.bento-item.wide {
  grid-column: span 2;
}

.bento-item.tall {
  grid-row: span 2;
}
```

### Dashboard Grid

```css
.dashboard {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 64px 1fr;
  min-height: 100vh;
}

.dashboard-header {
  grid-column: 1 / -1;
}

.dashboard-sidebar {
  grid-row: 2;
}

.dashboard-main {
  grid-row: 2;
  padding: 24px;
}
```

## Card Layouts

### Card Variants

```css
/* Standard card */
.card {
  border-radius: 12px;
  padding: 24px;
  background: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Horizontal card */
.card-horizontal {
  display: flex;
  gap: 16px;
}

.card-horizontal .media {
  width: 120px;
  flex-shrink: 0;
}

.card-horizontal .content {
  flex: 1;
}

/* Featured card (large) */
.card-featured {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: center;
}
```

### Card Grid Layouts

```css
/* 3-column grid */
.cards-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

/* Asymmetric grid */
.cards-asymmetric {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: repeat(2, 1fr);
  gap: 20px;
}

.cards-asymmetric .card:first-child {
  grid-row: span 2;
}
```

## Navigation Patterns

### Top Navigation

```css
.nav-top {
  display: flex;
  align-items: center;
  gap: 32px;
  height: 64px;
  padding: 0 24px;
}

.nav-top .brand {
  margin-right: auto;
}

.nav-top .links {
  display: flex;
  gap: 24px;
}

.nav-top .actions {
  display: flex;
  gap: 12px;
}
```

### Sidebar Navigation

```css
.nav-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  padding: 16px;
}

.nav-sidebar .section {
  margin-bottom: 24px;
}

.nav-sidebar .section-title {
  padding: 0 12px;
  margin-bottom: 8px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.nav-sidebar .links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

## Hero Section Patterns

### Centered Hero

```css
.hero-centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 80px 24px;
  max-width: 800px;
  margin: 0 auto;
}

.hero-centered h1 {
  font-size: 48px;
  margin-bottom: 24px;
}

.hero-centered p {
  font-size: 20px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.hero-centered .actions {
  display: flex;
  gap: 16px;
}
```

### Split Hero

```css
.hero-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  padding: 80px 24px;
}

.hero-split .content {
  max-width: 560px;
}

.hero-split .media {
  border-radius: 16px;
  overflow: hidden;
}
```

### Full-Width Hero

```css
.hero-full {
  position: relative;
  min-height: 600px;
  display: flex;
  align-items: center;
  padding: 80px 24px;
}

.hero-full .background {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.hero-full .content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
```

## Content Layouts

### Article Layout

```css
.article {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
}

.article h1 {
  font-size: 40px;
  margin-bottom: 16px;
}

.article .meta {
  display: flex;
  gap: 16px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.article p {
  font-size: 18px;
  line-height: 1.8;
  margin-bottom: 24px;
}
```

### Feature Grid

```css
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  padding: 80px 24px;
}

.feature {
  text-align: center;
}

.feature .icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
}

.feature h3 {
  font-size: 20px;
  margin-bottom: 12px;
}
```

## Responsive Breakpoints

```css
/* Mobile First */

/* Base styles: Mobile */
.container {
  padding: 0 16px;
}

/* Tablet: 640px+ */
@media (min-width: 640px) {
  .container {
    padding: 0 24px;
  }
  
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
    margin: 0 auto;
  }
  
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Large Desktop: 1280px+ */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
```

## Container Queries (Modern)

```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: flex;
    gap: 16px;
  }
  
  .card .media {
    width: 120px;
  }
}
```

## Spacing Patterns

### Section Spacing

```css
.section-sm { padding: 40px 0; }
.section-md { padding: 64px 0; }
.section-lg { padding: 96px 0; }
.section-xl { padding: 128px 0; }
```

### Stack Pattern (Vertical Rhythm)

```css
.stack > * + * {
  margin-top: 16px;
}

.stack-sm > * + * { margin-top: 8px; }
.stack-md > * + * { margin-top: 16px; }
.stack-lg > * + * { margin-top: 24px; }
.stack-xl > * + * { margin-top: 32px; }
```

### Cluster Pattern (Horizontal Groups)

```css
.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.cluster-center {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
```

## Form Layouts

### Inline Form

```css
.form-inline {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.form-inline .field {
  flex: 1;
}
```

### Two-Column Form

```css
.form-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}

.form-2col .full-width {
  grid-column: span 2;
}
```

## Best Practices

1. **Mobile First** - Start with mobile layout
2. **Use CSS Grid** - For 2D layouts
3. **Use Flexbox** - For 1D alignments
4. **Container Queries** - When component-based
5. **Consistent Spacing** - Use design tokens
6. **Min-width: 0** - On flex children to prevent overflow
