import type { DroidorApi } from '@shared/types/droidor-api'

declare global {
  interface Window {
    droidor: DroidorApi
  }
}

export {}
