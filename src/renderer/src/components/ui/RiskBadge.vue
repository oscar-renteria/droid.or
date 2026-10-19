<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { getRiskMeta } from '@renderer/utils/risk-meta'
import type { RiskLevel } from '@shared/types/analyzer'

const props = defineProps<{
  risk: RiskLevel
}>()

const meta = computed(() => getRiskMeta(props.risk))
const tone = computed(() => meta.value.tone)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
    :class="[
      `text-risk-${tone}`,
      `bg-risk-${tone}-subtle`,
      `border-risk-${tone}/30`
    ]"
  >
    <NIcon :component="meta.icon" size="14" />
    {{ meta.label }}
  </span>
</template>