<script setup lang="ts">
import type { SplitApkPart, SplitInstallIssue } from '@shared/types/split-install'
import { NAlert, NButton, NModal, NSelect, NSpin, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'
import { formatBytes } from '@renderer/utils/format-bytes'
import { PLAN_META } from '@renderer/utils/install-plan-meta'

const props = defineProps<{
  show: boolean
  /** Captured by the caller when the dialog opens, not read live from the
   *  sidebar — switching the sidebar's device mid-flow must not silently
   *  change where the app is copied from. */
  sourceDeviceId: string
  packageName: string
  displayName: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const devicesStore = useDevicesStore()
const transferStore = useDeviceTransferStore()
const targetDeviceId = ref<string | null>(null)

const ROLE_LABELS: Record<SplitApkPart['role'], string> = {
  base: 'Base',
  abi: 'Architecture',
  density: 'Screen density',
  language: 'Language',
  unknown: 'Other'
}

const sourceDevice = computed(
  () => devicesStore.devices.find((device) => device.id === props.sourceDeviceId) ?? null
)

const targetOptions = computed(() =>
  devicesStore.devices
    .filter((device) => device.connectionState === 'device' && device.id !== props.sourceDeviceId)
    .map((device) => ({ label: deviceDisplayName(device), value: device.id }))
)

watch(
  () => props.show,
  (visible) => {
    // Remounted mid-request (DeviceGate unmounts this while the source is
    // briefly disconnected): keep the running request's state visible.
    if (visible && !transferStore.busy) {
      transferStore.reset()
      targetDeviceId.value =
        targetOptions.value.length === 1 ? (targetOptions.value[0]?.value ?? null) : null
    }
  },
  { immediate: true }
)

// A result computed for one target must never drive an install onto
// another, so any target change — picked by the user, or the chosen
// device disconnecting — throws the current check away.
watch(targetDeviceId, () => {
  if (!transferStore.busy) {
    transferStore.reset()
  }
})
// While a request runs or once it has a result, the target stays selected
// even if it drops off briefly — clearing it would hide the outcome.
watch(targetOptions, (options) => {
  if (transferStore.busy || transferStore.result) {
    return
  }
  if (targetDeviceId.value && !options.some((option) => option.value === targetDeviceId.value)) {
    targetDeviceId.value = null
  }
})

const analysisMatchesSelection = computed(
  () =>
    transferStore.analysis !== null &&
    transferStore.analyzedSourceId === props.sourceDeviceId &&
    transferStore.analyzedTargetId === targetDeviceId.value &&
    transferStore.analyzedPackageName === props.packageName
)

const totalSizeBytes = computed(
  () => transferStore.analysis?.parts.reduce((sum, part) => sum + part.fileSizeBytes, 0) ?? 0
)

function issueTitle(issue: SplitInstallIssue): string {
  if (issue.severity === 'error') return 'This will likely fail'
  if (issue.severity === 'warning') return 'Heads up'
  return 'For your information'
}

function partQualifier(part: SplitApkPart): string {
  return part.abi ?? part.density ?? part.language ?? part.rawSplitAttribute ?? ''
}

function checkCompatibility(): void {
  if (!targetDeviceId.value) {
    return
  }
  void transferStore.analyze(props.sourceDeviceId, targetDeviceId.value, props.packageName)
}

function confirmCopy(): void {
  if (!analysisMatchesSelection.value) {
    return
  }
  void transferStore.confirm()
}

function close(): void {
  if (transferStore.busy) {
    return
  }
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="Copy app to another device"
    style="width: 640px"
    :mask-closable="!transferStore.busy"
    :closable="!transferStore.busy"
    @update:show="(value: boolean) => !value && close()"
  >
    <div class="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
      <p class="text-sm text-text-secondary">
        Copies every APK file of
        <span class="font-medium text-text">{{ displayName ?? packageName }}</span>
        from
        <span class="font-medium text-text">{{
          sourceDevice ? deviceDisplayName(sourceDevice) : sourceDeviceId
        }}</span>
        — the base APK and all of its split files — and installs them on the device you choose.
      </p>

      <NAlert type="warning" title="What this does not copy" :show-icon="true">
        Only the app itself is copied, not its data, accounts or logins — it starts on the target as
        a fresh install. Apps that check where they were installed from (Play integrity protection,
        common for banking apps) may install fine but refuse to start or sign in. It won't receive
        Play Store updates on the target either.
      </NAlert>

      <div class="flex items-center gap-2">
        <span class="shrink-0 text-sm text-text-secondary">Target device</span>
        <NSelect
          v-model:value="targetDeviceId"
          :options="targetOptions"
          :disabled="transferStore.busy"
          placeholder="Choose a connected device"
          size="small"
        />
      </div>
      <p v-if="targetOptions.length === 0" class="text-xs text-text-muted">
        Connect and authorize a second device to copy this app.
      </p>

      <NSpin v-if="transferStore.loading" :show="true">
        <div class="flex h-24 items-center justify-center text-sm text-text-muted">
          Copying files from the source device… this can take a minute for large apps.
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
              {{ ROLE_LABELS[part.role]
              }}{{ partQualifier(part) ? ` · ${partQualifier(part)}` : '' }}
            </span>
            <NTag v-if="!part.deviceCompatible" size="small" type="error">Not compatible</NTag>
            <span class="w-16 text-right text-xs tabular-nums text-text-muted">
              {{ formatBytes(part.fileSizeBytes) }}
            </span>
          </li>
        </ul>

        <NSpin v-if="transferStore.installing" :show="true">
          <div class="flex h-16 items-center justify-center text-sm text-text-muted">
            Copying from the source and installing on the target…
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
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton :disabled="transferStore.busy" @click="close">
          {{ transferStore.result?.success ? 'Close' : 'Cancel' }}
        </NButton>
        <NButton
          v-if="!analysisMatchesSelection"
          type="primary"
          :disabled="!targetDeviceId"
          :loading="transferStore.loading"
          @click="checkCompatibility"
        >
          Check compatibility
        </NButton>
        <NButton
          v-else-if="!transferStore.result?.success"
          type="primary"
          :disabled="!transferStore.analysis?.canInstall"
          :loading="transferStore.installing"
          @click="confirmCopy"
        >
          Copy &amp; install {{ transferStore.analysis?.parts.length ?? 0 }} file(s)
        </NButton>
      </div>
    </template>
  </NModal>
</template>
