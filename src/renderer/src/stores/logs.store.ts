import type { AdbCommandLogEntry } from '@shared/types/logs'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLogsStore = defineStore('logs', () => {
  const entries = ref<AdbCommandLogEntry[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      entries.value = (await window.droidor?.getLogs()) ?? []
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load logs.'
    } finally {
      loading.value = false
    }
  }

  async function clear(): Promise<void> {
    await window.droidor?.clearLogs()
    entries.value = []
  }

  async function exportLogs(): Promise<string | null> {
    return (await window.droidor?.exportLogs()) ?? null
  }

  return { entries, loading, errorMessage, load, clear, exportLogs }
})
