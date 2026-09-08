import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IpcChannel } from '@shared/constants/ipc-channels'
import type { SafetyDisclaimerStatus } from '@shared/validation/safety-disclaimer.schema'
import { getSetting, setSetting } from '../../persistence/settings.repository'

const ACKNOWLEDGED_AT_SETTING_KEY = 'safety_disclaimer_acknowledged_at'

export function registerSafetyDisclaimerHandlers(db: Database.Database): void {
  ipcMain.handle(IpcChannel.GetSafetyDisclaimerStatus, (): SafetyDisclaimerStatus => {
    return { acknowledgedAt: getSetting(db, ACKNOWLEDGED_AT_SETTING_KEY) }
  })

  ipcMain.handle(IpcChannel.AcknowledgeSafetyDisclaimer, (): SafetyDisclaimerStatus => {
    const acknowledgedAt = new Date().toISOString()
    setSetting(db, ACKNOWLEDGED_AT_SETTING_KEY, acknowledgedAt)
    return { acknowledgedAt }
  })
}
