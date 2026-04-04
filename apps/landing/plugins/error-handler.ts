export default defineNuxtPlugin(() => {
  window.addEventListener('error', (event) => {
    console.error('[AgentHive Error]', event.error)
  })
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[AgentHive Unhandled]', event.reason)
  })
})
