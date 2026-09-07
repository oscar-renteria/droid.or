import type Database from 'better-sqlite3'
import type { OperationHistoryEntry, OperationType } from '@shared/validation/operation.schema'

interface HistoryRow {
  id: number
  device_id: string
  package_name: string
  operation: string
  previous_state: string | null
  new_state: string | null
  success: number
  raw_output: string
  performed_at: string
}

function toHistoryEntry(row: HistoryRow): OperationHistoryEntry {
  return {
    id: row.id,
    deviceId: row.device_id,
    packageName: row.package_name,
    operation: row.operation as OperationType,
    previousState: row.previous_state,
    newState: row.new_state,
    success: row.success === 1,
    rawOutput: row.raw_output,
    performedAt: row.performed_at
  }
}

export interface RecordOperationInput {
  deviceId: string
  packageName: string
  operation: OperationType
  previousState: string | null
  newState: string | null
  success: boolean
  rawOutput: string
}

export function recordOperation(db: Database.Database, input: RecordOperationInput): void {
  db.prepare(
    `
    INSERT INTO operation_history
      (device_id, package_name, operation, previous_state, new_state, success, raw_output, performed_at)
    VALUES (@deviceId, @packageName, @operation, @previousState, @newState, @success, @rawOutput, @performedAt)
    `
  ).run({
    deviceId: input.deviceId,
    packageName: input.packageName,
    operation: input.operation,
    previousState: input.previousState,
    newState: input.newState,
    success: input.success ? 1 : 0,
    rawOutput: input.rawOutput,
    performedAt: new Date().toISOString()
  })
}

export function getOperationHistory(
  db: Database.Database,
  deviceId: string
): OperationHistoryEntry[] {
  const rows = db
    .prepare('SELECT * FROM operation_history WHERE device_id = ? ORDER BY performed_at DESC')
    .all(deviceId) as HistoryRow[]
  return rows.map(toHistoryEntry)
}
