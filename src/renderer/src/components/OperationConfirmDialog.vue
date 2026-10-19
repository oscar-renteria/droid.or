<script setup lang="ts">
import type { OperationType } from '@shared/types/operation'
import type { RiskLevel } from '@shared/types/analyzer'
import { NAlert, NButton, NInput, NModal } from 'naive-ui'
import AppIdentity from '@renderer/components/ui/AppIdentity.vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  packageName: string
  displayName: string | null
  operation: OperationType
  isSystemApp: boolean
  /** Null when no classification is available for this package (e.g. shown
   *  from the Apps tab rather than the Analyzer) — confirmation severity
   *  then falls back to the operation/isSystemApp combination alone. */
  risk: RiskLevel | null
  /** User-marked "Important" (spec §16) — always requires typed
   *  confirmation, regardless of risk classification. */
  isFavorite: boolean
  /** Optional human-readable impact, passed from the Analyzer's
   *  recommendation.potentialImpact. Other call sites pass nothing. */
  potentialImpact?: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: []
}>()

const typedConfirmation = ref('')
const confirmInputRef = ref<InstanceType<typeof NInput> | null>(null)

function focusConfirmInput(): void {
  confirmInputRef.value?.focus()
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      typedConfirmation.value = ''
    }
  }
)

const copy = computed(() => {
  switch (props.operation) {
    case 'disable':
      return {
        title: 'Disable this app?',
        description:
          'The app stops running and disappears from the launcher, but stays installed and can be re-enabled at any time.'
      }
    case 'enable':
      return {
        title: 'Enable this app?',
        description: 'The app becomes active again and reappears in the launcher.'
      }
    case 'uninstall-for-user':
      return props.isSystemApp
        ? {
            title: 'Uninstall for this user?',
            description:
              'This removes the app for your user only. The system copy stays on the device, so restoring it later may be possible — but Android does not guarantee that, especially after a system update.'
          }
        : {
            title: 'Uninstall this app?',
            description:
              'This completely removes the app and its data from the device — the same as an ordinary uninstall. You can reinstall it later from wherever you got it.'
          }
    case 'clear-data':
      return {
        title: 'Clear app data?',
        description:
          "This erases the app's data and cache — signed-in accounts, saved files, settings — as if freshly installed. This cannot be undone."
      }
    case 'restore-install':
      return {
        title: 'Restore this app?',
        description:
          'This reinstalls the app for your user using the copy already present on the device — no new data is downloaded.'
      }
    default:
      return { title: 'Confirm action', description: '' }
  }
})

/** Dialog and confirm-button severity by operation, so destructive actions
 *  are visually ranked above safe ones. */
const dialogType = computed(() => {
  switch (props.operation) {
    case 'enable':
    case 'restore-install':
      return 'info'
    case 'disable':
      return 'warning'
    case 'uninstall-for-user':
    case 'clear-data':
      return 'error'
    default:
      return 'warning'
  }
})

const confirmButtonType = computed(() => {
  switch (props.operation) {
    case 'enable':
    case 'restore-install':
    case 'disable':
      return 'primary'
    case 'uninstall-for-user':
    case 'clear-data':
      return 'error'
    default:
      return 'warning'
  }
})

/** Verb used for the confirm button label, matching the operation. */
const actionVerb = computed(() => {
  switch (props.operation) {
    case 'disable':
      return 'Disable'
    case 'enable':
      return 'Enable'
    case 'uninstall-for-user':
      return 'Uninstall'
    case 'clear-data':
      return 'Clear data'
    case 'restore-install':
      return 'Restore'
    default:
      return 'Confirm'
  }
})

/** Extra typed confirmation for the combinations most likely to surprise or
 *  be hard to reverse: an uncertain/critical-classified package, uninstalling
 *  a system app specifically (the spec singles out "particularly dangerous"
 *  operations for this, rather than applying it uniformly to every action),
 *  or a package the user themselves marked Important (spec §16 — "Important
 *  applications should receive stronger warnings before modification"). */
const requiresTypedConfirmation = computed(() => {
  if (props.isFavorite) {
    return true
  }
  if (props.risk === 'advanced' || props.risk === 'critical') {
    return true
  }
  return props.operation === 'uninstall-for-user' && props.isSystemApp
})

const confirmationWord = computed(() => (props.operation === 'clear-data' ? 'CLEAR' : 'UNINSTALL'))

const canConfirm = computed(() => {
  if (!requiresTypedConfirmation.value) {
    return true
  }
  return typedConfirmation.value.trim() === confirmationWord.value
})

function handleConfirm(): void {
  if (!canConfirm.value) {
    return
  }
  emit('confirm')
}

function handleClose(): void {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    :title="copy.title"
    :type="dialogType"
    @update:show="(value: boolean) => !value && handleClose()"
    @after-enter="focusConfirmInput"
  >
    <div class="flex flex-col gap-3">
      <div>
        <AppIdentity :label="displayName ?? packageName" :package-name="packageName" size="md" />
      </div>
      <p class="text-sm text-text-secondary">{{ copy.description }}</p>
      <div v-if="props.potentialImpact" class="rounded-lg border border-divider bg-surface p-2">
        <div class="text-xs font-semibold tracking-wide text-text-muted uppercase">
          Potential impact
        </div>
        <p class="mt-0.5 text-sm break-words text-text-secondary">{{ props.potentialImpact }}</p>
      </div>

      <NAlert v-if="isFavorite" type="error" :show-icon="true">
        You marked this app as Important. Double-check that you really want to do this before
        continuing.
      </NAlert>

      <NAlert v-if="requiresTypedConfirmation" type="warning" :show-icon="true">
        This action needs extra confirmation. Type
        <span class="font-mono font-semibold">{{ confirmationWord }}</span> below to continue.
      </NAlert>
      <div v-if="requiresTypedConfirmation" class="flex flex-col gap-1">
        <label for="typed-confirmation" class="text-xs font-medium text-text-secondary">
          Type {{ confirmationWord }} to confirm
        </label>
        <NInput
          ref="confirmInputRef"
          v-model:value="typedConfirmation"
          :placeholder="confirmationWord"
          :input-props="{ id: 'typed-confirmation', autocomplete: 'off' }"
          @keydown.enter="handleConfirm"
        />
      </div>
    </div>

    <template #action>
      <NButton @click="handleClose">Cancel</NButton>
      <NButton :type="confirmButtonType" :disabled="!canConfirm" @click="handleConfirm">{{
        actionVerb
      }}</NButton>
    </template>
  </NModal>
</template>
