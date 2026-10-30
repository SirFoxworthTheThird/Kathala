import { describe, it, expect } from 'vitest'

/**
 * What is true at a scene has one resolver (next-plan.md, Part B3): `stateAt`
 * and the single-entity readers beside it, in `src/lib/stateAt.ts`, which pick
 * each kind's rule once (`CARRIES`). A source rule, because the mistake it
 * rules out is a kind read by the wrong rule in a file of its own — a person's
 * state carried across eras, a place's kept in one — and five files each used
 * to choose.
 *
 * The engine's lookups (`lastKnown…`, `lastBefore`) are imported only by
 * `stateAt` and by the two models it is built on, whose walks need them: a
 * person's facets (`personState.ts`) and item custody (`custody.ts`). A
 * person's facet readers (`personAt`, `peopleAt`) are imported only by
 * `stateAt`. `carriedFrom` and `outOfEra` describe a record rather than
 * resolve one, and any screen may ask them.
 */

const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**', '!../../test/**'], {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const name = (path: string) => path.replace(/^.*\//, '')

/** The names an import statement brings in from a module whose path ends in `module`. */
export function importsFrom(src: string, module: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
    if (!m[2].endsWith(module)) continue
    for (const part of m[1].split(',')) {
      const id = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]
      if (id) out.push(id)
    }
  }
  return out
}

const LOOKUPS = ['lastKnown', 'lastKnownRecords', 'lastKnownOne', 'lastBefore']
const FACET_READERS = ['personAt', 'peopleAt']

describe('what is true at a scene has one resolver', () => {
  it('has sources to read, and finds the imports in them', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200)
    const stateAt = Object.entries(sources).find(([p]) => name(p) === 'stateAt.ts')![1]
    expect(importsFrom(stateAt, 'stateEngine')).toEqual(expect.arrayContaining(['lastKnown', 'lastBefore']))
    expect(importsFrom(stateAt, 'personState')).toEqual(expect.arrayContaining(['personAt', 'peopleAt']))
  })

  it('imports the engine’s lookups only in the resolver and the models it is built on', () => {
    const allowed = new Set(['stateAt.ts', 'personState.ts', 'custody.ts'])
    const offenders = Object.entries(sources)
      .filter(([path]) => !allowed.has(name(path)))
      .flatMap(([path, src]) => importsFrom(src, 'stateEngine').filter((id) => LOOKUPS.includes(id)).map((id) => `${path}: ${id}`))
    expect(offenders).toEqual([])
  })

  it('reads a person’s facets only through the resolver', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => name(path) !== 'stateAt.ts')
      .flatMap(([path, src]) => importsFrom(src, 'personState').filter((id) => FACET_READERS.includes(id)).map((id) => `${path}: ${id}`))
    expect(offenders).toEqual([])
  })

  it('reads the imports it claims to read, so the scan is not vacuous', () => {
    expect(importsFrom("import { lastKnownOne, type Story } from '@/lib/stateEngine'", 'stateEngine')).toEqual(['lastKnownOne', 'Story'])
    expect(importsFrom("import {\n  carriedFrom,\n  lastKnown as known,\n} from './stateEngine'", 'stateEngine')).toEqual(['carriedFrom', 'lastKnown'])
    // Another module's names are not this one's.
    expect(importsFrom("import { lastKnown } from './somewhereElse'", 'stateEngine')).toEqual([])
  })
})
