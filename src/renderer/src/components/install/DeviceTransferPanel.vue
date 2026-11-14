<script setup lang="ts">
import { NAlert, NInput, NSelect } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'

const devicesStore = useDevicesStore()
const transferStore = useDeviceTransferStore()
const sourceDeviceId = ref<string | null>(null)
const searchText = ref('')

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
const filteredPackages = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  if (!query) {
    return transferStore.sourcePackages
  }

  return transferStore.sourcePackages.filter((pkg) =>
    [pkg.displayName, pkg.packageName, pkg.versionName, pkg.versionCode?.toString()].some((value) =>
      value?.toLowerCase().includes(query)
    )
  )
})

watch(sourceDeviceId, (deviceId) => {
  searchText.value = ''
  if (deviceId) {
    void transferStore.loadSourcePackages(deviceId)
  } else {
    transferStore.resetSourcePackages()
  }
})
</script>

<template>
  <EmptyState
    v-if="connectedDevices.length < 2"
    title="Connect a second device"
    description="Connect and authorize another Android device to choose where to copy apps from."
    class="h-full"
  />
  <div v-else class="flex h-full min-h-0 flex-col gap-4">
    <div class="flex shrink-0 flex-col gap-2">
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
    <NAlert class="shrink-0" type="warning" title="What can be copied">
      Only user-installed apps are listed. App data, accounts, and logins are not copied. Google
      Play licensing or integrity checks may prevent an app from running on the target.
    </NAlert>
    <section class="flex min-h-0 flex-1 flex-col gap-3" aria-label="Apps from source device">
      <NInput
        v-model:value="searchText"
        clearable
        :disabled="!sourceDeviceId || transferStore.loadingSourcePackages"
        placeholder="Search by app name, package, or version"
        aria-label="Search source apps"
      />
      <EmptyState
        v-if="!sourceDeviceId"
        title="Choose a source device"
        description="Choose a connected device above to browse its user-installed apps."
        class="min-h-0 flex-1"
      />
      <p
        v-else-if="transferStore.loadingSourcePackages"
        class="flex flex-1 items-center justify-center text-sm text-text-secondary"
        role="status"
      >
        Loading apps from source device…
      </p>
      <NAlert
        v-else-if="transferStore.sourcePackagesErrorMessage"
        type="error"
        title="Could not load apps"
      >
        {{ transferStore.sourcePackagesErrorMessage }}
      </NAlert>
      <EmptyState
        v-else-if="transferStore.sourcePackages.length === 0"
        title="No user-installed apps found"
        description="This connected device has no apps available to copy."
        class="min-h-0 flex-1"
      />
      <EmptyState
        v-else-if="filteredPackages.length === 0"
        title="No apps match your search"
        description="Try another app name, package, or version."
        class="min-h-0 flex-1"
      />
      <ul v-else class="min-h-0 flex-1 divide-y divide-divider overflow-y-auto">
        <li
          v-for="pkg in filteredPackages"
          :key="pkg.packageName"
          class="flex items-center justify-between gap-4 py-2"
        >
          <AppIdentity
            :label="pkg.displayName ?? pkg.packageName"
            :package-name="pkg.packageName"
          />
          <span class="shrink-0 text-right text-xs tabular-nums text-text-muted">
            {{ pkg.versionName ?? 'Unknown version' }}
            <template v-if="pkg.versionCode !== null"> · {{ pkg.versionCode }}</template>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
