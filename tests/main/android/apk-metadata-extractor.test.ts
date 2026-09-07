import { describe, expect, it } from 'vitest'
import { fixDataUrlMimeType } from '@main/android/apk-metadata-extractor'

function dataUrl(declaredMime: string, bytes: number[]): string {
  return `data:${declaredMime};base64,${Buffer.from(bytes).toString('base64')}`
}

describe('fixDataUrlMimeType', () => {
  it('corrects a WebP icon mislabeled as image/png (verified against a real APK: Waze)', () => {
    // Real magic bytes captured from a real device's parsed icon: "RIFF"
    // container header followed by "WEBP", the app-info-parser library
    // labels this "image/png" regardless.
    const webpBytes = [0x52, 0x49, 0x46, 0x46, 0xd6, 0x04, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]
    const input = dataUrl('image/png', webpBytes)

    expect(fixDataUrlMimeType(input)).toMatch(/^data:image\/webp;base64,/)
  })

  it('leaves a correctly labeled PNG working (in effect)', () => {
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const input = dataUrl('image/png', pngBytes)

    expect(fixDataUrlMimeType(input)).toMatch(/^data:image\/png;base64,/)
  })

  it('recognizes a JPEG regardless of declared mime', () => {
    const jpegBytes = [0xff, 0xd8, 0xff, 0xe0]
    const input = dataUrl('image/png', jpegBytes)

    expect(fixDataUrlMimeType(input)).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('returns null for unrecognized bytes rather than passing through a broken image', () => {
    // Verified against a real app (Secure Folder) whose only icon resource
    // was an Adaptive Icon XML descriptor with no raster fallback — the
    // library returns that XML's raw bytes labeled "image/png", which
    // would render as a broken image if passed through as-is.
    const xmlBytes = [0x03, 0x00, 0x08, 0x00, 0x24, 0x02, 0x00, 0x00]
    const input = dataUrl('image/png', xmlBytes)

    expect(fixDataUrlMimeType(input)).toBeNull()
  })

  it('returns null if the input is not a data URL at all', () => {
    expect(fixDataUrlMimeType('not-a-data-url')).toBeNull()
  })
})
