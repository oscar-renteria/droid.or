<script setup lang="ts">
import { NAlert, NTabPane, NTabs } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
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

const tabs: Array<{ name: string; label: string }> = [
  { name: 'overview', label: 'Overview' },
  { name: 'apps', label: 'Apps' },
  { name: 'analyzer', label: 'Analyzer' },
  { name: 'history', label: 'History' },
  { name: 'recovery', label: 'Recovery' },
  { name: 'settings', label: 'Settings' },
  { name: 'logs', label: 'Logs' }
]

function onTabUpdate(name: string): void {
  void router.push({ name })
}
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100"
  >
    <header
      class="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800"
    >
      <span class="text-sm font-semibold">droid.or</span>
      <span class="text-xs text-gray-500 dark:text-gray-400">
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
    </NAlert>

    <div class="flex min-h-0 flex-1">
      <DeviceSidebar />

      <main class="flex min-w-0 flex-1 flex-col">
        <NTabs
          :value="String(route.name ?? 'overview')"
          type="line"
          class="shrink-0 px-4 pt-2"
          @update:value="onTabUpdate"
        >
          <NTabPane v-for="tab in tabs" :key="tab.name" :name="tab.name">
            <template #tab>{{ tab.label }}</template>
          </NTabPane>
        </NTabs>

        <div class="min-h-0 flex-1 overflow-auto p-4">
          <RouterView />
        </div>
      </main>
    </div>

    <footer
      class="flex h-6 shrink-0 items-center justify-end border-t border-gray-200 px-4 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500"
    >
      <span v-if="appInfo"
        >droid.or v{{ appInfo.appVersion }} · Electron {{ appInfo.electronVersion }}</span
      >
      <span v-else>droid.or</span>
    </footer>
  </div>
</template>
