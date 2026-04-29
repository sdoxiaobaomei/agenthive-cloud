# Dark Mode Form Card Styling

## Context
Landing app economy pages use card-based forms (recharge, withdraw, etc.) that need consistent dark mode support.

## Token Mapping

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Card bg | `#ffffff` | `#1e293b` |
| Card border | `#e5e7eb` | `#334155` |
| Section title | `#374151` | `#94a3b8` |
| Primary text | `#111827` | `#e2e8f0` |
| Muted text | `#6b7280` / `#9ca3af` | `#94a3b8` |
| Summary/fees bg | `#f9fafb` | `#0f172a` |
| Active chip/tab border | `#4f46e5` | `#6366f1` |
| Active chip/tab bg | `#eef2ff` | `rgba(79, 70, 229, 0.15)` |
| Active chip/tab text | `#4f46e5` | `#818cf8` |

## CSS Pattern

```css
.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
}
.dark .card {
  background: #1e293b;
  border-color: #334155;
}

.section-title {
  color: #374151;
}
.dark .section-title {
  color: #94a3b8;
}
```

## Usage
Apply `.dark` selectors alongside all light-mode styles in `<style scoped>`.

## Related
- `apps/landing/pages/credits/recharge.vue`
- `apps/landing/pages/credits/withdraw.vue`
