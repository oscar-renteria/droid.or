<script setup lang="ts">
import { NAlert, NButton, NIcon } from 'naive-ui'
import {
  AnalyticsOutline,
  ArrowUpCircleOutline,
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
import { onMounted, onUnmounted, ref } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdbAvailability } from '@renderer/composables/useAdbAvailability'
import { useAppInfo } from '@renderer/composables/useAppInfo'
import { useSupportLink } from '@renderer/composables/useSupportLink'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useUpdateStore } from '@renderer/stores/update.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import AboutModal from '@renderer/components/AboutModal.vue'
import DeviceSidebar from './DeviceSidebar.vue'

const route = useRoute()
const router = useRouter()
const { appInfo } = useAppInfo()
const { adbAvailability } = useAdbAvailability()
const { opening: openingSupportLink, openSupportLink } = useSupportLink()
const devicesStore = useDevicesStore()
const updateStore = useUpdateStore()
const showAboutModal = ref(false)

async function handlePayPalClick(): Promise<void> {
  await openSupportLink('paypal')
}

onMounted(() => {
  void devicesStore.initialize()
  void updateStore.load()
})
onUnmounted(() => {
  devicesStore.dispose()
})

const tabs: Array<{ name: string; label: string; icon: Component }> = [
  { name: 'install', label: 'Install', icon: DownloadOutline },
  { name: 'overview', label: 'Overview', icon: HomeOutline },
  { name: 'apps', label: 'Apps', icon: AppsOutline },
  { name: 'analyzer', label: 'Analyzer', icon: AnalyticsOutline },
  { name: 'profiles', label: 'Profiles', icon: LayersOutline },
  { name: 'recovery', label: 'Recovery', icon: ArrowUndoOutline },
  { name: 'security', label: 'Security', icon: ShieldCheckmarkOutline },
  { name: 'history', label: 'History', icon: TimeOutline }
]

const isActive = (name: string): boolean => route.name === name

const navGroups = [
  { label: 'Install', tabs: tabs.slice(0, 1) },
  { label: 'Device views', tabs: tabs.slice(1, 3) },
  { label: 'Device tools', tabs: tabs.slice(3, 7) },
  { label: 'History', tabs: tabs.slice(7) }
]
</script>

<template>
  <div class="flex h-screen w-screen flex-col bg-background text-text">
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div class="flex items-center gap-2 shrink-0">
        <div
          class="h-5 w-5 rounded bg-brand flex items-center justify-center text-on-primary text-xs font-medium"
          aria-hidden="true"
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
          {{ deviceDisplayName(devicesStore.selectedDevice) }}
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
          v-if="updateStore.updateAvailable"
          size="small"
          type="info"
          quaternary
          :title="`droid.or ${updateStore.latestVersion} is available — opens the release page in your browser`"
          @click="updateStore.openReleasePage()"
        >
          <template #icon>
            <NIcon :component="ArrowUpCircleOutline" :size="14" />
          </template>
          Update {{ updateStore.latestVersion }}
        </NButton>
        <NButton
          size="small"
          type="primary"
          secondary
          class="app-shell-support-action"
          :loading="openingSupportLink"
          @click="openSupportLink('github-sponsors')"
        >
          Sponsor on GitHub
        </NButton>
        <NButton
          size="small"
          type="primary"
          secondary
          class="app-shell-support-action"
          :loading="openingSupportLink"
          @click="handlePayPalClick"
        >
          Donate with PayPal
        </NButton>
        <NButton
          size="small"
          quaternary
          :type="isActive('logs') ? 'primary' : 'default'"
          :aria-current="isActive('logs') ? 'page' : undefined"
          @click="router.push({ name: 'logs' })"
        >
          <template #icon>
            <NIcon :component="DocumentTextOutline" :size="14" />
          </template>
          Logs
        </NButton>
        <NButton
          size="small"
          quaternary
          :type="isActive('settings') ? 'primary' : 'default'"
          :aria-current="isActive('settings') ? 'page' : undefined"
          @click="router.push({ name: 'settings' })"
        >
          <template #icon>
            <NIcon :component="SettingsOutline" :size="14" />
          </template>
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
          class="flex shrink-0 items-end gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-4 pt-2"
        >
          <div
            v-for="(group, gi) in navGroups"
            :key="group.label"
            role="group"
            :aria-label="group.label"
            class="flex items-end gap-1"
            :class="gi === 0 ? 'mr-3' : ''"
          >
            <RouterLink
              v-for="tab in group.tabs"
              :key="tab.name"
              :to="{ name: tab.name }"
              :aria-current="isActive(tab.name) ? 'page' : undefined"
              class="relative inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              :class="
                tab.name === 'install'
                  ? `rounded-md focus-visible:outline-on-primary ${
                      isActive(tab.name)
                        ? 'bg-primary-pressed text-on-primary after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:bg-on-primary after:content-[\'\']'
                        : 'bg-primary text-on-primary hover:bg-primary-hover'
                    }`
                  : `rounded-t-md focus-visible:outline-primary ${
                      isActive(tab.name)
                        ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary after:content-[\'\']'
                        : 'text-text-secondary hover:bg-surface hover:text-text'
                    }`
              "
            >
              <NIcon :component="tab.icon" :size="14" aria-hidden="true" />
              {{ tab.label }}
            </RouterLink>
            <div
              v-if="gi < navGroups.length - 1"
              class="mx-1 mb-2 h-5 w-px bg-border"
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
      <button
        type="button"
        class="rounded-sm hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-haspopup="dialog"
        :aria-expanded="showAboutModal"
        @click="showAboutModal = true"
      >
        <template v-if="appInfo">
          droid.or v{{ appInfo.appVersion }} · Electron {{ appInfo.electronVersion }}
        </template>
        <template v-else>droid.or</template>
      </button>
      <AboutModal v-model:show="showAboutModal" />
    </footer>
  </div>
</template>

<style>
.n-button.app-shell-support-action > .n-button__content {
  color: var(--color-primary-pressed);
}

:root.dark .n-button.app-shell-support-action > .n-button__content {
  color: var(--color-primary);
}

.n-button.app-shell-support-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
