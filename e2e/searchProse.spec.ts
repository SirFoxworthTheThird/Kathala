import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The writer's most frequent lookup is "where did I write that line", and the
 * palette used to answer "No results" to a word that was in the manuscript
 * twice. The prose was searchable only from Manuscript → Find & replace, which
 * nothing pointed at, so the honest conclusion from the palette was that the
 * app could not do it.
 *
 * Prose is gated exactly as its scene is: a scene the reader has not reached is
 * not searched. That half is asserted here too, because making a new body of
 * text searchable is exactly where a spoiler leak would appear.
 */

const OPENING =
  'The towpath was slick with the morning and Mira kept to the inside of it, ' +
  'where the reeds gave a little cover and the water said nothing at all. ' +
  'She had walked it since she was a child and could have walked it blind. ' +
  'At the turn, above the lock-keeper\'s roof, a brass weathercock hung still.'
const LATER = 'Above the counting-house a shutter knocked twice against its frame.'

/** A world with two scenes, the searched word only in the prose of the second. */
async function seed(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Prose World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.evaluate(async ([opening, later]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
      add: (v: unknown) => Promise<unknown>
      toArray: () => Promise<Array<{ id: string }>>
    }>
    const worlds = await db.worlds.toArray()
    const worldId = worlds[0].id
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId, name: 'Main', description: '', color: '#6366f1',
      dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.add({
      id: 'ch1', worldId, timelineId: 'tl1', number: 1, title: 'The Reed House',
      description: '', createdAt: now, updatedAt: now,
    })
    const base = {
      worldId, chapterId: 'ch1', timelineId: 'tl1', description: '', tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', title: 'Setting out', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', title: 'The seal breaks', sortOrder: 1 })
    await db.sceneTexts.add({
      id: 'st1', worldId, eventId: 'ev1', text: opening,
      wordCount: opening.split(' ').length, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({
      id: 'st2', worldId, eventId: 'ev2', text: later,
      wordCount: later.split(' ').length, createdAt: now, updatedAt: now,
    })
  }, [OPENING, LATER])

  await page.reload()
  await expect(page.getByTitle('Search (Ctrl+K)')).toBeVisible()
}

/** Search for `q` and return the visible result labels. */
async function search(page: Page, q: string): Promise<string[]> {
  await page.getByTitle('Search (Ctrl+K)').click()
  const box = page.getByPlaceholder('Search your world and the prose you wrote…')
  await expect(box).toBeVisible()
  await box.fill(q)
  await page.waitForTimeout(500)
  const labels = await page.locator('[data-search-result-label]').allTextContents()
  await page.keyboard.press('Escape')
  await expect(box).not.toBeVisible()
  return labels
}

test.describe('searching the prose you wrote', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await seed(page)
  })

  test('finds a scene by a word that is only in its prose', async ({ page }) => {
    // Presence: "shutter" is in no title, no synopsis — only in the draft.
    expect(await search(page, 'shutter')).toContain('The seal breaks')

    // Absence, in the same test, so neither half can be vacuous: a word that is
    // in no prose at all returns nothing.
    expect(await search(page, 'zeppelin')).toEqual([])
  })

  /*
    The first version of this test asserted the dialog contained the query, and
    passed with prose search disabled — because the empty state reads
    `No results for "towpath"`. It now asserts on words *neighbouring* the
    match, which only a rendered snippet can supply.
  */
  test('previews the line that matched, not the start of the scene', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    const box = page.getByPlaceholder('Search your world and the prose you wrote…')
    // Last sentence of a four-sentence scene.
    await box.fill('weathercock')
    await page.waitForTimeout(500)

    const dialog = page.getByRole('dialog', { name: 'Search' })
    await expect(dialog.locator('[data-search-result-label]')).toHaveText(['Setting out'])
    // Words either side of the match, which are nowhere but in the snippet.
    await expect(dialog.getByText(/lock-keeper/i)).toBeVisible()
    // …and not the opening of the scene, which is what a from-the-start
    // preview would have shown instead.
    await expect(dialog.getByText(/slick with the morning/i)).toHaveCount(0)
  })

  test('does not search prose the reader has not reached', async ({ page }) => {
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: {
          toArray: () => Promise<Array<{ id: string }>>
          update: (id: string, changes: object) => Promise<unknown>
        }
      }
      const worlds = await db.worlds.toArray()
      await db.worlds.update(worlds[0].id, { readingMode: true })
    })
    await page.reload()
    await expect(page.getByTitle('Search (Ctrl+K)')).toBeVisible()

    // The book opens at its first moment, so scene two is unread.
    expect(await search(page, 'shutter')).toEqual([])
    // …while scene one, which the reader is in, is searchable. Without this
    // half the assertion above would pass on a palette that searched nothing.
    expect(await search(page, 'towpath')).toContain('Setting out')

    // Read on, and the same word is now findable.
    await page.getByRole('button', { name: 'Next moment' }).click()
    await page.waitForTimeout(800)
    expect(await search(page, 'shutter')).toContain('The seal breaks')
  })
})
