import { safeStorage as electronSafeStorage } from 'electron'
import type Database from 'better-sqlite3'
import { getSetting, setSetting } from './settings.repository'

/** Narrow shape of the two `safeStorage` operations this file needs,
 *  injectable (defaulting to the real Electron module) purely so tests can
 *  supply an in-memory fake — `safeStorage` isn't available outside a real
 *  Electron process, the same reason `platform-tools-manager.ts` injects
 *  its own network call rather than using Electron's `net` directly in
 *  something a plain Vitest run would call. */
export interface SecretStorage {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

const PROVIDER_KEY = 'ai_provider'
const MODEL_KEY = 'ai_model'
const BASE_URL_KEY = 'ai_base_url'
const API_KEY_KEY = 'ai_api_key'

export type AiProviderId = 'anthropic' | 'openai-compatible'

export interface AiSettings {
  provider: AiProviderId | null
  model: string | null
  /** Only meaningful for the 'openai-compatible' provider. */
  baseUrl: string | null
  /** Whether a key is currently stored — the key itself is never read back
   *  by anything outside this file, including the renderer. */
  hasApiKey: boolean
}

export interface AiSettingsUpdate {
  provider: AiProviderId | null
  model: string | null
  baseUrl: string | null
  /** Omitted (or undefined): leave the stored key untouched. Null: clear
   *  it. A string: replace it. The key is never round-tripped back to the
   *  renderer once saved, so "leave untouched" has to be its own case,
   *  distinguishable from "the user wants to clear it". */
  apiKey?: string | null | undefined
}

function isValidProvider(value: string | null): value is AiProviderId {
  return value === 'anthropic' || value === 'openai-compatible'
}

export function getAiSettings(db: Database.Database): AiSettings {
  const provider = getSetting(db, PROVIDER_KEY)
  return {
    provider: isValidProvider(provider) ? provider : null,
    model: getSetting(db, MODEL_KEY),
    baseUrl: getSetting(db, BASE_URL_KEY),
    hasApiKey: getSetting(db, API_KEY_KEY) !== null
  }
}

export function setAiSettings(
  db: Database.Database,
  update: AiSettingsUpdate,
  secretStorage: SecretStorage = electronSafeStorage
): void {
  setSetting(db, PROVIDER_KEY, update.provider)
  setSetting(db, MODEL_KEY, update.model)
  setSetting(db, BASE_URL_KEY, update.baseUrl)

  if (update.apiKey === undefined) {
    return
  }
  if (update.apiKey === null || update.apiKey.length === 0) {
    setSetting(db, API_KEY_KEY, null)
    return
  }
  if (!secretStorage.isEncryptionAvailable()) {
    throw new Error(
      "This system's OS-level secret storage isn't available, so an API key can't be stored securely here."
    )
  }
  setSetting(db, API_KEY_KEY, secretStorage.encryptString(update.apiKey).toString('base64'))
}

/** Decrypts and returns the stored key — used only by the AI analysis
 *  service when actually calling a provider, never exposed over IPC. */
export function getDecryptedApiKey(
  db: Database.Database,
  secretStorage: SecretStorage = electronSafeStorage
): string | null {
  const encrypted = getSetting(db, API_KEY_KEY)
  if (encrypted === null) {
    return null
  }
  try {
    return secretStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}
