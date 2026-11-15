<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@renderer/components/ui/EmptyState.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'
import { getDeviceStateMeta } from '@renderer/utils/device-state-meta'

const props = withDefaults(
  defineProps<{
    /** Fallback guidance for a selected device whose state has none of its own. */
    requirement: string
    /** Title shown when no device is selected. */
    noDeviceTitle?: string
    /** Guidance shown when no device is selected at all. */
    noDeviceText: string
  }>(),
  { noDeviceTitle: 'No device selected' }
)

const devicesStore = useDevicesStore()
const device = computed(() => devicesStore.selectedDevice)
const canProceed = computed(() => device.value?.connectionState === 'device')

const title = computed(() =>
  device.value ? getDeviceStateMeta(device.value.connectionState).label : props.noDeviceTitle
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
  <!-- The gate replaces the whole view, PageHeader included, so its title is
       the page's h1. -->
  <EmptyState v-else :title="title" :description="body" :heading-level="1" class="h-full" />
</template>
