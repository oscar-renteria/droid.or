<script setup lang="ts">
import { NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import SingleApkInstallPanel from '@renderer/components/install/SingleApkInstallPanel.vue'
import SplitApkInstallPanel from '@renderer/components/install/SplitApkInstallPanel.vue'

const activeTab = ref<'single' | 'split'>('single')
</script>

<template>
  <DeviceGate
    requirement="Installing an APK requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to install an APK onto it."
  >
    <div class="flex h-full flex-col gap-3">
      <PageHeader title="Install" />
      <NTabs v-model:value="activeTab" type="segment" size="small" animated class="shrink-0">
        <NTabPane name="single">
          <template #tab>Single APK</template>
        </NTabPane>
        <NTabPane name="split">
          <template #tab>Split / Bundle</template>
        </NTabPane>
      </NTabs>
      <div class="min-h-0 flex-1">
        <SingleApkInstallPanel v-if="activeTab === 'single'" />
        <SplitApkInstallPanel v-else />
      </div>
    </div>
  </DeviceGate>
</template>
