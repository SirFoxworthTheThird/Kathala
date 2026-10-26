import path from 'path'
import { defineConfig } from 'vitest/config'

/*
  The custody probe (Part B1) is a tool, not a test, for the same reason as the
  census: it reads the Library, which is not part of this repository. Its own
  config keeps it out of `npm run test`.
*/
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['scripts/custody-probe.ts'],
    environment: 'jsdom',
    testTimeout: 1_800_000,
  },
})
