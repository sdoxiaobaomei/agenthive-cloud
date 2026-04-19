---
name: ui-color-palette
description: Beautiful color palettes and color scheme generation for modern UIs. Use when selecting colors, creating themes, or ensuring accessible color combinations. Provides curated palettes, gradient formulas, semantic color usage, and contrast checking. Triggers on: "color scheme", "palette", "gradient", "theme colors", "accessible colors", "color combination".
---

# Color Palettes & Schemes

Create beautiful, accessible color systems for your UI.

## Curated Color Palettes

### Modern Blue (Primary)

```css
:root {
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-200: #bfdbfe;
  --primary-300: #93c5fd;
  --primary-400: #60a5fa;
  --primary-500: #3b82f6;  /* Primary */
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  --primary-800: #1e40af;
  --primary-900: #1e3a8a;
}
```

### Elegant Purple

```css
:root {
  --purple-50: #faf5ff;
  --purple-100: #f3e8ff;
  --purple-200: #e9d5ff;
  --purple-300: #d8b4fe;
  --purple-400: #c084fc;
  --purple-500: #a855f7;  /* Primary */
  --purple-600: #9333ea;
  --purple-700: #7c3aed;
  --purple-800: #6b21a8;
  --purple-900: #581c87;
}
```

### Fresh Emerald

```css
:root {
  --emerald-50: #ecfdf5;
  --emerald-100: #d1fae5;
  --emerald-200: #a7f3d0;
  --emerald-300: #6ee7b7;
  --emerald-400: #34d399;
  --emerald-500: #10b981;  /* Primary */
  --emerald-600: #059669;
  --emerald-700: #047857;
  --emerald-800: #065f46;
  --emerald-900: #064e3b;
}
```

### Warm Orange

```css
:root {
  --orange-50: #fff7ed;
  --orange-100: #ffedd5;
  --orange-200: #fed7aa;
  --orange-300: #fdba74;
  --orange-400: #fb923c;
  --orange-500: #f97316;  /* Primary */
  --orange-600: #ea580c;
  --orange-700: #c2410c;
  --orange-800: #9a3412;
  --orange-900: #7c2d12;
}
```

### Professional Slate

```css
:root {
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;
}
```

## Semantic Colors

### Status Colors

```css
:root {
  /* Success - Emerald */
  --success-light: #d1fae5;
  --success-default: #10b981;
  --success-dark: #047857;
  
  /* Warning - Amber */
  --warning-light: #fef3c7;
  --warning-default: #f59e0b;
  --warning-dark: #b45309;
  
  /* Error - Rose */
  --error-light: #ffe4e6;
  --error-default: #f43f5e;
  --error-dark: #be123c;
  
  /* Info - Blue */
  --info-light: #dbeafe;
  --info-default: #3b82f6;
  --info-dark: #1e40af;
}
```

### Neutral Scale

```css
:root {
  --white: #ffffff;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  --black: #000000;
}
```

## Gradients

### Soft Gradients

```css
/* Dawn */
--gradient-dawn: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);

/* Sunset */
--gradient-sunset: linear-gradient(135deg, #fa709a 0%, #fee140 100%);

/* Ocean */
--gradient-ocean: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Forest */
--gradient-forest: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);

/* Sky */
--gradient-sky: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);
```

### Mesh Gradients (Modern)

```css
/* Aurora */
--gradient-aurora: 
  radial-gradient(at 40% 20%, hsla(28,100%,74%,1) 0px, transparent 50%),
  radial-gradient(at 80% 0%, hsla(189,100%,56%,1) 0px, transparent 50%),
  radial-gradient(at 0% 50%, hsla(340,100%,76%,1) 0px, transparent 50%),
  radial-gradient(at 80% 50%, hsla(340,100%,76%,1) 0px, transparent 50%),
  radial-gradient(at 0% 100%, hsla(22,100%,77%,1) 0px, transparent 50%),
  radial-gradient(at 80% 100%, hsla(242,100%,70%,1) 0px, transparent 50%),
  radial-gradient(at 0% 0%, hsla(343,100%,76%,1) 0px, transparent 50%);

/* Glassmorphism Base */
--gradient-glass: 
  linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
```

### Text Gradients

```css
.text-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-gradient-fire {
  background: linear-gradient(90deg, #ff6b6b, #feca57);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

## Dark Mode Colors

```css
[data-theme="dark"] {
  /* Background */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  
  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  
  /* Border */
  --border-default: #334155;
  --border-strong: #475569;
  
  /* Primary (adjust for dark) */
  --primary-500: #60a5fa;
  --primary-600: #3b82f6;
}
```

## Color Usage Patterns

### Primary Actions

```css
.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-700);
}
```

### Secondary Actions

```css
.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-secondary:hover {
  background: var(--gray-200);
}
```

### Destructive Actions

```css
.btn-danger {
  background: var(--error-default);
  color: white;
}

.btn-danger:hover {
  background: var(--error-dark);
}
```

### Status Badges

```css
.badge-success {
  background: var(--success-light);
  color: var(--success-dark);
}

.badge-warning {
  background: var(--warning-light);
  color: var(--warning-dark);
}

.badge-error {
  background: var(--error-light);
  color: var(--error-dark);
}
```

## Accessibility Guidelines

### Contrast Ratios (WCAG 2.1)

- **AA Normal**: 4.5:1
- **AA Large**: 3:1
- **AAA Normal**: 7:1

### Recommended Combinations

```css
/* Passes AA - Safe combinations */
--safe-dark-on-light: #1f2937 on #ffffff;  /* 12:1 */
--safe-light-on-dark: #ffffff on #1e293b;  /* 14:1 */
--safe-primary-text: #1e40af on #dbeafe;  /* 7:1 */
--safe-muted: #4b5563 on #f3f4f6;         /* 5:1 */
```

### Color Blind Friendly

Avoid relying solely on color:
- Use icons with status colors
- Use patterns or text labels
- Test with simulators

## Brand Color Generation

From a single brand color, generate full palette:

```javascript
function generatePalette(baseColor) {
  return {
    50: lighten(baseColor, 0.95),
    100: lighten(baseColor, 0.9),
    200: lighten(baseColor, 0.75),
    300: lighten(baseColor, 0.6),
    400: lighten(baseColor, 0.45),
    500: baseColor,
    600: darken(baseColor, 0.15),
    700: darken(baseColor, 0.25),
    800: darken(baseColor, 0.35),
    900: darken(baseColor, 0.45),
  };
}
```

## Color Psychology

| Color | Emotion | Best For |
|-------|---------|----------|
| Blue | Trust, calm | Corporate, tech, finance |
| Green | Growth, health | Sustainability, wellness |
| Orange | Energy, creativity | CTAs, notifications |
| Purple | Luxury, creativity | Beauty, premium products |
| Red | Urgency, passion | Errors, sales, warnings |
| Yellow | Optimism, clarity | Highlights, warnings |
| Pink | Playful, romantic | Beauty, lifestyle |
| Teal | Modern, balanced | Health, tech |

## Tools

- **Coolors**: coolors.co - Generate palettes
- **ColorHunt**: colorhunt.co - Curated palettes
- **Adobe Color**: color.adobe.com - Color wheel
- **Stark**: Contrast checker
