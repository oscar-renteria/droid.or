import type { AppInfo } from '@shared/types/app-info'
import { type Ref, onMounted, ref } from 'vue'

/**
 * Thin wrapper around the one IPC round-trip this milestone exists to prove:
 * renderer -> preload bridge -> main handler -> validated response back.
 * Resolves to null if window.droidor is unavailable (e.g. the renderer is
 * opened outside Electron) rather than throwing, matching the app-wide rule
 * that missing information is shown as "Not available", not as an error.
 */
export function useAppInfo(): { appInfo: Ref<AppInfo | null> } {
  const appInfo = ref<AppInfo | null>(null)

  onMounted(async () => {
    if (!window.droidor) {
      return
    }
    try {
      appInfo.value = await window.droidor.getAppInfo()
    } catch {
      appInfo.value = null
    }
  })

  return { appInfo }
}
