<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-between gap-4 px-4 py-3 border-b border-border bg-surface"
  >
    <div class="flex items-center gap-3 min-w-0">
      <h1 class="text-lg font-semibold leading-7 text-text">{{ title }}</h1>
      <p v-if="description" class="text-sm text-text-secondary truncate">{{ description }}</p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>