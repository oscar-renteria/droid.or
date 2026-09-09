<script setup lang="ts">
import type { DeviceDashboardInfo } from '@shared/types/device-dashboard'
import { NAlert, NButton, NDescriptions, NDescriptionsItem, NIcon, NSpin } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import {
  formatBoolean,
  formatBootloaderState,
  formatCelsius,
  formatHz,
  formatMegabytes,
  formatPercent,
  formatRootHeuristic,
  formatText,
  formatUptime
} from '@renderer/utils/format-dashboard-value'

const devicesStore = useDevicesStore()
const dashboardInfo = ref<DeviceDashboardInfo | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

const selectedDevice = computed(() => devicesStore.selectedDevice)

async function fetchDashboard(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    dashboardInfo.value = null
    errorMessage.value = null
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = null
  try {
    dashboardInfo.value = (await window.droidor?.getDeviceDashboardInfo(device.id)) ?? null
  } catch (error) {
    dashboardInfo.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load device information.'
  } finally {
    loading.value = false
  }
}

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  fetchDashboard,
  { immediate: true }
)
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to see its details.
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
        'Device details require an authorized, connected device.'
      }}
    </p>
  </div>

  <NSpin v-else :show="loading" class="h-full">
    <div class="flex flex-col gap-4 pb-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-text">
          {{ selectedDevice.nickname ?? selectedDevice.model ?? selectedDevice.id }}
        </h2>
        <NButton size="small" :loading="loading" @click="fetchDashboard">
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          Refresh
        </NButton>
      </div>

      <NAlert v-if="errorMessage" type="error" title="Couldn't load device information">
        {{ errorMessage }}
      </NAlert>

      <template v-if="dashboardInfo">
        <NDescriptions title="Basic" :column="2" label-placement="left" bordered size="small">
          <NDescriptionsItem label="Manufacturer">{{
            formatText(dashboardInfo.basic.manufacturer)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Model">{{
            formatText(dashboardInfo.basic.model)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Device name">{{
            formatText(dashboardInfo.basic.deviceName)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Android version">{{
            formatText(dashboardInfo.basic.androidVersion)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="SDK / API level">{{
            formatText(dashboardInfo.basic.sdkVersion)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Build number">{{
            formatText(dashboardInfo.basic.buildNumber)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Security patch">{{
            formatText(dashboardInfo.basic.securityPatch)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Kernel version">{{
            formatText(dashboardInfo.basic.kernelVersion)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="CPU architecture">{{
            formatText(dashboardInfo.basic.cpuAbi)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Bootloader">{{
            formatBootloaderState(dashboardInfo.basic.bootloaderState)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Root status">{{
            formatRootHeuristic(dashboardInfo.basic.rootHeuristic)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="USB debugging">{{
            formatBoolean(dashboardInfo.basic.usbDebuggingEnabled)
          }}</NDescriptionsItem>
        </NDescriptions>

        <NDescriptions title="Hardware" :column="2" label-placement="left" bordered size="small">
          <NDescriptionsItem label="CPU cores">{{
            formatText(dashboardInfo.hardware.cpuCoreCount)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="RAM">
            {{ formatMegabytes(dashboardInfo.hardware.ramAvailableMb) }} free of
            {{ formatMegabytes(dashboardInfo.hardware.ramTotalMb) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Storage">
            {{ formatMegabytes(dashboardInfo.hardware.storageAvailableMb) }} free of
            {{ formatMegabytes(dashboardInfo.hardware.storageTotalMb) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Battery">{{
            formatPercent(dashboardInfo.hardware.batteryPercent)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Battery temperature">{{
            formatCelsius(dashboardInfo.hardware.batteryTemperatureCelsius)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Battery status">{{
            formatText(dashboardInfo.hardware.batteryHealth)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Screen resolution">{{
            formatText(dashboardInfo.hardware.screenResolution)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Refresh rate">{{
            formatHz(dashboardInfo.hardware.refreshRateHz)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Display density">{{
            formatText(dashboardInfo.hardware.displayDensityDpi)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Serial">{{
            formatText(dashboardInfo.deviceId)
          }}</NDescriptionsItem>
        </NDescriptions>

        <NDescriptions title="System" :column="2" label-placement="left" bordered size="small">
          <NDescriptionsItem label="Uptime">{{
            formatUptime(dashboardInfo.system.uptimeSeconds)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="SELinux">{{
            formatText(dashboardInfo.system.selinuxStatus)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Encryption">{{
            formatText(dashboardInfo.system.encryptionState)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Encryption type">{{
            formatText(dashboardInfo.system.encryptionType)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="A/B partitions">{{
            formatBoolean(dashboardInfo.system.abUpdate)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Active slot">{{
            formatText(dashboardInfo.system.activeSlot)
          }}</NDescriptionsItem>
        </NDescriptions>
      </template>
    </div>
  </NSpin>
</template>
