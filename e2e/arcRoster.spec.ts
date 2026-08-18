import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * ARC-1, ARC-2 and ARC-3 — what the Arc grid puts in front of you.
 *
 * The ordering and filtering maths is unit-tested in
 * `src/lib/__tests__/arcRoster.test.ts`; this drives the grid itself, where the
 * question is whether the rows and cells actually read differently.
 */

/** The character name down the left-hand column, top to bottom. */
const rowNames = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="grid"] tbody tr'))
    .map((tr) => (tr.querySelector('td')?.textContent ?? '').trim().split('\n')[0])
    .filter(Boolean),
)

test('the grid leads with who is in the book, and can put the blanks away', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Arc Roster')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByTitle('Characters').click()
  await settleNav(page)
  for (const name of ['Frodo', 'Bill the Pony', 'Barrow-wight']) {
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill(name)
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText(name).first()).toBeVisible()
  }

  await page.getByTitle('Timeline').click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  for (const title of ['The Shire', 'Rivendell']) {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText(title).first()).toBeVisible()
  }
  for (const [idx, title] of [['0', 'Departure'], ['1', 'Council']] as const) {
    await page.getByTitle('Open chapter detail').nth(Number(idx)).click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText(title).first()).toBeVisible()
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settleNav(page)
  }

  // Frodo is in both scenes and has state recorded in the first; Bill is in one
  // scene with nothing recorded; the Barrow-wight is in neither. Seeded through
  // the dev-only Dexie seam, as `characterArc.spec.ts` does — live queries pick
  // it up in place.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: { toArray: () => Promise<{ id: string; name: string; worldId: string }[]> }
      events: { toArray: () => Promise<{ id: string; sortOrder: number; chapterId: string }[]>
                update: (id: string, changes: object) => Promise<unknown> }
      chapters: { toArray: () => Promise<{ id: string; number: number }[]> }
      characterSnapshots: { add: (r: object) => Promise<unknown> }
    }
    const chars = await db.characters.toArray()
    const chapters = (await db.chapters.toArray()).sort((a, b) => a.number - b.number)
    const events = await db.events.toArray()
    const first = events.find((e) => e.chapterId === chapters[0].id)!
    const second = events.find((e) => e.chapterId === chapters[1].id)!
    const frodo = chars.find((c) => c.name === 'Frodo')!
    const bill = chars.find((c) => c.name === 'Bill the Pony')!

    await db.events.update(first.id, { involvedCharacterIds: [frodo.id, bill.id] })
    await db.events.update(second.id, { involvedCharacterIds: [frodo.id] })
    await db.characterSnapshots.add({
      id: crypto.randomUUID(), worldId: frodo.worldId, characterId: frodo.id, eventId: first.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: 10_000, createdAt: Date.now(), updatedAt: Date.now(),
    })
  })

  await page.getByRole('link', { name: 'Arc' }).click()
  await settleNav(page)

  // ── ARC-3 ────────────────────────────────────────────────────────────────
  // Most-seen first by default: Frodo (2 scenes), Bill (1), the Barrow-wight (0).
  await expect.poll(() => rowNames(page), { timeout: 20_000 })
    .toEqual(['Frodo', 'Bill the Pony', 'Barrow-wight'])

  // A–Z is still there, and it is the order the finding complained about — so
  // the assertion above is about the default, not about the only order there is.
  await page.getByRole('button', { name: 'A–Z' }).click()
  await expect.poll(() => rowNames(page), { timeout: 10_000 })
    .toEqual(['Barrow-wight', 'Bill the Pony', 'Frodo'])
  await page.getByRole('button', { name: 'Most seen' }).click()
  await expect.poll(() => rowNames(page), { timeout: 10_000 })
    .toEqual(['Frodo', 'Bill the Pony', 'Barrow-wight'])

  // ── ARC-1 ────────────────────────────────────────────────────────────────
  // Only Frodo has state recorded, so the control offers to put two away and
  // says so before you press it.
  const hide = page.getByRole('button', { name: 'Hide 2 with no recorded state' })
  await expect(hide).toBeVisible()
  await hide.click()
  await expect.poll(() => rowNames(page), { timeout: 10_000 }).toEqual(['Frodo'])
  const showing = page.getByRole('button', { name: 'Showing recorded only (2 hidden)' })
  await expect(showing).toBeVisible()
  // And it goes back, so this is a filter rather than a deletion.
  await showing.click()
  await expect.poll(() => rowNames(page), { timeout: 10_000 })
    .toEqual(['Frodo', 'Bill the Pony', 'Barrow-wight'])

  // ── ARC-2 ────────────────────────────────────────────────────────────────
  // Frodo's state was authored in The Shire and carried into Rivendell. The
  // carried cell says so and recedes; the authored one does neither. Measured
  // in the same read, so neither half can pass vacuously.
  const cells = await page.evaluate(() => {
    const tds = Array.from(document.querySelectorAll('[role="grid"] tbody tr td'))
      .filter((td) => (td.textContent ?? '').includes('Alive'))
    return tds.map((td) => ({
      carried: (td.textContent ?? '').includes('Carried forward'),
      opacity: Number(getComputedStyle(td.firstElementChild as Element).opacity),
    }))
  })
  expect(cells, 'two chapters of state for Frodo').toHaveLength(2)
  expect(cells[0]).toEqual({ carried: false, opacity: 1 })
  expect(cells[1].carried, 'the second chapter inherits').toBe(true)
  expect(cells[1].opacity, `the carried cell renders at ${cells[1].opacity}`).toBeLessThan(1)
})
