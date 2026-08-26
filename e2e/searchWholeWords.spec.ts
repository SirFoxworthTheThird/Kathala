import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * N7 from a blind writer run: `Ctrl+K` → `tin` returned five results, one of
 * them a scene whose only hit was *cas**tin**g*, and `Bel` returned
 * *Bellhouse* and *bells* alongside *Bel Andry*. Matching inside words is the
 * right default for "where did I write that line", and it is noise in
 * proportion to how short and invented your names are — which, for the writers
 * this app is for, is very.
 *
 * So it is an option, with the same name and the same behaviour as the one
 * Find & Replace has always had.
 */

// "tin" three times over: inside a word in the first scene, standing alone in
// the second, and inside a word again in the same sentence — so a matcher that
// finds the wrong one has somewhere to go wrong.
const CASTING = 'The slate was kept until the next casting, then washed clean and hung by the door.'
const TIN = 'The tin was thin, and everyone in the yard knew it before the inspector came.'

async function seed(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Bells')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.evaluate(async ([casting, tin]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
      add: (v: unknown) => Promise<unknown>
      toArray: () => Promise<Array<{ id: string }>>
    }>
    const worldId = (await db.worlds.toArray())[0].id
    const now = Date.now()
    await db.timelines.add({ id: 'tl1', worldId, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId, timelineId: 'tl1', number: 1, title: 'Anhalt', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const base = {
      worldId, chapterId: 'ch1', timelineId: 'tl1', description: '', tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', title: 'The pour', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', title: 'Weighing the ninth', sortOrder: 1 })
    await db.sceneTexts.add({ id: 'st1', worldId, eventId: 'ev1', text: casting, wordCount: casting.split(' ').length, createdAt: now, updatedAt: now })
    await db.sceneTexts.add({ id: 'st2', worldId, eventId: 'ev2', text: tin, wordCount: tin.split(' ').length, createdAt: now, updatedAt: now })
    // A character whose name is a prefix of a place's, the other half of N7.
    await db.characters.add({ id: 'bel', worldId, name: 'Bel Andry', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.mapLayers.add({ id: 'map-a', worldId, name: 'Anhalt', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk-bell', worldId, mapLayerId: 'map-a', name: 'Bellhouse of the Ninth', description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
  }, [CASTING, TIN])

  await page.reload()
  await expect(page.getByTitle('Search (Ctrl+K)')).toBeVisible()
}

async function open(page: Page) {
  await page.getByTitle('Search (Ctrl+K)').click()
  const box = page.getByPlaceholder('Search your world and the prose you wrote…')
  await expect(box).toBeVisible()
  return box
}

async function labels(page: Page): Promise<string[]> {
  await page.waitForTimeout(500)
  return page.locator('[data-search-result-label]').allTextContents()
}

test.describe('searching whole words', () => {
  test.describe.configure({ timeout: 240_000 })

  test.beforeEach(async ({ page }) => {
    await resetDB(page)
    await seed(page)
  })

  test('the option drops the partial-word hits and keeps the real one', async ({ page }) => {
    const box = await open(page)
    const toggle = page.getByRole('checkbox', { name: 'Whole words' })

    // Off by default: `tin` finds both scenes, one of them only because of
    // "casting". That is the behaviour the option exists to be an alternative
    // to, so it is asserted rather than assumed.
    await expect(toggle).not.toBeChecked()
    await box.fill('tin')
    expect(await labels(page)).toEqual(expect.arrayContaining(['The pour', 'Weighing the ninth']))

    // On: only the scene where `tin` is a word.
    await toggle.check()
    const strict = await labels(page)
    expect(strict).toContain('Weighing the ninth')
    expect(strict).not.toContain('The pour')
  })

  test('a short name stops matching the longer word it starts', async ({ page }) => {
    const box = await open(page)
    const toggle = page.getByRole('checkbox', { name: 'Whole words' })

    await box.fill('Bel')
    expect(await labels(page)).toEqual(expect.arrayContaining(['Bel Andry', 'Bellhouse of the Ninth']))

    await toggle.check()
    const strict = await labels(page)
    expect(strict).toContain('Bel Andry')
    expect(strict).not.toContain('Bellhouse of the Ninth')
  })

  test('the snippet shows the match the option chose', async ({ page }) => {
    const box = await open(page)
    await page.getByRole('checkbox', { name: 'Whole words' }).check()
    await box.fill('tin')
    await page.waitForTimeout(600)

    const dialog = page.getByRole('dialog', { name: 'Search' })
    // Words either side of the standalone match, which only a snippet centred
    // there can supply — and not the scene that matched on "casting", which is
    // no longer a result at all.
    await expect(dialog.getByText(/everyone in the yard/i)).toBeVisible()
    await expect(dialog.getByText(/casting/i)).toHaveCount(0)
  })

  test('the choice is remembered, because it is a preference and not a mood', async ({ page }) => {
    const box = await open(page)
    await page.getByRole('checkbox', { name: 'Whole words' }).check()
    await box.fill('tin')
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(page.getByTitle('Search (Ctrl+K)')).toBeVisible()
    const reopened = await open(page)
    await expect(page.getByRole('checkbox', { name: 'Whole words' })).toBeChecked()

    // And it is still doing something after the reload, not merely drawn ticked.
    await reopened.fill('tin')
    expect(await labels(page)).not.toContain('The pour')
  })
})
