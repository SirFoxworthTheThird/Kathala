import { test, expect } from '@playwright/test'
import { onCards } from './helpers/nav'
import { resetDB } from './helpers/reset'

test.describe('Character Arc view', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)

    // Create a world
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Arc World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Create two characters
    await page.getByTitle('Characters').click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Frodo')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Frodo')).toBeVisible()

    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Sam')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Sam')).toBeVisible()

    // Create a timeline with two chapters
    await page.getByTitle('Manuscript').click()
    await onCards(page)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Shire')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    // Chapter names appear in both the chapter list and the timeline bar.
    await expect(page.getByText('The Shire').first()).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Rivendell').first()).toBeVisible()

    // Add one event so a snapshot can reference it.
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText('Departure').first()).toBeVisible()

    // The arc grid renders character rows only once at least one snapshot
    // exists. Seed a consistent one through Dexie (the dev-only __pwdb seam),
    // which updates live queries in place — no reload, no dangling references.
    // Row labels come from the character list, so seeding one character is enough.
    await page.evaluate(async () => {
       
      const db = (window as any).__pwdb
      const [chars, events] = await Promise.all([db.characters.toArray(), db.events.toArray()])
      const frodo = chars.find((c: { name: string }) => c.name === 'Frodo')
      const ev = events[0]
      await db.characterSnapshots.add({
        id: crypto.randomUUID(), worldId: frodo.worldId, characterId: frodo.id, eventId: ev.id,
        isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
        inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
        sortKey: 10_000, createdAt: Date.now(), updatedAt: Date.now(),
      })
    })
  })

  test('navigates to character arc view', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)
  })

  test('arc view shows chapter columns', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    /*
      The Arc grid's own column headers, and nothing else. This used to be a
      page-wide `getByText(/Ch\. 1/)` — and setup ends on a chapter screen, whose
      header says "Ch. 1 —" too. Straight after clicking Arc the outgoing screen is
      still mounted, so the assertion could be met by the page being *left* rather
      than the one arrived at. The binder, which repeats the chapter title, turned
      that into a strict-mode flake and so into something anyone could see.
    */
    await expect(page.getByRole('columnheader', { name: 'Chapter 1, The Shire' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Chapter 2, Rivendell' })).toBeVisible()
  })

  test('arc view shows character rows', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()
  })

  test('filter input narrows visible characters', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()

    await page.getByPlaceholder('Filter characters…').fill('Frodo')
    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).not.toBeVisible()
  })
})
