<script setup lang="ts">
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title: string
    description?: string
    /** 1 when the empty state stands in for the whole page (DeviceGate), so
     *  the page still has its h1; 2 for an empty section under a PageHeader. */
    headingLevel?: 1 | 2
  }>(),
  { headingLevel: 2 }
)
</script>

<template>
  <!-- Static content, deliberately not a live region: announcing it on every
       view change would be noise. -->
  <div class="flex min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
    <div v-if="icon" class="shrink-0">
      <NIcon :component="icon" size="34" class="text-text-muted" />
    </div>
    <component :is="`h${headingLevel}`" class="text-sm font-semibold break-words text-text">
      {{ title }}
    </component>
    <p v-if="description" class="mt-1 text-sm break-words text-text-secondary">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-5 flex items-center gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
