<script setup lang="ts">
import { NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import SingleApkInstallPanel from '@renderer/components/install/SingleApkInstallPanel.vue'
import SplitApkInstallPanel from '@renderer/components/install/SplitApkInstallPanel.vue'
import TargetDeviceStrip from '@renderer/components/install/TargetDeviceStrip.vue'

const activeTab = ref<'single' | 'split' | 'device'>('single')
</script>

<template>
  <DeviceGate
    requirement="Installing an APK requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to install an APK onto it."
  >
    <div class="flex h-full flex-col gap-3">
      <TargetDeviceStrip />
      <PageHeader title="Install" />
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
