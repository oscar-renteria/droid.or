<script setup lang="ts">
import { NAlert, NButton, NIcon } from 'naive-ui'
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
  { name: 'install', label: 'Install', icon: DownloadOutline },
  { name: 'analyzer', label: 'Analyzer', icon: AnalyticsOutline },
  { name: 'profiles', label: 'Profiles', icon: LayersOutline },
  { name: 'history', label: 'History', icon: TimeOutline },
  { name: 'recovery', label: 'Recovery', icon: ArrowUndoOutline },
  { name: 'security', label: 'Security', icon: ShieldCheckmarkOutline }
]

const isActive = (name: string): boolean => route.name === name

// §3.3 — grouped device-view tabs. Settings and Logs move to the header;
// route names stay unchanged.
const navGroups: Array<Array<{ name: string; label: string; icon: Component }>> = [
  tabs.slice(0, 3),
  tabs.slice(3, 5),
  tabs.slice(5, 7),
  tabs.slice(7)
]
</script>

<template>
  <div class="flex h-screen w-screen flex-col bg-background text-text">
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div class="flex items-center gap-2 shrink-0">
        <div
          class="h-5 w-5 rounded bg-brand flex items-center justify-center text-on-primary text-xs font-medium"
          aria-label="droid.or brand mark"
        >
          d
        </div>
        <span class="font-semibold text-text">droid.or</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0 text-xs text-text-secondary">
        <span v-if="devicesStore.selectedDevice" class="flex items-center gap-1">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :class="getDeviceStateMeta(devicesStore.selectedDevice.connectionState).dotClass"
            aria-hidden="true"
          />
          {{
            devicesStore.selectedDevice.nickname ??
            devicesStore.selectedDevice.model ??
            devicesStore.selectedDevice.id
          }}
        </span>
        <span v-if="devicesStore.selectedDevice">·</span>
        <span>
          {{
            devicesStore.selectedDevice
              ? getDeviceStateMeta(devicesStore.selectedDevice.connectionState).label
              : 'No device selected'
          }}
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <NButton
          size="small"
          quaternary
          :aria-current="isActive('logs') ? 'page' : undefined"
          :class="isActive('logs') ? 'text-primary' : ''"
          @click="router.push({ name: 'logs' })"
        >
          <NIcon :component="DocumentTextOutline" size="14" class="mr-1" />
          Logs
        </NButton>
        <NButton
          size="small"
          quaternary
          :aria-current="isActive('settings') ? 'page' : undefined"
          :class="isActive('settings') ? 'text-primary' : ''"
          @click="router.push({ name: 'settings' })"
        >
          <NIcon :component="SettingsOutline" size="14" class="mr-1" />
          Settings
        </NButton>
      </div>
    </header>

    <NAlert
      v-if="adbAvailability && !adbAvailability.available"
      type="error"
      title="ADB is not available"
      class="shrink-0 rounded-none"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-secondary">{{ adbAvailability.reason }}</span>
        <NButton size="small" @click="router.push({ name: 'settings' })">Go to Settings</NButton>
      </div>
    </NAlert>

    <div class="flex min-h-0 flex-1">
      <DeviceSidebar />

      <main class="flex min-w-0 flex-1 flex-col">
      <nav
        aria-label="Device views"
        class="flex shrink-0 items-center gap-1 px-4 pt-2 pb-1 overflow-x-auto border-b border-border"
      >
        <div
          v-for="(group, gi) in navGroups"
          :key="gi"
          class="flex items-center gap-1"
        >
          <RouterLink
            v-for="tab in group"
            :key="tab.name"
            :to="{ name: tab.name }"
            class="px-3 py-1.5 text-xs font-medium text-text-secondary rounded-md transition-colors border-b-2 border-transparent"
            :class="{ 'text-primary border-b-2 border-primary': isActive(tab.name) }"
          >
            <NIcon :component="tab.icon" size="13" class="mr-1" />
            {{ tab.label }}
          </RouterLink>
          <div
            v-if="gi < navGroups.length - 1"
            class="w-px h-5 bg-border mx-1"
            aria-hidden="true"
          />
        </div>
      </nav>

        <div class="min-h-0 flex-1 overflow-auto p-4">
          <RouterView />
        </div>
      </main>
    </div>

    <footer
      class="flex h-6 shrink-0 items-center justify-end border-t border-border px-4 text-xs text-text-muted"
    >
      <span v-if="appInfo"
        >droid.or v{{ appInfo.appVersion }} · Electron {{ appInfo.electronVersion }}</span
      >
      <span v-else>droid.or</span>
    </footer>
  </div>
</template>
