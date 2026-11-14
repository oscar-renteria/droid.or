<script setup lang="ts">
import { NRadioButton, NRadioGroup, useMessage } from 'naive-ui'
import { computed } from 'vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import DropZone from '@renderer/components/ui/DropZone.vue'
import DeviceTransferPanel from '@renderer/components/install/DeviceTransferPanel.vue'
import SingleApkInstallPanel from '@renderer/components/install/SingleApkInstallPanel.vue'
import SplitApkInstallPanel from '@renderer/components/install/SplitApkInstallPanel.vue'
import TargetDeviceStrip from '@renderer/components/install/TargetDeviceStrip.vue'
import { useApkInstallStore, type InstallSourceTab } from '@renderer/stores/apk-install.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useSplitInstallStore } from '@renderer/stores/split-install.store'
import { routeInstallFilePaths } from '@renderer/utils/install-file-routing'

const devicesStore = useDevicesStore()
const apkInstallStore = useApkInstallStore()
const splitInstallStore = useSplitInstallStore()
const message = useMessage()
const activeTab = computed({
  get: () => apkInstallStore.activeSourceTab,
  set: (tab: InstallSourceTab) => {
    apkInstallStore.activeSourceTab = tab
  }
})

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
    requirement="Reconnect the phone over USB and make sure USB debugging is enabled."
    no-device-title="Waiting for device…"
    no-device-text="Connect an Android phone over USB, enable Developer options and USB debugging in Settings, then approve the prompt on the phone. If already connected, select it in the sidebar."
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
      <!-- Native radios (not NTabs): Naive's tabs aren't keyboard-focusable;
           these get Tab + arrow-key navigation for free. -->
      <NRadioGroup
        v-model:value="activeTab"
        size="small"
        role="radiogroup"
        aria-label="Install source"
        class="shrink-0 self-start"
      >
        <NRadioButton value="single">From file</NRadioButton>
        <NRadioButton value="split">Split / Bundle</NRadioButton>
        <NRadioButton value="device">From another device</NRadioButton>
      </NRadioGroup>
      <div class="min-h-0 flex-1">
        <SingleApkInstallPanel v-if="activeTab === 'single'" />
        <SplitApkInstallPanel v-else-if="activeTab === 'split'" />
        <DeviceTransferPanel v-else />
      </div>
    </div>
  </DeviceGate>
</template>
