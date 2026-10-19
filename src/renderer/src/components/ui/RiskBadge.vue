<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import type { RiskLevel } from '@shared/types/analyzer'
import { getRiskMeta, type RiskMeta } from '@renderer/utils/risk-meta'

const props = defineProps<{
  risk: RiskLevel
}>()

// Full class names only — Tailwind can't see classes assembled at runtime.
const TONE_CLASSES: Record<RiskMeta['tone'], string> = {
  safe: 'text-risk-safe bg-risk-safe-subtle border-risk-safe/30',
  caution: 'text-risk-caution bg-risk-caution-subtle border-risk-caution/30',
  advanced: 'text-risk-advanced bg-risk-advanced-subtle border-risk-advanced/30',
  critical: 'text-risk-critical bg-risk-critical-subtle border-risk-critical/30'
}

const meta = computed(() => getRiskMeta(props.risk))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
    :class="TONE_CLASSES[meta.tone]"
  >
    <NIcon :component="meta.icon" :size="14" />
    {{ meta.label }}
  </span>
</template>
