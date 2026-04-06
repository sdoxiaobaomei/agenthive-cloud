import { ref, watch } from 'vue'

const STORAGE_KEY = 'agenthive:visitor-session'

export interface VisitorSession {
  canvasState: Record<string, any>
  promptHistory: string[]
  lastProjectId?: string
}

const defaultSession: VisitorSession = {
  canvasState: {},
  promptHistory: [],
}

function load(): VisitorSession {
  if (typeof window === 'undefined') return defaultSession
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : defaultSession
  } catch {
    return defaultSession
  }
}

function save(session: VisitorSession) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {}
}

export function useVisitorSession() {
  const session = ref<VisitorSession>(load())

  watch(session, (val) => save(val), { deep: true })

  const setCanvasState = (state: Record<string, any>) => {
    session.value.canvasState = state
  }

  const addPrompt = (prompt: string) => {
    session.value.promptHistory.push(prompt)
  }

  const clear = () => {
    session.value = { ...defaultSession }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    session,
    setCanvasState,
    addPrompt,
    clear,
  }
}
