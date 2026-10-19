/**
 * Literal hex colors for Naive UI theme overrides. Naive needs real color
 * values (it derives alpha variants from them), so each entry mirrors a
 * --color-* token in styles/tailwind.css. Values are Tailwind v4 palette
 * steps converted to hex — change a value here and in tailwind.css together.
 */
export interface NaivePalette {
  primary: string
  primaryHover: string
  primaryPressed: string
  success: string
  successHover: string
  successPressed: string
  warning: string
  warningHover: string
  warningPressed: string
  error: string
  errorHover: string
  errorPressed: string
  info: string
  infoHover: string
  infoPressed: string
  body: string
  card: string
  popover: string
}

export const lightPalette: NaivePalette = {
  primary: '#007a55', // emerald-700 — --color-primary
  primaryHover: '#006045', // emerald-800 — --color-primary-hover
  primaryPressed: '#004f3b', // emerald-900 — --color-primary-pressed
  success: '#007a55', // emerald-700 — --color-success
  successHover: '#006045',
  successPressed: '#004f3b',
  warning: '#bb4d00', // amber-700 — --color-warning
  warningHover: '#973c00', // amber-800
  warningPressed: '#7b3306', // amber-900
  error: '#c10007', // red-700 — --color-danger
  errorHover: '#9f0712', // red-800
  errorPressed: '#82181a', // red-900
  info: '#0069a8', // sky-700 — --color-info
  infoHover: '#00598a', // sky-800
  infoPressed: '#024a70', // sky-900
  body: '#ffffff', // --color-background
  card: '#ffffff', // --color-background
  popover: '#ffffff'
}

export const darkPalette: NaivePalette = {
  primary: '#10b981', // brand emerald — --color-primary
  primaryHover: '#00d492', // emerald-400 — --color-primary-hover
  primaryPressed: '#009966', // emerald-600 — --color-primary-pressed
  success: '#00d492', // emerald-400 — --color-success
  successHover: '#5ee9b5', // emerald-300
  successPressed: '#00bc7d', // emerald-500
  warning: '#ffb900', // amber-400 — --color-warning
  warningHover: '#ffd230', // amber-300
  warningPressed: '#fe9a00', // amber-500
  error: '#ff6467', // red-400 — --color-danger
  errorHover: '#ffa2a2', // red-300
  errorPressed: '#fb2c36', // red-500
  info: '#00bcff', // sky-400 — --color-info
  infoHover: '#74d4ff', // sky-300
  infoPressed: '#00a6f4', // sky-500
  body: '#030712', // gray-950 — --color-background
  card: '#101828', // gray-900 — --color-surface
  popover: '#1e2939' // gray-800 — --color-surface-elevated
}
