<script setup lang="ts">
import type { MutatingOperationType } from '@shared/types/operation'
import { NAlert, NButton, NInput, NModal } from 'naive-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  packageCount: number
  operation: MutatingOperationType
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: []
}>()

const typedConfirmation = ref('')

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      typedConfirmation.value = ''
    }
  }
)

const copy = computed(() => {
  if (props.operation === 'uninstall-for-user') {
    return {
      title: 'Uninstall these apps?',
      description:
        'This removes each app for your user only. The system copy stays on the device, so restoring it later (including from the Recovery page) may be possible — but Android does not guarantee that, especially after a system update.'
    }
  }
  return {
    title: 'Disable these apps?',
    description:
      'Each app stops running and disappears from the launcher, but stays installed and can be re-enabled at any time — individually, or all at once from the Recovery page.'
  }
})

// Uninstalling, even just for this user, is harder to reverse than
// disabling — the same tier of action that requires typed confirmation
// for a single package in OperationConfirmDialog.
const requiresTypedConfirmation = computed(() => props.operation === 'uninstall-for-user')
const confirmationWord = 'UNINSTALL'

const canConfirm = computed(() => {
  if (!requiresTypedConfirmation.value) {
    return true
  }
  return typedConfirmation.value.trim() === confirmationWord
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
    type="warning"
    @update:show="(value: boolean) => !value && handleClose()"
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        This will apply to <span class="font-medium">{{ packageCount }}</span> selected package(s).
        {{ copy.description }}
      </p>

      <NAlert v-if="requiresTypedConfirmation" type="warning" :show-icon="true">
        This action needs extra confirmation. Type
        <span class="font-mono font-semibold">{{ confirmationWord }}</span> below to continue.
      </NAlert>
      <NInput
        v-if="requiresTypedConfirmation"
        v-model:value="typedConfirmation"
        :placeholder="confirmationWord"
      />
    </div>

    <template #action>
      <NButton @click="handleClose">Cancel</NButton>
      <NButton type="warning" :disabled="!canConfirm" @click="handleConfirm">
        Apply to {{ packageCount }} package(s)
      </NButton>
    </template>
  </NModal>
</template>
