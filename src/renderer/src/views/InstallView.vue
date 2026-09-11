<script setup lang="ts">
import { NTabPane, NTabs } from 'naive-ui'
import { computed, ref } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import SingleApkInstallPanel from '@renderer/components/install/SingleApkInstallPanel.vue'
import SplitApkInstallPanel from '@renderer/components/install/SplitApkInstallPanel.vue'

const devicesStore = useDevicesStore()
const selectedDevice = computed(() => devicesStore.selectedDevice)

const activeTab = ref<'single' | 'split'>('single')
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to install an APK onto it.
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
        'Installing an APK requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col">
    <NTabs v-model:value="activeTab" size="small" animated class="shrink-0">
      <NTabPane name="single">
        <template #tab>Single APK</template>
      </NTabPane>
      <NTabPane name="split">
        <template #tab>Split / Bundle</template>
      </NTabPane>
    </NTabs>
    <div class="min-h-0 flex-1 pt-3">
      <SingleApkInstallPanel v-if="activeTab === 'single'" />
      <SplitApkInstallPanel v-else />
    </div>
  </div>
</template>
