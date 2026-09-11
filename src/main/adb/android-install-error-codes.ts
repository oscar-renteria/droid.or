/**
 * Plain-language explanations for the `INSTALL_FAILED_*`/`INSTALL_PARSE_FAILED_*`
 * codes `adb install`/`adb install-multiple` report (the bracketed text
 * extractInstallFailureMessage pulls out of "Failure [CODE]"). Sourced from
 * Android's own PackageManager error constants, which have been stable
 * across Android versions for years — not verified against a real device
 * producing each one this session. A code that isn't in this table is shown
 * to the user as-is rather than guessed at.
 */
const INSTALL_ERROR_EXPLANATIONS: Readonly<Record<string, string>> = {
  INSTALL_FAILED_ALREADY_EXISTS: 'An identical version of this app is already installed.',
  INSTALL_FAILED_INVALID_APK: 'Android rejected one of these files as a malformed APK.',
  INSTALL_FAILED_INVALID_URI: 'One of the file paths was rejected by the device.',
  INSTALL_FAILED_INSUFFICIENT_STORAGE: 'The device is out of storage space.',
  INSTALL_FAILED_DUPLICATE_PACKAGE: 'This package is already installed under a conflicting entry.',
  INSTALL_FAILED_NO_SHARED_USER:
    'This app expects to share a user ID with another app that is not installed.',
  INSTALL_FAILED_UPDATE_INCOMPATIBLE:
    'The installed version was signed with a different certificate than these files — uninstall it first.',
  INSTALL_FAILED_SHARED_USER_INCOMPATIBLE:
    'This app cannot share a user ID with the currently installed one.',
  INSTALL_FAILED_MISSING_SHARED_LIBRARY:
    'This app depends on a shared library the device does not have.',
  INSTALL_FAILED_OLDER_SDK:
    'This app requires a newer Android version than this device is running.',
  INSTALL_FAILED_CONFLICTING_PROVIDER:
    'This app conflicts with a content provider from another installed app.',
  INSTALL_FAILED_NEWER_SDK:
    'This app was built only for an older Android version than this device runs.',
  INSTALL_FAILED_TEST_ONLY:
    'This APK is marked test-only and cannot be installed without extra flags.',
  INSTALL_FAILED_CPU_ABI_INCOMPATIBLE:
    "This app's native code does not match the device's CPU architecture.",
  INSTALL_FAILED_MISSING_FEATURE: 'This app requires a hardware feature the device does not have.',
  INSTALL_FAILED_CONTAINER_ERROR: 'A storage container error occurred on the device.',
  INSTALL_FAILED_INVALID_INSTALL_LOCATION:
    'The requested install location is not valid for this app.',
  INSTALL_FAILED_MEDIA_UNAVAILABLE:
    'The external storage the device wanted to use is not available.',
  INSTALL_FAILED_VERIFICATION_TIMEOUT: 'App verification timed out on the device.',
  INSTALL_FAILED_VERIFICATION_FAILURE: 'App verification failed on the device.',
  INSTALL_FAILED_PACKAGE_CHANGED: 'The package changed unexpectedly during installation.',
  INSTALL_FAILED_UID_CHANGED: "This app's assigned user ID changed unexpectedly.",
  INSTALL_FAILED_VERSION_DOWNGRADE:
    'This would downgrade the installed version, which Android refuses by default.',
  INSTALL_FAILED_PERMISSION_MODEL_DOWNGRADE:
    "This app's permission model is older than the installed version's.",
  INSTALL_FAILED_SANDBOX_VERSION_DOWNGRADE:
    "This app's sandbox version is older than the installed version's.",
  INSTALL_FAILED_MULTIPACKAGE_INCONSISTENCY:
    'The files in this set are inconsistent with each other (mismatched package name, version, or signing certificate).',
  INSTALL_FAILED_DEXOPT: 'The device failed to optimize this app after copying it.',
  INSTALL_FAILED_INTERNAL_ERROR: 'The device reported an internal error during installation.',
  INSTALL_FAILED_USER_RESTRICTED: 'Installing apps is restricted on this device or user profile.',
  INSTALL_FAILED_DUPLICATE_PERMISSION:
    'This app declares a permission that conflicts with another installed app.',
  INSTALL_FAILED_NO_MATCHING_ABIS:
    "None of this app's native code matches the device's supported CPU architectures.",
  INSTALL_FAILED_ABORTED: 'The installation was aborted.',
  INSTALL_PARSE_FAILED_NOT_APK: 'One of the selected files is not a valid APK.',
  INSTALL_PARSE_FAILED_BAD_MANIFEST:
    'One of the selected files has a manifest Android could not parse.',
  INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION:
    'Android hit an unexpected error while parsing these files.',
  INSTALL_PARSE_FAILED_NO_CERTIFICATES: 'One of the selected files is not signed.',
  INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES:
    'These files are signed with different certificates and cannot be installed together.',
  INSTALL_PARSE_FAILED_CERTIFICATE_ENCODING:
    'One of the selected files has a certificate Android could not read.',
  INSTALL_PARSE_FAILED_MANIFEST_MALFORMED: 'One of the selected files has a malformed manifest.',
  INSTALL_PARSE_FAILED_MANIFEST_EMPTY: 'One of the selected files has an empty manifest.'
}

export function describeInstallErrorCode(code: string): string | null {
  return INSTALL_ERROR_EXPLANATIONS[code] ?? null
}

/**
 * Combines the raw code adb/PackageManager reported with a plain-language
 * explanation when one is known, e.g. "INSTALL_FAILED_UPDATE_INCOMPATIBLE —
 * The installed version was signed with a different certificate than these
 * files — uninstall it first." Falls back to the raw message unchanged when
 * no mapping exists (including when the "message" isn't a bare error code
 * at all, e.g. a host-side "File not accessible" message).
 */
export function formatInstallFailureMessage(rawMessage: string): string {
  const explanation = describeInstallErrorCode(rawMessage)
  return explanation ? `${rawMessage} — ${explanation}` : rawMessage
}
