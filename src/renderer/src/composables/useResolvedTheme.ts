import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui'
import { type ComputedRef, computed, onScopeDispose, ref, watchEffect } from 'vue'
import { useSettingsStore } from '@renderer/stores/settings.store'

const brandThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#10B981',
    primaryColorHover: '#34D399',
    primaryColorPressed: '#059669'
  }
}

/**
 * Resolves the user's theme preference (light/dark/system) against the OS
 * media query, keeps Tailwind's `.dark` class variant and Naive UI's theme
 * object in sync with that single source of truth, and exposes both to
 * components that need to branch on the current mode explicitly.
 */
export function useResolvedTheme(): {
  isDark: ComputedRef<boolean>
  naiveTheme: ComputedRef<GlobalTheme | null>
  themeOverrides: GlobalThemeOverrides
} {
  const settings = useSettingsStore()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const prefersDark = ref(media.matches)

  const onChange = (event: MediaQueryListEvent): void => {
    prefersDark.value = event.matches
  }
  media.addEventListener('change', onChange)
  onScopeDispose(() => media.removeEventListener('change', onChange))

  const isDark = computed(() => {
    if (settings.themeMode === 'system') {
      return prefersDark.value
    }
    return settings.themeMode === 'dark'
  })

  watchEffect(() => {
    document.documentElement.classList.toggle('dark', isDark.value)
  })

  const naiveTheme = computed<GlobalTheme | null>(() => (isDark.value ? darkTheme : null))

  return { isDark, naiveTheme, themeOverrides: brandThemeOverrides }
}
