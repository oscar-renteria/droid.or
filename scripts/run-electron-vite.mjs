#!/usr/bin/env node
import { spawn } from 'node:child_process'

// VS Code's integrated terminal (and any other Electron-based host, like
// this one) runs its extension host with ELECTRON_RUN_AS_NODE=1 so its own
// child processes get a plain Node environment. That variable is inherited
// by everything launched from that terminal, including this script's own
// child process — so when electron-vite's dev/preview commands spawn the
// real Electron binary to run *this* app, Electron sees the same flag and
// starts as plain Node instead of the actual app runtime: `require('electron')`
// then returns a path string instead of { app, BrowserWindow, ... }, and the
// window never appears. Stripping it here, once, fixes `npm run dev` and
// `npm run preview` in that environment without depending on every
// developer remembering to unset it by hand.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const subcommand = process.argv[2]
if (subcommand !== 'dev' && subcommand !== 'preview') {
  console.error('Usage: run-electron-vite.mjs <dev|preview>')
  process.exit(1)
}

const child = spawn('electron-vite', [subcommand], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

child.on('exit', (code) => process.exit(code ?? 1))
