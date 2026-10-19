<script setup lang="ts">
import type { PackageRecommendation } from '@shared/types/analyzer'
import type { MutatingOperationType } from '@shared/types/operation'
import { NAlert, NButton, NEmpty, NIcon, NSelect, NSpin, NTag, useMessage } from 'naive-ui'
import { Star } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import OperationConfirmDialog from '@renderer/components/OperationConfirmDialog.vue'
import { useAnalyzerStore } from '@renderer/stores/analyzer.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import { getRiskMeta, riskNaiveType } from '@renderer/utils/risk-meta'

const devicesStore = useDevicesStore()
const analyzerStore = useAnalyzerStore()
const packagesStore = usePackagesStore()
const operationsStore = useOperationsStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

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

const filteredRecommendations = computed(() => {
  const recommendations = analyzerStore.result?.recommendations ?? []
  return recommendations.filter((recommendation) => {
    if (filterKey.value === 'ignored') {
      return recommendation.isIgnored
    }
    if (recommendation.isIgnored) {
      return false
    }
    if (filterKey.value === 'actionable') {
      return recommendation.risk === 'safe' || recommendation.risk === 'caution'
    }
    if (filterKey.value === 'advanced') {
      return recommendation.risk === 'advanced'
    }
    return true
  })
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
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to analyze it for debloat opportunities.
    </p>
  </div>

  <div
    v-else-if="selectedDevice.connectionState !== 'device'"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">
      {{ getDeviceStateMeta(selectedDevice.connectionState).label }}
    </h2>
    <p class="max-w-md text-sm text-text-muted">
      {{
        getDeviceStateMeta(selectedDevice.connectionState).guidance ??
        'Analyzing a device requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center gap-2">
      <NButton type="primary" :loading="analyzerStore.loading" @click="runAnalysis">
        Analyze Device
      </NButton>
      <template v-if="analyzerStore.result">
        <NSelect v-model:value="filterKey" :options="filterOptions" class="w-64" />
        <span class="text-xs text-text-muted">
          {{ analyzerStore.result.summary.safe }} safe ·
          {{ analyzerStore.result.summary.caution }} caution ·
          {{ analyzerStore.result.summary.advanced }} advanced (uncertain) ·
          {{ analyzerStore.result.summary.critical }} critical (excluded) ·
          {{ analyzerStore.result.summary.ignored }} ignored
        </span>
      </template>
    </div>

    <NAlert v-if="analyzerStore.errorMessage" type="error" title="Analysis failed">
      {{ analyzerStore.errorMessage }}
    </NAlert>

    <div
      v-else-if="!analyzerStore.result && !analyzerStore.loading"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-center"
    >
      <h2 class="text-lg font-medium text-text">Analyze this device</h2>
      <p class="max-w-md text-sm text-text-muted">
        Reviews every preinstalled system package against a local knowledge base and flags possible
        debloat opportunities. User-installed apps aren't included — you already chose those
        yourself. Nothing on the device changes until you take an action.
      </p>
    </div>

    <NSpin v-else :show="analyzerStore.loading" class="min-h-0 flex-1">
      <div class="flex h-full flex-col gap-3 overflow-y-auto pr-1">
        <NEmpty
          v-if="analyzerStore.result && filteredRecommendations.length === 0"
          description="Nothing matches this filter"
        />

        <div
          v-for="recommendation in filteredRecommendations"
          :key="recommendation.packageName"
          class="rounded border border-border p-3"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="metadataFor(recommendation.packageName)?.iconDataUrl"
              :src="metadataFor(recommendation.packageName)?.iconDataUrl ?? undefined"
              alt=""
              class="h-8 w-8 shrink-0 rounded"
            />
            <div
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-elevated text-xs font-medium text-text-muted"
            >
              {{ displayLabel(recommendation).charAt(0).toUpperCase() }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-text">{{ displayLabel(recommendation) }}</span>
                <NTag size="small" :type="riskNaiveType(getRiskMeta(recommendation.risk).tone)">
                  <template #icon>
                    <NIcon :component="getRiskMeta(recommendation.risk).icon" />
                  </template>
                  {{ getRiskMeta(recommendation.risk).label }}
                </NTag>
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
              <div class="text-xs text-text-muted">
                {{ recommendation.packageName }}
              </div>

              <p class="mt-2 text-sm text-text-secondary">
                {{ recommendation.reason }}
              </p>
              <p class="mt-1 text-sm text-text-muted">
                <span class="font-medium">Potential impact:</span>
                {{ recommendation.potentialImpact }}
              </p>

              <div class="mt-3 flex items-center gap-2">
                <NButton
                  size="small"
                  :loading="operationsStore.pending.has(recommendation.packageName)"
                  @click="openConfirm(recommendation, 'uninstall-for-user')"
                >
                  Uninstall for User
                </NButton>
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
                  :loading="operationsStore.pending.has(recommendation.packageName)"
                  @click="openConfirm(recommendation, 'clear-data')"
                >
                  Clear Data
                </NButton>
                <NButton size="small" quaternary @click="toggleIgnore(recommendation)">
                  {{ recommendation.isIgnored ? 'Un-ignore' : 'Ignore' }}
                </NButton>
              </div>
            </div>
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
      @confirm="handleConfirm"
    />
  </div>
</template>
