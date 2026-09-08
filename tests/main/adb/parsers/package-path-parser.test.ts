import { describe, expect, it } from 'vitest'
import { parsePackagePaths } from '@main/adb/parsers/package-path-parser'

describe('parsePackagePaths', () => {
  it('parses a single-APK package', () => {
    const output =
      'package:/data/app/~~icVVk1G8CKGA5tqCjmIDew==/org.kde.kdeconnect_tp-OPVIGM3OtYwyIG4gvoMrLA==/base.apk\n'
    expect(parsePackagePaths(output)).toEqual([
      '/data/app/~~icVVk1G8CKGA5tqCjmIDew==/org.kde.kdeconnect_tp-OPVIGM3OtYwyIG4gvoMrLA==/base.apk'
    ])
  })

  it('parses a split/bundle package with several APK files', () => {
    const output = [
      'package:/data/app/~~abc==/com.whatsapp-xyz==/base.apk',
      'package:/data/app/~~abc==/com.whatsapp-xyz==/split_config.arm64_v8a.apk',
      'package:/data/app/~~abc==/com.whatsapp-xyz==/split_config.xxhdpi.apk',
      'package:/data/app/~~abc==/com.whatsapp-xyz==/split_i18n_de.apk',
      ''
    ].join('\n')

    expect(parsePackagePaths(output)).toEqual([
      '/data/app/~~abc==/com.whatsapp-xyz==/base.apk',
      '/data/app/~~abc==/com.whatsapp-xyz==/split_config.arm64_v8a.apk',
      '/data/app/~~abc==/com.whatsapp-xyz==/split_config.xxhdpi.apk',
      '/data/app/~~abc==/com.whatsapp-xyz==/split_i18n_de.apk'
    ])
  })

  it('handles a product-partition path whose filename is not "base.apk"', () => {
    expect(parsePackagePaths('package:/product/app/Gmail2/Gmail2.apk')).toEqual([
      '/product/app/Gmail2/Gmail2.apk'
    ])
  })

  it('returns an empty list for empty output', () => {
    expect(parsePackagePaths('')).toEqual([])
  })
})
