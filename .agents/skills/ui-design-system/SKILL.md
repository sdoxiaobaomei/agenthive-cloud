---
name: ui-design-system
description: Comprehensive design system guidelines for creating consistent, beautiful UIs. Use when building component libraries, establishing design standards, or ensuring UI consistency across applications. Covers spacing systems, typography scales, border radius, shadows, and component anatomy. Triggers on: "design system", "UI consistency", "component library", "spacing", "typography scale".
---

# Design System Guidelines

Create consistent, professional UIs with systematic design principles.

## Spacing System (8-Point Grid)

Use multiples of 4px or 8px for all spacing values:

```css
:root {
  --space-1: 4px;   /* xs - icons, tight gaps */
  --space-2: 8px;   /* sm - inline elements */
  --space-3: 12px;  /* md-small - compact spacing */
  --space-4: 16px;  /* md - default padding */
  --space-5: 20px;  /* md-large */
  --space-6: 24px;  /* lg - section gaps */
  --space-8: 32px;  /* xl - card padding */
  --space-10: 40px; /* 2xl - section margins */
  --space-12: 48px; /* 3xl - large sections */
  --space-16: 64px; /* 4xl - page sections */
}
```

**Usage Rules:**
- Component internal padding: 16px-24px
- Between related elements: 8px-12px
- Between unrelated elements: 24px-32px
- Section breaks: 48px-64px

## Typography Scale

```css
:root {
  /* Font sizes */
  --text-xs: 12px;    /* Captions, labels */
  --text-sm: 14px;    /* Secondary text */
  --text-base: 16px;  /* Body text */
  --text-lg: 18px;   /* Lead paragraphs */
  --text-xl: 20px;   /* H6, small headings */
  --text-2xl: 24px;  /* H5 */
  --text-3xl: 30px;  /* H4 */
  --text-4xl: 36px;  /* H3 */
  --text-5xl: 48px;  /* H2 */
  --text-6xl: 60px;  /* H1, hero */
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line heights */
  --leading-tight: 1.25;  /* Headings */
  --leading-normal: 1.5;  /* Body text */
  --leading-relaxed: 1.75; /* Large text */
}
```

**Type Scale Ratios:**
- Use 1.25 (Major Third) or 1.414 (Augmented Fourth) ratio
- Body: 16px / 1.5 line-height
- Headings: font-bold, tight line-height

## Border Radius Scale

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;    /* Small buttons, tags */
  --radius-md: 6px;    /* Inputs, small cards */
  --radius-lg: 8px;    /* Cards, modals */
  --radius-xl: 12px;   /* Large cards */
  --radius-2xl: 16px;  /* Feature cards */
  --radius-3xl: 24px;  /* Hero sections */
  --radius-full: 9999px; /* Pills, avatars */
}
```

**Usage:**
- Buttons: 6px-8px
- Cards: 8px-12px
- Inputs: 6px
- Avatars: 50% (full)
- Tags/Pills: full

## Shadow System

```css
:root {
  /* Flat - no shadow */
  --shadow-none: none;
  
  /* Subtle elevation */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  
  /* Default elevation */
  --shadow-md: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  
  /* Elevated */
  --shadow-lg: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  
  /* Floating */
  --shadow-xl: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Modal/Dialog */
  --shadow-2xl: 
    0 25px 50px -12px rgba(0, 0, 0, 0.25);
  
  /* Inner shadow */
  --shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
}
```

## Component Anatomy

### Button

```css
.btn {
  /* Size */
  padding: 8px 16px;  /* sm */
  padding: 10px 20px; /* md (default) */
  padding: 12px 24px; /* lg */
  
  /* Shape */
  border-radius: 6px;
  
  /* Typography */
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  
  /* Interaction */
  transition: all 0.2s ease;
}
```

**States:**
- Default: bg-primary-600, text-white
- Hover: bg-primary-700, shadow-sm
- Active: bg-primary-800, transform: scale(0.98)
- Disabled: opacity: 0.5, cursor: not-allowed

### Card

```css
.card {
  padding: 24px;
  border-radius: 12px;
  background: white;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}
```

**Variants:**
- Default: border + shadow
- Outlined: border only, no shadow
- Elevated: larger shadow
- Interactive: hover shadow increase

### Input

```css
.input {
  height: 40px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
  outline: none;
}
```

## Color Application

### Text Colors

```css
:root {
  --text-primary: #1f2937;      /* Main content */
  --text-secondary: #6b7280;    /* Descriptions */
  --text-tertiary: #9ca3af;     /* Placeholders */
  --text-disabled: #d1d5db;     /* Disabled */
  --text-inverse: #ffffff;      /* On dark bg */
}
```

### Surface Colors

```css
:root {
  --surface-primary: #ffffff;
  --surface-secondary: #f9fafb;
  --surface-tertiary: #f3f4f6;
  --surface-elevated: #ffffff;
}
```

### Border Colors

```css
:root {
  --border-light: #f3f4f6;
  --border-default: #e5e7eb;
  --border-strong: #d1d5db;
}
```

## Z-Index Scale

```css
:root {
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
  --z-toast: 800;
}
```

## Transition Standards

```css
:root {
  /* Duration */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  
  /* Easing */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

## Layout Grid

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

.grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(12, 1fr);
}

/* Responsive breakpoints */
@media (max-width: 640px) {
  .container { padding: 0 16px; }
  .grid { gap: 16px; }
}
```

## Icon Guidelines

- Size: 16px (sm), 20px (md), 24px (lg), 32px (xl)
- Stroke width: 1.5px-2px
- Use consistent icon set (Heroicons, Lucide, etc.)
- Color: inherit from text

## Best Practices

1. **Consistency First** - Use design tokens everywhere
2. **Responsive** - Test at all breakpoints
3. **Accessibility** - WCAG 2.1 AA compliance
4. **Dark Mode** - Prepare inverted color schemes
5. **Performance** - Use CSS variables, not JS
