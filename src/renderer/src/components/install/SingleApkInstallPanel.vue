<script setup lang="ts">
import { NButton, NIcon, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { WarningOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import { useApkInstallStore } from '@renderer/stores/apk-install.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { formatBytes } from '@renderer/utils/format-bytes'
import { PLAN_META } from '@renderer/utils/install-plan-meta'

const devicesStore = useDevicesStore()
const apkInstallStore = useApkInstallStore()
const message = useMessage()

/** Fallback label when the APK's metadata hasn't been read yet — mirrors
 *  what the queue row would have hand-rolled before AppIdentity. */
function rowLabel(filePath: string): string {
  const item = apkInstallStore.queue.find((entry) => entry.filePath === filePath)
  return item?.info?.label ?? item?.info?.packageName ?? filePath.split(/[\\/]/).pop() ?? filePath
}

async function installOne(filePath: string): Promise<void> {
  const device = devicesStore.selectedDevice
  const item = apkInstallStore.queue.find((entry) => entry.filePath === filePath)
  if (!device || !item) {
    return
  }
  await apkInstallStore.installItem(device.id, item.filePath)
  if (item.status === 'success') {
    message.success(item.message ?? 'Installed.')
  } else if (item.status === 'failed') {
    message.error(item.message ?? 'Install failed.')
  }
}

const readyItems = computed(() => apkInstallStore.queue.filter((item) => item.status === 'ready'))
const bulkConfirmVisible = ref(false)

function openBulkConfirm(): void {
  if (readyItems.value.length === 0) {
    return
  }
  bulkConfirmVisible.value = true
}

async function confirmInstallAll(): Promise<void> {
  const device = devicesStore.selectedDevice
  bulkConfirmVisible.value = false
  if (!device) {
    return
  }
  await apkInstallStore.installAll(device.id)
  const succeeded = apkInstallStore.queue.filter((item) => item.status === 'success').length
  const failed = apkInstallStore.queue.filter((item) => item.status === 'failed').length
  if (failed === 0) {
    message.success(`Installed ${succeeded} app(s).`)
  } else {
    message.warning(`Installed ${succeeded} app(s) — ${failed} failed.`)
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-sm font-semibold text-text">Install APK</h2>
      <NButton
        v-if="readyItems.length > 0"
        type="primary"
        size="small"
        :loading="apkInstallStore.installingAll"
        @click="openBulkConfirm"
      >
        Install All ({{ readyItems.length }})
      </NButton>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
      <div
        v-for="item in apkInstallStore.queue"
        :key="item.filePath"
        class="flex items-start gap-3 rounded border border-border p-3"
      >
        <NSpin v-if="item.status === 'inspecting'" :size="24" class="mt-1 shrink-0" />
        <AppIdentity
          v-else
          :label="rowLabel(item.filePath)"
          :package-name="item.info?.packageName ?? item.filePath"
          :icon-data-url="item.info?.iconDataUrl ?? null"
          size="md"
        />

        <div class="min-w-0 flex-1">
          <p v-if="item.status === 'inspecting'" class="mt-1 text-sm text-text-secondary">
            Reading {{ rowLabel(item.filePath) }}…
          </p>
          <template v-else-if="item.status === 'error'">
            <NTag size="small" type="error">Can't read file</NTag>
            <div class="truncate font-medium text-text">
              {{ item.filePath }}
            </div>
            <p class="mt-1 text-sm text-danger">{{ item.message }}</p>
          </template>
          <template v-else-if="item.info">
            <!-- Polite live region: "Installed"/"Failed" is announced when it appears. -->
            <div class="flex flex-wrap items-center gap-2" aria-live="polite">
              <NTag v-if="item.plan" size="small" :type="PLAN_META[item.plan.operation].tagType">
                {{ PLAN_META[item.plan.operation].label }}
              </NTag>
              <NTag v-if="item.status === 'success'" size="small" type="success">Installed</NTag>
              <NTag v-if="item.status === 'failed'" size="small" type="error">Failed</NTag>
            </div>
            <div class="text-xs text-text-muted">
              {{ item.info.versionName ?? 'unknown version' }} (code
              {{ item.info.versionCode ?? '?' }}) · {{ formatBytes(item.info.fileSizeBytes) }}
            </div>
            <div
              v-if="item.plan?.operation === 'downgrade-attempt'"
              class="mt-1 flex items-start gap-1 text-xs text-warning"
            >
              <NIcon
                :component="WarningOutline"
                :size="14"
                class="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                The installed version (code {{ item.plan.currentVersionCode }}) is newer than this
                file. Android will likely refuse this install.
              </span>
            </div>
            <p
              v-if="(item.status === 'failed' || item.status === 'success') && item.message"
              class="mt-1 text-sm"
              :class="item.status === 'failed' ? 'text-danger' : 'text-text-muted'"
            >
              {{ item.message }}
            </p>
          </template>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <NButton
            v-if="item.status === 'ready'"
            size="small"
            :aria-label="`Install ${rowLabel(item.filePath)}`"
            @click="installOne(item.filePath)"
          >
            Install
          </NButton>
          <NButton v-if="item.status === 'installing'" size="small" :loading="true" disabled>
            Installing…
          </NButton>
          <NButton
            v-if="item.status !== 'installing'"
            size="small"
            quaternary
            :aria-label="`Remove ${rowLabel(item.filePath)} from the list`"
            @click="apkInstallStore.removeItem(item.filePath)"
          >
            Remove
          </NButton>
        </div>
      </div>
    </div>

    <NModal
      v-model:show="bulkConfirmVisible"
      preset="dialog"
      title="Install all queued apps?"
      type="warning"
    >
      <div class="flex flex-col gap-2 text-sm text-text-secondary">
        <p>This will install {{ readyItems.length }} app(s) on this device, one at a time.</p>
      </div>
      <template #action>
        <NButton @click="bulkConfirmVisible = false">Cancel</NButton>
        <NButton type="primary" @click="confirmInstallAll"
          >Install {{ readyItems.length }} app(s)</NButton
        >
      </template>
    </NModal>
  </div>
</template>
