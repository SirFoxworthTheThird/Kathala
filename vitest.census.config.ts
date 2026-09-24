import path from 'path'
import { defineConfig } from 'vitest/config'

/*
  The census is a tool, not a test: it reads a checkout of the Library that is
  not part of this repository, and it asserts nothing. Its own config keeps it
  out of `npm run test`, which would otherwise collect it by filename and fail
  wherever the books are not beside the app — CI included.
*/
export default defineConfig({
  // The checker reaches for `@/…` like the rest of the app, and this config
  // does not inherit the main one's alias.
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['scripts/continuity-census.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
})
