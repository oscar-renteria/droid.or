<script setup lang="ts">
import { NAlert, NButton, NIcon, NTabPane, NTabs } from 'naive-ui'
import {
  AnalyticsOutline,
  AppsOutline,
  ArrowUndoOutline,
  DocumentTextOutline,
  DownloadOutline,
  HomeOutline,
  LayersOutline,
  SettingsOutline,
  ShieldCheckmarkOutline,
  TimeOutline
} from '@vicons/ionicons5'
import { onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdbAvailability } from '@renderer/composables/useAdbAvailability'
import { useAppInfo } from '@renderer/composables/useAppInfo'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import DeviceSidebar from './DeviceSidebar.vue'

const route = useRoute()
const router = useRouter()
const { appInfo } = useAppInfo()
const { adbAvailability } = useAdbAvailability()
const devicesStore = useDevicesStore()

onMounted(() => {
  void devicesStore.initialize()
})
onUnmounted(() => {
  devicesStore.dispose()
})

const tabs: Array<{ name: string; label: string; icon: Component }> = [
  { name: 'overview', label: 'Overview', icon: HomeOutline },
  { name: 'apps', label: 'Apps', icon: AppsOutline },
  { name: 'analyzer', label: 'Analyzer', icon: AnalyticsOutline },
  { name: 'profiles', label: 'Profiles', icon: LayersOutline },
  { name: 'install', label: 'Install', icon: DownloadOutline },
  { name: 'history', label: 'History', icon: TimeOutline },
  { name: 'recovery', label: 'Recovery', icon: ArrowUndoOutline },
  { name: 'security', label: 'Security Review', icon: ShieldCheckmarkOutline },
  { name: 'settings', label: 'Settings', icon: SettingsOutline },
  { name: 'logs', label: 'Logs', icon: DocumentTextOutline }
]

function onTabUpdate(name: string): void {
  void router.push({ name })
}
</script>

<template>
  <div class="flex h-screen w-screen flex-col bg-background text-text">
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <span class="text-sm font-semibold">droid.or</span>
      <span class="text-xs text-text-muted">
        <template v-if="devicesStore.selectedDevice">
          {{
            devicesStore.selectedDevice.nickname ??
            devicesStore.selectedDevice.model ??
            devicesStore.selectedDevice.id
          }}
          · {{ getDeviceStateMeta(devicesStore.selectedDevice.connectionState).label }}
        </template>
        <template v-else>No device selected</template>
      </span>
    </header>

    <NAlert
      v-if="adbAvailability && !adbAvailability.available"
      type="error"
      title="ADB is not available"
      class="shrink-0 rounded-none"
    >
      {{ adbAvailability.reason }}
      <NButton size="tiny" class="mt-2" @click="router.push({ name: 'settings' })">
        Go to Settings
      </NButton>
    </NAlert>

    <div class="flex min-h-0 flex-1">
      <DeviceSidebar />

      <main class="flex min-w-0 flex-1 flex-col">
        <NTabs
          :value="String(route.name ?? 'overview')"
          type="line"
          size="small"
          class="shrink-0 px-4 pt-2"
          @update:value="onTabUpdate"
        >
          <NTabPane v-for="tab in tabs" :key="tab.name" :name="tab.name">
            <template #tab>
              <span class="flex items-center gap-1">
                <NIcon :component="tab.icon" />
                {{ tab.label }}
              </span>
            </template>
          </NTabPane>
        </NTabs>

        <div class="min-h-0 flex-1 overflow-auto p-4">
          <RouterView />
        </div>
      </main>
    </div>

    <footer
      class="flex h-6 shrink-0 items-center justify-end border-t border-border px-4 text-[11px] text-gray-400 dark:text-gray-500"
    >
      <span v-if="appInfo"
        >droid.or v{{ appInfo.appVersion }} · Electron {{ appInfo.electronVersion }}</span
      >
      <span v-else>droid.or</span>
    </footer>
  </div>
</template>
