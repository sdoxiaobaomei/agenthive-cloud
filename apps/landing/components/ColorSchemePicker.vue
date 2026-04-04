<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>🎨</span> 配色方案
    </h3>
    
    <!-- Preset schemes -->
    <div class="grid grid-cols-3 gap-2 mb-5">
      <button
        v-for="scheme in presetSchemes"
        :key="scheme.id"
        @click="setScheme(scheme.id)"
        class="relative p-3 rounded-xl border-2 transition-all text-left"
        :class="activeSchemeId === scheme.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-100 hover:border-gray-200'"
        :style="{ backgroundColor: scheme.bg }"
      >
        <div class="text-xs font-medium mb-2" :style="{ color: scheme.text }">{{ scheme.name }}</div>
        <div class="flex gap-1">
          <div
            v-for="(color, i) in scheme.colors.slice(0, 5)"
            :key="i"
            class="w-4 h-4 rounded-full border border-white/20"
            :style="{ backgroundColor: color }"
          />
        </div>
      </button>
    </div>
    
    <!-- Custom palette editor -->
    <div class="border-t border-gray-100 pt-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">自定义调色盘</span>
        <button
          @click="resetCustomColors"
          class="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          重置
        </button>
      </div>
      
      <div class="space-y-3">
        <!-- Main colors -->
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(color, i) in activeScheme.colors"
            :key="`color-${i}`"
            class="relative group"
          >
            <input
              type="color"
              :value="customColors[`${activeSchemeId}-${i}`] || color"
              @input="setCustomColor(`${activeSchemeId}-${i}`, ($event.target as HTMLInputElement).value)"
              class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
              :style="{ backgroundColor: customColors[`${activeSchemeId}-${i}`] || color }"
            />
            <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              色阶 {{ i + 1 }}
            </div>
          </div>
        </div>
        
        <!-- Semantic colors -->
        <div class="grid grid-cols-2 gap-3 pt-2">
          <div v-for="key in semanticKeys" :key="key.key">
            <label class="block text-xs text-gray-500 mb-1">{{ key.label }}</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="customColors[`${activeSchemeId}-${key.key}`] || activeScheme[key.key as keyof ColorScheme]"
                @input="setCustomColor(`${activeSchemeId}-${key.key}`, ($event.target as HTMLInputElement).value)"
                class="w-8 h-8 rounded border border-gray-200 cursor-pointer flex-shrink-0"
              />
              <span class="text-xs text-gray-400 font-mono truncate">
                {{ customColors[`${activeSchemeId}-${key.key}`] || activeScheme[key.key as keyof ColorScheme] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Preview -->
    <div class="mt-5 rounded-xl p-4 border" :style="{ backgroundColor: activeScheme.bg, borderColor: activeScheme.border }">
      <div class="rounded-lg p-3 mb-3 shadow-sm" :style="{ backgroundColor: activeScheme.surface, color: activeScheme.text }">
        <div class="font-medium mb-1">预览卡片</div>
        <div class="text-xs opacity-70">这是当前配色方案的实时预览效果</div>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          :style="{ backgroundColor: activeScheme.accent }"
        >
          主要按钮
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-medium border"
          :style="{ borderColor: activeScheme.border, color: activeScheme.text, backgroundColor: activeScheme.surface }"
        >
          次要按钮
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useColorSchemes, type ColorScheme } from '~/composables/useColorSchemes'

const { presetSchemes, activeSchemeId, activeScheme, customColors, setScheme, setCustomColor, resetCustomColors } = useColorSchemes()

const semanticKeys = [
  { key: 'bg', label: '背景色' },
  { key: 'surface', label: '表面色' },
  { key: 'text', label: '文字色' },
  { key: 'border', label: '边框色' },
  { key: 'accent', label: '强调色' },
]
</script>
