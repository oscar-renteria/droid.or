import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@preload': resolve('src/preload'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // Default environment for everything under tests/. Renderer/component
    // tests that need a DOM (jsdom) opt in per file with a
    // `// @vitest-environment jsdom` docblock at the very top of the file
    // — this project's Vitest version (5.x) has no config-level
    // per-glob environment option (`environmentMatchGlobs` existed in
    // older Vitest majors; it's silently ignored here, not an error,
    // which is why this was wrong for a while with nothing to catch it).
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
