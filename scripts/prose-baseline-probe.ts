import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { addBook, countText, emptyCounts, toBaseline } from '../src/lib/proseChecks/baseline'
import { plainScene } from '../src/lib/proseChecks/text'
import { libraryBooks } from './proseLibrary'

/**
 * Count the prose checks' baseline (editorial-plan.md, R6, D-4) from the
 * Library's books, and write it where the app loads it from.
 *
 *   KATHALA_LIBRARY=../Kathala-Library npm run probe:prose-baseline
 */
describe('prose baseline', () => {
  it('counts the Library', () => {
    const counts = emptyCounts()
    const books = libraryBooks()
    for (const { book } of books) {
      const one = emptyCounts()
      for (const c of book.chapters) for (const s of c.scenes) countText(plainScene(s.text).text, one)
      addBook(counts, one)
    }
    const baseline = toBaseline(counts)
    const json = JSON.stringify(baseline)
    writeFileSync('src/lib/proseChecks/baseline.json', json)
    process.stdout.write(`${books.length} books, ${counts.total.toLocaleString('en')} words; ${Object.keys(baseline.words).length} words and ${Object.keys(baseline.bigrams).length} pairs kept; ${(json.length / 1024).toFixed(0)} KB\n`)
  })
})
