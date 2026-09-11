<script setup lang="ts">
import type { AdbCommandLogCategory, AdbCommandLogEntry } from '@shared/types/logs'
import {
  NButton,
  NEmpty,
  NDataTable,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { RefreshOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5'
import { computed, h, onMounted, ref } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useLogsStore } from '@renderer/stores/logs.store'

type ResultFilter = 'all' | 'success' | 'failed'

const devicesStore = useDevicesStore()
const logsStore = useLogsStore()
const message = useMessage()

const searchText = ref('')
const deviceFilter = ref<string>('all')
const categoryFilter = ref<AdbCommandLogCategory | 'all'>('all')
const resultFilter = ref<ResultFilter>('all')
const detailEntry = ref<AdbCommandLogEntry | null>(null)
const detailVisible = computed({
  get: () => detailEntry.value !== null,
  set: (value: boolean) => {
    if (!value) {
      detailEntry.value = null
    }
  }
})

onMounted(() => {
  void logsStore.load()
})

const CATEGORY_LABELS: Record<AdbCommandLogCategory, string> = {
  'list-devices': 'List devices',
  'get-properties': 'Get properties',
  shell: 'Shell',
  mutation: 'Mutation',
  'pull-file': 'Pull file',
  'install-apk': 'Install APK',
  'install-multiple-apk': 'Install split/bundle'
}

function deviceLabel(deviceId: string | null): string {
  if (deviceId === null) {
    return 'All devices'
  }
  const device = devicesStore.devices.find((candidate) => candidate.id === deviceId)
  return device?.nickname ?? device?.model ?? deviceId
}

const deviceFilterOptions = computed(() => [
  { label: 'All devices', value: 'all' },
  ...devicesStore.devices.map((device) => ({
    label: device.nickname ?? device.model ?? device.id,
    value: device.id
  }))
])

const categoryFilterOptions: Array<{ label: string; value: AdbCommandLogCategory | 'all' }> = [
  { label: 'All categories', value: 'all' },
  ...(Object.entries(CATEGORY_LABELS) as Array<[AdbCommandLogCategory, string]>).map(
    ([value, label]) => ({ label, value })
  )
]

const resultFilterOptions: Array<{ label: string; value: ResultFilter }> = [
  { label: 'All results', value: 'all' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' }
]

const filteredEntries = computed(() => {
  const search = searchText.value.trim().toLowerCase()
  return logsStore.entries.filter((entry) => {
    if (deviceFilter.value !== 'all' && entry.deviceId !== deviceFilter.value) {
      return false
    }
    if (categoryFilter.value !== 'all' && entry.category !== categoryFilter.value) {
      return false
    }
    if (resultFilter.value === 'success' && !entry.success) {
      return false
    }
    if (resultFilter.value === 'failed' && entry.success) {
      return false
    }
    if (search.length > 0 && !entry.command.toLowerCase().includes(search)) {
      return false
    }
    return true
  })
})

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

async function handleClear(): Promise<void> {
  await logsStore.clear()
  message.success('Logs cleared.')
}

async function handleExport(): Promise<void> {
  const path = await logsStore.exportLogs()
  if (path) {
    message.success(`Exported to ${path}`)
  }
}

const columns: DataTableColumns<AdbCommandLogEntry> = [
  {
    title: 'Time',
    key: 'timestamp',
    width: 180,
    render: (row) => formatTimestamp(row.timestamp)
  },
  {
    title: 'Device',
    key: 'deviceId',
    width: 160,
    ellipsis: true,
    render: (row) => deviceLabel(row.deviceId)
  },
  {
    title: 'Category',
    key: 'category',
    width: 130,
    render: (row) => CATEGORY_LABELS[row.category]
  },
  {
    title: 'Command',
    key: 'command',
    ellipsis: true,
    render: (row) => h('code', { class: 'text-xs' }, row.command)
  },
  {
    title: 'Duration',
    key: 'durationMs',
    width: 100,
    render: (row) => `${row.durationMs} ms`
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
  <div class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-medium text-text">Logs</h2>
      <div class="flex items-center gap-2">
        <NButton size="small" :loading="logsStore.loading" @click="logsStore.load">
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          Refresh
        </NButton>
        <NButton size="small" @click="handleExport">
          <template #icon>
            <NIcon :component="SaveOutline" />
          </template>
          Export Logs
        </NButton>
        <NButton size="small" type="error" @click="handleClear">
          <template #icon>
            <NIcon :component="TrashOutline" />
          </template>
          Clear
        </NButton>
      </div>
    </div>

    <p class="shrink-0 text-xs text-text-muted">
      Every ADB command this app has run this session, across all devices. Cleared on restart —
      export first if you need to keep a copy for troubleshooting.
    </p>

    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <NInput
        v-model:value="searchText"
        placeholder="Search by command..."
        class="w-64"
        clearable
      />
      <NSelect v-model:value="deviceFilter" :options="deviceFilterOptions" class="w-48" />
      <NSelect v-model:value="categoryFilter" :options="categoryFilterOptions" class="w-44" />
      <NSelect v-model:value="resultFilter" :options="resultFilterOptions" class="w-36" />
      <span class="text-xs text-text-muted">
        {{ filteredEntries.length }} / {{ logsStore.entries.length }} entries
      </span>
    </div>

    <NEmpty
      v-if="!logsStore.loading && filteredEntries.length === 0"
      description="No log entries match"
      class="flex-1 items-center justify-center"
    />

    <NDataTable
      v-else
      class="min-h-0 flex-1"
      flex-height
      :loading="logsStore.loading"
      :columns="columns"
      :data="filteredEntries"
      :row-key="(row: AdbCommandLogEntry) => row.id"
      size="small"
      striped
    />

    <NModal
      v-model:show="detailVisible"
      preset="card"
      title="Log entry details"
      style="width: 600px"
    >
      <template v-if="detailEntry">
        <p class="text-sm text-text-secondary">
          <span class="font-medium">{{ CATEGORY_LABELS[detailEntry.category] }}</span> on
          {{ deviceLabel(detailEntry.deviceId) }} at
          {{ formatTimestamp(detailEntry.timestamp) }} ({{ detailEntry.durationMs }}
          ms)
        </p>
        <pre
          class="mt-3 max-h-40 overflow-auto rounded bg-surface-code p-3 text-xs whitespace-pre-wrap text-text-code"
          >{{ detailEntry.command }}</pre>
        <p
          v-if="detailEntry.errorMessage"
          class="mt-3 text-sm font-medium text-red-600 dark:text-red-400"
        >
          Error
        </p>
        <pre
          v-if="detailEntry.errorMessage"
          class="mt-1 max-h-40 overflow-auto rounded bg-surface-code p-3 text-xs whitespace-pre-wrap text-text-code"
          >{{ detailEntry.errorMessage }}</pre>
      </template>
    </NModal>
  </div>
</template>
