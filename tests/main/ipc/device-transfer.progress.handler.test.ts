import Database from 'better-sqlite3'
import type { DeviceRegistry } from '@main/android/device-registry'
import { FakeAdbClient } from '../../fakes/fake-adb-client'
import type { KnownDevice } from '@shared/validation/device.schema'
import { IpcChannel, IpcEventChannel } from '@shared/constants/ipc-channels'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  analyzeDeviceTransfer: vi.fn(),
  performDeviceTransfer: vi.fn(),
  getDeviceTransferPackages: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle }
}))

vi.mock('@main/android/device-transfer.service', () => ({
  analyzeDeviceTransfer: mocks.analyzeDeviceTransfer,
  performDeviceTransfer: mocks.performDeviceTransfer,
  getDeviceTransferPackages: mocks.getDeviceTransferPackages
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

const TARGET: KnownDevice = { ...SOURCE, id: 'target-serial', model: 'Pixel 9' }
const TRANSFER_ID = 'd18263c4-2799-45f2-9ec4-7f4c77e3b4a1'
const PROGRESS: DeviceTransferProgressUpdate = {
  phase: 'pulling',
  fileName: 'base.apk',
  fileNumber: 1,
  totalFiles: 2
}

type TestSender = {
  isDestroyed: () => boolean
  send: (channel: string, payload: unknown) => void
}

type TestHandler = (event: { sender: TestSender }, payload: unknown) => Promise<unknown>

function getHandler(channel: IpcChannel): TestHandler {
  const registration = mocks.handle.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel
  )
  if (!registration) throw new Error(`Missing IPC handler for "${channel}".`)
  return registration[1] as unknown as TestHandler
}

describe('device transfer progress IPC', () => {
  let db: Database.Database

  beforeEach(() => {
    vi.clearAllMocks()
    db = new Database(':memory:')
    registerDeviceTransferHandlers(db, new FakeAdbClient(), {
      getCurrentDevices: () => [SOURCE, TARGET]
    } as unknown as DeviceRegistry)
  })

  afterEach(() => {
    db.close()
  })

  it('sends analysis progress to the requesting renderer with its transfer ID', async () => {
    mocks.analyzeDeviceTransfer.mockImplementationOnce(
      async (
        _adb: unknown,
        _sourceId: string,
        _targetId: string,
        _packageName: string,
        _parseApk: undefined,
        onProgress?: (progress: DeviceTransferProgressUpdate) => void
      ) => {
        onProgress?.(PROGRESS)
        return {}
      }
    )
    const sender: TestSender = { isDestroyed: () => false, send: vi.fn() }

    await getHandler(IpcChannel.AnalyzeDeviceTransfer)(
      { sender },
      {
        sourceDeviceId: SOURCE.id,
        targetDeviceId: TARGET.id,
        packageName: 'com.example.app',
        transferId: TRANSFER_ID
      }
    )

    expect(sender.send).toHaveBeenCalledWith(IpcEventChannel.DeviceTransferProgress, {
      transferId: TRANSFER_ID,
      ...PROGRESS
    })
  })

  it('sends install progress to the requesting renderer', async () => {
    mocks.performDeviceTransfer.mockImplementationOnce(
      async (
        _db: unknown,
        _adb: unknown,
        _sourceId: string,
        _targetId: string,
        _packageName: string,
        _expectedVersionCode: number | null,
        _historyNote: string,
        _parseApk: undefined,
        onProgress?: (progress: DeviceTransferProgressUpdate) => void
      ) => {
        onProgress?.({ phase: 'installing', fileCount: 2 })
        return { success: true, message: 'Installed', rawOutput: 'Success' }
      }
    )
    const sender: TestSender = { isDestroyed: () => false, send: vi.fn() }

    await getHandler(IpcChannel.PerformDeviceTransfer)(
      { sender },
      {
        sourceDeviceId: SOURCE.id,
        targetDeviceId: TARGET.id,
        packageName: 'com.example.app',
        expectedVersionCode: 8,
        transferId: TRANSFER_ID
      }
    )

    expect(sender.send).toHaveBeenCalledWith(IpcEventChannel.DeviceTransferProgress, {
      transferId: TRANSFER_ID,
      phase: 'installing',
      fileCount: 2
    })
  })
})
