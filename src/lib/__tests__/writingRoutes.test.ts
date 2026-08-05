import { describe, it, expect } from 'vitest'
import { navItems } from '@/components/navItems'

/**
 * The routes reading mode closes are derived from `navItems`, not listed twice.
 *
 * They *were* listed once and enforced nowhere: the nav filtered `writingOnly`
 * to hide the links, and the router happily served /corkboard, /structure and
 * /manuscript to anyone who typed them. The corkboard then let a reader drag
 * scene cards between chapters, which is a write.
 */

/** The route table as text, read through Vite so this stays browser-typed. */
const routesSource = Object.values(
  import.meta.glob('../../router/routes.tsx', { eager: true, query: '?raw', import: 'default' }),
)[0] as string

describe('writing-only routes', () => {
  it('has some, or this whole guard is asserting nothing', () => {
    const writingOnly = navItems.filter((n) => n.writingOnly)
    expect(writingOnly.length).toBeGreaterThan(0)
    expect(writingOnly.map((n) => n.to)).toContain('corkboard')
  })

  it('passes its path to Wrap for every world-scoped route', () => {
    // The guard can only fire for routes that tell Wrap which path they are, so
    // an untagged one is silently unguarded even when marked writingOnly.
    const declared = [...routesSource.matchAll(/\{ path: '([a-z]+)', element: <Wrap( path="([a-z]+)")?>/g)]
    expect(declared.length).toBeGreaterThan(5)
    for (const m of declared) {
      expect(m[3], `route '${m[1]}' does not pass its path to Wrap`).toBe(m[1])
    }
  })

  it('guards every writingOnly nav item, by deriving from the same list', () => {
    // Not a second hardcoded list: the router builds its set from navItems, so
    // marking a new screen writingOnly closes its route with no further edit.
    expect(routesSource).toMatch(/navItems\.filter\(\(n\) => n\.writingOnly\)/)

    for (const item of navItems.filter((n) => n.writingOnly)) {
      expect(
        routesSource,
        `no route declared for writing-only screen '${item.to}'`,
      ).toContain(`{ path: '${item.to}', element: <Wrap path="${item.to}">`)
    }
  })

  it('leaves reader-facing routes open', () => {
    // The pairing: if everything were guarded the tests above would pass and
    // the app would be unusable while reading.
    for (const open of ['timeline', 'characters', 'maps', 'lore']) {
      expect(navItems.find((n) => n.to === open)?.writingOnly ?? false).toBe(false)
    }
  })
})
