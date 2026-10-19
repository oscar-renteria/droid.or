<script setup lang="ts">
import type { DeviceDashboardInfo } from '@shared/types/device-dashboard'
import { NAlert, NButton, NDescriptions, NDescriptionsItem, NIcon, NSpin } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import StatTile from '@renderer/components/ui/StatTile.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'
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

const deviceTitle = computed(() => {
  const device = selectedDevice.value
  return device ? deviceDisplayName(device) : 'Device'
})

/** manufacturer · model · Android X — from the device registry, which knows
 *  these before the dashboard has loaded. */
const deviceMeta = computed(() => {
  const device = selectedDevice.value
  if (!device) {
    return ''
  }
  const parts = [device.manufacturer, device.model]
  if (device.androidVersion) {
    parts.push(`Android ${device.androidVersion}`)
  }
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
})

/** used = total − available, but only when both are known (§5.4). */
function usageMeter(availableMb: number | null, totalMb: number | null): number | null {
  if (availableMb === null || totalMb === null || totalMb <= 0) {
    return null
  }
  return Math.min(1, Math.max(0, (totalMb - availableMb) / totalMb))
}

const batteryTile = computed(() => {
  const hardware = dashboardInfo.value?.hardware
  if (!hardware) {
    return null
  }
  return {
    label: 'Battery',
    value: formatPercent(hardware.batteryPercent),
    detail: `${formatCelsius(hardware.batteryTemperatureCelsius)} · ${formatText(hardware.batteryHealth)}`,
    meter: hardware.batteryPercent === null ? undefined : hardware.batteryPercent / 100
  }
})

const storageTile = computed(() => {
  const hardware = dashboardInfo.value?.hardware
  if (!hardware) {
    return null
  }
  const total = hardware.storageTotalMb
  const available = hardware.storageAvailableMb
  if (total === null || available === null) {
    return { label: 'Storage', value: 'Not available', detail: undefined, meter: undefined }
  }
  return {
    label: 'Storage',
    value: `${formatMegabytes(total - available)} of ${formatMegabytes(total)}`,
    detail: `${formatMegabytes(available)} free`,
    meter: usageMeter(available, total) ?? undefined
  }
})

const ramTile = computed(() => {
  const hardware = dashboardInfo.value?.hardware
  if (!hardware) {
    return null
  }
  const total = hardware.ramTotalMb
  const available = hardware.ramAvailableMb
  if (total === null || available === null) {
    return { label: 'RAM', value: 'Not available', detail: undefined, meter: undefined }
  }
  return {
    label: 'RAM',
    value: `${formatMegabytes(total - available)} of ${formatMegabytes(total)}`,
    detail: `${formatMegabytes(available)} free`,
    meter: usageMeter(available, total) ?? undefined
  }
})

const androidTile = computed(() => {
  const basic = dashboardInfo.value?.basic
  if (!basic) {
    return null
  }
  return {
    label: 'Android',
    value: formatText(basic.androidVersion),
    detail: `API ${formatText(basic.sdkVersion)} · Patch ${formatText(basic.securityPatch)}`
  }
})
</script>

<template>
  <DeviceGate
    requirement="Device details require an authorized, connected device."
    no-device-text="Select a device from the sidebar to see its details."
  >
    <NSpin :show="loading" class="h-full">
      <div class="flex flex-col gap-4 pb-4">
        <PageHeader :title="deviceTitle" :description="deviceMeta">
          <template #actions>
            <NButton size="small" :loading="loading" @click="fetchDashboard">
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              Refresh
            </NButton>
          </template>
        </PageHeader>

        <NAlert v-if="errorMessage" type="error" title="Couldn't load device information">
          {{ errorMessage }}
        </NAlert>

        <div v-if="dashboardInfo" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            v-if="batteryTile"
            :label="batteryTile.label"
            :value="batteryTile.value"
            :detail="batteryTile.detail"
            :meter="batteryTile.meter"
          />
          <StatTile
            v-if="storageTile"
            :label="storageTile.label"
            :value="storageTile.value"
            :detail="storageTile.detail"
            :meter="storageTile.meter"
          />
          <StatTile
            v-if="ramTile"
            :label="ramTile.label"
            :value="ramTile.value"
            :detail="ramTile.detail"
            :meter="ramTile.meter"
          />
          <StatTile
            v-if="androidTile"
            :label="androidTile.label"
            :value="androidTile.value"
            :detail="androidTile.detail"
          />
        </div>

        <template v-if="dashboardInfo">
          <NDescriptions
            title="Basic"
            :column="2"
            label-placement="left"
            bordered
            size="small"
            :label-style="{ width: '22%' }"
          >
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

          <NDescriptions
            title="Hardware"
            :column="2"
            label-placement="left"
            bordered
            size="small"
            :label-style="{ width: '22%' }"
          >
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

          <NDescriptions
            title="System"
            :column="2"
            label-placement="left"
            bordered
            size="small"
            :label-style="{ width: '22%' }"
          >
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
  </DeviceGate>
</template>
