<script setup lang="ts">
import type { KnownDevice } from '@shared/types/device'
import { NButton, NDropdown, NEmpty, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const devicesStore = useDevicesStore()
const message = useMessage()

const hasHistoryToClear = computed(() =>
  devicesStore.devices.some((device) => device.connectionState === 'disconnected')
)

function displayName(device: KnownDevice): string {
  if (device.nickname) {
    return device.nickname
  }
  if (device.manufacturer && device.model) {
    return `${device.manufacturer} ${device.model}`
  }
  if (device.model) {
    return device.model
  }
  return device.connectionState === 'no-permissions' ? 'Unknown device' : device.id
}

function selectDevice(device: KnownDevice): void {
  devicesStore.selectDevice(device.id)
}

const renameTargetId = ref<string | null>(null)
const renameValue = ref('')
const renameModalVisible = computed({
  get: () => renameTargetId.value !== null,
  set: (value: boolean) => {
    if (!value) {
      renameTargetId.value = null
    }
  }
})

function openRename(device: KnownDevice): void {
  renameTargetId.value = device.id
  renameValue.value = device.nickname ?? ''
}

async function confirmRename(): Promise<void> {
  if (!renameTargetId.value) {
    return
  }
  const trimmed = renameValue.value.trim()
  await devicesStore.renameDevice(renameTargetId.value, trimmed.length > 0 ? trimmed : null)
  renameTargetId.value = null
}

async function removeDevice(device: KnownDevice): Promise<void> {
  await devicesStore.removeDevice(device.id)
}

async function clearHistory(): Promise<void> {
  await devicesStore.clearHistory()
  message.success('Device history cleared')
}

type ActionKey = 'rename' | 'remove'

function actionOptions(device: KnownDevice): Array<{ label: string; key: ActionKey }> {
  const options: Array<{ label: string; key: ActionKey }> = [{ label: 'Rename', key: 'rename' }]
  if (device.connectionState === 'disconnected') {
    options.push({ label: 'Remove from history', key: 'remove' })
  }
  return options
}

function handleAction(key: ActionKey, device: KnownDevice): void {
  if (key === 'rename') {
    openRename(device)
  } else if (key === 'remove') {
    void removeDevice(device)
  }
}
</script>

<template>
  <aside class="flex h-full w-64 flex-col border-r border-gray-200 dark:border-gray-800">
    <div
      class="flex items-center justify-between px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
    >
      <span>Devices</span>
    </div>

    <div
      v-if="devicesStore.devices.length === 0"
      class="flex flex-1 items-center justify-center px-4"
    >
      <NEmpty description="No devices yet" size="small">
        <template #extra>
          <p class="max-w-[16rem] text-center text-xs text-gray-500 dark:text-gray-400">
            Connect an Android phone via USB with USB debugging enabled.
          </p>
        </template>
      </NEmpty>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="device in devicesStore.devices"
        :key="device.id"
        class="group flex cursor-pointer items-start gap-2 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-900"
        :class="{ 'bg-gray-50 dark:bg-gray-900': devicesStore.selectedDeviceId === device.id }"
        @click="selectDevice(device)"
      >
        <span
          class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          :class="getDeviceStateMeta(device.connectionState).dotClass"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ displayName(device) }}
          </div>
          <div class="truncate text-xs text-gray-500 dark:text-gray-400">
            <template v-if="device.androidVersion">Android {{ device.androidVersion }} · </template>
            {{ getDeviceStateMeta(device.connectionState).label }}
          </div>
          <div
            v-if="getDeviceStateMeta(device.connectionState).guidance"
            class="mt-1 text-xs text-amber-600 dark:text-amber-400"
          >
            {{ getDeviceStateMeta(device.connectionState).guidance }}
          </div>
        </div>
        <NDropdown
          v-if="device.connectionState !== 'no-permissions'"
          trigger="click"
          :options="actionOptions(device)"
          @select="(key) => handleAction(key as ActionKey, device)"
        >
          <button
            class="shrink-0 rounded px-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Device actions"
            @click.stop
          >
            ⋯
          </button>
        </NDropdown>
      </div>
    </div>

    <div v-if="hasHistoryToClear" class="border-t border-gray-200 p-2 dark:border-gray-800">
      <NPopconfirm @positive-click="clearHistory">
        <template #trigger>
          <NButton size="small" quaternary block>Clear History</NButton>
        </template>
        Remove every disconnected device from history? Connected devices are kept.
      </NPopconfirm>
    </div>

    <NModal
      v-model:show="renameModalVisible"
      preset="dialog"
      title="Rename device"
      positive-text="Save"
      @positive-click="confirmRename"
    >
      <NInput
        v-model:value="renameValue"
        placeholder="Device nickname"
        clearable
        @keyup.enter="confirmRename"
      />
    </NModal>
  </aside>
</template>
