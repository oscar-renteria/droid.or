import type Database from 'better-sqlite3'
import type { OperationResult, OperationType } from '@shared/validation/operation.schema'
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
function buildCommandArgs(operation: OperationType, packageName: string): string[] {
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
 *  still has to be parsed and checked for the exact name. */
async function isPackageDisabled(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<boolean> {
  const output = await adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-d', packageName])
  return parsePackageNameList(output).includes(packageName)
}

async function isPackageInstalledForUser(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<boolean> {
  const output = await adbClient.shellCommand(serial, ['pm', 'list', 'packages', packageName])
  return parsePackageNameList(output).includes(packageName)
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
  operation: OperationType
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
  operation: OperationType
): Promise<string | null> {
  if (operation === 'disable' || operation === 'enable') {
    return (await isPackageDisabled(adbClient, serial, packageName))
      ? DISABLED_STATE
      : ENABLED_STATE
  }
  if (operation === 'uninstall-for-user') {
    return (await isPackageInstalledForUser(adbClient, serial, packageName))
      ? INSTALLED_STATE
      : NOT_INSTALLED_STATE
  }
  return null
}

function describeSuccess(operation: OperationType): string {
  switch (operation) {
    case 'disable':
      return 'Package disabled for this user.'
    case 'enable':
      return 'Package enabled.'
    case 'uninstall-for-user':
      return 'Package uninstalled for this user.'
    case 'clear-data':
      return 'App data cleared.'
  }
}
