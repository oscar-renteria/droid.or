<script setup lang="ts">
import type { KnownDevice } from '@shared/types/device'
import { NButton, NDropdown, NEmpty, NIcon, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
import { EllipsisHorizontal } from '@vicons/ionicons5'
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
  <aside class="flex h-full w-64 flex-col border-r border-border bg-surface">
    <div
      class="flex items-center justify-between px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase"
    >
      <span>Devices ({{ devicesStore.devices.length }})</span>
    </div>

    <div
      v-if="devicesStore.devices.length === 0"
      class="flex flex-1 items-center justify-center px-4"
    >
      <NEmpty description="No devices yet" size="small">
        <template #extra>
          <p class="max-w-[16rem] text-center text-xs text-text-muted">
            Connect an Android phone via USB with USB debugging enabled.
          </p>
        </template>
      </NEmpty>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="device in devicesStore.devices"
        :key="device.id"
        class="group flex items-start gap-2 border-b border-l-2 border-b-divider px-4 py-3"
        :class="
          devicesStore.selectedDeviceId === device.id
            ? 'border-l-primary bg-primary/10 hover:bg-primary/15'
            : 'border-l-transparent hover:bg-surface'
        "
      >
        <button
          type="button"
          class="flex-1 text-left min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="() => selectDevice(device)"
        >
          <span
            class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            :class="getDeviceStateMeta(device.connectionState).dotClass"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-text">
              {{ displayName(device) }}
            </div>
            <div class="truncate text-xs text-text-muted">
              <template v-if="device.androidVersion">Android {{ device.androidVersion }} · </template>
              {{ getDeviceStateMeta(device.connectionState).label }}
            </div>
            <div
              v-if="getDeviceStateMeta(device.connectionState).guidance"
              class="mt-1 text-xs text-warning"
            >
              {{ getDeviceStateMeta(device.connectionState).guidance }}
            </div>
          </div>
        </button>
        <NDropdown
          v-if="device.connectionState !== 'no-permissions'"
          trigger="click"
          :options="actionOptions(device)"
          @select="(key) => handleAction(key as ActionKey, device)"
        >
          <button
            type="button"
            class="shrink-0 rounded px-1 text-text-muted transition-opacity"
            :class="
              devicesStore.selectedDeviceId === device.id
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            "
            aria-label="Actions for {{ displayName(device) }}"
            @click.stop
          >
            <NIcon :component="EllipsisHorizontal" size="14" />
          </button>
        </NDropdown>
      </div>
    </div>

    <div v-if="hasHistoryToClear" class="border-t border-border p-2">
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
