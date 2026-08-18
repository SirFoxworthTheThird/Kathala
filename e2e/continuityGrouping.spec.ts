import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * CC-3: a category was the only grouping the checker had, so *Items 79* was one
 * heading over a single repeated fault with the real findings buried inside it.
 * The grouping and ordering are unit-tested in
 * `src/lib/__tests__/issueKinds.test.ts`; this drives the panel, where the
 * question is whether a heading appears when there is something to triage
 * between and stays away when there is not.
 */

interface SeedDb {
  characters: { toArray: () => Promise<{ id: string; worldId: string }[]> }
  events: {
    toArray: () => Promise<{ id: string; sortOrder: number }[]>
    update: (id: string, changes: object) => Promise<unknown>
  }
  characterSnapshots: { add: (r: object) => Promise<unknown> }
}

/** A snapshot for the character, at the event at `eventIndex` in story order. */
async function seedSnapshot(page: Page, eventIndex: number, isAlive: boolean) {
  await page.evaluate(async ({ eventIndex, isAlive }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as SeedDb
    const [char] = await db.characters.toArray()
    const events = (await db.events.toArray()).sort((a, b) => a.sortOrder - b.sortOrder)
    await db.characterSnapshots.add({
      id: crypto.randomUUID(), worldId: char.worldId, characterId: char.id,
      eventId: events[eventIndex].id,
      isAlive, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: (eventIndex + 1) * 100, createdAt: Date.now(), updatedAt: Date.now(),
    })
  }, { eventIndex, isAlive })
}

test('a category with more than one kind of fault says which is which', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Tangled')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByTitle('Characters').click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Boromir')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Boromir').first()).toBeVisible()

  await page.getByTitle('Timeline').click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('Amon Hen')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  for (const title of ['The Fall', 'After', 'Later', 'Epilogue']) {
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText(title).first()).toBeVisible()
  }

  // Boromir dies in the first scene and is in the cast of the two after it —
  // two faults, both the same kind.
  await seedSnapshot(page, 0, false)
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as SeedDb
    const [char] = await db.characters.toArray()
    const events = (await db.events.toArray()).sort((a, b) => a.sortOrder - b.sortOrder)
    await db.events.update(events[1].id, { involvedCharacterIds: [char.id] })
    await db.events.update(events[2].id, { involvedCharacterIds: [char.id] })
  })

  // ── One kind ────────────────────────────────────────────────────────────
  await page.getByTitle('Continuity Checker').click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByText('Continuity Checker')).toBeVisible({ timeout: 15_000 })

  const deadInScene = panel.getByText('Dead character in a scene', { exact: true })
  const aliveAfter = panel.getByText('Alive after dying', { exact: true })

  await expect(panel.getByText(/Dead character Boromir in/).first())
    .toBeVisible({ timeout: 15_000 })
  // Nothing to triage between, so a heading would only repeat the category.
  await expect(deadInScene).toHaveCount(0)
  await expect(aliveAfter).toHaveCount(0)

  // ── A second kind ───────────────────────────────────────────────────────
  // He is recorded alive again two scenes later, which is a different fault —
  // and an error rather than a warning.
  await page.keyboard.press('Escape')
  await seedSnapshot(page, 3, true)

  await page.getByTitle('Continuity Checker').click()
  await expect(panel.getByText('Continuity Checker')).toBeVisible({ timeout: 15_000 })

  // Now there is something to triage between, so each run is named and counted
  // — on the same locators that found nothing above.
  await expect(aliveAfter).toBeVisible({ timeout: 15_000 })
  await expect(deadInScene).toBeVisible()

  // The error leads, whatever the counts, which is the whole point of grouping.
  // The label and its count are adjacent spans separated by a flex gap, so the
  // text runs together — "Alive after dying1" — and the count is pulled out
  // rather than matched with a space that is not in the DOM.
  const headings = await panel.evaluate((el) =>
    Array.from(el.querySelectorAll('div'))
      .map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim())
      .map((t) => /^(Alive after dying|Dead character in a scene)\s*(\d+)$/.exec(t))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]} ${m[2]}`))
  expect(headings).toEqual(['Alive after dying 1', 'Dead character in a scene 2'])
})
