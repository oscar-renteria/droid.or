<script setup lang="ts">
import { NAlert, NSelect } from 'naive-ui'
import { computed, ref } from 'vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'

const devicesStore = useDevicesStore()
const sourceDeviceId = ref<string | null>(null)

const connectedDevices = computed(() =>
  devicesStore.devices.filter((device) => device.connectionState === 'device')
)
const sourceDeviceOptions = computed(() =>
  connectedDevices.value
    .filter((device) => device.id !== devicesStore.selectedDeviceId)
    .map((device) => ({ label: deviceDisplayName(device), value: device.id }))
)
const targetDeviceName = computed(() =>
  devicesStore.selectedDevice ? deviceDisplayName(devicesStore.selectedDevice) : 'the target device'
)
</script>

<template>
  <EmptyState
    v-if="connectedDevices.length < 2"
    title="Connect a second device"
    description="Connect and authorize another Android device to choose where to copy apps from."
    class="h-full"
  />
  <div v-else class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-text" for="transfer-source-device"
        >Source device</label
      >
      <NSelect
        id="transfer-source-device"
        v-model:value="sourceDeviceId"
        :options="sourceDeviceOptions"
        placeholder="Choose a connected source device"
        aria-label="Source device"
      />
      <p class="text-sm text-text-secondary">
        Apps will be copied from this device to {{ targetDeviceName }}.
      </p>
    </div>
    <NAlert type="warning" title="What can be copied">
      Only user-installed apps are listed. App data, accounts, and logins are not copied. Google
      Play licensing or integrity checks may prevent an app from running on the target.
    </NAlert>
  </div>
</template>
