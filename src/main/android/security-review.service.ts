import type { SecurityReviewResult } from '@shared/validation/security-review.schema'
import type { AdbClient } from '../adb/adb-client'
import { parseAccessibilityServicePackages } from '../adb/parsers/accessibility-services-parser'
import { parseDeviceAdminPackages } from '../adb/parsers/device-admin-parser'

/**
 * Surfaces exactly two read-only signals ADB can see that are worth a
 * human's attention: which apps hold Device Admin, and which hold an
 * Accessibility Service — the two most common real persistence/abuse
 * mechanisms for Android apps that behave maliciously. This is
 * deliberately not, and does not claim to be, malware detection: a
 * non-rooted ADB session cannot inspect firmware, the kernel, running
 * network connections, or a sandboxed app's own files. Holding either
 * permission is normal for many legitimate apps (device management
 * tools, launchers, screen readers) — this list is raw material for a
 * human to recognize or not recognize, not a verdict.
 */
export async function getSecurityReview(
  adbClient: AdbClient,
  serial: string
): Promise<SecurityReviewResult> {
  const [deviceAdminOutput, accessibilityOutput] = await Promise.all([
    adbClient.shellCommand(serial, ['dumpsys', 'device_policy']),
    adbClient.shellCommand(serial, ['settings', 'get', 'secure', 'enabled_accessibility_services'])
  ])

  return {
    deviceAdminPackages: parseDeviceAdminPackages(deviceAdminOutput),
    accessibilityServicePackages: parseAccessibilityServicePackages(accessibilityOutput)
  }
}
