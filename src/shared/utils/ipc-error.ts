/**
 * Electron prefixes every error thrown by an `ipcMain.handle` handler with
 * "Error invoking remote method '<channel>': Error: ". That is noise for the
 * user — the handler's own message is the part worth showing.
 */
const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

export function stripIpcErrorPrefix(message: string): string {
  return message.replace(IPC_ERROR_PREFIX, '')
}
