import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { checkBook, proseSettings, type ProseCheck, type ProseFinding } from '../src/lib/proseChecks'
import { addBook, countText, emptyCounts, toBaseline, without, type Counts } from '../src/lib/proseChecks/baseline'
import { plainScene, tokens } from '../src/lib/proseChecks/text'
import { libraryBooks } from './proseLibrary'

/**
 * The prose checks over the Library (editorial-plan.md, R6): how much each
 * finds per 10,000 words of a published novel, book by book, with a sample of
 * what it found to read. Each book is measured against a baseline of the
 * others, so no book is its own "books in general".
 *
 * Not a test: it reads the Library. The bar each check is held to, and the
 * test that holds it on a sample of public-domain prose, are in
 * `docs/records/r6-prose-checks.md` and `proseChecksNoise.test.ts`.
 *
 *   KATHALA_LIBRARY=../Kathala-Library npm run probe:prose
 *   PROSE_SETTINGS='{"echoSpan":30}' SAMPLES=echo,tag npm run probe:prose
 */

const OUT = process.env.PROSE_OUT ?? 'prose-probe.txt'
const SAMPLES = (process.env.SAMPLES ?? '').split(',').filter(Boolean)
const CHECKS: ProseCheck[] = ['echo', 'pet', 'rhythm', 'tag', 'length']

describe('prose probe', () => {
  it('reports what the checks find in every book', () => {
    const s = proseSettings(process.env.PROSE_SETTINGS ? JSON.parse(process.env.PROSE_SETTINGS) : {})
    const books = libraryBooks()
    const counts = new Map<string, Counts>()
    const all = emptyCounts()
    for (const { name, book } of books) {
      const c = emptyCounts()
      for (const ch of book.chapters) for (const sc of ch.scenes) countText(plainScene(sc.text).text, c)
      addBook(all, c)
      counts.set(name, c)
    }

    const rows: string[] = []
    const per: Record<ProseCheck, number[]> = { echo: [], pet: [], rhythm: [], tag: [], length: [] }
    const samples: string[] = []
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (const { name, book } of books) {
      const baseline = toBaseline(without(all, counts.get(name)!))
      const report = checkBook(book, baseline, s)
      const words = [...report.plain.values()].reduce((n, p) => n + tokens(p.text).length, 0)
      const found = [...report.byScene.values()].flat()
      const by = (k: ProseCheck) => found.filter((f) => f.check === k)
      const rate = (k: ProseCheck) => (by(k).length / words) * 1e4
      for (const k of CHECKS) per[k].push(rate(k))
      rows.push(`${name.padEnd(42)} ${String(words).padStart(7)}w  ` + CHECKS.map((k) => `${k} ${rate(k).toFixed(1).padStart(5)}`).join('  ') + `  chapters:${report.chapterLengths.size}`)
      rows.push(`    pets: ${report.pets.slice(0, 12).map((p) => `${p.words}×${p.count}(${p.ratio.toFixed(1)})`).join(', ')}`)
      for (const k of SAMPLES as ProseCheck[]) {
        const list = by(k)
        for (let i = 0; i < 4 && list.length; i++) {
          const f = list[Math.floor(rand() * list.length)] as ProseFinding
          const text = report.plain.get(f.eventId)!.text
          const ctx = f.end > f.start ? text.slice(Math.max(0, f.start - 90), f.end + 30).replace(/\s+/g, ' ') : ''
          samples.push(`[${name}] ${k}: ${f.message}${ctx ? `\n      …${ctx}…` : ''}`)
        }
      }
    }
    const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)] }
    const report = [
      `settings: ${JSON.stringify(s)}`,
      '',
      'per 10,000 words — median and highest across the books:',
      ...CHECKS.map((k) => `  ${k.padEnd(7)} median ${med(per[k]).toFixed(1).padStart(5)}  max ${Math.max(...per[k]).toFixed(1).padStart(6)}`),
      '',
      ...rows,
      ...(samples.length ? ['', '=== SAMPLES ===', ...samples] : []),
    ].join('\n')
    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(report.split('\n').slice(0, 9).join('\n') + `\n\nwritten to ${OUT}\n`)
  })
})
