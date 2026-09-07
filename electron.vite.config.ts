import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * electron-vite externalizes every package.json "dependencies" entry for the
 * preload build by default (the same behavior externalizeDepsPlugin exposes
 * explicitly), so it can't be turned off by simply not adding that plugin.
 * That default is wrong for a sandboxed preload script, which has no Node
 * module resolution at runtime and can only require() the modules Electron
 * special-cases (electron itself). This runs as an `enforce: 'post'` plugin
 * so its config() hook is the last word after that default is injected,
 * forcing every real dependency (zod, and whatever else preload imports
 * later) to be bundled instead of left as an external require() call.
 */
function bundlePreloadDepsPlugin(): Plugin {
  return {
    name: 'bundle-preload-deps',
    enforce: 'post',
    config(config) {
      config.build ??= {}
      config.build.rollupOptions ??= {}
      config.build.rollupOptions.external = ['electron']
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      // Forced to CJS regardless of the root package.json's "type": "module":
      // Node's CJS/ESM interop cannot statically resolve some of Electron's
      // built-in module exports (e.g. BrowserWindow) as named ESM exports,
      // which breaks `import { BrowserWindow } from 'electron'` at runtime.
      rollupOptions: {
        output: {
          // .cjs, not .js: the root package.json declares "type": "module",
          // so a plain .js file would still be parsed as ESM by Node no
          // matter what format Rollup wrote into it.
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  preload: {
    plugins: [bundlePreloadDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        output: {
          // Forced to CJS regardless of the root package.json's "type":
          // "module": the sandboxed preload context does not run an ESM
          // loader. .cjs (not .js) because that "type": "module" would
          // otherwise make Node parse a plain .js file as ESM anyway.
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
