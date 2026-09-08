import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import {
  getAiSettings,
  getDecryptedApiKey,
  setAiSettings,
  type SecretStorage
} from '@main/persistence/ai-settings.repository'

/** A fake SecretStorage that just base64-round-trips instead of using real
 *  OS-level encryption — `safeStorage` only exists inside a real Electron
 *  process, so a real implementation can't be exercised under Vitest. */
function fakeSecretStorage(available = true): SecretStorage {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plainText) => Buffer.from(plainText, 'utf-8'),
    decryptString: (encrypted) => encrypted.toString('utf-8')
  }
}

describe('ai-settings.repository', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns all-null/false defaults before anything is configured', () => {
    expect(getAiSettings(db)).toEqual({
      provider: null,
      model: null,
      baseUrl: null,
      hasApiKey: false
    })
    expect(getDecryptedApiKey(db, fakeSecretStorage())).toBeNull()
  })

  it('stores provider/model/baseUrl and reports hasApiKey without exposing the key', () => {
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null, apiKey: 'sk-ant-secret' },
      fakeSecretStorage()
    )

    expect(getAiSettings(db)).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      baseUrl: null,
      hasApiKey: true
    })
  })

  it('round-trips the API key through the injected secret storage', () => {
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null, apiKey: 'sk-ant-secret' },
      fakeSecretStorage()
    )

    expect(getDecryptedApiKey(db, fakeSecretStorage())).toBe('sk-ant-secret')
  })

  it('leaves a previously-stored key untouched when apiKey is omitted', () => {
    const storage = fakeSecretStorage()
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'm1', baseUrl: null, apiKey: 'sk-original' },
      storage
    )

    setAiSettings(db, { provider: 'anthropic', model: 'm2', baseUrl: null }, storage)

    expect(getAiSettings(db).model).toBe('m2')
    expect(getDecryptedApiKey(db, storage)).toBe('sk-original')
  })

  it('clears the key when apiKey is explicitly null', () => {
    const storage = fakeSecretStorage()
    setAiSettings(
      db,
      { provider: 'anthropic', model: 'm1', baseUrl: null, apiKey: 'sk-original' },
      storage
    )

    setAiSettings(db, { provider: 'anthropic', model: 'm1', baseUrl: null, apiKey: null }, storage)

    expect(getAiSettings(db).hasApiKey).toBe(false)
    expect(getDecryptedApiKey(db, storage)).toBeNull()
  })

  it('stores a base URL for the openai-compatible provider', () => {
    setAiSettings(db, {
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      baseUrl: 'https://my-proxy.example.com/v1'
    })

    expect(getAiSettings(db)).toMatchObject({
      provider: 'openai-compatible',
      baseUrl: 'https://my-proxy.example.com/v1'
    })
  })

  it('throws rather than storing a key when encryption is unavailable', () => {
    expect(() =>
      setAiSettings(
        db,
        { provider: 'anthropic', model: 'm1', baseUrl: null, apiKey: 'sk-secret' },
        fakeSecretStorage(false)
      )
    ).toThrow(/secret storage/i)
    expect(getAiSettings(db).hasApiKey).toBe(false)
  })
})
