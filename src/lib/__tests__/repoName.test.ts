import { describe, it, expect } from 'vitest'

/**
 * No live document still calls this project by its old name.
 *
 * The rename moved 448 strings, and the thing that kept escaping was never a
 * variable — it was prose. A word-boundary miss left `plotweave_*.deb` in three
 * documents naming a file the build no longer produces; a protected URL left
 * two files reading `[Kathala-Library]` while pointing at the old repository.
 * Both were found by hand, twice, and neither failed anything.
 *
 * The repositories are now `Kathala` and `Kathala-Library`. GitHub redirects
 * the old URLs indefinitely, so a stale link *works* — which is exactly why it
 * survives unnoticed until someone recreates a repository under the old name
 * and the link quietly points at a stranger's.
 *
 * Read through `import.meta.glob` rather than `node:fs`, which passes vitest and
 * then fails `tsc -b` for want of node types.
 */

const REPO = '../../../'
const key = (p: string) => (p.startsWith(REPO) ? p.slice(REPO.length) : p)

const live = Object.fromEntries(
  Object.entries({
    ...import.meta.glob('../../../{README.md,CLAUDE.md}', { eager: true, query: '?raw', import: 'default' }),
    ...import.meta.glob('../../../docs/**/*.md', { eager: true, query: '?raw', import: 'default' }),
    ...import.meta.glob('../../../scripts/**/*.mjs', { eager: true, query: '?raw', import: 'default' }),
    ...import.meta.glob('../../../.github/**/*.{md,yml}', { eager: true, query: '?raw', import: 'default' }),
  }).map(([p, text]) => [key(p), text as string]),
)

/**
 * Documents that record what someone saw, on a day, in an application that was
 * called something else at the time. Rewriting these would make an observation
 * say what was never observed, so they keep the old name on purpose.
 */
const RECORDS = [
  'docs/writer-run-', 'docs/reader-run-', 'docs/writer-journey-',
  'docs/ux-review.md', 'docs/release-notes/', 'docs/rename-plan.md',
]
const isRecord = (path: string) => RECORDS.some((r) => path.startsWith(r))

/**
 * Old-name strings that are still correct, stripped before the scan.
 *
 * Both hosts have moved and are gone from this list — which is the whole point
 * of keeping it as data: the sites moved after the repositories did, and the
 * only edit that required was deleting two lines and watching what failed.
 *
 * `plotweave-world` is the `type` field the book generators write into an
 * export. Nothing reads it — import ignores it entirely — so changing it would
 * rewrite every shipped world to no effect.
 */
const STILL_CORRECT = [
  'plotweave-world',
  'PLOTWEAVE_WORLD_ID',
]

describe('the old repository name', () => {
  it('is scanning the documents it claims to scan', () => {
    // Without this, every assertion below is satisfied by an empty glob.
    expect(Object.keys(live).length).toBeGreaterThan(20)
    for (const path of [
      'README.md', 'CLAUDE.md', 'docs/GUIDE.md', 'docs/wiki/Home.md',
      '.github/PULL_REQUEST_TEMPLATE.md', '.github/workflows/release.yml',
    ]) {
      expect(live[path], `${path} is not in the scan`).toBeTruthy()
    }
  })

  it('appears in no live document', () => {
    const found: string[] = []
    for (const [path, text] of Object.entries(live)) {
      if (isRecord(path)) continue
      let rest = text
      for (const allowed of STILL_CORRECT) rest = rest.split(allowed).join('')
      for (const line of rest.split('\n')) {
        if (/plotweave/i.test(line)) found.push(`${path}: ${line.trim().slice(0, 100)}`)
      }
    }
    expect(found).toEqual([])
  })

  /*
    The presence half, in both directions. Without the first, the rule above
    passes once someone deletes the hosts from the docs — leaving an allow-list
    that excuses nothing and reads as though it does. Without the second, it
    passes once the records are rewritten, which is the mistake the exemption
    exists to prevent.
  */
  it('is still carried by the things that should carry it', () => {
    const all = Object.values(live).join('\n')
    for (const allowed of STILL_CORRECT) {
      expect(all, `${allowed} is allowed but no longer appears`).toContain(allowed)
    }
    const records = Object.entries(live).filter(([p]) => isRecord(p))
    expect(records.length, 'no records are in the scan').toBeGreaterThan(3)
    expect(
      records.filter(([, text]) => /plotweave/i.test(text)).length,
      'the records were rewritten, which the exemption exists to prevent',
    ).toBeGreaterThan(3)
  })
})
