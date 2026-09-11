import { describe, expect, it } from 'vitest'
import { AdbCommandLog } from '@main/adb/adb-command-log'
import { LoggingAdbClient } from '@main/adb/logging-adb-client'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

describe('LoggingAdbClient', () => {
  it('logs a successful shell command with its device, category, and duration', async () => {
    const inner = new FakeAdbClient()
    inner.shellResponses.set(`${SERIAL}\ndumpsys battery`, 'level: 80')
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    const result = await client.shellCommand(SERIAL, ['dumpsys', 'battery'])

    expect(result).toBe('level: 80')
    const [entry] = log.getAll()
    expect(entry).toMatchObject({
      deviceId: SERIAL,
      category: 'shell',
      command: 'dumpsys battery',
      success: true,
      errorMessage: null
    })
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs a rejected shell command as a failure with the error message, and still rejects', async () => {
    const inner = new FakeAdbClient()
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    await expect(client.shellCommand(SERIAL, ['dumpsys', 'battery'])).rejects.toThrow()

    const [entry] = log.getAll()
    expect(entry?.success).toBe(false)
    expect(entry?.errorMessage).toMatch(/no shell response configured/)
  })

  it('treats a non-zero mutation exit code as a failure, even though the promise resolves', async () => {
    const inner = new FakeAdbClient()
    inner.mutationResponses.set(`${SERIAL}\npm disable-user com.example.app`, {
      exitCode: 1,
      stdout: '',
      stderr: 'Failure [not installed for 0]'
    })
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    const result = await client.runMutationCommand(SERIAL, [
      'pm',
      'disable-user',
      'com.example.app'
    ])

    expect(result.exitCode).toBe(1)
    const [entry] = log.getAll()
    expect(entry).toMatchObject({
      category: 'mutation',
      success: false,
      errorMessage: 'Failure [not installed for 0]'
    })
  })

  it('logs a successful mutation (exit code 0) as success', async () => {
    const inner = new FakeAdbClient()
    inner.mutationResponses.set(`${SERIAL}\npm enable com.example.app`, {
      exitCode: 0,
      stdout: 'Package com.example.app new state: enabled',
      stderr: ''
    })
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    await client.runMutationCommand(SERIAL, ['pm', 'enable', 'com.example.app'])

    const [entry] = log.getAll()
    expect(entry?.success).toBe(true)
    expect(entry?.errorMessage).toBeNull()
  })

  it('logs listDevicesOnce with a null deviceId, since it is not device-specific', async () => {
    const inner = new FakeAdbClient()
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    await client.listDevicesOnce()

    const [entry] = log.getAll()
    expect(entry).toMatchObject({ deviceId: null, category: 'list-devices' })
  })

  it('logs installMultipleApks under its own category', async () => {
    const inner = new FakeAdbClient()
    inner.mutationResponses.set(`${SERIAL}\ninstall-multiple -r base.apk split.apk`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    await client.installMultipleApks(SERIAL, ['base.apk', 'split.apk'])

    const [entry] = log.getAll()
    expect(entry).toMatchObject({
      deviceId: SERIAL,
      category: 'install-multiple-apk',
      success: true
    })
  })

  it('does not log watchDevices, since it is a persistent stream rather than a one-shot command', () => {
    const inner = new FakeAdbClient()
    const log = new AdbCommandLog()
    const client = new LoggingAdbClient(inner, log)

    const stop = client.watchDevices(
      () => {},
      () => {}
    )
    stop()

    expect(log.getAll()).toEqual([])
  })
})
