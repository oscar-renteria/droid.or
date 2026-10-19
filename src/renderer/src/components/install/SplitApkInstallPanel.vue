<script setup lang="ts">
import type { SplitApkPart, SplitInstallIssue, SplitSourceKind } from '@shared/types/split-install'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDataTable,
  NIcon,
  NSpin,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { ArchiveOutline, DocumentsOutline, FolderOpenOutline } from '@vicons/ionicons5'
import { computed, h, watch } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import DropZone from '@renderer/components/ui/DropZone.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { useSplitInstallStore } from '@renderer/stores/split-install.store'
import { formatBytes } from '@renderer/utils/format-bytes'
import { PLAN_META } from '@renderer/utils/install-plan-meta'

const devicesStore = useDevicesStore()
const splitInstallStore = useSplitInstallStore()
const message = useMessage()

const selectedDevice = computed(() => devicesStore.selectedDevice)

// The store's analysis/plan/compatibility data is only ever valid for the
// device it was computed against. If the sidebar's selection changes to a
// different device — either directly, or by going through a "no device
// selected" gap that unmounted and remounted this whole panel — re-analyze
// the same source for the newly selected device rather than silently
// letting stale data from the old one drive what gets installed where.
// `immediate: true` covers the remount case, since analyzedDeviceId lives
// in the store and outlives this component's own lifecycle.
watch(
  () => selectedDevice.value?.id ?? null,
  (deviceId) => {
    if (!deviceId || splitInstallStore.analyzedDeviceId === null) {
      return
    }
    if (deviceId === splitInstallStore.analyzedDeviceId) {
      return
    }
    if (splitInstallStore.sourceKind) {
      void splitInstallStore.analyzeSource(
        deviceId,
        splitInstallStore.sourceKind,
        splitInstallStore.sourcePaths
      )
    } else {
      splitInstallStore.reset()
    }
  },
  { immediate: true }
)

const ROLE_LABELS: Record<SplitApkPart['role'], string> = {
  base: 'Base',
  abi: 'Architecture',
  density: 'Screen density',
  language: 'Language',
  unknown: 'Other'
}

function partQualifier(part: SplitApkPart): string {
  return part.abi ?? part.density ?? part.language ?? part.rawSplitAttribute ?? '—'
}

function analyze(kind: SplitSourceKind, paths: string[]): void {
  const device = selectedDevice.value
  if (!device || paths.length === 0) {
    return
  }
  void splitInstallStore.analyzeSource(device.id, kind, paths)
}

function handleDrop(files: File[]): void {
  if (!window.droidor) {
    return
  }
  const paths = files.map((file) => window.droidor!.getPathForFile(file))
  if (paths.length === 0) {
    return
  }

  if (paths.length === 1 && /\.(apks|xapk|apkm)$/i.test(paths[0] ?? '')) {
    analyze('archive', paths)
    return
  }
  if (paths.every((path) => /\.apk$/i.test(path))) {
    analyze('files', paths)
    return
  }
  if (paths.length === 1) {
    // Most likely a dropped folder of split APKs — the browser's drag-and-
    // drop API gives no reliable is-directory flag to check for up front,
    // so this just tries it as a directory source; resolveSplitSource
    // already validates that for real and surfaces a clear error here if
    // it isn't one.
    analyze('directory', paths)
    return
  }
  message.warning('Drop a single .apks/.xapk/.apkm archive, a folder, or one or more .apk files.')
}

async function browseArchive(): Promise<void> {
  if (!window.droidor) {
    return
  }
  const path = await window.droidor.browseForSplitArchiveFile()
  if (path) {
    analyze('archive', [path])
  }
}

async function browseDirectory(): Promise<void> {
  if (!window.droidor) {
    return
  }
  const path = await window.droidor.browseForSplitDirectory()
  if (path) {
    analyze('directory', [path])
  }
}

async function browseFiles(): Promise<void> {
  if (!window.droidor) {
    return
  }
  const paths = await window.droidor.browseForApkFiles()
  if (paths.length > 0) {
    analyze('files', paths)
  }
}

function issueAlertType(issue: SplitInstallIssue): 'error' | 'warning' | 'info' {
  return issue.severity
}

function issueAlertTitle(issue: SplitInstallIssue): string {
  if (issue.severity === 'error') return 'This will likely fail'
  if (issue.severity === 'warning') return 'Heads up'
  return 'For your information'
}

const columns = computed<DataTableColumns<SplitApkPart>>(() => [
  {
    title: '',
    key: 'selected',
    width: 44,
    render: (part) =>
      h(NCheckbox, {
        checked: part.role === 'base' || splitInstallStore.selectedFileNames.has(part.fileName),
        disabled: part.role === 'base' || !part.deviceCompatible,
        'onUpdate:checked': () => splitInstallStore.toggleFileName(part.fileName)
      })
  },
  {
    title: 'File',
    key: 'fileName',
    ellipsis: true
  },
  {
    title: 'Role',
    key: 'role',
    width: 130,
    render: (part) => ROLE_LABELS[part.role]
  },
  {
    title: 'Qualifier',
    key: 'qualifier',
    width: 110,
    render: (part) => partQualifier(part)
  },
  {
    title: 'Size',
    key: 'fileSizeBytes',
    width: 90,
    align: 'right',
    render: (part) => h('span', { class: 'tabular-nums' }, formatBytes(part.fileSizeBytes))
  },
  {
    title: 'Device',
    key: 'deviceCompatible',
    width: 130,
    render: (part) =>
      part.deviceCompatible
        ? h(NTag, { size: 'small', type: 'success' }, { default: () => 'Compatible' })
        : h(NTag, { size: 'small', type: 'error' }, { default: () => 'Not compatible' })
  }
])

function changeSource(): void {
  splitInstallStore.reset()
}

async function confirmInstall(): Promise<void> {
  const device = selectedDevice.value
  if (!device) {
    return
  }
  await splitInstallStore.confirmInstall(device.id)
  const result = splitInstallStore.installResult
  if (result?.success) {
    message.success(result.message)
  } else if (result) {
    message.error(result.message)
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-lg font-medium text-text">Install Split APK / App Bundle</h2>
      <NButton v-if="splitInstallStore.sourceKind" size="small" quaternary @click="changeSource">
        Change source
      </NButton>
    </div>

    <template v-if="!splitInstallStore.sourceKind">
      <DropZone
        title="Drag & drop a .apks/.xapk/.apkm archive, a folder, or one or more .apk files"
        hint="Or choose a source below"
        class="shrink-0"
        @drop="handleDrop"
      />

      <div class="flex shrink-0 flex-wrap gap-2">
        <NButton @click="browseArchive">
          <template #icon><NIcon :component="ArchiveOutline" /></template>
          Choose Archive (.apks/.xapk/.apkm)
        </NButton>
        <NButton @click="browseDirectory">
          <template #icon><NIcon :component="FolderOpenOutline" /></template>
          Choose Folder
        </NButton>
        <NButton @click="browseFiles">
          <template #icon><NIcon :component="DocumentsOutline" /></template>
          Choose APK Files
        </NButton>
      </div>

      <p class="text-xs text-text-muted">For a single .apk file, use the Single APK tab instead.</p>
    </template>

    <template v-else>
      <NSpin v-if="splitInstallStore.loading" :show="true" class="flex-1">
        <div class="flex h-40 items-center justify-center text-sm text-text-muted">
          Reading this source…
        </div>
      </NSpin>

      <NAlert
        v-else-if="splitInstallStore.errorMessage"
        type="error"
        title="Couldn't read this source"
      >
        {{ splitInstallStore.errorMessage }}
      </NAlert>

      <div v-else-if="splitInstallStore.analysis" class="flex min-h-0 flex-1 flex-col gap-3">
        <div class="flex shrink-0 items-start gap-3 rounded border border-border p-3">
          <AppIdentity
            :label="
              splitInstallStore.analysis.label ??
              splitInstallStore.analysis.packageName ??
              'Unknown app'
            "
            :package-name="splitInstallStore.analysis.packageName ?? 'unknown package'"
            :icon-data-url="splitInstallStore.analysis.iconDataUrl ?? null"
            size="lg"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <NTag
                v-if="splitInstallStore.analysis.plan"
                size="small"
                :type="PLAN_META[splitInstallStore.analysis.plan.operation].tagType"
              >
                {{ PLAN_META[splitInstallStore.analysis.plan.operation].label }}
              </NTag>
            </div>
            <div class="text-xs text-text-muted">
              {{ splitInstallStore.analysis.versionName ?? 'unknown version' }} (code
              {{ splitInstallStore.analysis.versionCode ?? '?' }}) ·
              {{ splitInstallStore.analysis.parts.length }} file(s)
            </div>
          </div>
        </div>

        <div
          v-if="splitInstallStore.analysis.issues.length > 0"
          class="flex shrink-0 flex-col gap-2"
        >
          <NAlert
            v-for="(issue, index) in splitInstallStore.analysis.issues"
            :key="index"
            :type="issueAlertType(issue)"
            :title="issueAlertTitle(issue)"
          >
            {{ issue.message }}
          </NAlert>
        </div>

        <NDataTable
          class="min-h-0 flex-1"
          flex-height
          :columns="columns"
          :data="splitInstallStore.analysis.parts"
          :row-key="(row: SplitApkPart) => row.fileName"
          size="small"
          striped
        />

        <template v-if="splitInstallStore.installResult">
          <NAlert
            :type="splitInstallStore.installResult.success ? 'success' : 'error'"
            :title="splitInstallStore.installResult.success ? 'Installed' : 'Install failed'"
          >
            {{ splitInstallStore.installResult.message }}
          </NAlert>
        </template>

        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border pt-3">
          <NButton
            type="primary"
            :disabled="!splitInstallStore.analysis.canInstall"
            :loading="splitInstallStore.installing"
            @click="confirmInstall"
          >
            Install {{ splitInstallStore.selectedFileNames.size + 1 }} file(s)
          </NButton>
        </div>
      </div>
    </template>
  </div>
</template>
