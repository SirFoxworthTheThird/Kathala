/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createRequire } from 'module'
import { desktopAssetBaseUrl } from './src/lib/desktopAssets'

const pkg = createRequire(import.meta.url)('./package.json') as {
  repository: { url: string }
  version: string
}

/*
  `--mode electron` is what the desktop build passes, and it is the only thing
  that changes: the Library's artwork is fetched from a CDN copy rather than
  from files inside the installer. See `src/lib/desktopAssets.ts` for why.

  Injected through `define` rather than an environment variable because the npm
  script has to work on Windows too — the release matrix builds the installer
  there, and `VAR=value command` is not a thing in cmd.exe.
*/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: './',
  define: mode === 'electron'
    ? {
        'import.meta.env.VITE_ASSET_BASE_URL': JSON.stringify(
          desktopAssetBaseUrl(pkg.repository.url, pkg.version),
        ),
      }
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
}))
