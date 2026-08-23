import { describe, it, expect } from 'vitest'

/**
 * `tsc -b` checks the projects `tsconfig.json` references, and nothing else.
 *
 * For a long time those were `src` and `vite.config.ts`, which left the whole
 * `e2e/` directory unchecked — and Playwright strips types with esbuild rather
 * than checking them, so a type error in a spec was caught by neither. It
 * surfaced as a puzzling runtime failure twelve minutes into a suite run, or
 * not at all: a spec asserting on `undefined` still passes.
 *
 * Losing that coverage again would be silent — no test fails, no build breaks,
 * the checking simply stops — which is why it is asserted here rather than
 * left to be noticed.
 */

const configs = import.meta.glob('../../../tsconfig*.json', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/**
 * `tsc` allows comments in these files; `JSON.parse` does not.
 *
 * Stripped with a scanner rather than a regex, because a regex cannot tell a
 * comment from the `/*` inside `"@/*"` — the path alias in `tsconfig.app.json`
 * — and eating from there to the next `*\/` corrupts the rest of the file.
 */
export function stripJsonComments(src: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inString) {
      out += c
      if (c === '\\') { out += src[++i] ?? ''; continue }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') { inString = true; out += c; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    out += c
  }
  return out
}

function readConfig(name: string): { references?: { path: string }[]; include?: string[] } {
  const key = Object.keys(configs).find((k) => k.endsWith(`/${name}`))
  if (key === undefined) throw new Error(`no ${name} found`)
  return JSON.parse(stripJsonComments(configs[key]))
}

const root = readConfig('tsconfig.json')
const referenced = (root.references ?? []).map((r) => r.path.replace(/^\.\//, ''))

/** Every path any referenced project includes. */
const covered = referenced.flatMap((name) => readConfig(name).include ?? [])

describe('tsc -b checks every directory of TypeScript in the repo', () => {
  it('reads the real configs', () => {
    expect(referenced.length).toBeGreaterThanOrEqual(3)
    expect(covered.length).toBeGreaterThan(0)
  })

  it('checks the app', () => {
    expect(covered).toContain('src')
  })

  it('checks the e2e specs, which Playwright itself does not type-check', () => {
    expect(covered).toContain('e2e')
  })

  it('checks the build and test configuration files', () => {
    expect(covered).toContain('vite.config.ts')
    expect(covered).toContain('playwright.config.ts')
  })

  it('would notice a project being dropped, so the scan is not vacuous', () => {
    // The union is built from the references — remove one and its includes go
    // with it. Asserted on a fixture so this stays true if the real files move.
    const fake = { references: [{ path: './a.json' }, { path: './b.json' }] }
    expect(fake.references.map((r) => r.path.replace(/^\.\//, ''))).toEqual(['a.json', 'b.json'])
    // The stripper keeps a `/*` that is inside a string and drops a real comment.
    expect(JSON.parse(stripJsonComments('{ /* c */ "paths": { "@/*": ["./src/*"] } // t\n}')))
      .toEqual({ paths: { '@/*': ['./src/*'] } })
    expect(readConfig('tsconfig.e2e.json').include).toContain('e2e')
    expect(covered).not.toContain('this-directory-does-not-exist')
  })
})
