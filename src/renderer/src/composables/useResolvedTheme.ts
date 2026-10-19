import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui'
import { type ComputedRef, computed, onScopeDispose, ref, watchEffect } from 'vue'
import { useSettingsStore } from '@renderer/stores/settings.store'

/* §6.2 — Naive UI theme overrides, per theme. Hex values are literal because
 * Naive derives alpha variants (hover/pressed/etc.) from them. Each value
 * mirrors its --color-* token in tailwind.css so the two systems stay in sync.
 */
const lightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#007a55',
    primaryColorHover: '#006045',
    primaryColorPressed: '#064e3b',
    primaryColorSuppl: '#007a55',
    errorColor: '#c10007',
    warningColor: '#bb4d00',
    successColor: '#007a55',
    infoColor: '#0069a8',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
    fontFamily: 'var(--font-sans)',
    fontFamilyMono: 'var(--font-mono)'
  }
}

const darkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#10b981',
    primaryColorHover: '#00d492',
    primaryColorPressed: '#009966',
    primaryColorSuppl: '#10b981',
    errorColor: '#f87171',
    warningColor: '#fb923c',
    successColor: '#34d399',
    infoColor: '#38bdf8',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
    fontFamily: 'var(--font-sans)',
    fontFamilyMono: 'var(--font-mono)'
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
  themeOverrides: ComputedRef<GlobalThemeOverrides>
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

  return { isDark, naiveTheme, themeOverrides: computed(() => (isDark.value ? darkOverrides : lightOverrides)) }
}
