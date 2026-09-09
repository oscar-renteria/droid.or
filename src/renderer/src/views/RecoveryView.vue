<script setup lang="ts">
import type { OperationType } from '@shared/types/operation'
import { NAlert, NButton, NCheckbox, NEmpty, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import OperationConfirmDialog from '@renderer/components/OperationConfirmDialog.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import { useRecoveryStore } from '@renderer/stores/recovery.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const devicesStore = useDevicesStore()
const packagesStore = usePackagesStore()
const recoveryStore = useRecoveryStore()
const operationsStore = useOperationsStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

async function loadChanges(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    recoveryStore.reset()
    return
  }
  await recoveryStore.load(device.id)
}

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  loadChanges,
  { immediate: true }
)

/** Best-effort only — the real label/icon requires the package's APK path,
 *  which is only known once the Apps tab has resolved it this session. A
 *  package that no longer exists on the device at all (fully uninstalled)
 *  can never have one, and correctly falls back to its raw name. */
function displayName(packageName: string): string {
  const cached = packagesStore.metadataCache.get(packageName)
  return cached && cached !== 'loading' && cached.label ? cached.label : packageName
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

const reviewOpen = ref(false)
const selected = ref(new Set<string>())

function toggleSelected(packageName: string, value: boolean): void {
  if (value) {
    selected.value.add(packageName)
  } else {
    selected.value.delete(packageName)
  }
  // Force reactivity: Set mutation alone doesn't trigger Vue's tracking.
  selected.value = new Set(selected.value)
}

watch(
  () => recoveryStore.changes,
  () => {
    selected.value = new Set()
  }
)

const restorableUninstalled = computed(
  () => recoveryStore.changes?.uninstalled.filter((entry) => entry.restorable) ?? []
)
const blockedUninstalled = computed(
  () => recoveryStore.changes?.uninstalled.filter((entry) => !entry.restorable) ?? []
)

const totalChanges = computed(() => {
  const changes = recoveryStore.changes
  if (!changes) {
    return 0
  }
  return changes.disabled.length + changes.uninstalled.length + changes.cleared.length
})

const restorableTargets = computed(
  (): Array<{ packageName: string; operation: 'enable' | 'restore-install' }> => [
    ...(recoveryStore.changes?.disabled.map((entry) => ({
      packageName: entry.packageName,
      operation: 'enable' as const
    })) ?? []),
    ...restorableUninstalled.value.map((entry) => ({
      packageName: entry.packageName,
      operation: 'restore-install' as const
    }))
  ]
)

const selectedTargets = computed(() =>
  restorableTargets.value.filter((target) => selected.value.has(target.packageName))
)

// --- Single-package restore, via the same dialog every other action uses ---

const confirmTarget = ref<{ packageName: string; operation: OperationType } | null>(null)
const dialogVisible = computed({
  get: () => confirmTarget.value !== null,
  set: (value: boolean) => {
    if (!value) {
      confirmTarget.value = null
    }
  }
})

function openRestoreConfirm(packageName: string, operation: 'enable' | 'restore-install'): void {
  confirmTarget.value = { packageName, operation }
}

async function handleSingleConfirm(): Promise<void> {
  const device = selectedDevice.value
  const target = confirmTarget.value
  if (!device || !target) {
    return
  }
  confirmTarget.value = null
  const { succeeded, failed } = await recoveryStore.restoreMany(device.id, [
    { packageName: target.packageName, operation: target.operation as 'enable' | 'restore-install' }
  ])
  if (succeeded > 0) {
    message.success('Restored successfully.')
  } else if (failed > 0) {
    message.error('Restore failed — see the operation history for details.')
  }
}

// --- Bulk restore ("Restore All Changes" / "Restore Selected") ---

const bulkConfirmVisible = ref(false)
const bulkTargets = ref<Array<{ packageName: string; operation: 'enable' | 'restore-install' }>>([])

function openBulkConfirm(
  targets: Array<{ packageName: string; operation: 'enable' | 'restore-install' }>
): void {
  if (targets.length === 0) {
    return
  }
  bulkTargets.value = targets
  bulkConfirmVisible.value = true
}

const bulkEnableCount = computed(
  () => bulkTargets.value.filter((t) => t.operation === 'enable').length
)
const bulkReinstallCount = computed(
  () => bulkTargets.value.filter((t) => t.operation === 'restore-install').length
)

async function confirmBulkRestore(): Promise<void> {
  const device = selectedDevice.value
  if (!device) {
    return
  }
  bulkConfirmVisible.value = false
  const targets = bulkTargets.value
  const { succeeded, failed } = await recoveryStore.restoreMany(device.id, targets)
  if (failed === 0) {
    message.success(`Restored ${succeeded} of ${targets.length} package(s).`)
  } else {
    message.warning(`Restored ${succeeded} of ${targets.length} package(s) — ${failed} failed.`)
  }
}
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to review and restore changes made to it.
    </p>
  </div>

  <div
    v-else-if="selectedDevice.connectionState !== 'device'"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">
      {{ getDeviceStateMeta(selectedDevice.connectionState).label }}
    </h2>
    <p class="max-w-md text-sm text-text-muted">
      {{
        getDeviceStateMeta(selectedDevice.connectionState).guidance ??
        'Device recovery requires an authorized, connected device.'
      }}
    </p>
  </div>

  <NSpin v-else :show="recoveryStore.loading" class="h-full">
    <div class="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <NAlert v-if="recoveryStore.errorMessage" type="error" title="Failed to load device changes">
        {{ recoveryStore.errorMessage }}
      </NAlert>

      <NEmpty
        v-else-if="!recoveryStore.loading && totalChanges === 0"
        description="No changes detected on this device"
        class="flex-1 items-center justify-center"
      >
        <template #extra>
          <p class="max-w-md text-center text-xs text-text-muted">
            droid.or hasn't modified this device, or every change already made has since been
            restored.
          </p>
        </template>
      </NEmpty>

      <template v-else-if="recoveryStore.changes">
        <div>
          <h2 class="text-lg font-medium text-text">Device Recovery</h2>
          <p class="text-sm text-text-muted">This device has been modified by droid.or.</p>
        </div>

        <div class="rounded border border-border p-3 text-sm">
          <span class="font-medium text-text">Changes detected:</span>
          <ul class="mt-1 list-inside list-disc text-text-secondary">
            <li>{{ recoveryStore.changes.uninstalled.length }} package(s) uninstalled</li>
            <li>{{ recoveryStore.changes.disabled.length }} package(s) disabled</li>
            <li>{{ recoveryStore.changes.cleared.length }} package(s) cleared</li>
          </ul>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <NButton
            type="primary"
            :disabled="restorableTargets.length === 0"
            :loading="recoveryStore.bulkRestoring"
            @click="openBulkConfirm(restorableTargets)"
          >
            Restore All Changes
          </NButton>
          <NButton @click="reviewOpen = !reviewOpen">
            {{ reviewOpen ? 'Hide Changes' : 'Review Changes' }}
          </NButton>
          <NButton
            v-if="reviewOpen"
            :disabled="selectedTargets.length === 0"
            :loading="recoveryStore.bulkRestoring"
            @click="openBulkConfirm(selectedTargets)"
          >
            Restore Selected ({{ selectedTargets.length }})
          </NButton>
        </div>

        <div v-if="reviewOpen" class="flex flex-col gap-4">
          <div v-if="recoveryStore.changes.disabled.length > 0">
            <h3 class="text-sm font-medium text-text">Disabled</h3>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="entry in recoveryStore.changes.disabled"
                :key="`disabled-${entry.packageName}`"
                class="flex items-center gap-3 rounded border border-border p-2 text-sm"
              >
                <NCheckbox
                  :checked="selected.has(entry.packageName)"
                  @update:checked="(v: boolean) => toggleSelected(entry.packageName, v)"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium text-text">
                    {{ displayName(entry.packageName) }}
                  </div>
                  <div class="truncate text-xs text-text-muted">
                    {{ entry.packageName }} · disabled {{ formatTimestamp(entry.performedAt) }}
                  </div>
                </div>
                <NButton
                  size="small"
                  :loading="operationsStore.pending.has(entry.packageName)"
                  @click="openRestoreConfirm(entry.packageName, 'enable')"
                >
                  Restore
                </NButton>
              </div>
            </div>
          </div>

          <div v-if="recoveryStore.changes.uninstalled.length > 0">
            <h3 class="text-sm font-medium text-text">Uninstalled</h3>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="entry in [...restorableUninstalled, ...blockedUninstalled]"
                :key="`uninstalled-${entry.packageName}`"
                class="flex flex-col gap-1 rounded border border-border p-2 text-sm"
              >
                <div class="flex items-center gap-3">
                  <NCheckbox
                    v-if="entry.restorable"
                    :checked="selected.has(entry.packageName)"
                    @update:checked="(v: boolean) => toggleSelected(entry.packageName, v)"
                  />
                  <NTag v-else size="small" type="warning">Not restorable</NTag>
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-text">
                      {{ displayName(entry.packageName) }}
                    </div>
                    <div class="truncate text-xs text-text-muted">
                      {{ entry.packageName }} · uninstalled {{ formatTimestamp(entry.performedAt) }}
                    </div>
                  </div>
                  <NButton
                    v-if="entry.restorable"
                    size="small"
                    :loading="operationsStore.pending.has(entry.packageName)"
                    @click="openRestoreConfirm(entry.packageName, 'restore-install')"
                  >
                    Restore
                  </NButton>
                </div>
                <p v-if="!entry.restorable" class="pl-1 text-xs text-text-muted">
                  {{ entry.blockedReason }}
                </p>
              </div>
            </div>
          </div>

          <div v-if="recoveryStore.changes.cleared.length > 0">
            <h3 class="text-sm font-medium text-text">Cleared</h3>
            <p class="mt-1 text-xs text-text-muted">
              Clearing app data cannot be undone — these are listed for reference only.
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="entry in recoveryStore.changes.cleared"
                :key="`cleared-${entry.packageName}`"
                class="flex items-center gap-3 rounded border border-border p-2 text-sm"
              >
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium text-text">
                    {{ displayName(entry.packageName) }}
                  </div>
                  <div class="truncate text-xs text-text-muted">
                    {{ entry.packageName }} · cleared {{ formatTimestamp(entry.performedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </NSpin>

  <OperationConfirmDialog
    v-if="confirmTarget"
    v-model:show="dialogVisible"
    :package-name="confirmTarget.packageName"
    :display-name="displayName(confirmTarget.packageName)"
    :operation="confirmTarget.operation"
    :is-system-app="false"
    :risk="null"
    :is-favorite="false"
    @confirm="handleSingleConfirm"
  />

  <NModal
    v-model:show="bulkConfirmVisible"
    preset="dialog"
    title="Restore these changes?"
    type="warning"
  >
    <div class="flex flex-col gap-2 text-sm text-text-secondary">
      <p>This will attempt to restore {{ bulkTargets.length }} package(s):</p>
      <ul class="list-inside list-disc">
        <li v-if="bulkEnableCount > 0">Enable {{ bulkEnableCount }} disabled package(s)</li>
        <li v-if="bulkReinstallCount > 0">
          Reinstall {{ bulkReinstallCount }} uninstalled package(s) for this user
        </li>
      </ul>
      <p class="text-xs text-text-muted">
        This restores changes made by droid.or only — it is not a factory reset and does not touch
        firmware or system partitions.
      </p>
    </div>
    <template #action>
      <NButton @click="bulkConfirmVisible = false">Cancel</NButton>
      <NButton type="warning" @click="confirmBulkRestore">Confirm</NButton>
    </template>
  </NModal>
</template>
