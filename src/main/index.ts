import { app, BrowserWindow, dialog, shell } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppContext, type AppContext } from './app-context'
import { installCrashHandlers } from './crash-handlers'
import { FileLogger } from './logging/file-logger'
import { registerIpcHandlers } from './ipc/register-ipc-handlers'
import { cleanupStaleSplitInstallTempDirs } from './android/split-install-temp-cleanup'
import { isSmokeTest, runSmokeTest } from './smoke-test'

// A smoke test (see smoke-test.ts) runs against a throwaway profile, so it
// never touches a real user's database and never collides with a running
// instance's single-instance lock. Must happen before anything reads
// userData — including requestSingleInstanceLock below.
const smokeTest = isSmokeTest(process.argv)
if (smokeTest) {
  app.setPath('userData', mkdtempSync(join(tmpdir(), 'droid-or-smoke-')))
}

const logger = new FileLogger(join(app.getPath('userData'), 'logs'))
let context: AppContext | null = null

const handleFatalError = installCrashHandlers(process, {
  logger,
  showError: smokeTest ? undefined : (title, content) => dialog.showErrorBox(title, content),
  closeResources: () => {
    context?.deviceRegistry.stop()
    if (context?.db.open) {
      context.db.close()
    }
  },
  exit: (code) => app.exit(code)
})

// A second launch (e.g. double-clicking the app while it's already running)
// should focus the existing window rather than spawn a second ADB-owning
// process that could race the first one over the same device.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
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
    if (!smokeTest) {
      mainWindow?.show()
    }
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
  return mainWindow
}

/** Resolves once the page has loaded, the preload bridge is exposed, and
 *  the Vue app has rendered into #app — i.e. the renderer bundle and the
 *  preload script both work from inside the packaged archive. */
function waitForRendererReady(window: BrowserWindow): Promise<void> {
  const { webContents } = window
  return new Promise((resolve, reject) => {
    webContents.once('did-fail-load', (_event, code, description) => {
      reject(new Error(`did-fail-load: ${code} ${description}`))
    })
    webContents.once('render-process-gone', (_event, details) => {
      reject(new Error(`render-process-gone: ${details.reason}`))
    })
    webContents.once('did-finish-load', () => {
      const poll = (): void => {
        webContents
          .executeJavaScript(
            "typeof window.droidor === 'object' && (document.querySelector('#app')?.childElementCount ?? 0) > 0"
          )
          .then((ready: boolean) => (ready ? resolve() : setTimeout(poll, 250)))
          .catch(reject)
      }
      poll()
    })
  })
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
})

app
  .whenReady()
  .then(() => {
    logger.info(
      `droid.or ${app.getVersion()} starting (Electron ${process.versions.electron}, ${process.platform} ${process.arch})`
    )
    const appContext = createAppContext(logger)
    context = appContext
    registerIpcHandlers(appContext)

    if (smokeTest) {
      // No device polling: the smoke test must not start an ADB server.
      const window = createMainWindow()
      void runSmokeTest({
        checkDatabase: () => {
          const row = appContext.db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined
          if (row?.ok !== 1) {
            throw new Error('database query returned an unexpected result')
          }
        },
        waitForRenderer: () => waitForRendererReady(window),
        log: (message) => console.log(message),
        exit: (code) => {
          appContext.db.close()
          app.exit(code)
        }
      })
      return
    }

    appContext.deviceRegistry.start()
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
      appContext.deviceRegistry.stop()
      appContext.db.close()
    })
  })
  .catch(handleFatalError)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
