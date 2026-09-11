import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { createAppContext } from './app-context'
import { registerIpcHandlers } from './ipc/register-ipc-handlers'
import { cleanupStaleSplitInstallTempDirs } from './android/split-install-temp-cleanup'

// A second launch (e.g. double-clicking the app while it's already running)
// should focus the existing window rather than spawn a second ADB-owning
// process that could race the first one over the same device.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    // Only resolves in dev (build/ isn't part of the packaged files list —
    // see electron-builder.yml — so this path doesn't exist in a packaged
    // build). That's fine: a packaged app's window/taskbar icon already
    // comes from the icon electron-builder itself embedded into the
    // exe/app bundle. This only fixes the generic Electron icon otherwise
    // shown in the taskbar while running from source.
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Any link the renderer tries to open in a new window is handed to the
  // OS browser instead of spawning an unrestricted second Electron window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererDevServerUrl) {
    void mainWindow.loadURL(rendererDevServerUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  const context = createAppContext()
  registerIpcHandlers(context)
  context.deviceRegistry.start()
  createMainWindow()
  // Fire-and-forget: sweeps up any split-install temp directory a prior
  // run left behind after crashing before its own cleanup ran. Never
  // awaited — this must not delay window creation, and a stale directory
  // surviving one more session if this is slow is harmless.
  void cleanupStaleSplitInstallTempDirs()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  app.on('will-quit', () => {
    context.deviceRegistry.stop()
    context.db.close()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
