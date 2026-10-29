import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import type { DonationProviderId } from '@shared/validation/support.schema'

type MessageApi = {
  info: (message: string) => void
  warning: (message: string) => void
  error: (message: string) => void
}

export function useSupportLink(messageApi: MessageApi = useMessage()) {
  const opening = ref(false)

  async function openSupportLink(provider: DonationProviderId): Promise<void> {
    if (opening.value) return
    opening.value = true

    try {
      const result = await window.droidor.openDonationLink(provider)
      if (result.success) {
        messageApi.info('Opening link in your browser…')
      } else {
        messageApi.warning(result.error ?? 'Could not open the browser. Link copied to clipboard.')
        if (result.urlOpened) {
          await navigator.clipboard.writeText(result.urlOpened)
        }
      }
    } catch {
      messageApi.error('Failed to open the donation link.')
    } finally {
      setTimeout(() => {
        opening.value = false
      }, 1000)
    }
  }

  return { opening, openSupportLink }
}
