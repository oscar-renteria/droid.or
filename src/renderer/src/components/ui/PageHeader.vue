<script setup lang="ts">
defineProps<{
  title: string
  description?: string | undefined
}>()
</script>

<template>
  <div class="flex shrink-0 items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-lg leading-7 font-semibold text-text">{{ title }}</h1>
      <p v-if="description" class="mt-0.5 text-sm text-text-secondary">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
