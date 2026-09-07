import { describe, expect, it } from 'vitest'
import { appInfoSchema } from '@shared/validation/app-info.schema'

describe('appInfoSchema', () => {
  it('accepts a well-formed app info payload', () => {
    const result = appInfoSchema.safeParse({
      appVersion: '0.1.0',
      electronVersion: '44.2.0',
      chromeVersion: '128.0.0',
      nodeVersion: '22.0.0',
      platform: 'linux',
      arch: 'x64'
    })

    expect(result.success).toBe(true)
  })

  it('rejects an unsupported platform value', () => {
    const result = appInfoSchema.safeParse({
      appVersion: '0.1.0',
      electronVersion: '44.2.0',
      chromeVersion: '128.0.0',
      nodeVersion: '22.0.0',
      platform: 'android',
      arch: 'x64'
    })

    expect(result.success).toBe(false)
  })
})
