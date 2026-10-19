<script setup lang="ts">
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div
    class="flex min-h-0 flex-col items-center justify-center gap-3 p-6 text-center"
    role="status"
    aria-live="polite"
  >
    <div v-if="icon" class="shrink-0">
      <NIcon :component="icon" size="34" class="text-text-muted" />
    </div>
    <h3 class="text-sm font-semibold text-text break-words">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-sm text-text-secondary break-words">{{ description }}</p>
    <div v-if="$slots.action" class="mt-5 flex items-center gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
