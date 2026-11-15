import { describe, expect, it } from 'vitest'
import { installSplitApksRequestSchema } from '@shared/validation/split-install.schema'

describe('installSplitApksRequestSchema', () => {
  const request = {
    deviceId: 'SERIAL1',
    sourceKind: 'archive',
    sourcePaths: ['/tmp/app.apks']
  }

  it('accepts a base-only bundle (no extra parts selected; the base is implicit)', () => {
    expect(
      installSplitApksRequestSchema.safeParse({ ...request, selectedFileNames: [] }).success
    ).toBe(true)
  })

  it('rejects empty file names and a missing source', () => {
    expect(
      installSplitApksRequestSchema.safeParse({ ...request, selectedFileNames: [''] }).success
    ).toBe(false)
    expect(
      installSplitApksRequestSchema.safeParse({
        ...request,
        sourcePaths: [],
        selectedFileNames: []
      }).success
    ).toBe(false)
  })
})
