import { describe, it, expect } from 'vitest'
import { computeSortKeySync } from '../sortKey'

/**
 * A stored `sortKey` is `chapter.number + event.sortOrder / 1_000_000`, and has
 * been since the v31 migration recomputed every one of them.
 *
 * Two documents went on saying `chapter.number × 10_000 + sortOrder` for months
 * afterwards — `CLAUDE.md`'s snapshot-model paragraph and a comment in
 * `CurrentStateTab` describing "the global order every snapshot carries". Both
 * are instructions, read as fact, and a key written from either lands on the
 * wrong scale. That is not hypothetical: `snapshotSortKeyScale.test.ts` measures
 * what mixing scales does — `1.001 > 1.000001`, so a snapshot is ruled out as
 * "after the cursor" while the cursor sits on the very event it was authored on,
 * 396 of 533 snapshots in the Fellowship export.
 *
 * The multiplied form is not banned, because it is genuinely used: the v30
 * upgrade block must write what v31 expects to read, and several views build a
 * `chapter * 10_000 + sortOrder` comparator in memory to sort a list they already
 * hold, where it only has to be monotonic and is never compared to a stored key.
 * The rule keys on the typographic `×`, which is how the prose claims are written
 * and how the code never is.
 */

const CLAIM = /×\s*10[_,]?000/

/**
 * `CLAUDE.md` only, not `docs/*.md`. The review documents are archival: they
 * record findings as they were written, and `ux-review.md`'s CC-6 row exists
 * precisely to describe this wrong formula being removed from four type
 * comments. Policing them would flag the history for saying what the history
 * said. `CLAUDE.md` is the file that instructs, so it is the file held to it.
 */
const docs = import.meta.glob('../../../CLAUDE.md', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const sources = import.meta.glob(['../../features/**/*.tsx', '../../lib/**/*.ts', '../../db/**/*.ts'], {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** Lines asserting the multiplied form, minus those correcting it. */
function badLines(src: string): string[] {
  return src.split('\n').filter(
    (l) => CLAIM.test(l) && !/\bNot the\b|used to claim|no longer|old formula|pre-v\d/.test(l),
  )
}

describe('the documented sortKey formula is the one the code computes', () => {
  it('reads the real files', () => {
    expect(Object.keys(docs)).toHaveLength(1)
    expect(Object.values(docs)[0]).toContain('sortKey')
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('computes the fractional key', () => {
    const key = computeSortKeySync(
      'e1',
      new Map([['e1', { chapterId: 'ch1', sortOrder: 3 }]]),
      new Map([['ch1', 2]]),
    )
    expect(key).toBe(2 + 3 / 1_000_000)
    // The scale the docs used to claim would put this at 20_003.
    expect(key).not.toBe(2 * 10_000 + 3)
  })

  it('is not described as the multiplied form in CLAUDE.md', () => {
    const offenders = Object.entries(docs)
      .flatMap(([p, src]) => badLines(src).map((l) => `${p}: ${l.trim()}`))
    expect(offenders).toEqual([])
  })

  it('is not described as the multiplied form in any source comment', () => {
    const offenders = Object.entries(sources)
      .flatMap(([p, src]) => badLines(src).map((l) => `${p}: ${l.trim()}`))
    expect(offenders).toEqual([])
  })

  it('still catches the claim, and still allows the comparator', () => {
    expect(badLines('`sortKey` = chapter.number × 10_000 + event.sortOrder')).toHaveLength(1)
    expect(badLines('the global order every snapshot carries — chapter × 10_000 + scene')).toHaveLength(1)
    // Real code, and the comment describing it, use ASCII `*`.
    expect(badLines('return (chapNumById.get(id) ?? 0) * 10_000 + ev.sortOrder')).toEqual([])
    // And a line that exists to correct the claim, or to date it, is not the claim.
    expect(badLines('Not the `chapter.number × 10_000 + sortOrder` these comments used to claim')).toEqual([])
    expect(badLines('// v3-v6 files have sortKey using the old formula (chapter.number × 10_000 + x).')).toEqual([])
  })
})
