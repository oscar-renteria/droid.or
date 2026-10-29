import { ipcMain, shell } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  donationProviderIdSchema,
  type OpenDonationLinkResult
} from '@shared/validation/support.schema'
import { DONATION_URLS, validateSafeExternalUrl } from '../../support/support-config'

export function registerSupportHandlers(): void {
  ipcMain.handle(
    IpcChannel.OpenDonationLink,
    async (_event, rawProvider: unknown): Promise<OpenDonationLinkResult> => {
      const provider = donationProviderIdSchema.safeParse(rawProvider)
      if (!provider.success) {
        return { success: false, urlOpened: null, error: 'Invalid donation provider.' }
      }

      const url = DONATION_URLS[provider.data]
      if (!validateSafeExternalUrl(url)) {
        return { success: false, urlOpened: null, error: 'Invalid donation destination.' }
      }

      try {
        await shell.openExternal(url)
        return { success: true, urlOpened: url, error: null }
      } catch (error) {
        return {
          success: false,
          urlOpened: url,
          error: error instanceof Error ? error.message : 'Failed to launch the system browser.'
        }
      }
    }
  )
}
