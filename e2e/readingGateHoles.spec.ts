import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Two holes a blind reader run found in the gate, from opposite directions.
 *
 * One let a record through that should have waited; the other held back records
 * that could never arrive at all. Both came from the same seam — what the gate
 * is asked about, rather than what it decides.
 */

const stopReading = (page: Page, worldId: string) => page.evaluate(async (id) => {
  const db = (window as unknown as { __pwdb?: {
    worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
  } }).__pwdb
  await db!.worlds.update(id, { readingMode: false })
}, worldId)

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a character page does not list relationships with people the reader has not met', async ({ page }) => {
  /*
    `useCharacterRelationships` was a raw query with no gate. The sibling
    `useRelationships` is gated and says why in its own comment, which is most of
    how the omission survived — the file reads as though relationships were
    handled. At chapter 7 of *Monte Cristo* a character page showed rows whose
    counterpart was redacted to "Unknown" beside a description naming them.

    Alice at the opening: Alice meets the Hatter in chapter 7, so at the start
    that relationship exists in the data and must not be on her page.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('main').getByRole('link').first().click()
  await settle(page)

  const tab = page.getByRole('tab', { name: /Relationships/ })
  if (await tab.count()) await tab.click()
  await settle(page)

  const shown = await page.getByRole('main').innerText()
  expect(shown, 'nobody is listed as a bond with a redacted stranger').not.toContain('Unknown')

  /*
    The presence beside the absence, on the same character. Turning reading mode
    off must bring the later bonds back, or this passes on a page that lists
    nothing for anyone.
  */
  const readerText = shown
  await stopReading(page, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  if (await tab.count()) await tab.click()
  await settle(page)
  const writerText = await page.getByRole('main').innerText()
  expect(writerText.length, 'a writer sees more of them than a reader does')
    .toBeGreaterThan(readerText.length)
})

test('a lore page linked to a faction is reachable while reading', async ({ page }) => {
  /*
    `linksRevealed` asked `isRevealed` about every linked id, and `isRevealed`
    answers false for anything it has never seen appear. That is right for a
    character — the roster proves they exist, so silence means "not met yet" —
    and wrong for a faction, a map layer or the world itself, because the gate
    records no appearances for those kinds at all.

    So those pages were unreachable at every cursor, and the screen called them
    not written. Measured across the shipped Library: 51 pages in 12 books.
    *Philosopher's Stone* has two, of which "Gryffindor House" is one.
  */
  const worldId = await downloadLibraryBook(page, "Harry Potter and the Philosopher's Stone")
  await settle(page)
  await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
  await settle(page)

  const page7 = page.getByRole('main').getByText('Gryffindor House', { exact: true }).first()

  /*
    Hidden at the opening, and rightly: this page carries its own reveal point,
    the Sorting Ceremony in chapter 7. The first version of this test asserted
    at chapter 1 and failed against a working fix — the page was waiting for the
    story, exactly as it should.
  */
  await expect(page7, 'not before the Sorting').toHaveCount(0)

  // Read to the end, where nothing has a reveal point left to wait for.
  const last = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: Record<string, {
      toArray: () => Promise<Record<string, string | number>[]>
    }> }).__pwdb!
    const [events, chapters] = await Promise.all([db.events.toArray(), db.chapters.toArray()])
    const no = new Map(chapters.map((c) => [c.id as string, c.number as number]))
    return events
      .map((e) => ({ id: e.id as string, key: (no.get(e.chapterId as string) ?? 0) * 1e4 + (e.sortOrder as number) }))
      .sort((a, b) => a.key - b.key)
      .at(-1)!.id
  })
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('plotweave-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('plotweave-ui', JSON.stringify(st))
  }, last)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('plotweave-ui') ?? '{}').state?.activeEventId ?? null),
  'the cursor was parked at the end').toBe(last)

  await expect(page7, 'the page its own links were hiding').toBeVisible({ timeout: 20_000 })
})

test('and a character who never appears is still held back', async ({ page }) => {
  /*
    The half the fix must not break. `isRevealed` fails closed on purpose: an
    entity the story never places would otherwise arrive at chapter one, which
    is how Charlie Weasley, a flying motorcycle and Godric's Hollow once did.
    A character the book never places is still *in* the roster, so the gate has
    a model for them and keeps them waiting.
  */
  const worldId = await downloadLibraryBook(page, "Harry Potter and the Philosopher's Stone")
  await settle(page)

  const counts = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: Record<string, {
      toArray: () => Promise<Record<string, unknown>[]>
    }> }).__pwdb!
    const [characters, events] = await Promise.all([db.characters.toArray(), db.events.toArray()])
    const seen = new Set<string>()
    for (const e of events) {
      for (const id of (e.involvedCharacterIds as string[] | undefined) ?? []) seen.add(id)
      if (e.povCharacterId) seen.add(e.povCharacterId as string)
    }
    return { total: characters.length, unplaced: characters.filter((c) => !seen.has(c.id as string)).length }
  })
  expect(counts.unplaced, 'the book has characters it never puts on stage').toBeGreaterThan(0)

  await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
  await settle(page)
  const listed = await page.getByRole('main').getByRole('link').count()
  expect(listed, `${listed} listed of ${counts.total}, ${counts.unplaced} never placed`)
    .toBeLessThan(counts.total)
})
