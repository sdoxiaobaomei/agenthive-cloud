
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

interface _GlobalComponents {
  AICodeAssistant: typeof import("../../components/AICodeAssistant.vue")['default']
  AIFeaturesExtended: typeof import("../../components/AIFeaturesExtended.vue")['default']
  AgentAvatar: typeof import("../../components/AgentAvatar.vue")['default']
  AgentTeam: typeof import("../../components/AgentTeam.vue")['default']
  AgentWorkflow: typeof import("../../components/AgentWorkflow.vue")['default']
  AgentWorkflowCard: typeof import("../../components/AgentWorkflowCard.vue")['default']
  AnimatedCharacters: typeof import("../../components/AnimatedCharacters.vue")['default']
  AppFooter: typeof import("../../components/AppFooter.vue")['default']
  AppHeader: typeof import("../../components/AppHeader.vue")['default']
  CTASection: typeof import("../../components/CTASection.vue")['default']
  ChatPanel: typeof import("../../components/ChatPanel.vue")['default']
  ChatView: typeof import("../../components/ChatView.vue")['default']
  ClientProgress: typeof import("../../components/ClientProgress.vue")['default']
  ClientRender: typeof import("../../components/ClientRender.vue")['default']
  CreateAgentDialog: typeof import("../../components/CreateAgentDialog.vue")['default']
  DocCard: typeof import("../../components/DocCard.vue")['default']
  FeatureCard: typeof import("../../components/FeatureCard.vue")['default']
  FeatureDetail: typeof import("../../components/FeatureDetail.vue")['default']
  FeaturesSection: typeof import("../../components/FeaturesSection.vue")['default']
  FileIcon: typeof import("../../components/FileIcon.vue")['default']
  FileManager: typeof import("../../components/FileManager.vue")['default']
  FileTreeNode: typeof import("../../components/FileTreeNode.vue")['default']
  FinalFeatures: typeof import("../../components/FinalFeatures.vue")['default']
  MessageHub: typeof import("../../components/MessageHub.vue")['default']
  PreviewDeploy: typeof import("../../components/PreviewDeploy.vue")['default']
  PricingCard: typeof import("../../components/PricingCard.vue")['default']
  ProjectManager: typeof import("../../components/ProjectManager.vue")['default']
  ProjectSidebar: typeof import("../../components/ProjectSidebar.vue")['default']
  SafeElementDropdown: typeof import("../../components/SafeElementDropdown.vue")['default']
  ShibaAvatar: typeof import("../../components/ShibaAvatar.vue")['default']
  StudioCanvas: typeof import("../../components/StudioCanvas.vue")['default']
  TabButton: typeof import("../../components/TabButton.vue")['default']
  WorkflowSection: typeof import("../../components/WorkflowSection.vue")['default']
  WorkflowStep: typeof import("../../components/WorkflowStep.vue")['default']
  AnimatedEyeBall: typeof import("../../components/animated/EyeBall.vue")['default']
  AnimatedPupil: typeof import("../../components/animated/Pupil.vue")['default']
  OrganismsCTASection: typeof import("../../components/organisms/CTASection.vue")['default']
  OrganismsFeaturesSection: typeof import("../../components/organisms/FeaturesSection.vue")['default']
  OrganismsHeroSection: typeof import("../../components/organisms/HeroSection.vue")['default']
  OrganismsWorkflowSection: typeof import("../../components/organisms/WorkflowSection.vue")['default']
  NuxtWelcome: typeof import("../../node_modules/nuxt/dist/app/components/welcome.vue")['default']
  NuxtLayout: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
  NuxtErrorBoundary: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
  ClientOnly: typeof import("../../node_modules/nuxt/dist/app/components/client-only")['default']
  DevOnly: typeof import("../../node_modules/nuxt/dist/app/components/dev-only")['default']
  ServerPlaceholder: typeof import("../../node_modules/nuxt/dist/app/components/server-placeholder")['default']
  NuxtLink: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-link")['default']
  NuxtLoadingIndicator: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
  NuxtTime: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
  NuxtRouteAnnouncer: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
  NuxtImg: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
  NuxtPicture: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
  NuxtPage: typeof import("../../node_modules/nuxt/dist/pages/runtime/page")['default']
  NoScript: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['NoScript']
  Link: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Link']
  Base: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Base']
  Title: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Title']
  Meta: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Meta']
  Style: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Style']
  Head: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Head']
  Html: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Html']
  Body: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Body']
  NuxtIsland: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-island")['default']
  LazyAICodeAssistant: LazyComponent<typeof import("../../components/AICodeAssistant.vue")['default']>
  LazyAIFeaturesExtended: LazyComponent<typeof import("../../components/AIFeaturesExtended.vue")['default']>
  LazyAgentAvatar: LazyComponent<typeof import("../../components/AgentAvatar.vue")['default']>
  LazyAgentTeam: LazyComponent<typeof import("../../components/AgentTeam.vue")['default']>
  LazyAgentWorkflow: LazyComponent<typeof import("../../components/AgentWorkflow.vue")['default']>
  LazyAgentWorkflowCard: LazyComponent<typeof import("../../components/AgentWorkflowCard.vue")['default']>
  LazyAnimatedCharacters: LazyComponent<typeof import("../../components/AnimatedCharacters.vue")['default']>
  LazyAppFooter: LazyComponent<typeof import("../../components/AppFooter.vue")['default']>
  LazyAppHeader: LazyComponent<typeof import("../../components/AppHeader.vue")['default']>
  LazyCTASection: LazyComponent<typeof import("../../components/CTASection.vue")['default']>
  LazyChatPanel: LazyComponent<typeof import("../../components/ChatPanel.vue")['default']>
  LazyChatView: LazyComponent<typeof import("../../components/ChatView.vue")['default']>
  LazyClientProgress: LazyComponent<typeof import("../../components/ClientProgress.vue")['default']>
  LazyClientRender: LazyComponent<typeof import("../../components/ClientRender.vue")['default']>
  LazyCreateAgentDialog: LazyComponent<typeof import("../../components/CreateAgentDialog.vue")['default']>
  LazyDocCard: LazyComponent<typeof import("../../components/DocCard.vue")['default']>
  LazyFeatureCard: LazyComponent<typeof import("../../components/FeatureCard.vue")['default']>
  LazyFeatureDetail: LazyComponent<typeof import("../../components/FeatureDetail.vue")['default']>
  LazyFeaturesSection: LazyComponent<typeof import("../../components/FeaturesSection.vue")['default']>
  LazyFileIcon: LazyComponent<typeof import("../../components/FileIcon.vue")['default']>
  LazyFileManager: LazyComponent<typeof import("../../components/FileManager.vue")['default']>
  LazyFileTreeNode: LazyComponent<typeof import("../../components/FileTreeNode.vue")['default']>
  LazyFinalFeatures: LazyComponent<typeof import("../../components/FinalFeatures.vue")['default']>
  LazyMessageHub: LazyComponent<typeof import("../../components/MessageHub.vue")['default']>
  LazyPreviewDeploy: LazyComponent<typeof import("../../components/PreviewDeploy.vue")['default']>
  LazyPricingCard: LazyComponent<typeof import("../../components/PricingCard.vue")['default']>
  LazyProjectManager: LazyComponent<typeof import("../../components/ProjectManager.vue")['default']>
  LazyProjectSidebar: LazyComponent<typeof import("../../components/ProjectSidebar.vue")['default']>
  LazySafeElementDropdown: LazyComponent<typeof import("../../components/SafeElementDropdown.vue")['default']>
  LazyShibaAvatar: LazyComponent<typeof import("../../components/ShibaAvatar.vue")['default']>
  LazyStudioCanvas: LazyComponent<typeof import("../../components/StudioCanvas.vue")['default']>
  LazyTabButton: LazyComponent<typeof import("../../components/TabButton.vue")['default']>
  LazyWorkflowSection: LazyComponent<typeof import("../../components/WorkflowSection.vue")['default']>
  LazyWorkflowStep: LazyComponent<typeof import("../../components/WorkflowStep.vue")['default']>
  LazyAnimatedEyeBall: LazyComponent<typeof import("../../components/animated/EyeBall.vue")['default']>
  LazyAnimatedPupil: LazyComponent<typeof import("../../components/animated/Pupil.vue")['default']>
  LazyOrganismsCTASection: LazyComponent<typeof import("../../components/organisms/CTASection.vue")['default']>
  LazyOrganismsFeaturesSection: LazyComponent<typeof import("../../components/organisms/FeaturesSection.vue")['default']>
  LazyOrganismsHeroSection: LazyComponent<typeof import("../../components/organisms/HeroSection.vue")['default']>
  LazyOrganismsWorkflowSection: LazyComponent<typeof import("../../components/organisms/WorkflowSection.vue")['default']>
  LazyNuxtWelcome: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
  LazyNuxtLayout: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
  LazyNuxtErrorBoundary: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
  LazyClientOnly: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/client-only")['default']>
  LazyDevOnly: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/dev-only")['default']>
  LazyServerPlaceholder: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
  LazyNuxtLink: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
  LazyNuxtLoadingIndicator: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
  LazyNuxtTime: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
  LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
  LazyNuxtImg: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
  LazyNuxtPicture: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
  LazyNuxtPage: LazyComponent<typeof import("../../node_modules/nuxt/dist/pages/runtime/page")['default']>
  LazyNoScript: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
  LazyLink: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Link']>
  LazyBase: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Base']>
  LazyTitle: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Title']>
  LazyMeta: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Meta']>
  LazyStyle: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Style']>
  LazyHead: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Head']>
  LazyHtml: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Html']>
  LazyBody: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Body']>
  LazyNuxtIsland: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-island")['default']>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export {}
