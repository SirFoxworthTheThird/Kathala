import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// The two remaining Plot Threads surfaces: an Arc View lane per thread, and
// dangling/dormant threads reported by the Continuity Checker. The cadence and
// issue maths are unit-tested (tagCadence / threadContinuity); these drive the
// real views.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/** A world with two chapters where "The Heist" is raised in ch.1 and dropped. */
async function setupDanglingThread(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Threaded')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  const gotoTimeline = async () => { await page.getByRole('link', { name: /timeline/i }).first().click(); await settleNav(page) }
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }
  const addEvent = async (title: string) => {
    await main.getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill(title)
    await page.getByRole('button', { name: 'Add Event' }).last().click()
  }

  // Arc View is character-centric, so the world needs at least one character.
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Vela')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Vela')).toBeVisible()

  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  for (const t of ['One', 'Two', 'Three', 'Four']) await addChapter(t)

  // One event in ch.1 (will carry the thread) and one in ch.4.
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('Casing the vault')
  await gotoTimeline()
  await page.getByTitle('Open chapter detail').nth(3).click()
  await addEvent('An unrelated scene')

  // Create the thread on the dashboard.
  await page.getByRole('link', { name: /dashboard/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'New thread' }).click()
  await page.getByPlaceholder(/Thread name/).fill('The Heist')
  await page.getByPlaceholder(/Thread name/).press('Enter')
  await expect(page.getByText('The Heist')).toBeVisible()

  // Tag only the chapter-1 scene.
  await gotoTimeline()
  await page.getByTitle('Open chapter detail').first().click()
  await main.getByText('Casing the vault', { exact: true }).click()
  await main.getByRole('button', { name: '+ Tag a thread…' }).click()
  await page.getByRole('option', { name: 'The Heist' }).click()
  await expect(main.getByLabel('Remove thread The Heist')).toBeVisible()

  // The arc grid only renders once at least one snapshot exists. Seed one
  // through the dev-only Dexie seam (as e2e/characterArc.spec.ts does), which
  // updates live queries in place.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: any }).__pwdb
    const [chars, events] = await Promise.all([db.characters.toArray(), db.events.toArray()])
    const vela = chars[0]
    const ev = events[0]
    await db.characterSnapshots.add({
      id: crypto.randomUUID(), worldId: vela.worldId, characterId: vela.id, eventId: ev.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: 10_000, createdAt: Date.now(), updatedAt: Date.now(),
    })
  })
}

test('Arc View shows a lane per plot thread', async ({ page }) => {
  test.setTimeout(90000)
  await setupDanglingThread(page)

  await page.getByRole('link', { name: /^arc$/i }).first().click()
  await settleNav(page)

  // The Threads row-type toggle appears once threads exist.
  await page.getByRole('button', { name: 'Threads', exact: true }).click()

  const main = page.getByRole('main')
  await expect(main.getByText('1 thread ·', { exact: false })).toBeVisible()
  await expect(main.getByText('The Heist', { exact: true })).toBeVisible()
  // The chapter that carries the thread names its beat.
  await expect(main.getByText('Casing the vault', { exact: true })).toBeVisible()
})

test('Continuity Checker reports a dangling plot thread', async ({ page }) => {
  test.setTimeout(90000)
  await setupDanglingThread(page)

  await page.getByTitle('Continuity Checker').click()
  await expect(page.getByRole('dialog', { name: 'Continuity Checker' })).toBeVisible()

  // The thread was raised in ch.1 and never returned to across ch.2–4.
  await expect(page.getByText('Plot threads', { exact: true })).toBeVisible()
  await expect(page.getByText(/Plot thread "The Heist" is left dangling/)).toBeVisible()
})
