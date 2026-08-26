import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Character goals across their three surfaces: the Goals tab (CRUD + time
// scoping), the Writer's Brief, and the Arc View overlay. The active-at-cursor
// maths is unit-tested in src/lib/__tests__/characterGoals.test.ts.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

async function setupWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Inner Life')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')

  // A character.
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Vela')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Vela')).toBeVisible()

  // A timeline, chapter, and two events.
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  for (const title of ['The oath', 'The betrayal']) {
    await main.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
  }
}

test('goals can be added, scoped in time, and reach the Writer\'s Brief', async ({ page }) => {
  test.setTimeout(120000)
  await setupWorld(page)

  // Add two goals on the Goals tab.
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.getByText('Vela').click()
  await page.getByRole('tab', { name: 'Goals' }).click()

  await page.getByRole('button', { name: /Add a goal/ }).first().click()
  await page.getByPlaceholder(/conscious objective/).fill('Reclaim the throne')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Delete want "Reclaim the throne"')).toBeVisible()

  // A second goal, this time a Fear (the type picker is the custom Select).
  await page.getByRole('button', { name: /Add a goal/ }).click()
  await page.getByRole('button', { name: 'Want', exact: true }).click()
  await page.getByRole('option', { name: 'Fear' }).click()
  await page.getByPlaceholder(/avoiding/).fill('Becoming her father')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Delete fear "Becoming her father"')).toBeVisible()

  // Scope the first goal to start at the second event.
  const fromPicker = page.getByRole('button', { name: /The beginning/ }).first()
  await fromPicker.click()
  await page.getByRole('option', { name: /The betrayal/ }).click()

  // Put the character on stage at the first event so the Brief lists her.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: any }).__pwdb
    const [chars, events, chapters] = await Promise.all([
      db.characters.toArray(), db.events.toArray(), db.chapters.toArray(),
    ])
    const chapterNumber = new Map<string, number>(
      chapters.map((c: { id: string; number: number }) => [c.id, c.number] as [string, number]),
    )
    for (const ev of events) {
      await db.characterSnapshots.add({
        id: crypto.randomUUID(), worldId: chars[0].worldId, characterId: chars[0].id, eventId: ev.id,
        isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
        inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
        // sortKey convention: chapter number + sortOrder / 1e6 (see src/lib/sortKey.ts)
        sortKey: (chapterNumber.get(ev.chapterId) ?? 0) + ev.sortOrder / 1_000_000,
        createdAt: Date.now(), updatedAt: Date.now(),
      })
    }
  })

  // At the FIRST event the scoped goal is not yet held, but the unscoped one is.
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByTitle('The oath', { exact: true }).click()
  await page.getByTitle("Writer's Brief").click()
  const brief = page.getByRole('dialog', { name: /Writer's Brief/i })
  await expect(brief.getByText('Becoming her father')).toBeVisible()
  await expect(brief.getByText('Reclaim the throne')).toHaveCount(0)

  // At the SECOND event it has begun.
  await page.keyboard.press('Escape')
  await page.getByTitle('The betrayal', { exact: true }).click()
  await page.getByTitle("Writer's Brief").click()
  await expect(brief.getByText('Reclaim the throne')).toBeVisible()
})

test('the Arc View Goals overlay lists a character\'s goals', async ({ page }) => {
  test.setTimeout(120000)
  await setupWorld(page)

  // One unscoped goal.
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.getByText('Vela').click()
  await page.getByRole('tab', { name: 'Goals' }).click()
  await page.getByRole('button', { name: /Add a goal/ }).first().click()
  await page.getByPlaceholder(/conscious objective/).fill('Reclaim the throne')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Delete want "Reclaim the throne"')).toBeVisible()

  // Arc needs a snapshot to render rows.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: any }).__pwdb
    const [chars, events] = await Promise.all([db.characters.toArray(), db.events.toArray()])
    await db.characterSnapshots.add({
      id: crypto.randomUUID(), worldId: chars[0].worldId, characterId: chars[0].id, eventId: events[0].id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: 1, createdAt: Date.now(), updatedAt: Date.now(),
    })
  })

  await page.getByRole('link', { name: /^arc$/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Goals', exact: true }).click()

  const main = page.getByRole('main')
  await expect(main.getByText('Reclaim the throne')).toBeVisible()
})
