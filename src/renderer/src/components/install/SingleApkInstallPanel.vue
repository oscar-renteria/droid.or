<script setup lang="ts">
import { NButton, NIcon, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { WarningOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DropZone from '@renderer/components/ui/DropZone.vue'
import { useApkInstallStore } from '@renderer/stores/apk-install.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { formatBytes } from '@renderer/utils/format-bytes'
import { PLAN_META } from '@renderer/utils/install-plan-meta'

const devicesStore = useDevicesStore()
const apkInstallStore = useApkInstallStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

/** Fallback label when the APK's metadata hasn't been read yet — mirrors
 *  what the queue row would have hand-rolled before AppIdentity. */
function rowLabel(filePath: string): string {
  const item = apkInstallStore.queue.find((entry) => entry.filePath === filePath)
  return item?.info?.label ?? item?.info?.packageName ?? filePath.split(/[\\/]/).pop() ?? filePath
}

function handleDrop(files: File[]): void {
  const device = selectedDevice.value
  if (!device || !window.droidor) {
    return
  }
  const paths = files.map((file) => window.droidor!.getPathForFile(file))
  if (paths.length === 0) {
    return
  }
  void apkInstallStore.addFiles(device.id, paths)
}

async function browseFiles(): Promise<void> {
  const device = selectedDevice.value
  if (!device || !window.droidor) {
    return
  }
  const paths = await window.droidor.browseForApkFiles()
  if (paths.length > 0) {
    void apkInstallStore.addFiles(device.id, paths)
  }
}

async function installOne(filePath: string): Promise<void> {
  const device = selectedDevice.value
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
  const device = selectedDevice.value
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

    <DropZone
      clickable
      title="Drag & drop .apk files here, or click to browse"
      hint="Only single .apk files are supported here — for a split APK set, an app bundle, or a .apks/.xapk/.apkm archive, use the Split / Bundle tab instead."
      class="shrink-0"
      @drop="handleDrop"
      @activate="browseFiles"
    />

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
          <template v-if="item.status === 'error'">
            <div class="truncate font-medium text-text">
              {{ item.filePath }}
            </div>
            <p class="mt-1 text-sm text-danger">{{ item.message }}</p>
          </template>
          <template v-else-if="item.info">
            <div class="flex flex-wrap items-center gap-2">
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
              <NIcon :component="WarningOutline" :size="14" class="mt-0.5 shrink-0" />
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
          <NButton v-if="item.status === 'ready'" size="small" @click="installOne(item.filePath)">
            Install
          </NButton>
          <NButton v-if="item.status === 'installing'" size="small" :loading="true" disabled>
            Installing…
          </NButton>
          <NButton
            v-if="item.status !== 'installing'"
            size="small"
            quaternary
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
