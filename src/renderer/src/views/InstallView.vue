<script setup lang="ts">
import type { InstallPlanOperation } from '@shared/types/apk-install'
import { NButton, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useApkInstallStore } from '@renderer/stores/apk-install.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const devicesStore = useDevicesStore()
const apkInstallStore = useApkInstallStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

const PLAN_META: Record<
  InstallPlanOperation,
  { label: string; tagType: 'success' | 'info' | 'default' | 'warning' }
> = {
  'fresh-install': { label: 'New install', tagType: 'success' },
  update: { label: 'Update', tagType: 'info' },
  'reinstall-same-version': { label: 'Reinstall (same version)', tagType: 'default' },
  'downgrade-attempt': { label: 'Downgrade attempt', tagType: 'warning' }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const isDragging = ref(false)

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(): void {
  isDragging.value = false
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  const device = selectedDevice.value
  const files = event.dataTransfer?.files
  if (!device || !files || !window.droidor) {
    return
  }
  const paths = Array.from(files).map((file) => window.droidor!.getPathForFile(file))
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
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to install an APK onto it.
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
        'Installing an APK requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-lg font-medium text-text">Install APK</h2>
      <NButton
        v-if="readyItems.length > 0"
        type="primary"
        :loading="apkInstallStore.installingAll"
        @click="openBulkConfirm"
      >
        Install All ({{ readyItems.length }})
      </NButton>
    </div>

    <div
      class="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed p-6 text-center transition-colors"
      :class="
        isDragging
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-border-strong'
      "
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="browseFiles"
    >
      <p class="text-sm font-medium text-text-secondary">
        Drag & drop .apk files here, or click to browse
      </p>
      <p class="text-xs text-text-muted">
        Only .apk files are supported — split APK sets, .apks and .xapk are not.
      </p>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
      <div
        v-for="item in apkInstallStore.queue"
        :key="item.filePath"
        class="flex items-start gap-3 rounded border border-border p-3"
      >
        <NSpin v-if="item.status === 'inspecting'" :size="24" class="mt-1 shrink-0" />
        <img
          v-else-if="item.info?.iconDataUrl"
          :src="item.info.iconDataUrl"
          alt=""
          class="h-8 w-8 shrink-0 rounded"
        />
        <div
          v-else
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-elevated text-xs font-medium text-text-muted"
        >
          {{
            (item.info?.label ?? item.info?.packageName ?? item.filePath).charAt(0).toUpperCase()
          }}
        </div>

        <div class="min-w-0 flex-1">
          <template v-if="item.status === 'error'">
            <div class="truncate font-medium text-text">
              {{ item.filePath }}
            </div>
            <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ item.message }}</p>
          </template>
          <template v-else-if="item.info">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-text">{{
                item.info.label ?? item.info.packageName
              }}</span>
              <NTag v-if="item.plan" size="small" :type="PLAN_META[item.plan.operation].tagType">
                {{ PLAN_META[item.plan.operation].label }}
              </NTag>
              <NTag v-if="item.status === 'success'" size="small" type="success">Installed</NTag>
              <NTag v-if="item.status === 'failed'" size="small" type="error">Failed</NTag>
            </div>
            <div class="text-xs text-text-muted">
              {{ item.info.packageName }} · {{ item.info.versionName ?? 'unknown version' }} (code
              {{ item.info.versionCode ?? '?' }}) · {{ formatBytes(item.info.fileSizeBytes) }}
            </div>
            <div
              v-if="item.plan?.operation === 'downgrade-attempt'"
              class="mt-1 text-xs text-amber-600 dark:text-amber-400"
            >
              The installed version (code {{ item.plan.currentVersionCode }}) is newer than this
              file. Android will likely refuse this install.
            </div>
            <p
              v-if="(item.status === 'failed' || item.status === 'success') && item.message"
              class="mt-1 text-sm"
              :class="
                item.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-text-muted'
              "
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
        <NButton type="warning" @click="confirmInstallAll">Confirm</NButton>
      </template>
    </NModal>
  </div>
</template>
