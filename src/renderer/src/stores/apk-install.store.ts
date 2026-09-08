import type { ApkInspectionResult, InstallPlan, LocalApkInfo } from '@shared/types/apk-install'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type QueueItemStatus = 'inspecting' | 'ready' | 'installing' | 'success' | 'failed' | 'error'

export interface ApkQueueItem {
  filePath: string
  status: QueueItemStatus
  info: LocalApkInfo | null
  plan: InstallPlan | null
  /** Set when status is 'error' (couldn't be read as an APK at all) or
   *  'failed' (adb rejected the install) — same field either way, since
   *  the UI shows it identically. */
  message: string | null
}

export const useApkInstallStore = defineStore('apkInstall', () => {
  const queue = ref<ApkQueueItem[]>([])
  const installingAll = ref(false)

  /** Looks the item up fresh through the reactive array every time, rather
   *  than closing over the object reference from before it was pushed —
   *  mutating that pre-push reference doesn't go through Vue's reactive
   *  proxy, so the UI would silently never reflect it (a real bug this
   *  fixes: the queue looked permanently stuck "inspecting" even after
   *  the underlying IPC call had long since resolved). */
  function findItem(filePath: string): ApkQueueItem | undefined {
    return queue.value.find((item) => item.filePath === filePath)
  }

  /** Skips a path already in the queue rather than inspecting it twice —
   *  dropping the same file again (or picking it via the file dialog after
   *  already dragging it in) is a plausible slip, not a request for a
   *  duplicate row. */
  async function addFiles(deviceId: string, filePaths: string[]): Promise<void> {
    const existing = new Set(queue.value.map((item) => item.filePath))
    const newPaths = filePaths.filter((path) => !existing.has(path))

    queue.value.push(
      ...newPaths.map((filePath): ApkQueueItem => ({
        filePath,
        status: 'inspecting',
        info: null,
        plan: null,
        message: null
      }))
    )

    await Promise.all(newPaths.map((filePath) => inspectItem(deviceId, filePath)))
  }

  async function inspectItem(deviceId: string, filePath: string): Promise<void> {
    if (!window.droidor) {
      return
    }
    try {
      const result: ApkInspectionResult = await window.droidor.inspectApkFile(deviceId, filePath)
      const item = findItem(filePath)
      if (!item) {
        return
      }
      item.info = result.info
      item.plan = result.plan
      item.status = 'ready'
    } catch (error) {
      const item = findItem(filePath)
      if (!item) {
        return
      }
      item.status = 'error'
      item.message = error instanceof Error ? error.message : 'Failed to read this file.'
    }
  }

  async function installItem(deviceId: string, filePath: string): Promise<void> {
    const item = findItem(filePath)
    if (!window.droidor || !item || item.status !== 'ready') {
      return
    }
    item.status = 'installing'
    try {
      const result = await window.droidor.installApk(deviceId, filePath)
      const current = findItem(filePath)
      if (!current) {
        return
      }
      current.status = result.success ? 'success' : 'failed'
      current.message = result.message
    } catch (error) {
      const current = findItem(filePath)
      if (!current) {
        return
      }
      current.status = 'failed'
      current.message = error instanceof Error ? error.message : 'Install failed.'
    }
  }

  /** Sequential, never concurrent — these share the device's single USB
   *  connection, same as every other bulk action in this app. */
  async function installAll(deviceId: string): Promise<void> {
    installingAll.value = true
    try {
      for (const item of [...queue.value]) {
        if (item.status === 'ready') {
          await installItem(deviceId, item.filePath)
        }
      }
    } finally {
      installingAll.value = false
    }
  }

  function removeItem(filePath: string): void {
    queue.value = queue.value.filter((item) => item.filePath !== filePath)
  }

  function reset(): void {
    queue.value = []
  }

  return { queue, installingAll, addFiles, installItem, installAll, removeItem, reset }
})
