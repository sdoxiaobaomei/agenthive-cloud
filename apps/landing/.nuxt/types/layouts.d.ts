import type { ComputedRef, MaybeRef } from 'vue'

type ComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? NonNullable<P>
  : T extends (props: infer P, ...args: any) => any ? P
  : {}

declare module 'nuxt/app' {
  interface NuxtLayouts {
    chat: ComponentProps<typeof import("E:/Git/ai-digital-twin/agenthive-cloud/apps/landing/layouts/chat.vue").default>,
    default: ComponentProps<typeof import("E:/Git/ai-digital-twin/agenthive-cloud/apps/landing/layouts/default.vue").default>,
    studio: ComponentProps<typeof import("E:/Git/ai-digital-twin/agenthive-cloud/apps/landing/layouts/studio.vue").default>,
}
  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}