import type { UpdateStatus } from '@shared/validation/update.schema'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useUpdateStore = defineStore('update', () => {
  const status = ref<UpdateStatus | null>(null)

  /** True only when a newer release is known — every failure (no bridge,
   *  IPC error, offline) leaves the badge hidden rather than showing an
   *  error: an update hint is never worth interrupting the user for. */
  const updateAvailable = computed(() => status.value?.updateAvailable === true)
  const latestVersion = computed(() => status.value?.latestVersion ?? null)

  async function load(): Promise<void> {
    try {
      status.value = (await window.droidor?.getUpdateStatus()) ?? null
    } catch {
      status.value = null
    }
  }

  async function setCheckEnabled(enabled: boolean): Promise<void> {
    const next = await window.droidor?.setUpdateCheckEnabled(enabled)
    if (next) {
      status.value = next
    }
  }

  async function openReleasePage(): Promise<void> {
    await window.droidor?.openReleasePage()
  }

  return { status, updateAvailable, latestVersion, load, setCheckEnabled, openReleasePage }
})
