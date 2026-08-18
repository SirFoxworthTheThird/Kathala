import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

/**
 * The "@" picker in the scene draft used to offer characters, and only ones
 * that already existed. Naming a sword or a house meant leaving the prose,
 * making the record, and coming back — the errand the picker exists to spare
 * people.
 *
 * Every test ends at the database. The prose showing a name is not evidence
 * that anything was recorded against the scene, and recording against the scene
 * is the entire point: it is what the map, the Brief and continuity read.
 */

const prose = (page: Page) => page.getByLabel('Scene prose')

const storedEvent = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Array<{ involvedItemIds: string[]; mentionedCharacterIds: string[]; locationMarkerId: string | null }>> }
    characters: { toArray: () => Promise<Array<{ id: string; name: string }>> }
    items: { toArray: () => Promise<Array<{ id: string; name: string }>> }
    locationMarkers: { toArray: () => Promise<Array<{ id: string; name: string; mapLayerId: string }>> }
  }
  const [events, characters, items, locationMarkers] = await Promise.all([
    db.events.toArray(), db.characters.toArray(), db.items.toArray(), db.locationMarkers.toArray(),
  ])
  return { event: events[0], characters, items, locationMarkers }
})

/** A world with one scene open for editing, and one existing item. */
async function sceneWithProse(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Mention World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
  await settleNav(page)
  await page.getByRole('button', { name: 'Add Item' }).first().click()
  await page.getByPlaceholder('Item name').fill('The Sealed Letter')
  await page.getByRole('button', { name: 'Add Item' }).last().click()
  await expect(page.getByText('The Sealed Letter').first()).toBeVisible()

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('The Letter')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
  await page.getByPlaceholder('Scene title').fill('The letter arrives')
  await page.getByRole('button', { name: 'Add Scene' }).last().click()

  // A new scene card arrives collapsed; the prose lives inside it.
  await page.getByRole('button', { name: 'Expand “The letter arrives”' }).click({ timeout: 30_000 })
  await expect(prose(page)).toBeVisible()
  return worldId
}

/** Type an "@" query and wait for the picker to answer. */
async function mention(page: Page, query: string) {
  await prose(page).click()
  await page.keyboard.type(` @${query}`)
  await page.waitForTimeout(500)
}

test.describe('Naming things from the scene prose', () => {
  test.describe.configure({ timeout: 300_000 })

  test('an existing item can be named, and lands on the scene', async ({ page }) => {
    await sceneWithProse(page)
    await mention(page, 'Sealed')

    // The row says what kind of thing it is, because a world can hold a
    // character and a place of the same name.
    const row = page.getByRole('button', { name: /The Sealed Letter\s+item/ })
    await expect(row).toBeVisible()
    await row.click()

    // The prose carries the plain name — no "@token" in a manuscript.
    await expect(prose(page)).toHaveValue(/The Sealed Letter/)
    await expect(prose(page)).not.toHaveValue(/@/)

    await expect.poll(async () => {
      const { event, items } = await storedEvent(page)
      const letter = items.find((i) => i.name === 'The Sealed Letter')
      return event.involvedItemIds.includes(letter?.id ?? '')
    }, { timeout: 15_000 }).toBe(true)
  })

  test('a character who does not exist yet can be made from the sentence', async ({ page }) => {
    await sceneWithProse(page)
    await mention(page, 'Marren')

    await page.getByRole('button', { name: /Marren\s+new character/ }).click()
    await expect(prose(page)).toHaveValue(/Marren/)

    await expect.poll(async () => {
      const { event, characters } = await storedEvent(page)
      const marren = characters.find((c) => c.name === 'Marren')
      return !!marren && event.mentionedCharacterIds.includes(marren.id)
    }, { timeout: 15_000 }).toBe(true)
  })

  /**
   * The pair to the test above: an offer to create must not appear for a name
   * that already exists, or a cast list ends up with two of everybody.
   */
  test('and is not offered a second time once it exists', async ({ page }) => {
    await sceneWithProse(page)
    await mention(page, 'Marren')
    await page.getByRole('button', { name: /Marren\s+new character/ }).click()
    await page.waitForTimeout(1200)

    await mention(page, 'Marren')
    await expect(page.getByRole('button', { name: /Marren\s+character/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /new character/ })).toHaveCount(0)
  })

  /**
   * A place is a pin, so it needs a map to be on. With no map in the world the
   * row is withheld rather than inventing coordinates — and the other two kinds
   * are still offered, which is what stops this passing on a picker that has
   * simply stopped working.
   */
  test('a place cannot be created in a world with no map', async ({ page }) => {
    await sceneWithProse(page)
    await mention(page, 'Thornfield')

    await expect(page.getByRole('button', { name: /Thornfield\s+new character/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Thornfield\s+new item/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /new place/ })).toHaveCount(0)

    const { locationMarkers } = await storedEvent(page)
    expect(locationMarkers).toHaveLength(0)
  })

  /**
   * With a map in the world the row appears, and the pin it makes is real: on
   * that map, and at its centre — somewhere findable to be dragged where it
   * belongs, rather than at coordinates that only look deliberate.
   *
   * This is the presence half of the test above. Without it, "no place row"
   * would pass just as well on a picker that never offers places at all.
   */
  test('and can be created once the world has a map, as a pin on it', async ({ page }) => {
    const worldId = await sceneWithProse(page)

    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await expect(page.getByRole('heading', { name: /Upload Map/ })).toBeVisible()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('The Shire')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })

    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('button', { name: 'Expand “The letter arrives”' }).click({ timeout: 30_000 })
    await mention(page, 'Thornfield')

    await page.getByRole('button', { name: /Thornfield\s+new place/ }).click()
    await expect(prose(page)).toHaveValue(/Thornfield/)

    await expect.poll(async () => {
      const { event, locationMarkers } = await storedEvent(page)
      const pin = locationMarkers.find((m) => m.name === 'Thornfield')
      return !!pin && !!pin.mapLayerId && event.locationMarkerId === pin.id
    }, { timeout: 20_000 }).toBe(true)
  })
})
