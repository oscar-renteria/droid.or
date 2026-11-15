<script setup lang="ts">
import type { DeviceDashboardInfo } from '@shared/types/device-dashboard'
import { NIcon, NSpin } from 'naive-ui'
import { ChevronForwardOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'
import { formatMegabytes, formatText } from '@renderer/utils/format-dashboard-value'

const devicesStore = useDevicesStore()
const selectedDevice = computed(() => devicesStore.selectedDevice)
const dashboardInfo = ref<DeviceDashboardInfo | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function fetchDashboard(): Promise<void> {
  const device = selectedDevice.value
  dashboardInfo.value = null
  errorMessage.value = null

  if (!device || device.connectionState !== 'device') {
    loading.value = false
    return
  }

  loading.value = true
  try {
    if (!window.droidor) {
      throw new Error('Device information is unavailable.')
    }

    const info = await window.droidor.getDeviceDashboardInfo(device.id)
    if (
      selectedDevice.value?.id === device.id &&
      selectedDevice.value.connectionState === 'device'
    ) {
      dashboardInfo.value = info
    }
  } catch (error) {
    if (
      selectedDevice.value?.id === device.id &&
      selectedDevice.value.connectionState === 'device'
    ) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Failed to load device information.'
    }
  } finally {
    if (
      selectedDevice.value?.id === device.id &&
      selectedDevice.value.connectionState === 'device'
    ) {
      loading.value = false
    }
  }
}

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  fetchDashboard,
  { immediate: true }
)
</script>

<template>
  <section
    aria-labelledby="target-device-heading"
    class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 rounded border border-border bg-surface px-4 py-3"
  >
    <div class="min-w-[10rem]">
      <h2 id="target-device-heading" class="text-xs font-medium text-text-secondary">
        Target device
      </h2>
      <p class="mt-0.5 truncate text-sm font-semibold text-text">
        {{ selectedDevice ? deviceDisplayName(selectedDevice) : 'Device' }}
      </p>
    </div>

    <div v-if="loading" class="flex min-w-0 flex-1 items-center gap-2 text-sm text-text-secondary">
      <NSpin :size="16" />
      Loading device details…
    </div>
    <p v-else-if="errorMessage" role="alert" class="min-w-0 flex-1 text-sm text-danger">
      {{ errorMessage }}
    </p>
    <dl
      v-else-if="dashboardInfo"
      class="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 xl:grid-cols-4"
    >
      <div class="min-w-0">
        <dt class="text-xs text-text-secondary">Android version</dt>
        <dd class="truncate text-sm font-medium text-text">
          {{ formatText(dashboardInfo.basic.androidVersion) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-text-secondary">API level</dt>
        <dd class="truncate text-sm font-medium text-text">
          {{ formatText(dashboardInfo.basic.sdkVersion) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-text-secondary">ABI</dt>
        <dd class="truncate text-sm font-medium text-text">
          {{ formatText(dashboardInfo.basic.cpuAbi) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-text-secondary">Free storage</dt>
        <dd class="truncate text-sm font-medium text-text">
          {{ formatMegabytes(dashboardInfo.hardware.storageAvailableMb) }}
        </dd>
      </div>
    </dl>

    <RouterLink
      :to="{ name: 'overview' }"
      class="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Device details
      <NIcon :component="ChevronForwardOutline" :size="14" aria-hidden="true" />
    </RouterLink>
  </section>
</template>
