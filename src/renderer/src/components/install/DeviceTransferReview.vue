<script setup lang="ts">
import type { SplitApkPart, SplitInstallIssue } from '@shared/types/split-install'
import { NAlert, NButton, NSpin, NTag } from 'naive-ui'
import { computed, nextTick, ref } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'
import { formatBytes } from '@renderer/utils/format-bytes'
import { PLAN_META } from '@renderer/utils/install-plan-meta'

const props = defineProps<{
  sourceDeviceId: string
  targetDeviceId: string
  packageName: string
  displayName: string | null
}>()

const transferStore = useDeviceTransferStore()

const ROLE_LABELS: Record<SplitApkPart['role'], string> = {
  base: 'Base',
  abi: 'Architecture',
  density: 'Screen density',
  language: 'Language',
  unknown: 'Other'
}

const analysisMatchesSelection = computed(
  () =>
    transferStore.analysis !== null &&
    transferStore.analyzedSourceId === props.sourceDeviceId &&
    transferStore.analyzedTargetId === props.targetDeviceId &&
    transferStore.analyzedPackageName === props.packageName
)

const totalSizeBytes = computed(
  () => transferStore.analysis?.parts.reduce((sum, part) => sum + part.fileSizeBytes, 0) ?? 0
)

const progressMessage = computed(() => {
  const progress = transferStore.progress
  if (progress?.phase === 'pulling') {
    return `Copying file ${progress.fileNumber} of ${progress.totalFiles} from the source: ${progress.fileName}`
  }
  if (progress?.phase === 'checking') {
    return 'Checking the copied files against the target device…'
  }
  if (progress?.phase === 'installing') {
    return `Installing ${progress.fileCount} file(s) on the target device…`
  }
  return 'Copying files from the source device… this can take a minute for large apps.'
})

function issueTitle(issue: SplitInstallIssue): string {
  if (issue.severity === 'error') return 'This will likely fail'
  if (issue.severity === 'warning') return 'Heads up'
  return 'For your information'
}

function partQualifier(part: SplitApkPart): string {
  return part.abi ?? part.density ?? part.language ?? part.rawSplitAttribute ?? ''
}

const rootRef = ref<HTMLElement | null>(null)
const copyButtonRef = ref<{ $el: unknown } | null>(null)

/** Each step swaps out the button that had focus. If focus was lost that
 *  way (not moved by the user meanwhile), put it on the next step: the copy
 *  button when it's usable, otherwise this review, which explains why not. */
async function restoreFocus(preferCopyButton: boolean): Promise<void> {
  await nextTick()
  if (document.activeElement && document.activeElement !== document.body) {
    return
  }
  const button = copyButtonRef.value?.$el
  if (preferCopyButton && button instanceof HTMLButtonElement && !button.disabled) {
    button.focus()
  } else {
    rootRef.value?.focus()
  }
}

async function checkCompatibility(): Promise<void> {
  await transferStore.analyze(props.sourceDeviceId, props.targetDeviceId, props.packageName)
  await restoreFocus(true)
}

async function confirmCopy(): Promise<void> {
  if (analysisMatchesSelection.value) {
    await transferStore.confirm()
    await restoreFocus(false)
  }
}
</script>

<template>
  <div ref="rootRef" tabindex="-1" class="flex flex-col gap-3 outline-none">
    <NSpin v-if="transferStore.loading" :show="true">
      <div
        class="flex h-24 items-center justify-center text-sm text-text-muted"
        role="status"
        aria-live="polite"
      >
        {{ progressMessage }}
      </div>
    </NSpin>

    <NAlert v-else-if="transferStore.errorMessage" type="error" title="Couldn't check this app">
      {{ transferStore.errorMessage }}
    </NAlert>

    <template v-else-if="analysisMatchesSelection && transferStore.analysis">
      <div class="flex items-start gap-3 rounded border border-border p-3">
        <AppIdentity
          :label="transferStore.analysis.label ?? displayName ?? packageName"
          :package-name="packageName"
          :icon-data-url="transferStore.analysis.iconDataUrl"
          size="lg"
        />
        <div class="min-w-0 flex-1">
          <NTag
            v-if="transferStore.analysis.plan"
            size="small"
            :type="PLAN_META[transferStore.analysis.plan.operation].tagType"
          >
            {{ PLAN_META[transferStore.analysis.plan.operation].label }}
          </NTag>
          <div class="text-xs text-text-muted">
            {{ transferStore.analysis.versionName ?? 'unknown version' }} (code
            {{ transferStore.analysis.versionCode ?? '?' }}) ·
            {{ transferStore.analysis.parts.length }} file(s) · {{ formatBytes(totalSizeBytes) }}
          </div>
        </div>
      </div>

      <NAlert
        v-for="(issue, index) in transferStore.analysis.issues"
        :key="index"
        :type="issue.severity"
        :title="issueTitle(issue)"
      >
        {{ issue.message }}
      </NAlert>

      <ul class="flex flex-col divide-y divide-border rounded border border-border text-sm">
        <li
          v-for="part in transferStore.analysis.parts"
          :key="part.fileName"
          class="flex items-center gap-2 px-3 py-1.5"
        >
          <span class="min-w-0 flex-1 truncate">{{ part.fileName }}</span>
          <span class="text-xs text-text-muted">
            {{ ROLE_LABELS[part.role] }}{{ partQualifier(part) ? ` · ${partQualifier(part)}` : '' }}
          </span>
          <NTag v-if="!part.deviceCompatible" size="small" type="error">Not compatible</NTag>
          <span class="w-16 text-right text-xs tabular-nums text-text-muted">
            {{ formatBytes(part.fileSizeBytes) }}
          </span>
        </li>
      </ul>

      <NSpin v-if="transferStore.installing" :show="true">
        <div
          class="flex h-16 items-center justify-center text-sm text-text-muted"
          role="status"
          aria-live="polite"
        >
          {{ progressMessage }}
        </div>
      </NSpin>

      <NAlert
        v-else-if="transferStore.result"
        :type="transferStore.result.success ? 'success' : 'error'"
        :title="transferStore.result.success ? 'Copied' : 'Copy failed'"
      >
        {{ transferStore.result.message }}
      </NAlert>
    </template>

    <!-- Before the check: still show which app was picked. -->
    <div v-else class="flex items-start gap-3 rounded border border-border p-3">
      <AppIdentity :label="displayName ?? packageName" :package-name="packageName" size="lg" />
    </div>

    <div class="flex justify-end">
      <NButton
        v-if="!analysisMatchesSelection"
        type="primary"
        :loading="transferStore.loading"
        :disabled="transferStore.busy"
        @click="void checkCompatibility()"
      >
        Check compatibility
      </NButton>
      <NButton
        v-else-if="!transferStore.result?.success"
        ref="copyButtonRef"
        type="primary"
        :disabled="!transferStore.analysis?.canInstall || transferStore.busy"
        :loading="transferStore.installing"
        @click="void confirmCopy()"
      >
        Copy &amp; install {{ transferStore.analysis?.parts.length ?? 0 }} file(s)
      </NButton>
    </div>
  </div>
</template>
