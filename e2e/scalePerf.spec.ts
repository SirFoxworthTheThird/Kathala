import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Part C (next-plan.md): speed at novel scale. Measure first, then set the
 * bar — on a 100-scene book and on the largest in the Library:
 *
 * - **a header read**: planning a scene's header against the store, as the
 *   Page does on every line it applies (`planHeaderFromStore`, timed through
 *   `__pwperf`);
 * - **a checker run**: the continuity rules over a world already loaded
 *   (`kathala:checker`);
 * - **a paste of a 5-scene chapter** onto the Page, from the paste to every
 *   scene made and its header's cast recorded — with the Page's opening, which
 *   a book this long pays before anything can be pasted.
 *
 * The aim the plan sets is a header read under 30 ms on a 100-scene book. The
 * timings are printed (`SCALE …`), not asserted: this container is not a
 * writer's machine, and a bound pinned to it would go red for reasons nothing
 * to do with the code (see `arcScenesPerf`). What is asserted is that each
 * thing measured happened.
 */

const BOOKS = ['Pride and Prejudice', 'Little Women']

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const round = (x: number) => Math.round(x)

/** Header reads at five scenes across the book, three each: the line names the scene's place and cast. */
async function headerReads(page: Page) {
  return page.evaluate(async () => {
    const w = window as unknown as { __pwdb: Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>; __pwperf: { headerRead: (id: string, line: string) => Promise<number> } }
    const [events, chapters, characters, markers] = await Promise.all(['events', 'chapters', 'characters', 'locationMarkers'].map((t) => w.__pwdb[t].toArray()))
    const number = new Map(chapters.map((c) => [c.id, c.number as number]))
    const name = new Map([...characters, ...markers].map((r) => [r.id, r.name as string]))
    const ordered = [...events].sort((a, b) => (number.get(a.chapterId as string) ?? 0) - (number.get(b.chapterId as string) ?? 0) || (a.sortOrder as number) - (b.sortOrder as number))
    const picks = [0, 0.25, 0.5, 0.75, 1].map((f) => ordered[Math.min(ordered.length - 1, Math.floor(f * (ordered.length - 1)))])
    const times: number[] = []
    for (const e of picks) {
      const place = e.locationMarkerId ? `#${name.get(e.locationMarkerId as string)}` : ''
      const cast = (e.involvedCharacterIds as string[]).map((id) => `@@${name.get(id)}`).join(' ')
      const line = `[${[place, cast].filter(Boolean).join(' ')}]`
      for (let i = 0; i < 3; i++) times.push(await w.__pwperf.headerRead(e.id as string, line))
    }
    return { times, scenes: ordered.length }
  })
}

const durations = (page: Page, name: string) => page.evaluate((n) => performance.getEntriesByName(n).map((e) => e.duration), name)

test.describe('speed at novel scale (Part C)', () => {
  for (const book of BOOKS) {
    test(`${book}: a header read, a checker run, and a five-scene paste`, async ({ page }, testInfo) => {
      test.setTimeout(900_000)
      await resetDB(page)
      const worldId = await downloadLibraryBook(page, book)
      // Written, not read: the Library's books arrive in reading mode, where nothing is edited.
      await page.evaluate(async (id) => {
        const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (id: string, v: unknown) => Promise<unknown> } }
        await db.worlds.update(id, { readingMode: false })
      }, worldId)

      const reads = await headerReads(page)
      expect(reads.times).toHaveLength(15)

      // The checker, over the world once loaded: its last run is the one with everything in.
      await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
      await settle(page)
      await page.getByTitle('Continuity Checker').click()
      await expect(page.getByText('Continuity Checker').first()).toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(5_000)
      const checker = await durations(page, 'kathala:checker')
      expect(checker.length).toBeGreaterThan(0)
      await page.keyboard.press('Escape')

      // The Page, opened; then a chapter's worth of scenes pasted at its end.
      await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
      await settle(page)
      const opening = Date.now()
      await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
      const pageText = page.getByRole('textbox', { name: 'The book, as one page' })
      await expect(pageText).toBeVisible({ timeout: 300_000 })
      const opened = Date.now() - opening

      const who = await page.evaluate(async () => {
        const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { toArray: () => Promise<Array<{ id: string; name: string }>> } }
        const [first] = await db.characters.toArray()
        return first
      })
      await pageText.click()
      await page.keyboard.press('Control+End')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      const text = Array.from({ length: 5 }, (_, i) => [`## Measured scene ${i + 1}`, `[@@${who.name}]`, '', `Prose for measured scene ${i + 1}.`, ''].join('\n')).join('\n')
      const pasting = Date.now()
      await page.locator('.cm-content').evaluate((el, t) => {
        const data = new DataTransfer()
        data.setData('text/plain', t)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
      }, text)
      // Every scene made, and its header's cast recorded.
      const made = () => page.evaluate(async (id) => {
        const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { toArray: () => Promise<Array<{ title: string; involvedCharacterIds: string[] }>> } }
        return (await db.events.toArray()).filter((e) => e.title.startsWith('Measured scene') && e.involvedCharacterIds.includes(id)).length
      }, who.id)
      await expect.poll(made, { timeout: 300_000, intervals: [100] }).toBe(5)
      const pasted = Date.now() - pasting
      const applies = await durations(page, 'kathala:header-read')

      const line = `SCALE ${book}: ${reads.scenes} scenes; header read median ${round(median(reads.times))} ms (${round(Math.min(...reads.times))}–${round(Math.max(...reads.times))}, n=${reads.times.length}); checker ${round(checker[checker.length - 1])} ms (last of ${checker.length} runs, max ${round(Math.max(...checker))}); Page opened in ${opened} ms; 5-scene paste ${pasted} ms (${applies.length} header reads, median ${round(median(applies))} ms)`
      console.log(line)
      testInfo.annotations.push({ type: 'scale', description: line })
    })
  }
})
