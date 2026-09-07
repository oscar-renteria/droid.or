import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'droidor.theme-mode'

function readStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export const useSettingsStore = defineStore('settings', () => {
  const themeMode = ref<ThemeMode>(readStoredThemeMode())

  watchEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeMode.value)
  })

  function setThemeMode(mode: ThemeMode): void {
    themeMode.value = mode
  }

  return { themeMode, setThemeMode }
})
