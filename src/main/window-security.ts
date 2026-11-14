import type { App, BrowserWindow } from 'electron'
import { validateSafeExternalUrl } from './support/support-config'

/**
 * The only permission the renderer uses: `navigator.clipboard.writeText`
 * (copy-link fallback when the browser can't be opened). Everything else —
 * camera, microphone, notifications, geolocation, HID/USB/serial,
 * fullscreen, … — is denied.
 */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

export function isPermissionAllowed(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission)
}

/**
 * True for the app's own page: the bundled renderer file in production,
 * or the Vite dev server origin in development. Hash-route changes don't
 * fire `will-navigate`; anything else is a navigation away from the app.
 */
export function isAppUrl(
  rawUrl: string,
  rendererIndexPath: string,
  devServerUrl: string | undefined
): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (devServerUrl) {
    return url.origin === new URL(devServerUrl).origin
  }
  if (url.protocol !== 'file:') {
    return false
  }
  const normalize = (path: string): string => decodeURIComponent(path).replace(/\\/g, '/')
  const expected = normalize(rendererIndexPath)
  const actual = normalize(url.pathname)
  // Windows file URLs have a leading slash before the drive letter.
  return actual === expected || actual === `/${expected}`
}

export interface WindowSecurityOptions {
  rendererIndexPath: string
  devServerUrl: string | undefined
  openExternal: (url: string) => Promise<void>
  onBlocked: (what: string) => void
}

/** Locks down a window: no navigation away from the app, no new windows
 *  (allow-listed https links go to the system browser instead), no
 *  permissions beyond the clipboard write above. */
export function hardenWindow(window: BrowserWindow, options: WindowSecurityOptions): void {
  const { webContents } = window

  webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url, options.rendererIndexPath, options.devServerUrl)) {
      event.preventDefault()
      options.onBlocked(`navigation to ${url}`)
    }
  })

  webContents.setWindowOpenHandler(({ url }) => {
    if (validateSafeExternalUrl(url)) {
      void options.openExternal(url)
    } else {
      options.onBlocked(`window.open of ${url}`)
    }
    return { action: 'deny' }
  })

  const { session } = webContents
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    const allowed = isPermissionAllowed(permission)
    if (!allowed) {
      options.onBlocked(`permission request "${permission}"`)
    }
    callback(allowed)
  })
  session.setPermissionCheckHandler((_contents, permission) => isPermissionAllowed(permission))
}

/** App-wide: no `<webview>` can ever be attached, in any web contents. */
export function blockWebviews(app: App): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}
