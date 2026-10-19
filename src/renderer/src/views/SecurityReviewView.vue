<script setup lang="ts">
import { NAlert, NButton, NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui'
import { computed, watch } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import { useSecurityReviewStore } from '@renderer/stores/security-review.store'
import {
  formatInstallSource,
  formatInstalledDate,
  isFromPlayStore
} from '@renderer/utils/format-package-value'

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
  <DeviceGate
    requirement="A security review requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to run a security review on it."
  >
    <div class="flex h-full flex-col gap-3">
      <PageHeader title="Security">
        <template #actions>
          <NButton
            type="primary"
            size="small"
            :loading="securityReviewStore.loading || packagesStore.loading"
            @click="runReview"
          >
            {{ securityReviewStore.result ? 'Re-run Review' : 'Run Review' }}
          </NButton>
        </template>
      </PageHeader>

      <NCollapse :default-expanded-names="['scope']" class="shrink-0 border border-border">
        <NCollapseItem title="This is not a virus scanner" name="scope">
          <p class="text-sm text-text-secondary">
            This surfaces a few things a non-rooted ADB connection can actually see — it cannot
            inspect your router, network traffic, firmware, or the kernel. Holding Device Admin or
            an Accessibility Service is normal for many legitimate apps (device managers, launchers,
            screen readers). Nothing below is a verdict — it's raw material for you to recognize or
            not recognize.
          </p>
        </NCollapseItem>
      </NCollapse>

      <NAlert v-if="securityReviewStore.errorMessage" type="error" title="Review failed">
        {{ securityReviewStore.errorMessage }}
      </NAlert>

      <EmptyState
        v-else-if="!securityReviewStore.result && !securityReviewStore.loading"
        title="No review yet"
        description="Run a review to see device admin apps, accessibility services and app install sources."
        class="flex-1"
      />

      <NSpin
        v-else
        :show="securityReviewStore.loading || packagesStore.loading"
        class="min-h-0 flex-1"
      >
        <div class="flex h-full flex-col gap-4 overflow-y-auto pr-1">
          <section class="rounded-lg border border-border bg-surface p-3">
            <h3 class="flex items-center gap-2 text-sm font-medium text-text">
              Device Admin apps
              <span
                class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted"
              >
                {{ deviceAdminApps.length }}
              </span>
            </h3>
            <p class="mt-1 text-xs text-text-muted">
              Can make itself hard to remove normally. Real examples: MDM/work-profile tools,
              "hibernate background apps" utilities, Find My Device.
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="pkg in deviceAdminApps"
                :key="pkg"
                class="rounded-md border border-border p-2 text-sm"
              >
                <AppIdentity :label="displayLabel(pkg)" :package-name="pkg" size="sm" />
              </div>
              <p v-if="deviceAdminApps.length === 0" class="text-xs text-text-muted">None.</p>
            </div>
          </section>

          <section class="rounded-lg border border-border bg-surface p-3">
            <h3 class="flex items-center gap-2 text-sm font-medium text-text">
              Accessibility services
              <span
                class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted"
              >
                {{ accessibilityApps.length }}
              </span>
            </h3>
            <p class="mt-1 text-xs text-text-muted">
              Can observe and interact with the screen. Real examples: screen readers, launchers,
              automation tools.
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="pkg in accessibilityApps"
                :key="pkg"
                class="rounded-md border border-border p-2 text-sm"
              >
                <AppIdentity :label="displayLabel(pkg)" :package-name="pkg" size="sm" />
              </div>
              <p v-if="accessibilityApps.length === 0" class="text-xs text-text-muted">None.</p>
            </div>
          </section>

          <section class="rounded-lg border border-border bg-surface p-3">
            <h3 class="flex items-center gap-2 text-sm font-medium text-text">
              Apps not installed from the Play Store
              <span
                class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted"
              >
                {{ nonPlayStoreApps.length }}
              </span>
            </h3>
            <p class="mt-1 text-xs text-text-muted">
              User-installed apps only — a system app with no recorded installer is normal
              (preloaded by the manufacturer) and not included here.
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="pkg in nonPlayStoreApps"
                :key="pkg.packageName"
                class="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
              >
                <AppIdentity
                  :label="displayLabel(pkg.packageName)"
                  :package-name="pkg.packageName"
                  size="sm"
                />
                <NTag size="small">{{ formatInstallSource(pkg.installerPackage) }}</NTag>
              </div>
              <p v-if="nonPlayStoreApps.length === 0" class="text-xs text-text-muted">None.</p>
            </div>
          </section>

          <section class="rounded-lg border border-border bg-surface p-3">
            <h3 class="flex items-center gap-2 text-sm font-medium text-text">
              Most recently installed or updated
              <span
                class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted"
              >
                {{ recentlyChangedApps.length }}
              </span>
            </h3>
            <p class="mt-1 text-xs text-text-muted">
              The 15 most recent, across all apps — useful for cross-checking against a specific
              date you're concerned about.
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="pkg in recentlyChangedApps"
                :key="pkg.packageName"
                class="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm"
              >
                <AppIdentity
                  :label="displayLabel(pkg.packageName)"
                  :package-name="pkg.packageName"
                  size="sm"
                  class="min-w-0"
                />
                <span class="shrink-0 text-xs text-text-muted">
                  installed {{ formatInstalledDate(pkg.firstInstallTimeMs) }} · updated
                  {{ formatInstalledDate(pkg.lastUpdateTimeMs) }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </NSpin>
    </div>
  </DeviceGate>
</template>
