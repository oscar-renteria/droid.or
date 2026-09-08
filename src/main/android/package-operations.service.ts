import type Database from 'better-sqlite3'
import type { MutatingOperationType, OperationResult } from '@shared/validation/operation.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidPackageName } from '../adb/android-package-name'
import { extractFailureMessage } from '../adb/mutation-result-parser'
import { parsePackageNameList } from '../adb/parsers/package-list-parser'
import { recordOperation } from '../persistence/operation-history.repository'

/**
 * Every command this app can ever send that changes device state, in one
 * place. Each is a fixed, hard-coded argv array — the caller only chooses
 * which of these four to run, never any of their arguments beyond the
 * already-validated package name.
 */
function buildCommandArgs(operation: MutatingOperationType, packageName: string): string[] {
  switch (operation) {
    case 'disable':
      return ['pm', 'disable-user', '--user', '0', packageName]
    case 'enable':
      return ['pm', 'enable', '--user', '0', packageName]
    case 'uninstall-for-user':
      // Deliberately without -k (keep data): the spec treats "uninstall"
      // and "clear data" as two distinct actions, so uninstalling here
      // matches the ordinary, intuitive meaning of "uninstall this app" —
      // data goes with it — rather than silently leaving data behind.
      return ['pm', 'uninstall', '--user', '0', packageName]
    case 'clear-data':
      return ['pm', 'clear', '--user', '0', packageName]
    case 'restore-install':
      // Verified against a real device (`pm` itself, not just docs): this
      // subcommand exists and takes exactly these flags. Only ever
      // reachable for a package the device still knows about — see
      // recovery.service.ts.
      return ['pm', 'install-existing', '--user', '0', packageName]
  }
}

const DISABLED_STATE = 'disabled'
const ENABLED_STATE = 'enabled'
const INSTALLED_STATE = 'installed for this user'
const NOT_INSTALLED_STATE = 'not installed for this user'

/** Exact-match, not a raw substring check: `pm list packages <filter>`
 *  matches any package name *containing* the filter (verified against a
 *  real device: filtering for "com.google.android.gm" also matched
 *  "com.google.android.gms" and its sub-packages), so the filtered output
 *  still has to be parsed and checked for the exact name.
 *
 *  -u ("also include uninstalled packages") is required, not optional —
 *  verified against a real Android 10 device where `-d` alone omitted a
 *  package that genuinely was disabled, which made this function silently
 *  and consistently report it as enabled both before and after a real
 *  disable command actually succeeded (previousState === newState, so the
 *  operation was wrongly reported as having failed to take effect). The
 *  Android 16 device this was first built against didn't exhibit the
 *  gap, which is why it went unnoticed until a second real device with an
 *  older Android version was tested. */
export async function isPackageDisabled(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<boolean> {
  const output = await adbClient.shellCommand(serial, [
    'pm',
    'list',
    'packages',
    '-d',
    '-u',
    packageName
  ])
  return parsePackageNameList(output).includes(packageName)
}

/** A package that's merely disabled (not uninstalled) is still genuinely
 *  "installed for this user" — but on the same real Android 10 device
 *  where a plain `pm list packages <pkg>` was confirmed to omit a
 *  disabled-but-installed package entirely, checking only the plain
 *  query would misreport it as not installed. Checked against both the
 *  plain query (catches the common enabled+installed case) and the
 *  disabled-but-installed query (catches exactly the gap above). A
 *  package genuinely uninstalled for this user is documented AOSP
 *  behavior to be a different, stronger pm state than merely disabled
 *  ("not installed" vs. "installed but disabled-user"), so it should
 *  correctly match neither query — reasoned from that documented
 *  distinction, not independently re-verified against a real
 *  uninstalled-for-user package on this device, since creating one
 *  would require an actual uninstall this investigation deliberately
 *  avoided performing. */
export async function isPackageInstalledForUser(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<boolean> {
  const [plainOutput, disabledOutput] = await Promise.all([
    adbClient.shellCommand(serial, ['pm', 'list', 'packages', packageName]),
    adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-d', '-u', packageName])
  ])
  return (
    parsePackageNameList(plainOutput).includes(packageName) ||
    parsePackageNameList(disabledOutput).includes(packageName)
  )
}

/**
 * Runs one predefined mutating operation against one package and records
 * it to history. Never trusts a zero exit code alone (spec's explicit
 * rule): for disable/enable/uninstall, the resulting state is independently
 * re-queried afterward rather than assumed from the command's own exit
 * code. clear-data has no independent state to re-query (there's no
 * reliable, non-root way to confirm data was actually cleared), so its
 * result rests on the device's own reported outcome — that limitation is
 * surfaced to the caller via the message text, not hidden.
 */
export async function performPackageOperation(
  db: Database.Database,
  adbClient: AdbClient,
  serial: string,
  packageName: string,
  operation: MutatingOperationType
): Promise<OperationResult> {
  if (!isValidPackageName(packageName)) {
    throw new Error(`Refusing to operate on an invalid package name: "${packageName}"`)
  }

  const previousState = await getStateLabel(adbClient, serial, packageName, operation)
  const mutation = await adbClient.runMutationCommand(
    serial,
    buildCommandArgs(operation, packageName)
  )
  const rawOutput = [mutation.stdout, mutation.stderr].filter(Boolean).join('\n').trim()
  const commandExitedCleanly = mutation.exitCode === 0

  let success: boolean
  let message: string
  let newState: string | null = null

  if (!commandExitedCleanly) {
    success = false
    message = extractFailureMessage(mutation.stdout, mutation.stderr)
  } else if (operation === 'clear-data') {
    // No independent verification available for this one — see the
    // function comment above.
    success = true
    message =
      "App data cleared, per the device's own report (this cannot be independently verified)."
  } else {
    newState = await getStateLabel(adbClient, serial, packageName, operation)
    success = newState !== previousState
    message = success
      ? describeSuccess(operation)
      : "The device accepted the command, but the package's state did not actually change."
  }

  recordOperation(db, {
    deviceId: serial,
    packageName,
    operation,
    previousState,
    newState,
    success,
    rawOutput: rawOutput || '(no output)'
  })

  return { success, message, rawOutput: rawOutput || '(no output)' }
}

async function getStateLabel(
  adbClient: AdbClient,
  serial: string,
  packageName: string,
  operation: MutatingOperationType
): Promise<string | null> {
  if (operation === 'disable' || operation === 'enable') {
    return (await isPackageDisabled(adbClient, serial, packageName))
      ? DISABLED_STATE
      : ENABLED_STATE
  }
  if (operation === 'uninstall-for-user' || operation === 'restore-install') {
    return (await isPackageInstalledForUser(adbClient, serial, packageName))
      ? INSTALLED_STATE
      : NOT_INSTALLED_STATE
  }
  return null
}

function describeSuccess(operation: MutatingOperationType): string {
  switch (operation) {
    case 'disable':
      return 'Package disabled for this user.'
    case 'enable':
      return 'Package enabled.'
    case 'uninstall-for-user':
      return 'Package uninstalled for this user.'
    case 'clear-data':
      return 'App data cleared.'
    case 'restore-install':
      return 'Package reinstalled for this user.'
  }
}
