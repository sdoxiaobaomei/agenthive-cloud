import { ref, computed } from 'vue'

export interface ColorScheme {
  id: string
  name: string
  colors: string[]
  bg: string
  surface: string
  text: string
  border: string
  accent: string
}

export const presetSchemes: ColorScheme[] = [
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    colors: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff'],
    bg: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    border: '#374151',
    accent: '#3b82f6',
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    colors: ['#0c4a6e', '#075985', '#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#f0f9ff'],
    bg: '#f0f9ff',
    surface: '#ffffff',
    text: '#0c4a6e',
    border: '#bae6fd',
    accent: '#0ea5e9',
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    colors: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fff7ed'],
    bg: '#fff7ed',
    surface: '#ffffff',
    text: '#7c2d12',
    border: '#fdba74',
    accent: '#ea580c',
  },
  {
    id: 'forest-zen',
    name: 'Forest Zen',
    colors: ['#14532d', '#166534', '#15803d', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#f0fdf4'],
    bg: '#f0fdf4',
    surface: '#ffffff',
    text: '#14532d',
    border: '#bbf7d0',
    accent: '#22c55e',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: ['#2e1065', '#4c1d95', '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#faf5ff'],
    bg: '#0f0f1a',
    surface: '#1a1a2e',
    text: '#e9d5ff',
    border: '#7c3aed',
    accent: '#d946ef',
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    colors: ['#1e3a5f', '#2e4a6f', '#4a6fa5', '#6b8cae', '#8fafc7', '#b0c4de', '#d6e3f0', '#f1f5fb'],
    bg: '#f1f5fb',
    surface: '#ffffff',
    text: '#1e3a5f',
    border: '#d6e3f0',
    accent: '#4a6fa5',
  },
]

export function useColorSchemes() {
  const activeSchemeId = ref<string>(presetSchemes[0].id)
  const customColors = ref<Record<string, string>>({})
  
  const activeScheme = computed<ColorScheme>(() => {
    const base = presetSchemes.find(s => s.id === activeSchemeId.value) || presetSchemes[0]
    return {
      ...base,
      colors: base.colors.map((c, i) => customColors.value[`${base.id}-${i}`] || c),
      bg: customColors.value[`${base.id}-bg`] || base.bg,
      surface: customColors.value[`${base.id}-surface`] || base.surface,
      text: customColors.value[`${base.id}-text`] || base.text,
      border: customColors.value[`${base.id}-border`] || base.border,
      accent: customColors.value[`${base.id}-accent`] || base.accent,
    }
  })
  
  function setScheme(id: string) {
    activeSchemeId.value = id
  }
  
  function setCustomColor(key: string, color: string) {
    customColors.value[key] = color
  }
  
  function resetCustomColors() {
    customColors.value = {}
  }
  
  return {
    presetSchemes,
    activeSchemeId,
    activeScheme,
    customColors,
    setScheme,
    setCustomColor,
    resetCustomColors,
  }
}
