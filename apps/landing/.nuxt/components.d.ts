
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T> = DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>> & T

type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }> & T


export const AICodeAssistant: typeof import("../components/AICodeAssistant.vue")['default']
export const AIFeaturesExtended: typeof import("../components/AIFeaturesExtended.vue")['default']
export const AgentAvatar: typeof import("../components/AgentAvatar.vue")['default']
export const AgentTeam: typeof import("../components/AgentTeam.vue")['default']
export const AgentWorkflow: typeof import("../components/AgentWorkflow.vue")['default']
export const AgentWorkflowCard: typeof import("../components/AgentWorkflowCard.vue")['default']
export const AnimatedCharacters: typeof import("../components/AnimatedCharacters.vue")['default']
export const AppFooter: typeof import("../components/AppFooter.vue")['default']
export const AppHeader: typeof import("../components/AppHeader.vue")['default']
export const CTASection: typeof import("../components/CTASection.vue")['default']
export const ChatPanel: typeof import("../components/ChatPanel.vue")['default']
export const ChatView: typeof import("../components/ChatView.vue")['default']
export const ClientProgress: typeof import("../components/ClientProgress.vue")['default']
export const ClientRender: typeof import("../components/ClientRender.vue")['default']
export const CreateAgentDialog: typeof import("../components/CreateAgentDialog.vue")['default']
export const DocCard: typeof import("../components/DocCard.vue")['default']
export const FeatureCard: typeof import("../components/FeatureCard.vue")['default']
export const FeatureDetail: typeof import("../components/FeatureDetail.vue")['default']
export const FeaturesSection: typeof import("../components/FeaturesSection.vue")['default']
export const FileIcon: typeof import("../components/FileIcon.vue")['default']
export const FileManager: typeof import("../components/FileManager.vue")['default']
export const FileTreeNode: typeof import("../components/FileTreeNode.vue")['default']
export const FinalFeatures: typeof import("../components/FinalFeatures.vue")['default']
export const MessageHub: typeof import("../components/MessageHub.vue")['default']
export const PreviewDeploy: typeof import("../components/PreviewDeploy.vue")['default']
export const PricingCard: typeof import("../components/PricingCard.vue")['default']
export const ProjectManager: typeof import("../components/ProjectManager.vue")['default']
export const ProjectSidebar: typeof import("../components/ProjectSidebar.vue")['default']
export const SafeElementDropdown: typeof import("../components/SafeElementDropdown.vue")['default']
export const ShibaAvatar: typeof import("../components/ShibaAvatar.vue")['default']
export const StudioCanvas: typeof import("../components/StudioCanvas.vue")['default']
export const TabButton: typeof import("../components/TabButton.vue")['default']
export const WorkflowSection: typeof import("../components/WorkflowSection.vue")['default']
export const WorkflowStep: typeof import("../components/WorkflowStep.vue")['default']
export const AnimatedEyeBall: typeof import("../components/animated/EyeBall.vue")['default']
export const AnimatedPupil: typeof import("../components/animated/Pupil.vue")['default']
export const OrganismsCTASection: typeof import("../components/organisms/CTASection.vue")['default']
export const OrganismsFeaturesSection: typeof import("../components/organisms/FeaturesSection.vue")['default']
export const OrganismsHeroSection: typeof import("../components/organisms/HeroSection.vue")['default']
export const OrganismsWorkflowSection: typeof import("../components/organisms/WorkflowSection.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const LazyAICodeAssistant: LazyComponent<typeof import("../components/AICodeAssistant.vue")['default']>
export const LazyAIFeaturesExtended: LazyComponent<typeof import("../components/AIFeaturesExtended.vue")['default']>
export const LazyAgentAvatar: LazyComponent<typeof import("../components/AgentAvatar.vue")['default']>
export const LazyAgentTeam: LazyComponent<typeof import("../components/AgentTeam.vue")['default']>
export const LazyAgentWorkflow: LazyComponent<typeof import("../components/AgentWorkflow.vue")['default']>
export const LazyAgentWorkflowCard: LazyComponent<typeof import("../components/AgentWorkflowCard.vue")['default']>
export const LazyAnimatedCharacters: LazyComponent<typeof import("../components/AnimatedCharacters.vue")['default']>
export const LazyAppFooter: LazyComponent<typeof import("../components/AppFooter.vue")['default']>
export const LazyAppHeader: LazyComponent<typeof import("../components/AppHeader.vue")['default']>
export const LazyCTASection: LazyComponent<typeof import("../components/CTASection.vue")['default']>
export const LazyChatPanel: LazyComponent<typeof import("../components/ChatPanel.vue")['default']>
export const LazyChatView: LazyComponent<typeof import("../components/ChatView.vue")['default']>
export const LazyClientProgress: LazyComponent<typeof import("../components/ClientProgress.vue")['default']>
export const LazyClientRender: LazyComponent<typeof import("../components/ClientRender.vue")['default']>
export const LazyCreateAgentDialog: LazyComponent<typeof import("../components/CreateAgentDialog.vue")['default']>
export const LazyDocCard: LazyComponent<typeof import("../components/DocCard.vue")['default']>
export const LazyFeatureCard: LazyComponent<typeof import("../components/FeatureCard.vue")['default']>
export const LazyFeatureDetail: LazyComponent<typeof import("../components/FeatureDetail.vue")['default']>
export const LazyFeaturesSection: LazyComponent<typeof import("../components/FeaturesSection.vue")['default']>
export const LazyFileIcon: LazyComponent<typeof import("../components/FileIcon.vue")['default']>
export const LazyFileManager: LazyComponent<typeof import("../components/FileManager.vue")['default']>
export const LazyFileTreeNode: LazyComponent<typeof import("../components/FileTreeNode.vue")['default']>
export const LazyFinalFeatures: LazyComponent<typeof import("../components/FinalFeatures.vue")['default']>
export const LazyMessageHub: LazyComponent<typeof import("../components/MessageHub.vue")['default']>
export const LazyPreviewDeploy: LazyComponent<typeof import("../components/PreviewDeploy.vue")['default']>
export const LazyPricingCard: LazyComponent<typeof import("../components/PricingCard.vue")['default']>
export const LazyProjectManager: LazyComponent<typeof import("../components/ProjectManager.vue")['default']>
export const LazyProjectSidebar: LazyComponent<typeof import("../components/ProjectSidebar.vue")['default']>
export const LazySafeElementDropdown: LazyComponent<typeof import("../components/SafeElementDropdown.vue")['default']>
export const LazyShibaAvatar: LazyComponent<typeof import("../components/ShibaAvatar.vue")['default']>
export const LazyStudioCanvas: LazyComponent<typeof import("../components/StudioCanvas.vue")['default']>
export const LazyTabButton: LazyComponent<typeof import("../components/TabButton.vue")['default']>
export const LazyWorkflowSection: LazyComponent<typeof import("../components/WorkflowSection.vue")['default']>
export const LazyWorkflowStep: LazyComponent<typeof import("../components/WorkflowStep.vue")['default']>
export const LazyAnimatedEyeBall: LazyComponent<typeof import("../components/animated/EyeBall.vue")['default']>
export const LazyAnimatedPupil: LazyComponent<typeof import("../components/animated/Pupil.vue")['default']>
export const LazyOrganismsCTASection: LazyComponent<typeof import("../components/organisms/CTASection.vue")['default']>
export const LazyOrganismsFeaturesSection: LazyComponent<typeof import("../components/organisms/FeaturesSection.vue")['default']>
export const LazyOrganismsHeroSection: LazyComponent<typeof import("../components/organisms/HeroSection.vue")['default']>
export const LazyOrganismsWorkflowSection: LazyComponent<typeof import("../components/organisms/WorkflowSection.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']>

export const componentNames: string[]
