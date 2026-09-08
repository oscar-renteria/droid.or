<script setup lang="ts">
import { NAlert, NButton, NEmpty, NSpin, NTag } from 'naive-ui'
import { computed, watch } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import { useSecurityReviewStore } from '@renderer/stores/security-review.store'
import {
  formatInstallSource,
  formatInstalledDate,
  isFromPlayStore
} from '@renderer/utils/format-package-value'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const devicesStore = useDevicesStore()
const packagesStore = usePackagesStore()
const securityReviewStore = useSecurityReviewStore()

const selectedDevice = computed(() => devicesStore.selectedDevice)

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  () => {
    securityReviewStore.reset()
  }
)

async function runReview(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    return
  }
  const needsPackages = packagesStore.loadedForDeviceId !== device.id
  await Promise.all([
    securityReviewStore.review(device.id),
    needsPackages ? packagesStore.fetchPackages(device.id) : Promise.resolve()
  ])
}

function metadataFor(packageName: string) {
  const cached = packagesStore.metadataCache.get(packageName)
  return cached && cached !== 'loading' ? cached : null
}

function displayLabel(packageName: string): string {
  const packageInfo = packagesStore.packages.find((p) => p.packageName === packageName)
  return metadataFor(packageName)?.label ?? packageInfo?.displayName ?? packageName
}

const deviceAdminApps = computed(() => securityReviewStore.result?.deviceAdminPackages ?? [])
const accessibilityApps = computed(
  () => securityReviewStore.result?.accessibilityServicePackages ?? []
)

/** Third-party (user-installed) apps not from the Play Store — a system
 *  app with no installer recorded is normal (OEM-preloaded) and
 *  deliberately excluded here, since flagging nearly every system app
 *  would be noise, not signal. */
const nonPlayStoreApps = computed(() =>
  packagesStore.packages.filter((pkg) => !pkg.isSystemApp && !isFromPlayStore(pkg.installerPackage))
)

const recentlyChangedApps = computed(() => {
  const withDate = packagesStore.packages
    .map((pkg) => ({
      pkg,
      latestMs: Math.max(pkg.firstInstallTimeMs ?? 0, pkg.lastUpdateTimeMs ?? 0)
    }))
    .filter((entry) => entry.latestMs > 0)
  withDate.sort((a, b) => b.latestMs - a.latestMs)
  return withDate.slice(0, 15).map((entry) => entry.pkg)
})
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">No device selected</h2>
    <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
      Select a device from the sidebar to run a security review on it.
    </p>
  </div>

  <div
    v-else-if="selectedDevice.connectionState !== 'device'"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
      {{ getDeviceStateMeta(selectedDevice.connectionState).label }}
    </h2>
    <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
      {{
        getDeviceStateMeta(selectedDevice.connectionState).guidance ??
        'A security review requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Security Review</h2>
      <NButton
        type="primary"
        :loading="securityReviewStore.loading || packagesStore.loading"
        @click="runReview"
      >
        {{ securityReviewStore.result ? 'Re-run Review' : 'Run Review' }}
      </NButton>
    </div>

    <NAlert type="warning" title="This is not a virus scanner" :show-icon="true" class="shrink-0">
      This surfaces a few things a non-rooted ADB connection can actually see — it cannot inspect
      your router, network traffic, firmware, or the kernel. Holding Device Admin or an
      Accessibility Service is normal for many legitimate apps (device managers, launchers, screen
      readers). Nothing below is a verdict — it's raw material for you to recognize or not
      recognize.
    </NAlert>

    <NAlert v-if="securityReviewStore.errorMessage" type="error" title="Review failed">
      {{ securityReviewStore.errorMessage }}
    </NAlert>

    <NEmpty
      v-else-if="!securityReviewStore.result && !securityReviewStore.loading"
      description="Run a review to see what's below"
      class="flex-1 items-center justify-center"
    />

    <NSpin
      v-else
      :show="securityReviewStore.loading || packagesStore.loading"
      class="min-h-0 flex-1"
    >
      <div class="flex h-full flex-col gap-4 overflow-y-auto pr-1">
        <section>
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Device Admin apps ({{ deviceAdminApps.length }})
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Can make itself hard to remove normally. Real examples: MDM/work-profile tools,
            "hibernate background apps" utilities, Find My Device.
          </p>
          <div class="mt-2 flex flex-col gap-2">
            <div
              v-for="pkg in deviceAdminApps"
              :key="pkg"
              class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
            >
              <span class="font-medium text-gray-900 dark:text-gray-100">{{
                displayLabel(pkg)
              }}</span>
              <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{ pkg }}</span>
            </div>
            <p v-if="deviceAdminApps.length === 0" class="text-xs text-gray-500 dark:text-gray-400">
              None.
            </p>
          </div>
        </section>

        <section>
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Accessibility services ({{ accessibilityApps.length }})
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Can observe and interact with the screen. Real examples: screen readers, launchers,
            automation tools.
          </p>
          <div class="mt-2 flex flex-col gap-2">
            <div
              v-for="pkg in accessibilityApps"
              :key="pkg"
              class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
            >
              <span class="font-medium text-gray-900 dark:text-gray-100">{{
                displayLabel(pkg)
              }}</span>
              <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{ pkg }}</span>
            </div>
            <p
              v-if="accessibilityApps.length === 0"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              None.
            </p>
          </div>
        </section>

        <section>
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Apps not installed from the Play Store ({{ nonPlayStoreApps.length }})
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            User-installed apps only — a system app with no recorded installer is normal (preloaded
            by the manufacturer) and not included here.
          </p>
          <div class="mt-2 flex flex-col gap-2">
            <div
              v-for="pkg in nonPlayStoreApps"
              :key="pkg.packageName"
              class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{
                  displayLabel(pkg.packageName)
                }}</span>
                <NTag size="small">{{ formatInstallSource(pkg.installerPackage) }}</NTag>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ pkg.packageName }}</span>
            </div>
            <p
              v-if="nonPlayStoreApps.length === 0"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              None.
            </p>
          </div>
        </section>

        <section>
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Most recently installed or updated
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            The 15 most recent, across all apps — useful for cross-checking against a specific date
            you're concerned about.
          </p>
          <div class="mt-2 flex flex-col gap-2">
            <div
              v-for="pkg in recentlyChangedApps"
              :key="pkg.packageName"
              class="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
            >
              <div>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{
                  displayLabel(pkg.packageName)
                }}</span>
                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{
                  pkg.packageName
                }}</span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                installed {{ formatInstalledDate(pkg.firstInstallTimeMs) }} · updated
                {{ formatInstalledDate(pkg.lastUpdateTimeMs) }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </NSpin>
  </div>
</template>
