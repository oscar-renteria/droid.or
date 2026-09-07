// app-info-parser ships no types, and its subpath resolves to a real .js
// file on disk — which means an ambient `declare module` for that exact
// path is never consulted (TypeScript only falls back to ambient
// declarations when normal resolution fails to find a file at all), so the
// import is asserted to a local interface instead, typing only the fields
// this file actually reads. Shared here so every APK-parsing consumer
// (installed-app metadata, local install-candidate inspection) goes
// through one typed wrapper instead of re-declaring this dance.
// @ts-expect-error -- untyped package; see comment above.
import ApkParserImport from 'app-info-parser/src/apk'

export interface RawApkApplication {
  /** Verified against real APKs: this is never a plain string — it is
   *  always every value the resource table stores under that string
   *  resource's id, one per locale/density configuration bucket
   *  (a single-locale app still gets an array of near-duplicates). The
   *  first entry is consistently the base/default-configuration value,
   *  including on a heavily-localized app (100+ unrelated strings sharing
   *  the array) where later entries are other strings entirely, not other
   *  translations of this one. */
  label?: string | string[]
}

export interface RawApkInfo {
  package: string
  versionName: string | null
  versionCode: number | null
  usesSdk: { minSdkVersion?: number; targetSdkVersion?: number } | null
  application: RawApkApplication
  /** Set by app-info-parser itself, after it resolves the app's icon
   *  resource to actual image bytes — already a single, resolved base64
   *  data URL (unlike `application.label`, which needs its own
   *  array-handling; verified against real APKs that this one is not an
   *  array). Undefined when the APK has no icon. */
  icon?: string
}

interface ApkParserConstructor {
  new (filePath: string): { parse: () => Promise<RawApkInfo> }
}

const ApkParser = ApkParserImport as unknown as ApkParserConstructor

export function parseApkFile(localApkPath: string): Promise<RawApkInfo> {
  return new ApkParser(localApkPath).parse()
}
