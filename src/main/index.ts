import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { createAppContext } from './app-context'
import { registerIpcHandlers } from './ipc/register-ipc-handlers'

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
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
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
