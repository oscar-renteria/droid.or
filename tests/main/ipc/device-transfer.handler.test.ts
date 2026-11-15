import Database from 'better-sqlite3'
import type { DeviceRegistry } from '@main/android/device-registry'
import { FakeAdbClient } from '../../fakes/fake-adb-client'
import type { KnownDevice } from '@shared/validation/device.schema'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { ZodError } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceTransferPackage } from '@shared/types/device-transfer'

const mocks = vi.hoisted(() => ({ handle: vi.fn() }))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle }
}))

const { registerDeviceTransferHandlers } =
  await import('@main/ipc/handlers/device-transfer.handler')

const SOURCE: KnownDevice = {
  id: 'source-serial',
  nickname: null,
  manufacturer: 'Samsung',
  model: 'Galaxy S24',
  androidVersion: '15',
  sdkVersion: 35,
  connectionState: 'device',
  firstSeenAt: '2026-10-10T10:00:00.000Z',
  lastConnectedAt: '2026-10-10T10:00:00.000Z'
}

type PackagesHandler = (_event: unknown, payload: unknown) => Promise<DeviceTransferPackage[]>

function getPackagesHandler(): PackagesHandler {
  const registration = mocks.handle.mock.calls.find(
    ([channel]) => channel === IpcChannel.GetDeviceTransferPackages
  )
  if (!registration) throw new Error('Device transfer package handler was not registered.')
  return registration[1] as PackagesHandler
}

describe('registerDeviceTransferHandlers package listing', () => {
  let adb: FakeAdbClient
  let db: Database.Database
  let getCurrentDevices: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    adb = new FakeAdbClient()
    db = new Database(':memory:')
    getCurrentDevices = vi.fn(() => [SOURCE])
    const registry = { getCurrentDevices } as unknown as DeviceRegistry
    registerDeviceTransferHandlers(db, adb, registry)
  })

  afterEach(() => {
    db.close()
  })

  it('lists third-party packages and versions from the requested source serial', async () => {
    adb.shellResponses.set(
      `${SOURCE.id}\npm list packages -3`,
      'package:com.whatsapp\npackage:com.example.reader'
    )
    adb.shellResponses.set(
      `${SOURCE.id}\ndumpsys package packages`,
      [
        '  Package [com.whatsapp] (abc123):',
        '    versionCode=22420000 minSdk=23 targetSdk=34',
        '    versionName=2.24.20',
        '  Package [com.example.reader] (def456):',
        '    versionCode=8 minSdk=26 targetSdk=35',
        '    versionName=1.8.0'
      ].join('\n')
    )

    await expect(getPackagesHandler()(undefined, { sourceDeviceId: SOURCE.id })).resolves.toEqual([
      {
        packageName: 'com.whatsapp',
        displayName: 'WhatsApp',
        versionName: '2.24.20',
        versionCode: 22420000
      },
      {
        packageName: 'com.example.reader',
        displayName: null,
        versionName: '1.8.0',
        versionCode: 8
      }
    ])
    expect(getCurrentDevices).toHaveBeenCalledOnce()
  })

  it('rejects a malformed source serial with Zod before querying devices or ADB', async () => {
    await expect(
      getPackagesHandler()(undefined, { sourceDeviceId: 'source serial' })
    ).rejects.toBeInstanceOf(ZodError)
    expect(getCurrentDevices).not.toHaveBeenCalled()
  })
})
