<script setup lang="ts">
import { computed } from 'vue'
import { NAlert, NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useDevicesStore } from '@renderer/stores/devices.store'

defineProps<{
  requirement: string
  noDeviceText: string
}>()

const devicesStore = useDevicesStore()
const router = useRouter()

const connectionState = computed(
  () => devicesStore.selectedDevice?.connectionState ?? null
)
const canProceed = computed(() => connectionState.value === 'device')
</script>

<template>
  <div v-if="!canProceed" class="flex flex-col items-center justify-center h-full p-6 text-center">
    <NAlert
      type="error"
      :title="requirement"
      class="w-full max-w-md mb-4 border border-border"
    >
      {{ noDeviceText }}
    </NAlert>
    <NButton size="small" @click="router.push({ name: 'settings' })">Go to Settings</NButton>
  </div>
  <div v-else class="min-h-0 w-full">
    <slot />
  </div>
</template>