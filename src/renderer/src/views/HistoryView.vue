<script setup lang="ts">
import type { OperationHistoryEntry } from '@shared/types/operation'
import { NButton, NDataTable, NEmpty, NModal, NTag, type DataTableColumns } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const devicesStore = useDevicesStore()
const operationsStore = useOperationsStore()

const selectedDevice = computed(() => devicesStore.selectedDevice)

async function loadHistory(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    operationsStore.reset()
    return
  }
  await operationsStore.loadHistory(device.id)
}

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  loadHistory,
  { immediate: true }
)

const detailEntry = ref<OperationHistoryEntry | null>(null)
const detailVisible = computed({
  get: () => detailEntry.value !== null,
  set: (value: boolean) => {
    if (!value) {
      detailEntry.value = null
    }
  }
})

const OPERATION_LABELS: Record<string, string> = {
  disable: 'Disable',
  enable: 'Enable',
  'uninstall-for-user': 'Uninstall for User',
  'clear-data': 'Clear Data'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

const columns: DataTableColumns<OperationHistoryEntry> = [
  {
    title: 'Time',
    key: 'performedAt',
    width: 180,
    render: (row) => formatTimestamp(row.performedAt)
  },
  {
    title: 'Package',
    key: 'packageName',
    ellipsis: true
  },
  {
    title: 'Operation',
    key: 'operation',
    width: 150,
    render: (row) => OPERATION_LABELS[row.operation] ?? row.operation
  },
  {
    title: 'State change',
    key: 'previousState',
    width: 220,
    render: (row) =>
      row.previousState || row.newState
        ? `${row.previousState ?? 'unknown'} → ${row.newState ?? 'unknown'}`
        : 'n/a'
  },
  {
    title: 'Result',
    key: 'success',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.success ? 'success' : 'error' },
        { default: () => (row.success ? 'Success' : 'Failed') }
      )
  },
  {
    title: '',
    key: 'actions',
    width: 90,
    render: (row) =>
      h(
        NButton,
        { size: 'small', quaternary: true, onClick: () => (detailEntry.value = row) },
        { default: () => 'Details' }
      )
  }
]
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-text">No device selected</h2>
    <p class="max-w-md text-sm text-text-muted">
      Select a device from the sidebar to see the changes this app has made to it.
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
        'Viewing history requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-lg font-medium text-text">Operation History</h2>
      <NButton size="small" :loading="operationsStore.historyLoading" @click="loadHistory">
        Refresh
      </NButton>
    </div>

    <NEmpty
      v-if="!operationsStore.historyLoading && operationsStore.history.length === 0"
      description="No changes have been made on this device yet"
      class="flex-1 items-center justify-center"
    />

    <NDataTable
      v-else
      class="min-h-0 flex-1"
      flex-height
      :loading="operationsStore.historyLoading"
      :columns="columns"
      :data="operationsStore.history"
      :row-key="(row: OperationHistoryEntry) => row.id"
      size="small"
    />

    <NModal
      v-model:show="detailVisible"
      preset="card"
      title="Operation details"
      style="width: 600px"
    >
      <template v-if="detailEntry">
        <p class="text-sm text-text-secondary">
          <span class="font-medium">{{ detailEntry.packageName }}</span> —
          {{ OPERATION_LABELS[detailEntry.operation] ?? detailEntry.operation }}
          at {{ formatTimestamp(detailEntry.performedAt) }}
        </p>
        <pre
          class="mt-3 max-h-80 overflow-auto rounded bg-surface-code p-3 text-xs whitespace-pre-wrap text-text-code"
          >{{ detailEntry.rawOutput }}</pre>
      </template>
    </NModal>
  </div>
</template>
