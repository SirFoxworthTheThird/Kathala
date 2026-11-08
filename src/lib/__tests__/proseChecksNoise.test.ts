import { describe, it, expect } from 'vitest'
import sample from './fixtures/prose/sample.json'
import baseline from '@/lib/proseChecks/baseline.json'
import { checkBook, PROSE_CHECK_DEFAULTS, type BookProse, type ProseBaseline, type ProseCheck } from '@/lib/proseChecks'
import { tokens } from '@/lib/proseChecks/text'

/*
  The noise bar (editorial-plan.md, R6): a check ships only if it finds few
  enough in published novels to be worth reading. The Library run set the
  defaults (`scripts/prose-probe.ts`, `docs/records/r6-prose-checks.md`); this
  holds them on a sample of it — about 8,000 to 12,000 words of each of four
  novels, all long out of copyright — with the shipped baseline.

  Each bar is the sample's count when the defaults were set, with a quarter
  again for headroom. Loosen a threshold and a bar fails; turn a check off and
  its presence below does.
*/

const BAR: Record<ProseCheck, number> = { echo: 13, pet: 8, rhythm: 1, tag: 7, length: 1 }
const ALL = 28

describe('the prose checks on published prose', () => {
  const books = sample as unknown as Array<{ name: string } & BookProse>
  let words = 0
  const count: Record<ProseCheck, number> = { echo: 0, pet: 0, rhythm: 0, tag: 0, length: 0 }
  for (const b of books) {
    const r = checkBook(b, baseline as ProseBaseline, PROSE_CHECK_DEFAULTS)
    words += [...r.plain.values()].reduce((n, p) => n + tokens(p.text).length, 0)
    for (const f of [...r.byScene.values()].flat()) count[f.check]++
  }
  const per10k = (n: number) => (n / words) * 1e4

  it('finds few enough in each check, per 10,000 words, to be read', () => {
    expect(words).toBeGreaterThan(40_000)
    for (const k of Object.keys(BAR) as ProseCheck[]) expect(per10k(count[k]), `${k} per 10,000 words`).toBeLessThanOrEqual(BAR[k])
    expect(per10k(Object.values(count).reduce((a, b) => a + b, 0))).toBeLessThanOrEqual(ALL)
  })

  it('and finds something: a check that finds nothing in forty thousand words of novels is not checking', () => {
    expect(count.echo).toBeGreaterThan(10)
    expect(count.pet).toBeGreaterThan(5)
    expect(count.tag).toBeGreaterThan(5)
  })
})
