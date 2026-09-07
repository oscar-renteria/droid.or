/**
 * Every IPC channel the app uses. Renderer and preload must only ever
 * reference channels through this enum, never as raw string literals,
 * so a typo becomes a compile error instead of a silent no-op handler.
 */
export enum IpcChannel {
  GetAppInfo = 'app:get-info'
}
