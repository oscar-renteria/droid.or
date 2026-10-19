<script setup lang="ts">
import type { OperationHistoryEntry } from '@shared/types/operation'
import { NButton, NDataTable, NIcon, NModal, NTag, type DataTableColumns } from 'naive-ui'
import { CheckmarkCircleOutline, CloseCircleOutline, RefreshOutline } from '@vicons/ionicons5'
import { computed, h, ref, watch } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { usePackagesStore } from '@renderer/stores/packages.store'

const devicesStore = useDevicesStore()
const operationsStore = useOperationsStore()
const packagesStore = usePackagesStore()

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
  'clear-data': 'Clear Data',
  install: 'Install APK',
  'restore-install': 'Restore Install',
  'split-install': 'Install Split/Bundle'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

/** Same best-effort fallback Recovery uses: the cached label if the Apps tab
 *  resolved it this session, otherwise the raw package name. */
function displayName(packageName: string): string {
  const cached = packagesStore.metadataCache.get(packageName)
  return cached && cached !== 'loading' && cached.label ? cached.label : packageName
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
    ellipsis: true,
    render: (row) =>
      h(
        'div',
        { class: 'min-w-0' },
        {
          default: () => [
            h(AppIdentity, {
              label: displayName(row.packageName),
              packageName: row.packageName,
              size: 'sm'
            })
          ]
        }
      )
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
        {
          size: 'small',
          type: row.success ? 'success' : 'error'
        },
        {
          icon: () =>
            h(NIcon, {
              component: row.success ? CheckmarkCircleOutline : CloseCircleOutline,
              size: 14
            }),
          default: () => (row.success ? 'Success' : 'Failed')
        }
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
  <DeviceGate
    requirement="Viewing history requires an authorized, connected device."
    no-device-text="Select a device from the sidebar to see the changes this app has made to it."
  >
    <div class="flex h-full flex-col gap-3">
      <PageHeader title="History">
        <template #actions>
          <NButton size="small" :loading="operationsStore.historyLoading" @click="loadHistory">
            <template #icon>
              <NIcon :component="RefreshOutline" />
            </template>
            Refresh
          </NButton>
        </template>
      </PageHeader>

      <EmptyState
        v-if="!operationsStore.historyLoading && operationsStore.history.length === 0"
        title="No changes yet"
        description="No changes have been made on this device yet."
        class="flex-1"
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
        striped
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
  </DeviceGate>
</template>
