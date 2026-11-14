<script setup lang="ts">
import { NTabPane, NTabs, useMessage } from 'naive-ui'
import { ref } from 'vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import DropZone from '@renderer/components/ui/DropZone.vue'
import SingleApkInstallPanel from '@renderer/components/install/SingleApkInstallPanel.vue'
import SplitApkInstallPanel from '@renderer/components/install/SplitApkInstallPanel.vue'
import TargetDeviceStrip from '@renderer/components/install/TargetDeviceStrip.vue'
import { useApkInstallStore } from '@renderer/stores/apk-install.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useSplitInstallStore } from '@renderer/stores/split-install.store'
import { routeInstallFilePaths } from '@renderer/utils/install-file-routing'

const activeTab = ref<'single' | 'split' | 'device'>('single')
const devicesStore = useDevicesStore()
const apkInstallStore = useApkInstallStore()
const splitInstallStore = useSplitInstallStore()
const message = useMessage()

function routePaths(paths: string[]): void {
  const device = devicesStore.selectedDevice
  if (!device || paths.length === 0) {
    return
  }

  const route = routeInstallFilePaths(paths)
  if (!route) {
    message.warning('Drop one supported archive, a folder, or only .apk files together.')
    return
  }

  activeTab.value = route.tab
  if (route.tab === 'single') {
    void apkInstallStore.addFiles(device.id, route.paths)
  } else {
    void splitInstallStore.analyzeSource(device.id, route.sourceKind, route.paths)
  }
}

function handleDrop(files: File[]): void {
  if (!window.droidor || files.length === 0) {
    return
  }
  routePaths(files.map((file) => window.droidor.getPathForFile(file)))
}

async function browseApkFiles(): Promise<void> {
  const device = devicesStore.selectedDevice
  if (!device || !window.droidor) {
    return
  }

  try {
    const paths = await window.droidor.browseForApkFiles()
    if (paths.length > 0) {
      activeTab.value = 'single'
      void apkInstallStore.addFiles(device.id, paths)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to open the APK file picker.')
  }
}
</script>

<template>
  <DeviceGate
    requirement="Installing an APK requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to install an APK onto it."
  >
    <div class="flex h-full flex-col gap-3">
      <TargetDeviceStrip />
      <PageHeader title="Install" />
      <DropZone
        clickable
        title="Drop an APK or bundle to choose the right install flow"
        hint="Drop .apk, .apks, .xapk, or .apkm files here. Click to browse for .apk files."
        class="shrink-0"
        @drop="handleDrop"
        @activate="browseApkFiles"
      />
      <NTabs v-model:value="activeTab" type="segment" size="small" animated class="shrink-0">
        <NTabPane name="single">
          <template #tab>From file</template>
        </NTabPane>
        <NTabPane name="split">
          <template #tab>Split / Bundle</template>
        </NTabPane>
        <NTabPane name="device">
          <template #tab>From another device</template>
        </NTabPane>
      </NTabs>
      <div class="min-h-0 flex-1">
        <SingleApkInstallPanel v-if="activeTab === 'single'" />
        <SplitApkInstallPanel v-else-if="activeTab === 'split'" />
        <EmptyState
          v-else
          title="Device-to-device install is coming soon"
          description="For now, install from a file or split bundle."
          class="min-h-0 flex-1"
        />
      </div>
    </div>
  </DeviceGate>
</template>
