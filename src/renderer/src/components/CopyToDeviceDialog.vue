<script setup lang="ts">
import { NAlert, NButton, NModal, NSelect } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import DeviceTransferReview from '@renderer/components/install/DeviceTransferReview.vue'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { deviceDisplayName } from '@renderer/utils/device-display-name'

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

      <DeviceTransferReview
        v-if="targetDeviceId"
        :source-device-id="sourceDeviceId"
        :target-device-id="targetDeviceId"
        :package-name="packageName"
        :display-name="displayName"
      />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton :disabled="transferStore.busy" @click="close">
          {{ transferStore.result?.success ? 'Close' : 'Cancel' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
