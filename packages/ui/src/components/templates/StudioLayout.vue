<template>
  <div class="studio-layout min-h-screen bg-gray-50 pt-16">
    <!-- Header slot -->
    <slot name="header" />

    <div class="studio-body flex h-[calc(100vh-4rem)]">
      <!-- Left toolbox -->
      <aside class="w-14 lg:w-56 flex-shrink-0 p-3 border-r border-gray-200 bg-white/50">
        <slot name="toolbox" />
      </aside>

      <!-- Main canvas -->
      <main class="flex-1 relative overflow-hidden">
        <slot name="canvas" />
      </main>
    </div>

    <!-- Bottom dock -->
    <slot name="dock" />

    <!-- Right drawer -->
    <slot name="drawer" />
  </div>
</template>

<script setup lang="ts">
// Layout shell only
</script>
