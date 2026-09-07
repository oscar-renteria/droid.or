/**
 * Standard Java/Android package name shape: dot-separated segments, each
 * starting with a letter. Every argv element is already passed to adb via
 * execFile (never a shell string), so this isn't an injection barrier —
 * it's a sanity check against a corrupted database row or an unexpected
 * value reaching a mutating command, per the project's explicit
 * "validate package names" rule.
 */
const VALID_PACKAGE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/

export function isValidPackageName(packageName: string): boolean {
  return packageName.length <= 255 && VALID_PACKAGE_NAME_PATTERN.test(packageName)
}
