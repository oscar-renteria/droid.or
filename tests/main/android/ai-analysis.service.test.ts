import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import { setAiSettings, type SecretStorage } from '@main/persistence/ai-settings.repository'
import { analyzePackageWithAi } from '@main/android/ai-analysis.service'
import type { AiProvider, PackageAiAnalysisInput } from '@main/ai/ai-provider'
import type { KnownDevice } from '@shared/validation/device.schema'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

function fakeSecretStorage(): SecretStorage {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(plainText, 'utf-8'),
    decryptString: (encrypted) => encrypted.toString('utf-8')
  }
}

const DEVICE: KnownDevice = {
  id: 'R5CY73MF2QL',
  nickname: null,
  manufacturer: 'Samsung',
  model: 'SM-F766B',
  androidVersion: '16',
  sdkVersion: 36,
  connectionState: 'device',
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  lastConnectedAt: '2026-01-01T00:00:00.000Z'
}

const REQUEST = {
  deviceId: DEVICE.id,
  packageName: 'com.example.app',
  displayName: 'Example App',
  versionName: '1.0',
  isSystemApp: true
}

describe('analyzePackageWithAi', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('rejects when no provider is configured', async () => {
    const adb = new FakeAdbClient()

    await expect(analyzePackageWithAi(db, adb, DEVICE, REQUEST)).rejects.toThrow(/no ai provider/i)
  })

  it('rejects when a provider is configured but no key has been saved', async () => {
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null },
      fakeSecretStorage()
    )
    const adb = new FakeAdbClient()

    await expect(analyzePackageWithAi(db, adb, DEVICE, REQUEST)).rejects.toThrow(/no api key/i)
  })

  it('builds the prompt input from device info, the request, and fetched permissions, then returns the provider result', async () => {
    const storage = fakeSecretStorage()
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null, apiKey: 'sk-test' },
      storage
    )
    const adb = new FakeAdbClient()
    adb.shellResponses.set(
      `${DEVICE.id}\ndumpsys package com.example.app`,
      [
        '  Package [com.example.app] (abc123):',
        '    requested permissions:',
        '      android.permission.INTERNET',
        '    install permissions:'
      ].join('\n')
    )

    let capturedInput: PackageAiAnalysisInput | null = null
    const analyzePackage = vi.fn(async (input: PackageAiAnalysisInput) => {
      capturedInput = input
      return { text: 'Looks safe to disable.', model: 'claude-sonnet-5' }
    })
    const fakeProvider: AiProvider = { analyzePackage }

    const result = await analyzePackageWithAi(
      db,
      adb,
      DEVICE,
      REQUEST,
      { anthropic: () => fakeProvider, 'openai-compatible': () => fakeProvider },
      storage
    )

    expect(result).toEqual({
      text: 'Looks safe to disable.',
      model: 'claude-sonnet-5',
      provider: 'anthropic'
    })
    expect(capturedInput).toEqual({
      manufacturer: 'Samsung',
      model: 'SM-F766B',
      androidVersion: '16',
      packageName: 'com.example.app',
      appLabel: 'Example App',
      versionName: '1.0',
      isSystemApp: true,
      permissions: ['android.permission.INTERNET']
    })
  })

  it('degrades to an empty permissions list rather than failing the whole request when dumpsys fails', async () => {
    const storage = fakeSecretStorage()
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null, apiKey: 'sk-test' },
      storage
    )
    const adb = new FakeAdbClient()
    // No shellResponses configured — the dumpsys call rejects.

    const analyzePackage = vi.fn(async () => ({ text: 'ok', model: 'claude-sonnet-5' }))
    const fakeProvider: AiProvider = { analyzePackage }

    await analyzePackageWithAi(
      db,
      adb,
      DEVICE,
      REQUEST,
      { anthropic: () => fakeProvider, 'openai-compatible': () => fakeProvider },
      storage
    )

    expect(analyzePackage).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [] }),
      expect.anything()
    )
  })

  it('propagates a provider failure (e.g. an API error) to the caller', async () => {
    const storage = fakeSecretStorage()
    setAiSettings(
      db,
      { provider: 'openai-compatible', model: 'gpt-4o-mini', baseUrl: null, apiKey: 'sk-test' },
      storage
    )
    const adb = new FakeAdbClient()

    const fakeProvider: AiProvider = {
      analyzePackage: vi.fn().mockRejectedValue(new Error('rate limit exceeded'))
    }

    await expect(
      analyzePackageWithAi(
        db,
        adb,
        DEVICE,
        REQUEST,
        { anthropic: () => fakeProvider, 'openai-compatible': () => fakeProvider },
        storage
      )
    ).rejects.toThrow('rate limit exceeded')
  })
})
