import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { ISSUE_KIND_LABELS } from '../src/lib/continuity/issueKinds'

/*
  The headings come from the registry rather than being retyped here. Renaming
  `dead-then-alive` from "Alive after dying" to "Alive again after dying" broke
  this spec in three places at once, and a spec that has to be edited whenever a
  label is reworded is testing the wording, not the grouping.
*/
const DEAD_IN_SCENE = ISSUE_KIND_LABELS['dead-in-event']
const ALIVE_AGAIN = ISSUE_KIND_LABELS['dead-then-alive']

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

  const deadInScene = panel.getByText(DEAD_IN_SCENE, { exact: true })
  const aliveAfter = panel.getByText(ALIVE_AGAIN, { exact: true })

  await expect(panel.getByText(/Dead character Boromir in/).first())
    .toBeVisible({ timeout: 15_000 })
  // Nothing to triage between, so a heading would only repeat the category.
  await expect(deadInScene).toHaveCount(0)
  await expect(aliveAfter).toHaveCount(0)

  // ── A second kind ───────────────────────────────────────────────────────
  // He is recorded alive again two scenes later, which is a different fault.
  await page.keyboard.press('Escape')
  await seedSnapshot(page, 3, true)

  await page.getByTitle('Continuity Checker').click()
  await expect(panel.getByText('Continuity Checker')).toBeVisible({ timeout: 15_000 })

  // Now there is something to triage between, so each run is named and counted
  // — on the same locators that found nothing above.
  await expect(aliveAfter).toBeVisible({ timeout: 15_000 })
  await expect(deadInScene).toBeVisible()

  /*
    Both faults are warnings now — a recorded resurrection is a genre, not an
    impossibility — so the rule on show here is the tiebreak: **equal severities
    order by size**, the bigger run first. That errors lead whatever their count
    is the other half of the rule, and it is unit-tested in
    `src/lib/__tests__/issueKinds.test.ts`, which builds severities directly
    instead of depending on which kinds happen to be errors today.

    The label and its count are adjacent spans separated by a flex gap, so the
    text runs together — "Alive again after dying1" — and the count is pulled
    out rather than matched with a space that is not in the DOM.
  */
  // Locator.evaluate hands the element first and the argument second — the
  // element was being destructured as the pair, which is not iterable.
  const headings = await panel.evaluate((el, [alive, dead]) =>
    Array.from(el.querySelectorAll('div'))
      .map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim())
      .map((t) => new RegExp(`^(${alive}|${dead})\\s*(\\d+)$`).exec(t))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]} ${m[2]}`), [ALIVE_AGAIN, DEAD_IN_SCENE])
  expect(headings).toEqual([`${DEAD_IN_SCENE} 2`, `${ALIVE_AGAIN} 1`])
})
