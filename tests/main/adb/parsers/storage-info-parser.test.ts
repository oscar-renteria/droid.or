import { describe, expect, it } from 'vitest'
import { parseStorageInfo } from '@main/adb/parsers/storage-info-parser'

describe('parseStorageInfo', () => {
  it('parses a real `df /data` capture, where "Mounted on" is /data/user/0, not /data', () => {
    const output = [
      'Filesystem       1K-blocks      Used Available Use% Mounted on',
      '/dev/block/dm-74 232318976 115395296 116792608  50% /data/user/0'
    ].join('\n')

    expect(parseStorageInfo(output)).toEqual({ totalKb: 232318976, availableKb: 116792608 })
  })

  it('returns nulls when there is no data row', () => {
    expect(
      parseStorageInfo('Filesystem       1K-blocks      Used Available Use% Mounted on')
    ).toEqual({ totalKb: null, availableKb: null })
  })

  it('returns nulls for empty output', () => {
    expect(parseStorageInfo('')).toEqual({ totalKb: null, availableKb: null })
  })
})
