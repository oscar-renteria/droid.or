import { describe, expect, it } from 'vitest'
import { stripIpcErrorPrefix } from '@shared/utils/ipc-error'

describe('stripIpcErrorPrefix', () => {
  it("removes Electron's remote-method prefix and the error class name", () => {
    expect(
      stripIpcErrorPrefix(
        "Error invoking remote method 'ai:set-settings': Error: Secret storage isn't available."
      )
    ).toBe("Secret storage isn't available.")
    expect(
      stripIpcErrorPrefix("Error invoking remote method 'split-install:install': TypeError: boom")
    ).toBe('boom')
  })

  it('keeps messages without the prefix unchanged', () => {
    expect(stripIpcErrorPrefix('Install failed.')).toBe('Install failed.')
    expect(stripIpcErrorPrefix('Error: kept as is')).toBe('Error: kept as is')
  })
})
