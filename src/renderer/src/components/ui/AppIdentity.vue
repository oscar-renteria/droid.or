<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  packageName: string
  iconDataUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClass = computed(() =>
  props.size === 'lg' ? 'h-10 w-10' : props.size === 'md' ? 'h-8 w-8' : 'h-6 w-6'
)
const showPackageName = computed(
  () => Boolean(props.packageName) && props.packageName !== props.label
)
const initial = computed(() => props.label.charAt(0).toUpperCase())
</script>

<template>
  <div class="inline-flex items-center gap-2 min-w-0">
    <div class="shrink-0 rounded" :class="sizeClass">
      <img v-if="iconDataUrl" :src="iconDataUrl" alt="" class="h-full w-full rounded" />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-surface-elevated text-xs font-medium text-text-muted"
      >
        {{ initial }}
      </div>
    </div>
    <div class="min-w-0">
      <div class="text-sm font-medium text-text truncate">{{ label }}</div>
      <div v-if="showPackageName" class="text-xs text-text-muted truncate font-mono">
        {{ packageName }}
      </div>
    </div>
  </div>
</template>
