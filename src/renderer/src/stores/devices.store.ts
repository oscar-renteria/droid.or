import type { KnownDevice } from '@shared/types/device'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useDevicesStore = defineStore('devices', () => {
  const devices = ref<KnownDevice[]>([])
  const selectedDeviceId = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  const selectedDevice = computed<KnownDevice | null>(
    () => devices.value.find((device) => device.id === selectedDeviceId.value) ?? null
  )

  async function initialize(): Promise<void> {
    if (!window.droidor) {
      return
    }
    devices.value = await window.droidor.getDevices()
    unsubscribe = window.droidor.onDevicesChanged((updated) => {
      devices.value = updated
    })
  }

  function dispose(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  function selectDevice(id: string | null): void {
    selectedDeviceId.value = id
  }

  async function renameDevice(id: string, nickname: string | null): Promise<void> {
    await window.droidor?.renameDevice(id, nickname)
  }

  async function removeDevice(id: string): Promise<void> {
    await window.droidor?.removeDevice(id)
    if (selectedDeviceId.value === id) {
      selectedDeviceId.value = null
    }
  }

  async function clearHistory(): Promise<void> {
    await window.droidor?.clearDeviceHistory()
  }

  return {
    devices,
    selectedDeviceId,
    selectedDevice,
    initialize,
    dispose,
    selectDevice,
    renameDevice,
    removeDevice,
    clearHistory
  }
})
