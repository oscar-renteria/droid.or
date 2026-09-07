/**
 * Real adb serials are alphanumeric (optionally with . _ - :), the last two
 * for USB bus paths and network ip:port serials respectively. This isn't a
 * security boundary — every call site passes serials as argv elements, never
 * through a shell, so injection is not possible regardless — but a defensive
 * shape check on values pulled from our own database or from adb's own
 * output catches corruption before it reaches a spawned process.
 */
const VALID_SERIAL_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export function isValidAdbSerial(serial: string): boolean {
  return VALID_SERIAL_PATTERN.test(serial)
}
