<script setup lang="ts">
import type { AppPackageInfo } from '@shared/types/package'
import type { MutatingOperationType } from '@shared/types/operation'
import {
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NSelect,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import OperationConfirmDialog from '@renderer/components/OperationConfirmDialog.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useOperationsStore } from '@renderer/stores/operations.store'
import { usePackagesStore } from '@renderer/stores/packages.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'
import {
  formatInstallSource,
  formatInstalledDate,
  formatVersion,
  isFromPlayStore
} from '@renderer/utils/format-package-value'

type FilterKey = 'all' | 'user' | 'system' | 'disabled' | 'recent' | 'play-store' | 'unknown-source'

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const devicesStore = useDevicesStore()
const packagesStore = usePackagesStore()
const operationsStore = useOperationsStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)
const searchText = ref('')
const filterKey = ref<FilterKey>('all')
const selectedPackage = ref<AppPackageInfo | null>(null)

const filterOptions: Array<{ label: string; value: FilterKey }> = [
  { label: 'All apps', value: 'all' },
  { label: 'User apps', value: 'user' },
  { label: 'System apps', value: 'system' },
  { label: 'Disabled apps', value: 'disabled' },
  { label: 'Recently installed', value: 'recent' },
  { label: 'From Play Store', value: 'play-store' },
  { label: 'Unknown source', value: 'unknown-source' }
]

async function loadPackages(): Promise<void> {
  const device = selectedDevice.value
  if (!device || device.connectionState !== 'device') {
    packagesStore.reset()
    return
  }
  await packagesStore.fetchPackages(device.id)
}

watch(
  () => `${selectedDevice.value?.id ?? ''}:${selectedDevice.value?.connectionState ?? ''}`,
  loadPackages,
  { immediate: true }
)

const filteredPackages = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  const now = Date.now()

  return packagesStore.packages.filter((pkg) => {
    if (
      query &&
      !pkg.packageName.toLowerCase().includes(query) &&
      !(pkg.displayName?.toLowerCase().includes(query) ?? false)
    ) {
      return false
    }
    switch (filterKey.value) {
      case 'user':
        return !pkg.isSystemApp
      case 'system':
        return pkg.isSystemApp
      case 'disabled':
        return pkg.isDisabled
      case 'recent':
        return pkg.firstInstallTimeMs !== null && now - pkg.firstInstallTimeMs <= RECENT_WINDOW_MS
      case 'play-store':
        return isFromPlayStore(pkg.installerPackage)
      case 'unknown-source':
        return pkg.installerPackage === null
      default:
        return true
    }
  })
})

function openDetail(pkg: AppPackageInfo): void {
  selectedPackage.value = pkg
  const deviceId = selectedDevice.value?.id
  if (deviceId) {
    packagesStore.fetchMetadata(deviceId, pkg)
  }
}

const drawerVisible = computed({
  get: () => selectedPackage.value !== null,
  set: (value: boolean) => {
    if (!value) {
      selectedPackage.value = null
    }
  }
})

const confirmOperation = ref<MutatingOperationType | null>(null)
const confirmDialogVisible = computed({
  get: () => confirmOperation.value !== null,
  set: (value: boolean) => {
    if (!value) {
      confirmOperation.value = null
    }
  }
})

function openConfirm(operation: MutatingOperationType): void {
  confirmOperation.value = operation
}

async function handleConfirm(): Promise<void> {
  const device = selectedDevice.value
  const pkg = selectedPackage.value
  const operation = confirmOperation.value
  if (!device || !pkg || !operation) {
    return
  }
  confirmOperation.value = null

  const result = await operationsStore.performOperation(device.id, pkg.packageName, operation)
  if (!result) {
    return
  }

  if (result.success) {
    message.success(result.message)
    if (operation === 'disable') {
      pkg.isDisabled = true
    } else if (operation === 'enable') {
      pkg.isDisabled = false
    }
  } else {
    message.error(result.message)
  }
}

const selectedPackageMetadata = computed(() => {
  if (!selectedPackage.value) {
    return null
  }
  const cached = packagesStore.metadataCache.get(selectedPackage.value.packageName)
  return cached && cached !== 'loading' ? cached : null
})

/** Triggers a lazy metadata fetch for a row and renders whatever's known so
 *  far — package name and curated name are instant, the real APK-parsed
 *  label/icon fills in once resolved. Called from the column's render()
 *  rather than a separate watcher: Naive UI's virtual scroll only calls
 *  render() for rows it's actually painting, which naturally bounds these
 *  fetches to visible rows instead of queuing all of them at once. */
function renderAppCell(row: AppPackageInfo) {
  const deviceId = selectedDevice.value?.id
  if (deviceId) {
    packagesStore.fetchMetadata(deviceId, row)
  }
  const cached = packagesStore.metadataCache.get(row.packageName)
  const metadata = cached && cached !== 'loading' ? cached : null
  const label = metadata?.label ?? row.displayName ?? row.packageName

  return h('div', { class: 'flex min-w-0 items-center gap-2' }, [
    metadata?.iconDataUrl
      ? h('img', { src: metadata.iconDataUrl, class: 'h-6 w-6 shrink-0 rounded', alt: '' })
      : h(
          'div',
          {
            class:
              'flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-200 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          },
          label.charAt(0).toUpperCase()
        ),
    h('div', { class: 'min-w-0' }, [
      h('div', { class: 'truncate font-medium text-gray-900 dark:text-gray-100' }, label),
      label !== row.packageName
        ? h('div', { class: 'truncate text-xs text-gray-500 dark:text-gray-400' }, row.packageName)
        : null
    ])
  ])
}

const columns: DataTableColumns<AppPackageInfo> = [
  {
    title: 'App',
    key: 'packageName',
    sorter: (a, b) =>
      (a.displayName ?? a.packageName).localeCompare(b.displayName ?? b.packageName),
    render: renderAppCell
  },
  {
    title: 'Version',
    key: 'versionName',
    width: 170,
    render: (row) => formatVersion(row.versionName, row.versionCode)
  },
  {
    title: 'Type',
    key: 'isSystemApp',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.isSystemApp ? 'default' : 'info' },
        { default: () => (row.isSystemApp ? 'System' : 'User') }
      )
  },
  {
    title: 'State',
    key: 'isDisabled',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.isDisabled ? 'warning' : 'success' },
        { default: () => (row.isDisabled ? 'Disabled' : 'Enabled') }
      )
  },
  {
    title: 'Source',
    key: 'installerPackage',
    width: 170,
    ellipsis: true,
    render: (row) => formatInstallSource(row.installerPackage)
  },
  {
    title: 'Installed',
    key: 'firstInstallTimeMs',
    width: 120,
    sorter: (a, b) => (a.firstInstallTimeMs ?? 0) - (b.firstInstallTimeMs ?? 0),
    render: (row) => formatInstalledDate(row.firstInstallTimeMs)
  }
]

function rowProps(row: AppPackageInfo): Record<string, unknown> {
  return {
    style: 'cursor: pointer',
    onClick: () => openDetail(row)
  }
}
</script>

<template>
  <div
    v-if="!selectedDevice"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">No device selected</h2>
    <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
      Select a device from the sidebar to browse its installed applications.
    </p>
  </div>

  <div
    v-else-if="selectedDevice.connectionState !== 'device'"
    class="flex h-full flex-col items-center justify-center gap-2 text-center"
  >
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
      {{ getDeviceStateMeta(selectedDevice.connectionState).label }}
    </h2>
    <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
      {{
        getDeviceStateMeta(selectedDevice.connectionState).guidance ??
        'Browsing applications requires an authorized, connected device.'
      }}
    </p>
  </div>

  <div v-else class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center gap-2">
      <NInput
        v-model:value="searchText"
        placeholder="Search by app or package name..."
        clearable
        class="max-w-xs"
      />
      <NSelect v-model:value="filterKey" :options="filterOptions" class="w-48" />
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ filteredPackages.length }} / {{ packagesStore.packages.length }} packages
      </span>
      <div class="flex-1" />
      <NButton size="small" quaternary :loading="packagesStore.loading" @click="loadPackages">
        Refresh
      </NButton>
    </div>

    <NEmpty
      v-if="!packagesStore.loading && packagesStore.errorMessage"
      :description="packagesStore.errorMessage"
      class="flex-1 items-center justify-center"
    />

    <NDataTable
      v-else
      class="min-h-0 flex-1"
      flex-height
      :loading="packagesStore.loading"
      :columns="columns"
      :data="filteredPackages"
      :row-props="rowProps"
      :row-key="(row: AppPackageInfo) => row.packageName"
      virtual-scroll
      size="small"
    />

    <NDrawer v-model:show="drawerVisible" :width="420" placement="right">
      <NDrawerContent
        v-if="selectedPackage"
        :title="
          selectedPackageMetadata?.label ??
          selectedPackage.displayName ??
          selectedPackage.packageName
        "
        closable
      >
        <div v-if="selectedPackageMetadata?.iconDataUrl" class="mb-4 flex justify-center">
          <img :src="selectedPackageMetadata.iconDataUrl" alt="" class="h-16 w-16 rounded-lg" />
        </div>
        <NDescriptions :column="1" label-placement="top" bordered size="small">
          <NDescriptionsItem label="App name">{{
            selectedPackageMetadata?.label ?? selectedPackage.displayName ?? 'Not available'
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Package name">{{
            selectedPackage.packageName
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Version">{{
            formatVersion(selectedPackage.versionName, selectedPackage.versionCode)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Type">{{
            selectedPackage.isSystemApp ? 'System app' : 'User app'
          }}</NDescriptionsItem>
          <NDescriptionsItem label="State">{{
            selectedPackage.isDisabled ? 'Disabled' : 'Enabled'
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Install source">{{
            formatInstallSource(selectedPackage.installerPackage)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="First installed">{{
            formatInstalledDate(selectedPackage.firstInstallTimeMs)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="Last updated">{{
            formatInstalledDate(selectedPackage.lastUpdateTimeMs)
          }}</NDescriptionsItem>
          <NDescriptionsItem label="APK path">{{
            selectedPackage.apkPath ?? 'Not available'
          }}</NDescriptionsItem>
        </NDescriptions>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <NButton
            size="small"
            :loading="operationsStore.pending.has(selectedPackage.packageName)"
            @click="openConfirm('uninstall-for-user')"
          >
            Uninstall for User
          </NButton>
          <NButton
            size="small"
            :loading="operationsStore.pending.has(selectedPackage.packageName)"
            @click="openConfirm(selectedPackage.isDisabled ? 'enable' : 'disable')"
          >
            {{ selectedPackage.isDisabled ? 'Enable' : 'Disable' }}
          </NButton>
          <NButton
            size="small"
            :loading="operationsStore.pending.has(selectedPackage.packageName)"
            @click="openConfirm('clear-data')"
          >
            Clear Data
          </NButton>
        </div>
      </NDrawerContent>
    </NDrawer>

    <OperationConfirmDialog
      v-if="selectedPackage && confirmOperation"
      v-model:show="confirmDialogVisible"
      :package-name="selectedPackage.packageName"
      :display-name="selectedPackageMetadata?.label ?? selectedPackage.displayName"
      :operation="confirmOperation"
      :is-system-app="selectedPackage.isSystemApp"
      :risk="null"
      @confirm="handleConfirm"
    />
  </div>
</template>
