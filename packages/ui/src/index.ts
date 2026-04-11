// ── Atoms ──
export { default as ShibaAvatar } from './components/atoms/ShibaAvatar.vue'
export { default as AgentAvatar } from './components/atoms/AgentAvatar.vue'

// ── Molecules ──
export { default as AgentCard } from './components/molecules/AgentCard.vue'
export { default as AgentWorkflowCard } from './components/molecules/AgentWorkflowCard.vue'
export { default as CodeDiffViewer } from './components/molecules/CodeDiffViewer.vue'
export { default as CodeEditor } from './components/molecules/CodeEditor.vue'
export { default as TicketCard } from './components/molecules/TicketCard.vue'
export { default as DocCard } from './components/molecules/DocCard.vue'
export { default as FeatureCard } from './components/molecules/FeatureCard.vue'
export { default as PricingCard } from './components/molecules/PricingCard.vue'
export { default as WorkflowStep } from './components/molecules/WorkflowStep.vue'

// ── Organisms ──
export { default as AgentDock } from './components/organisms/AgentDock.vue'
export { default as AppHeader } from './components/organisms/AppHeader.vue'
export { default as AppFooter } from './components/organisms/AppFooter.vue'
export { default as ChatView } from './components/organisms/ChatView.client.vue'
// export { default as CodeViewer } from './components/organisms/CodeViewer.vue'
// export { default as TerminalView } from './components/organisms/TerminalView.vue'
// export { default as Terminal } from './components/organisms/Terminal.vue'
// export { default as LoginOverlay } from './components/organisms/LoginOverlay.vue'
// export { default as PromptInput } from './components/organisms/PromptInput.vue'
// export { default as PropertyPanel } from './components/organisms/PropertyPanel.vue'
// export { default as RequirementWizard } from './components/organisms/RequirementWizard.vue'
// export { default as AgentList } from './components/organisms/AgentList.vue'
// export { default as AgentPanel } from './components/organisms/AgentPanel.vue'
// export { default as ArtifactViewer } from './components/organisms/ArtifactViewer.vue'
// export { default as CreateAgentDialog } from './components/organisms/CreateAgentDialog.vue'
// export { default as TaskList } from './components/organisms/TaskList.vue'
// export { default as ExecutionBoard } from './components/organisms/ExecutionBoard.vue'
// export { default as TicketDetailPanel } from './components/organisms/TicketDetailPanel.vue'
// export { default as HeroSection } from './components/organisms/HeroSection.vue'
// export { default as FeaturesSection } from './components/organisms/FeaturesSection.vue'
// export { default as CTASection } from './components/organisms/CTASection.vue'
// export { default as WorkflowSection } from './components/organisms/WorkflowSection.vue'
// export { default as MessageHub } from './components/organisms/MessageHub.vue'
export { default as StudioExecutionPanel } from './components/organisms/StudioExecutionPanel.client.vue'
// export { default as ClientProgress } from './components/organisms/ClientProgress.vue'
// export { default as DeployPipeline } from './components/organisms/DeployPipeline.vue'
// export { default as FeatureDetail } from './components/organisms/FeatureDetail.vue'
// export { default as AgentTracker } from './components/organisms/AgentTracker.vue'

// ── Templates ──
export { default as StudioDrawer } from './components/templates/StudioDrawer.vue'
export { default as StudioLayout } from './components/templates/StudioLayout.vue'
export { default as StudioToolbox } from './components/templates/StudioToolbox.vue'
export { default as MainLayout } from './components/templates/MainLayout.vue'

// ── Specials ──
export { default as AsyncCodeViewer } from './components/specials/AsyncCodeViewer.vue'
export { default as ColorSchemePicker } from './components/specials/ColorSchemePicker.vue'
export { default as ErrorBoundary } from './components/specials/ErrorBoundary.vue'
export { default as FeatureGate } from './components/specials/FeatureGate.vue'
export { default as LockedPanel } from './components/specials/LockedPanel.vue'

// ── Composables ──
export { useApi } from './composables/useApi'
export { useAuth } from './composables/useAuth'
export { useToast } from './composables/useToast'
export { useVisitorSession } from './composables/useVisitorSession'

// ── Stores ──
export { useExecutionStore } from './stores/execution'
export { useWebSocketStore } from './stores/websocket'
export { useMessageHubStore } from './stores/messageHub'

// ── Utils ──
export { demoPlan } from './utils/execution-demo'
