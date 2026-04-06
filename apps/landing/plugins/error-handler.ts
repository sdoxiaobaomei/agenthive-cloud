export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    window.addEventListener('error', (event) => {
      console.error('[AgentHive Error]', event.error)
    })
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[AgentHive Unhandled]', event.reason)
    })
  }
})
