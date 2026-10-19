<script setup lang="ts">
import { NProgress } from 'naive-ui'

defineProps<{
  label: string
  value: string | number
  detail?: string | undefined
  meter?: number | undefined
}>()
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-3">
    <div class="text-xs text-text-muted uppercase tracking-wide">{{ label }}</div>
    <div class="text-base font-semibold text-text tabular-nums">{{ value }}</div>
    <div v-if="detail" class="mt-0.5 text-xs text-text-secondary">{{ detail }}</div>
    <NProgress
      v-if="meter !== null && meter !== undefined"
      :percentage="meter * 100"
      :show-indicator="false"
      color="var(--color-primary)"
      rail-color="var(--color-surface-elevated)"
      class="mt-2"
    />
  </div>
</template>
