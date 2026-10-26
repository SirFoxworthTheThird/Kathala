import path from 'path'
import { defineConfig } from 'vitest/config'

/*
  The equivalence probes — item custody (Part B1), a person's state (B2) — are
  tools, not tests, for the same reason as the census: they read the Library,
  which is not part of this repository. Their own config keeps them out of
  `npm run test`; each npm script names its probe.
*/
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['scripts/*-probe.ts'],
    environment: 'jsdom',
    testTimeout: 1_800_000,
  },
})
