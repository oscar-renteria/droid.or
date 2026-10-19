import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui'
import { type ComputedRef, computed, onScopeDispose, ref, watchEffect } from 'vue'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { darkPalette, lightPalette, type NaivePalette } from '@renderer/theme/palette'

// Tailwind v4's default --font-sans / --font-mono stacks, so Naive components
// and Tailwind-styled text render in the same font.
const FONT_SANS =
  'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
const FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

/** Naive does not derive hover/pressed/suppl variants from an overridden base
 *  color, so every variant is set explicitly. */
function buildOverrides(p: NaivePalette): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: p.primary,
      primaryColorHover: p.primaryHover,
      primaryColorPressed: p.primaryPressed,
      primaryColorSuppl: p.primaryHover,
      successColor: p.success,
      successColorHover: p.successHover,
      successColorPressed: p.successPressed,
      successColorSuppl: p.successHover,
      warningColor: p.warning,
      warningColorHover: p.warningHover,
      warningColorPressed: p.warningPressed,
      warningColorSuppl: p.warningHover,
      errorColor: p.error,
      errorColorHover: p.errorHover,
      errorColorPressed: p.errorPressed,
      errorColorSuppl: p.errorHover,
      infoColor: p.info,
      infoColorHover: p.infoHover,
      infoColorPressed: p.infoPressed,
      infoColorSuppl: p.infoHover,
      bodyColor: p.body,
      cardColor: p.card,
      tableColor: p.card,
      modalColor: p.card,
      popoverColor: p.popover,
      borderRadius: '6px',
      borderRadiusSmall: '4px',
      fontFamily: FONT_SANS,
      fontFamilyMono: FONT_MONO
    }
  }
}

const lightOverrides = buildOverrides(lightPalette)
const darkOverrides = buildOverrides(darkPalette)

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
  const themeOverrides = computed(() => (isDark.value ? darkOverrides : lightOverrides))

  return { isDark, naiveTheme, themeOverrides }
}
