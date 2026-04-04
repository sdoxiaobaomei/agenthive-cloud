import { ref, computed } from 'vue'

export interface CanvasComponent {
  id: string
  type: 'rect' | 'circle' | 'button' | 'card' | 'input'
  x: number
  y: number
  width: number
  height: number
  color: string
  borderColor: string
  borderRadius: number
  name: string
  zIndex: number
}

export function useCanvasBuilder() {
  const components = ref<CanvasComponent[]>([
    { id: '1', type: 'card', x: 50, y: 50, width: 200, height: 120, color: '#ffffff', borderColor: '#e5e7eb', borderRadius: 12, name: 'Card A', zIndex: 1 },
    { id: '2', type: 'button', x: 80, y: 200, width: 140, height: 40, color: '#3b82f6', borderColor: '#2563eb', borderRadius: 8, name: 'Primary Button', zIndex: 2 },
    { id: '3', type: 'input', x: 280, y: 60, width: 180, height: 48, color: '#f9fafb', borderColor: '#d1d5db', borderRadius: 6, name: 'Search Input', zIndex: 1 },
    { id: '4', type: 'rect', x: 300, y: 150, width: 140, height: 100, color: '#f3f4f6', borderColor: '#9ca3af', borderRadius: 4, name: 'Feature Box', zIndex: 1 },
  ])
  
  const selectedId = ref<string | null>(null)
  const isDragging = ref(false)
  const dragOffset = ref({ x: 0, y: 0 })
  
  const selectedComponent = computed(() => 
    components.value.find(c => c.id === selectedId.value) || null
  )
  
  function addComponent(type: CanvasComponent['type']) {
    const id = `${Date.now()}`
    const defaults: Record<CanvasComponent['type'], Partial<CanvasComponent>> = {
      rect: { width: 120, height: 80, color: '#f3f4f6', borderColor: '#9ca3af', borderRadius: 4 },
      circle: { width: 80, height: 80, color: '#e0e7ff', borderColor: '#6366f1', borderRadius: 40 },
      button: { width: 120, height: 40, color: '#3b82f6', borderColor: '#2563eb', borderRadius: 8 },
      card: { width: 200, height: 120, color: '#ffffff', borderColor: '#e5e7eb', borderRadius: 12 },
      input: { width: 160, height: 40, color: '#f9fafb', borderColor: '#d1d5db', borderRadius: 6 },
    }
    
    const count = components.value.filter(c => c.type === type).length + 1
    components.value.push({
      id,
      type,
      x: 50 + (components.value.length * 20) % 200,
      y: 50 + (components.value.length * 20) % 150,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
      zIndex: Math.max(...components.value.map(c => c.zIndex), 0) + 1,
      ...defaults[type],
    } as CanvasComponent)
    
    selectedId.value = id
  }
  
  function updateComponent(id: string, updates: Partial<CanvasComponent>) {
    const comp = components.value.find(c => c.id === id)
    if (comp) {
      Object.assign(comp, updates)
    }
  }
  
  function deleteComponent(id: string) {
    const idx = components.value.findIndex(c => c.id === id)
    if (idx > -1) {
      components.value.splice(idx, 1)
      if (selectedId.value === id) selectedId.value = null
    }
  }
  
  function bringToFront(id: string) {
    const comp = components.value.find(c => c.id === id)
    if (comp) {
      comp.zIndex = Math.max(...components.value.map(c => c.zIndex), 0) + 1
    }
  }
  
  function handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Check components in reverse z-index order (top first)
    const clicked = [...components.value]
      .sort((a, b) => b.zIndex - a.zIndex)
      .find(c => 
        x >= c.x && x <= c.x + c.width &&
        y >= c.y && y <= c.y + c.height
      )
    
    if (clicked) {
      selectedId.value = clicked.id
      isDragging.value = true
      dragOffset.value = { x: x - clicked.x, y: y - clicked.y }
      bringToFront(clicked.id)
      return true
    } else {
      selectedId.value = null
      return false
    }
  }
  
  function handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement) {
    if (!isDragging.value || !selectedId.value) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.value.x
    const y = e.clientY - rect.top - dragOffset.value.y
    
    updateComponent(selectedId.value, { x, y })
  }
  
  function handleMouseUp() {
    isDragging.value = false
  }
  
  function draw(ctx: CanvasRenderingContext2D) {
    const canvas = ctx.canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 1
    for (let i = 0; i < canvas.width; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvas.height)
      ctx.stroke()
    }
    for (let i = 0; i < canvas.height; i += 20) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvas.width, i)
      ctx.stroke()
    }
    
    // Draw components sorted by z-index
    ;[...components.value]
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(comp => {
        drawComponent(ctx, comp, comp.id === selectedId.value)
      })
  }
  
  function drawComponent(ctx: CanvasRenderingContext2D, comp: CanvasComponent, isSelected: boolean) {
    ctx.save()
    
    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = isSelected ? 12 : 4
    ctx.shadowOffsetY = isSelected ? 6 : 2
    
    // Fill
    ctx.fillStyle = comp.color
    ctx.beginPath()
    ctx.roundRect(comp.x, comp.y, comp.width, comp.height, comp.borderRadius)
    ctx.fill()
    
    // Border
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = isSelected ? '#3b82f6' : comp.borderColor
    ctx.lineWidth = isSelected ? 2 : 1
    ctx.stroke()
    
    // Label
    ctx.fillStyle = getContrastColor(comp.color)
    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(comp.name, comp.x + comp.width / 2, comp.y + comp.height / 2)
    
    // Selection handles
    if (isSelected) {
      ctx.fillStyle = '#3b82f6'
      const handles = [
        [comp.x, comp.y],
        [comp.x + comp.width, comp.y],
        [comp.x, comp.y + comp.height],
        [comp.x + comp.width, comp.y + comp.height],
      ]
      handles.forEach(([hx, hy]) => {
        ctx.beginPath()
        ctx.arc(hx, hy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      })
    }
    
    ctx.restore()
  }
  
  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#1f2937' : '#ffffff'
  }
  
  return {
    components,
    selectedId,
    selectedComponent,
    isDragging,
    addComponent,
    updateComponent,
    deleteComponent,
    bringToFront,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    draw,
  }
}
