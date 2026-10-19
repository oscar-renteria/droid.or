<script setup lang="ts">
import type { PackageRecommendation } from '@shared/types/analyzer'
import type { MutatingOperationType } from '@shared/types/operation'
import {
  NAlert,
  NButton,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NSpin,
  NTag,
  useMessage
} from 'naive-ui'
import { Star } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import OperationConfirmDialog from '@renderer/components/OperationConfirmDialog.vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import RiskBadge from '@renderer/components/ui/RiskBadge.vue'
import { useAnalyzerStore } from '@renderer/stores/analyzer.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { usePackagesStore } from '@renderer/stores/packages.store'

const devicesStore = useDevicesStore()
const analyzerStore = useAnalyzerStore()
const packagesStore = usePackagesStore()
const operationsStore = useOperationsStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

/** Same rule Profiles uses: offer "Re-analyze" only when the stored result
 *  actually belongs to the currently selected device. */
const analysisIsCurrent = computed(
  () => analyzerStore.result !== null && analyzerStore.result.deviceId === selectedDevice.value?.id
)

type FilterKey = 'actionable' | 'advanced' | 'all' | 'ignored'
const filterKey = ref<FilterKey>('actionable')
const filterOptions: Array<{ label: string; value: FilterKey }> = [
  { label: 'Recommended (Safe & Caution)', value: 'actionable' },
  { label: 'Advanced (uncertain)', value: 'advanced' },
  { label: 'All reviewed', value: 'all' },
  { label: 'Ignored', value: 'ignored' }
]

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  () => analyzerStore.reset()
)

async function runAnalysis(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    return
  }
  await analyzerStore.analyze(device.id)
}

/** Single source of truth for which recommendations a filter shows — used
 *  both by the list and by the per-button counts, so the numbers always
 *  match the rows you get after clicking. */
function matchesFilter(recommendation: PackageRecommendation, key: FilterKey): boolean {
  if (key === 'ignored') {
    return recommendation.isIgnored
  }
  if (recommendation.isIgnored) {
    return false
  }
  if (key === 'actionable') {
    return recommendation.risk === 'safe' || recommendation.risk === 'caution'
  }
  if (key === 'advanced') {
    return recommendation.risk === 'advanced'
  }
  return true
}

const filteredRecommendations = computed(() => {
  const recommendations = analyzerStore.result?.recommendations ?? []
  return recommendations.filter((recommendation) => matchesFilter(recommendation, filterKey.value))
})

const filterCounts = computed<Record<FilterKey, number>>(() => {
  const recommendations = analyzerStore.result?.recommendations ?? []
  return {
    actionable: recommendations.filter((r) => matchesFilter(r, 'actionable')).length,
    advanced: recommendations.filter((r) => matchesFilter(r, 'advanced')).length,
    all: recommendations.filter((r) => matchesFilter(r, 'all')).length,
    ignored: recommendations.filter((r) => matchesFilter(r, 'ignored')).length
  }
})

/** The summary line stays exactly as before — meta text under the header. */
const summaryText = computed(() => {
  const summary = analyzerStore.result?.summary
  if (!summary) {
    return ''
  }
  return (
    `${summary.safe} safe · ${summary.caution} caution · ` +
    `${summary.advanced} advanced (uncertain) · ${summary.critical} critical (excluded) · ` +
    `${summary.ignored} ignored`
  )
})

/** Reuses whatever the Apps tab has already resolved (via its own lazy
 *  per-row fetch) rather than triggering fresh APK pulls from here — this
 *  view only reads that shared cache, falling back to the curated name /
 *  a letter placeholder exactly like the Apps tab does when nothing has
 *  been resolved yet. */
function metadataFor(packageName: string) {
  const cached = packagesStore.metadataCache.get(packageName)
  return cached && cached !== 'loading' ? cached : null
}

function displayLabel(recommendation: PackageRecommendation): string {
  return (
    metadataFor(recommendation.packageName)?.label ??
    recommendation.displayName ??
    recommendation.packageName
  )
}

async function toggleIgnore(recommendation: PackageRecommendation): Promise<void> {
  await analyzerStore.setIgnored(recommendation.packageName, !recommendation.isIgnored)
}

const confirmTarget = ref<PackageRecommendation | null>(null)
const confirmOperation = ref<MutatingOperationType>('disable')
const dialogVisible = computed({
  get: () => confirmTarget.value !== null,
  set: (value: boolean) => {
    if (!value) {
      confirmTarget.value = null
    }
  }
})

function openConfirm(
  recommendation: PackageRecommendation,
  operation: MutatingOperationType
): void {
  confirmTarget.value = recommendation
  confirmOperation.value = operation
}

async function handleConfirm(): Promise<void> {
  const device = selectedDevice.value
  const target = confirmTarget.value
  if (!device || !target) {
    return
  }
  confirmTarget.value = null

  const result = await operationsStore.performOperation(
    device.id,
    target.packageName,
    confirmOperation.value
  )
  if (!result) {
    return
  }

  if (result.success) {
    message.success(result.message)
    if (confirmOperation.value === 'disable') {
      target.isDisabled = true
    } else if (confirmOperation.value === 'enable') {
      target.isDisabled = false
    }
  } else {
    message.error(result.message)
  }
}
</script>

<template>
  <DeviceGate
    requirement="Analyzing a device requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to analyze it for debloat opportunities."
  >
    <div class="flex h-full flex-col gap-3">
      <PageHeader title="Analyzer" :description="summaryText">
        <template #actions>
          <NButton
            type="primary"
            size="small"
            :loading="analyzerStore.loading"
            @click="runAnalysis"
          >
            {{ analysisIsCurrent ? 'Re-analyze' : 'Analyze Device' }}
          </NButton>
        </template>
      </PageHeader>

      <NRadioGroup
        v-if="analyzerStore.result"
        v-model:value="filterKey"
        size="small"
        class="flex flex-wrap items-center gap-2"
      >
        <NRadioButton v-for="option in filterOptions" :key="option.value" :value="option.value">
          {{ option.label }}
          <span class="ml-1 tabular-nums opacity-70">{{ filterCounts[option.value] }}</span>
        </NRadioButton>
      </NRadioGroup>

      <NAlert v-if="analyzerStore.errorMessage" type="error" title="Analysis failed">
        {{ analyzerStore.errorMessage }}
      </NAlert>

      <EmptyState
        v-else-if="!analyzerStore.result && !analyzerStore.loading"
        title="Analyze this device"
        description="Reviews every preinstalled system package against a local knowledge base and flags possible debloat opportunities. User-installed apps aren't included — you already chose those yourself. Nothing on the device changes until you take an action."
        class="flex-1"
      >
        <template #action>
          <NButton
            type="primary"
            size="small"
            :loading="analyzerStore.loading"
            @click="runAnalysis"
          >
            Analyze Device
          </NButton>
        </template>
      </EmptyState>

      <NSpin v-else :show="analyzerStore.loading" class="min-h-0 flex-1">
        <div class="flex h-full flex-col gap-3 overflow-y-auto pr-1">
          <EmptyState
            v-if="analyzerStore.result && filteredRecommendations.length === 0"
            title="Nothing matches this filter"
            description="Try another filter, or review the full list under 'All reviewed'."
          />

          <div
            v-for="recommendation in filteredRecommendations"
            :key="recommendation.packageName"
            class="rounded-lg border border-border p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <AppIdentity
                :label="displayLabel(recommendation)"
                :package-name="recommendation.packageName"
                :icon-data-url="metadataFor(recommendation.packageName)?.iconDataUrl ?? null"
                size="md"
                class="mr-2"
              />
              <RiskBadge :risk="recommendation.risk" />
              <NTag v-if="recommendation.isDisabled" size="small">Already disabled</NTag>
              <NTag v-if="recommendation.isRunning" size="small" type="info">Running now</NTag>
              <NTag v-if="!recommendation.isKnownPackage" size="small">Not yet reviewed</NTag>
              <NTag v-if="recommendation.isFavorite" size="small" type="warning">
                <template #icon>
                  <NIcon :component="Star" />
                </template>
                Important
              </NTag>
            </div>

            <p class="mt-2 text-sm text-text-secondary">{{ recommendation.reason }}</p>
            <p class="mt-1 text-sm text-text-muted">
              <span class="font-medium">Potential impact:</span>
              {{ recommendation.potentialImpact }}
            </p>

            <div class="mt-3 flex items-center gap-2">
              <NButton
                size="small"
                :loading="operationsStore.pending.has(recommendation.packageName)"
                @click="
                  openConfirm(recommendation, recommendation.isDisabled ? 'enable' : 'disable')
                "
              >
                {{ recommendation.isDisabled ? 'Enable' : 'Disable' }}
              </NButton>
              <NButton
                size="small"
                type="error"
                secondary
                :loading="operationsStore.pending.has(recommendation.packageName)"
                @click="openConfirm(recommendation, 'uninstall-for-user')"
              >
                Uninstall for User
              </NButton>
              <NButton
                size="small"
                type="error"
                secondary
                :loading="operationsStore.pending.has(recommendation.packageName)"
                @click="openConfirm(recommendation, 'clear-data')"
              >
                Clear Data
              </NButton>
              <div class="flex-1" />
              <NButton size="small" quaternary @click="toggleIgnore(recommendation)">
                {{ recommendation.isIgnored ? 'Un-ignore' : 'Ignore' }}
              </NButton>
            </div>
          </div>
        </div>
      </NSpin>

      <OperationConfirmDialog
        v-if="confirmTarget"
        v-model:show="dialogVisible"
        :package-name="confirmTarget.packageName"
        :display-name="displayLabel(confirmTarget)"
        :operation="confirmOperation"
        :is-system-app="confirmTarget.isSystemApp"
        :risk="confirmTarget.risk"
        :is-favorite="confirmTarget.isFavorite"
        :potential-impact="confirmTarget.potentialImpact"
        @confirm="handleConfirm"
      />
    </div>
  </DeviceGate>
</template>
