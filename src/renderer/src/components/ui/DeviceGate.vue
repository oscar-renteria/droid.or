<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const props = defineProps<{
  /** Fallback guidance for a selected device whose state has none of its own. */
  requirement: string
  /** Shown when no device is selected at all. */
  noDeviceText: string
}>()

const devicesStore = useDevicesStore()
const device = computed(() => devicesStore.selectedDevice)
const canProceed = computed(() => device.value?.connectionState === 'device')

const title = computed(() =>
  device.value ? getDeviceStateMeta(device.value.connectionState).label : 'No device selected'
)
const body = computed(() =>
  device.value
    ? (getDeviceStateMeta(device.value.connectionState).guidance ?? props.requirement)
    : props.noDeviceText
)
</script>

<template>
  <div v-if="canProceed" class="h-full min-h-0 w-full">
    <slot />
  </div>
  <EmptyState v-else :title="title" :description="body" class="h-full" />
</template>
