import type { AdbAvailability } from '@shared/types/device'
import { type Ref, onMounted, ref } from 'vue'

export function useAdbAvailability(): { adbAvailability: Ref<AdbAvailability | null> } {
  const adbAvailability = ref<AdbAvailability | null>(null)

  onMounted(async () => {
    if (!window.droidor) {
      return
    }
    try {
      adbAvailability.value = await window.droidor.getAdbAvailability()
    } catch {
      adbAvailability.value = null
    }
  })

  return { adbAvailability }
}
