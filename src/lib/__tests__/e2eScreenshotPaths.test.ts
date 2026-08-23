import { describe, it, expect } from 'vitest'

/**
 * A screenshot an e2e test saves is an artifact of that run, not a source file.
 *
 * The two validation specs wrote theirs to `screenshots/validation/`, which is
 * tracked — and, worse, wrote the *same* eleven filenames, so the committed
 * image was whichever book ran last. Every full suite run therefore rewrote
 * five to twelve tracked PNGs, and a `git status` after a green run looked like
 * the change under test had touched them. They rode along in commits that way.
 *
 * The rule is that a saved screenshot's path comes from the test's own output
 * directory, which is `test-results/` and gitignored. `page.screenshot()` with
 * no `path` is untouched — `themeAtmosphere.spec.ts` compares buffers in memory
 * and never writes anything.
 */

const specs = import.meta.glob('../../../e2e/**/*.ts', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/**
 * Comments are stripped first: the prose that explains a rule has to be free to
 * name the thing it forbids, and `helpers/shot.ts` says exactly where these
 * used to go. `//` after a colon is left alone so a `https://` url survives.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '')
}

/** Every `path:` argument given to a `.screenshot(…)` call. */
function screenshotPaths(src: string): string[] {
  return [...stripComments(src).matchAll(/\.screenshot\(\{([^}]*)\}\)/g)]
    .map((m) => /\bpath:\s*([^,}]+)/.exec(m[1])?.[1]?.trim())
    .filter((p): p is string => p !== undefined)
}

describe('e2e screenshots are run artifacts, not tracked files', () => {
  it('has the e2e sources to read', () => {
    expect(Object.keys(specs).length).toBeGreaterThan(20)
    expect(Object.keys(specs).some((p) => p.endsWith('validate-neuromancer.spec.ts'))).toBe(true)
  })

  it('saves every screenshot into the test output directory', () => {
    const offenders: string[] = []
    for (const [file, src] of Object.entries(specs)) {
      for (const p of screenshotPaths(src)) {
        if (!p.includes('testInfo.outputPath')) offenders.push(`${file}: path: ${p}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no spec writes into a tracked directory by name', () => {
    const offenders = Object.entries(specs)
      .filter(([, src]) => /screenshots\//.test(stripComments(src)))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('reads the paths it claims to read, so the scan is not vacuous', () => {
    expect(screenshotPaths("await page.screenshot({ path: SS('01.png'), fullPage: false })"))
      .toEqual(["SS('01.png')"])
    expect(screenshotPaths('await page.screenshot({ path: testInfo.outputPath(n), fullPage: false })'))
      .toEqual(['testInfo.outputPath(n)'])
    // A buffer comparison writes nothing and is not the rule's business.
    expect(screenshotPaths('const a = await page.screenshot({ clip: { x: 1 } })')).toEqual([])
    // A commented-out call is not a call.
    expect(screenshotPaths("// await page.screenshot({ path: SS('01.png') })")).toEqual([])
    expect(stripComments("const u = 'http://x' /* screenshots/ */")).toContain('http://x')
  })
})
