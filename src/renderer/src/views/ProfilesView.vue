<script setup lang="ts">
import type { PackageRecommendation } from '@shared/types/analyzer'
import { NAlert, NButton, NCheckbox, NIcon, NSpin, NTag, useMessage } from 'naive-ui'
import { CheckmarkCircleOutline, CloseCircleOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import ProfileApplyDialog from '@renderer/components/ProfileApplyDialog.vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import RiskBadge from '@renderer/components/ui/RiskBadge.vue'
import { useAnalyzerStore } from '@renderer/stores/analyzer.store'
import { useDebloatProfilesStore } from '@renderer/stores/debloat-profiles.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import {
  DEBLOAT_PROFILES,
  getProfileCandidates,
  getProfileCounts,
  type DebloatProfile
} from '@renderer/utils/debloat-profiles'

const devicesStore = useDevicesStore()
const analyzerStore = useAnalyzerStore()
const packagesStore = usePackagesStore()
const profilesStore = useDebloatProfilesStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

const selectedProfileId = ref<string | null>(null)
const reviewOpen = ref(false)
const checkedPackages = ref(new Set<string>())

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  () => {
    analyzerStore.reset()
    selectedProfileId.value = null
    reviewOpen.value = false
    checkedPackages.value = new Set()
  }
)

/** analyzerStore is shared with the Analyzer tab — if the device changed
 *  while this tab (not that one) was mounted, that tab's own reset
 *  watcher never ran, so the result could still belong to a different
 *  device. Checked defensively here rather than trusting the watcher
 *  above alone. */
const analysisIsCurrent = computed(
  () => analyzerStore.result !== null && analyzerStore.result.deviceId === selectedDevice.value?.id
)

async function runAnalysis(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    return
  }
  await analyzerStore.analyze(device.id)
}

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

const selectedProfile = computed<DebloatProfile | null>(
  () => DEBLOAT_PROFILES.find((profile) => profile.id === selectedProfileId.value) ?? null
)

const recommendations = computed(() => analyzerStore.result?.recommendations ?? [])

const candidates = computed(() =>
  selectedProfile.value ? getProfileCandidates(selectedProfile.value, recommendations.value) : []
)

function countsFor(profile: DebloatProfile) {
  return getProfileCounts(profile, recommendations.value)
}

function selectProfile(profile: DebloatProfile): void {
  selectedProfileId.value = profile.id
  reviewOpen.value = false
  checkedPackages.value = new Set(
    getProfileCandidates(profile, recommendations.value).map((c) => c.packageName)
  )
  profilesStore.reset()
}

function toggleChecked(packageName: string, value: boolean): void {
  if (value) {
    checkedPackages.value.add(packageName)
  } else {
    checkedPackages.value.delete(packageName)
  }
  checkedPackages.value = new Set(checkedPackages.value)
}

const bulkConfirmVisible = ref(false)

function openApplyConfirm(): void {
  if (checkedPackages.value.size === 0) {
    return
  }
  bulkConfirmVisible.value = true
}

async function confirmApply(): Promise<void> {
  const device = selectedDevice.value
  const profile = selectedProfile.value
  bulkConfirmVisible.value = false
  if (!device || !profile) {
    return
  }
  const targets = [...checkedPackages.value]
  const { succeeded, failed } = await profilesStore.applyToPackages(
    device.id,
    targets,
    profile.operation
  )
  if (failed === 0) {
    message.success(`Applied to ${succeeded} package(s).`)
  } else {
    message.warning(`Applied to ${succeeded} package(s) — ${failed} failed.`)
  }
  await analyzerStore.analyze(device.id)
  checkedPackages.value = new Set(
    getProfileCandidates(profile, recommendations.value).map((c) => c.packageName)
  )
}
</script>

<template>
  <DeviceGate
    requirement="Debloat profiles require an authorized, connected device."
    no-device-text="Select a device from the sidebar to apply a debloat profile to it."
  >
    <div class="flex h-full flex-col gap-3">
      <PageHeader title="Profiles">
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

      <NAlert v-if="analyzerStore.errorMessage" type="error" title="Analysis failed">
        {{ analyzerStore.errorMessage }}
      </NAlert>

      <EmptyState
        v-else-if="!analysisIsCurrent && !analyzerStore.loading"
        title="Analyze this device first"
        description="Debloat profiles are built from the same per-package review the Analyzer uses. Run an analysis to see how many packages each profile would apply to."
        class="flex-1"
      >
        <template #action>
          <NButton type="primary" size="small" @click="runAnalysis">Analyze Device</NButton>
        </template>
      </EmptyState>

      <NSpin v-else :show="analyzerStore.loading" class="min-h-0 flex-1">
        <div class="flex h-full flex-col gap-3 overflow-y-auto pr-1">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              v-for="profile in DEBLOAT_PROFILES"
              :key="profile.id"
              type="button"
              :aria-pressed="selectedProfileId === profile.id"
              class="cursor-pointer rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="
                selectedProfileId === profile.id ? 'border-primary bg-primary/10' : 'border-border'
              "
              @click="selectProfile(profile)"
            >
              <div class="font-medium text-text">{{ profile.name }}</div>
              <p class="mt-1 text-xs text-text-muted">{{ profile.description }}</p>
              <div class="mt-2 text-xs text-text-muted">
                {{ countsFor(profile).safe }} safe · {{ countsFor(profile).caution }} caution
              </div>
            </button>
          </div>

          <template v-if="selectedProfile">
            <div class="rounded-lg border border-border p-3">
              <h3 class="font-medium text-text">{{ selectedProfile.name }}</h3>
              <ul class="mt-1 list-inside list-disc text-sm text-text-secondary">
                <li>{{ countsFor(selectedProfile).safe }} package(s) recommended</li>
                <li>{{ countsFor(selectedProfile).caution }} package(s) caution</li>
                <li>
                  {{ analyzerStore.result?.summary.critical ?? 0 }} package(s) excluded as critical
                </li>
              </ul>
              <div class="mt-3 flex items-center gap-2">
                <NButton size="small" @click="reviewOpen = !reviewOpen">
                  {{ reviewOpen ? 'Hide Review' : 'Review' }}
                </NButton>
                <NButton
                  size="small"
                  type="primary"
                  :disabled="checkedPackages.size === 0"
                  :loading="profilesStore.applying"
                  @click="openApplyConfirm"
                >
                  Apply Selected ({{ checkedPackages.size }})
                </NButton>
              </div>
            </div>

            <EmptyState
              v-if="candidates.length === 0"
              title="Nothing to do for this profile"
              description="Every matching package is already in its target state, or ignored."
            />

            <div v-else-if="reviewOpen" class="flex flex-col gap-2">
              <div
                v-for="candidate in candidates"
                :key="candidate.packageName"
                class="flex items-start gap-3 rounded-lg border border-border p-2 text-sm"
              >
                <NCheckbox
                  :checked="checkedPackages.has(candidate.packageName)"
                  @update:checked="(v: boolean) => toggleChecked(candidate.packageName, v)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <AppIdentity
                      :label="displayLabel(candidate)"
                      :package-name="candidate.packageName"
                      size="sm"
                    />
                    <RiskBadge :risk="candidate.risk" />
                    <NTag v-if="candidate.isDisabled" size="small">Already disabled</NTag>
                  </div>
                  <p
                    v-if="profilesStore.results.has(candidate.packageName)"
                    class="mt-1 flex items-center gap-1 text-xs"
                    :class="
                      profilesStore.results.get(candidate.packageName)!.success
                        ? 'text-success'
                        : 'text-danger'
                    "
                  >
                    <NIcon
                      :component="
                        profilesStore.results.get(candidate.packageName)!.success
                          ? CheckmarkCircleOutline
                          : CloseCircleOutline
                      "
                      :size="14"
                    />
                    {{ profilesStore.results.get(candidate.packageName)!.message }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </NSpin>

      <ProfileApplyDialog
        v-if="selectedProfile"
        v-model:show="bulkConfirmVisible"
        :package-count="checkedPackages.size"
        :operation="selectedProfile.operation"
        @confirm="confirmApply"
      />
    </div>
  </DeviceGate>
</template>
