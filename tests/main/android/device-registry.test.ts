import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DeviceRegistry } from '@main/android/device-registry'
import type { RawAdbDevice } from '@main/adb/device-list-parser'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function rawDevice(serial: string, state: RawAdbDevice['state'] = 'device'): RawAdbDevice {
  return { serial, state, diagnosticMessage: null, properties: {} }
}

describe('DeviceRegistry', () => {
  let db: Database.Database
  let adb: FakeAdbClient
  let registry: DeviceRegistry

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
    registry = new DeviceRegistry(db, adb)
    registry.start()
  })

  afterEach(() => {
    registry.stop()
    db.close()
  })

  it('shows a newly connected authorized device with enriched properties', async () => {
    adb.deviceProperties.set(
      'ABC123',
      new Map([
        ['ro.product.manufacturer', 'Google'],
        ['ro.product.model', 'Pixel 8'],
        ['ro.build.version.release', '15'],
        ['ro.build.version.sdk', '35']
      ])
    )

    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()

    const devices = registry.getCurrentDevices()
    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      id: 'ABC123',
      manufacturer: 'Google',
      model: 'Pixel 8',
      androidVersion: '15',
      sdkVersion: 35,
      connectionState: 'device'
    })
  })

  it('shows an unauthorized device live without persisting it', () => {
    adb.emitSnapshot([rawDevice('XYZ', 'unauthorized')])

    const devices = registry.getCurrentDevices()
    expect(devices).toHaveLength(1)
    expect(devices[0]?.connectionState).toBe('unauthorized')

    adb.emitSnapshot([])
    expect(registry.getCurrentDevices()).toHaveLength(0)
  })

  it('keeps a device in history as "disconnected" after it is unplugged', async () => {
    adb.deviceProperties.set('ABC123', new Map([['ro.product.model', 'Pixel 8']]))
    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()

    adb.emitSnapshot([])
    const devices = registry.getCurrentDevices()
    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      id: 'ABC123',
      connectionState: 'disconnected',
      model: 'Pixel 8'
    })
  })

  it('renames a device', async () => {
    adb.deviceProperties.set('ABC123', new Map())
    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()

    registry.renameDevice('ABC123', 'My Phone')
    expect(registry.getCurrentDevices()[0]?.nickname).toBe('My Phone')
  })

  it('refuses to remove a currently attached device', async () => {
    adb.deviceProperties.set('ABC123', new Map())
    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()

    registry.removeDevice('ABC123')
    expect(registry.getCurrentDevices()).toHaveLength(1)
  })

  it('removes a disconnected device from history', async () => {
    adb.deviceProperties.set('ABC123', new Map())
    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()
    adb.emitSnapshot([])

    registry.removeDevice('ABC123')
    expect(registry.getCurrentDevices()).toHaveLength(0)
  })

  it('clears history but keeps currently attached devices', async () => {
    adb.deviceProperties.set('ABC123', new Map())
    adb.deviceProperties.set('DEF456', new Map())
    adb.emitSnapshot([rawDevice('ABC123'), rawDevice('DEF456')])
    await flushAsync()
    adb.emitSnapshot([rawDevice('ABC123')])
    await flushAsync()

    registry.clearHistory()
    expect(registry.getCurrentDevices().map((d) => d.id)).toEqual(['ABC123'])
  })

  it('assigns a transient id per no-permissions row without crashing', () => {
    adb.emitSnapshot([
      { serial: null, state: 'no-permissions', diagnosticMessage: 'no permissions', properties: {} }
    ])
    const devices = registry.getCurrentDevices()
    expect(devices).toHaveLength(1)
    expect(devices[0]?.connectionState).toBe('no-permissions')
  })

  it('notifies subscribers on every change', () => {
    const seenLengths: number[] = []
    registry.onDevicesChanged((devices) => seenLengths.push(devices.length))

    adb.emitSnapshot([rawDevice('ABC123', 'unauthorized')])
    expect(seenLengths).toEqual([1])
  })
})
