import { parseApkFile, type RawApkApplication } from './apk-parser-loader'

export interface ApkMetadata {
  label: string | null
  /** A correctly-labeled `data:<mime>;base64,...` URL, or null if the APK
   *  had no icon or parsing failed. */
  iconDataUrl: string | null
}

const MAGIC_BYTES: ReadonlyArray<{ mime: string; signature: number[] }> = [
  { mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" container; WebP specifically
  { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] }
]

/**
 * app-info-parser's icon data URL always declares "image/png" regardless of
 * the actual bytes — verified against a real APK (Waze) whose icon was
 * genuine WebP (RIFF/WEBP magic bytes) but came back labeled image/png,
 * which a strict image decoder can refuse to render. This re-derives the
 * mime type from the actual bytes rather than trusting the label.
 *
 * Returns null (not the original, still-mislabeled string) when the bytes
 * don't match any known raster format — verified against a real app
 * (Secure Folder) whose `application.icon` resource was a *single* Adaptive
 * Icon XML descriptor with no raster fallback (`["res/M3.xml"]`); the
 * library returns that XML's raw bytes as if they were image data. There is
 * no safe way to render that, so this is treated as "no icon available"
 * rather than passed through to an <img> tag, which would just render as a
 * broken-image icon. Full Adaptive Icon support (resolving and compositing
 * the separate foreground/background layers) is a real follow-up feature,
 * not something this function attempts.
 */
export function fixDataUrlMimeType(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    return null
  }
  const base64 = dataUrl.slice(commaIndex + 1)
  const bytes = Buffer.from(base64.slice(0, 16), 'base64')

  for (const { mime, signature } of MAGIC_BYTES) {
    if (signature.every((byte, index) => bytes[index] === byte)) {
      return `data:${mime};base64,${base64}`
    }
  }
  return null
}

/**
 * Resolves `application.label` to a single display string. Verified
 * against several real APKs: this field is never a plain string — it is
 * always an array of every value the resource table stores under that
 * string resource's id (one per locale/density configuration bucket, even
 * for a single-locale app), and on a heavily localized app it can contain
 * dozens of entries that are other strings entirely (a resource-table
 * lookup quirk in the parsing library, not real translations of the app
 * name). The first entry was, in every real APK checked, the correct
 * base/default-configuration app name — so this takes that one rather
 * than attempting to disambiguate the rest.
 */
export function resolveApkLabel(application: RawApkApplication | undefined): string | null {
  const label = application?.label
  const resolved = Array.isArray(label) ? label[0] : label
  return resolved?.trim() || null
}

/** Parses a locally-available APK file (already pulled from the device) for
 *  its resolved app label and icon. Never throws: any parse failure (a
 *  malformed or split APK, an unsupported icon format) degrades to nulls
 *  rather than breaking the caller. */
export async function extractApkMetadata(localApkPath: string): Promise<ApkMetadata> {
  try {
    const result = await parseApkFile(localApkPath)
    return {
      label: resolveApkLabel(result.application),
      iconDataUrl: result.icon ? fixDataUrlMimeType(result.icon) : null
    }
  } catch {
    return { label: null, iconDataUrl: null }
  }
}
