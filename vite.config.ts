/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/*
  `--mode electron` is what the desktop build passes, and it is the only thing
  that changes: the Library's artwork is fetched from a CDN copy rather than
  from files inside the installer. See `src/lib/desktopAssets.ts` for why.

  Injected through `define` rather than an environment variable because the npm
  script has to work on Windows too — the release matrix builds the installer
  there, and `VAR=value command` is not a thing in cmd.exe.
*/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  /*
    The end-to-end suite serves the Library from its own preview server, with
    the real books staged into `dist/library` by `scripts/stage-e2e-library.mjs`.
    Without this it would try to reach the library site, which the suite has no
    route to — sixteen specs need real catalogue data and would all fail on a
    network error rather than on anything about the app.

    A relative base, so the same build works on whatever port preview picks.
  */
  define: process.env.VITE_E2E
    ? { 'import.meta.env.VITE_LIBRARY_BASE_URL': JSON.stringify('./') }
    : {},
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/store/**', 'src/db/hooks/**'],
      exclude: ['src/db/hooks/useBlobs.ts', 'src/db/hooks/useMapLayers.ts'],
    },
  },
})
