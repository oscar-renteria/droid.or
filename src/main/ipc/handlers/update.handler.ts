import { ipcMain, shell } from 'electron'
import { z } from 'zod'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { updateStatusSchema, type UpdateStatus } from '@shared/validation/update.schema'
import { validateSafeExternalUrl } from '../../support/support-config'
import type { UpdateCheckService } from '../../update/update-check.service'

export function registerUpdateHandlers(updateCheckService: UpdateCheckService): void {
  ipcMain.handle(IpcChannel.GetUpdateStatus, async (): Promise<UpdateStatus> =>
    updateStatusSchema.parse(await updateCheckService.getStatus())
  )

  ipcMain.handle(
    IpcChannel.SetUpdateCheckEnabled,
    async (_event, rawEnabled: unknown): Promise<UpdateStatus> => {
      const enabled = z.boolean().parse(rawEnabled)
      return updateStatusSchema.parse(await updateCheckService.setEnabled(enabled))
    }
  )

  // Takes no arguments: the URL comes from the main process's own status,
  // and still passes the same https-allow-list check as donation links.
  ipcMain.handle(IpcChannel.OpenReleasePage, async (): Promise<void> => {
    const { releaseUrl } = await updateCheckService.getStatus()
    if (!releaseUrl || !validateSafeExternalUrl(releaseUrl)) {
      throw new Error('No release page is available.')
    }
    await shell.openExternal(releaseUrl)
  })
}
