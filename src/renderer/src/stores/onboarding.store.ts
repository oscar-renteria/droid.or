import { defineStore } from 'pinia'
import { ref } from 'vue'

export const ONBOARDING_SEEN_KEY = 'droidor.onboarding-seen'

function readSeen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true'
  } catch {
    // Storage unavailable: show the guide rather than hide it forever.
    return false
  }
}

/** First-run setup guide: shown once automatically, re-openable from
 *  Settings. Per-machine UI state, so it lives in localStorage next to the
 *  theme preference rather than in the database. */
export const useOnboardingStore = defineStore('onboarding', () => {
  const seen = ref(readSeen())
  const reopened = ref(false)

  function dismiss(): void {
    seen.value = true
    reopened.value = false
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    } catch {
      // Shown again next start; harmless.
    }
  }

  function open(): void {
    reopened.value = true
  }

  return { seen, reopened, dismiss, open }
})
