import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A world lives in one browser's IndexedDB, and clearing site data takes it.
 *
 * The folder-copy machinery had existed for a long while and **nothing
 * anywhere mentioned it**: the status chip rendered nothing at all until a
 * folder was already bound, so the writer most at risk — the one who has never
 * heard of the feature — was the one told nothing. Silence there is
 * indistinguishable from *you are safe*.
 *
 * Driven in a browser because both halves are: the chip reads a handle store
 * that is not Dexie, and the nudge has to survive being answered.
 */

async function worldWithAScene(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Unbacked')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  return worldId
}

async function addACharacterAndScene(page: Page, worldId: string) {
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'ayla', worldId: id, name: 'Ayla', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The gate opens', description: '',
      locationMarkerId: null, involvedCharacterIds: ['ayla'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
      tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'ayla', eventId: 'ev1', isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 1, createdAt: now, updatedAt: now,
    })
  }, worldId)
}

test.describe('a world with nowhere else to live', () => {
  test.describe.configure({ timeout: 240_000 })

  test('says so beside its own name', async ({ page }) => {
    const worldId = await worldWithAScene(page)
    await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
    await settle(page)

    const chip = page.getByRole('button', { name: /^Backup:/ })
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await expect(chip).toHaveAccessibleName('Backup: Not backed up')

    // And it is one click from the panel that fixes it, rather than a statement
    // with no reply.
    await chip.click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('offers a folder once there is a scene to lose, and takes no for an answer', async ({ page }) => {
    const worldId = await worldWithAScene(page)
    await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
    await settle(page)

    /*
      The absence half first, and it is a real one: an empty world has nothing
      to protect, and the three nudges that matter then are the ones about
      getting a character and a scene in.
    */
    await expect(page.getByText('Keep a copy of this world in a folder')).toHaveCount(0)

    await addACharacterAndScene(page, worldId)
    await page.reload({ waitUntil: 'load' })
    await settle(page)

    const nudge = page.getByText('Keep a copy of this world in a folder')
    await expect(nudge).toBeVisible({ timeout: 20_000 })

    // Answered rather than obeyed: a writer with their own backups has a reply.
    const card = nudge.locator('xpath=ancestor::div[2]')
    await card.getByRole('button', { name: /Dismiss|×|Not now/ }).first().click()
    await expect(nudge).toHaveCount(0)

    // And it stays answered across a reload, because the answer is stored.
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await expect(page.getByText('Keep a copy of this world in a folder')).toHaveCount(0)
  })
})

/**
 * The same silence, one group along.
 *
 * The first version of this fix excluded browsers without the folder picker,
 * reasoning that there would be nothing to offer them. Brave blocks the File
 * System Access API with no flag to re-enable it, and no Chromium on Android
 * exposes it — so the writers with the *fewest* routes to a second copy were
 * the ones told least about it. There is something to offer: a `.pwk` export
 * falls back to a download link and works everywhere.
 *
 * Chromium has the picker, so the browser is made to look like Brave by
 * removing it before any app code runs.
 */
test.describe('a browser that cannot be given a folder', () => {
  test.describe.configure({ timeout: 240_000 })

  async function withoutTheFolderPicker(page: Page) {
    await page.addInitScript(() => {
      // It is an IDL attribute of Window, so it lives on the prototype; deleting
      // the own property alone would leave `'showDirectoryPicker' in window` true.
      delete (Window.prototype as unknown as Record<string, unknown>).showDirectoryPicker
      delete (window as unknown as Record<string, unknown>).showDirectoryPicker
    })
  }

  test('is told the same standing and a different remedy', async ({ page }) => {
    await withoutTheFolderPicker(page)
    const worldId = await worldWithAScene(page)
    await addACharacterAndScene(page, worldId)
    await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
    await settle(page)

    /*
      Without this the test is vacuous in the worst way: Chromium *does* have
      the picker, so a stub that silently failed to remove it would leave every
      assertion below testing the supported path instead.
    */
    expect(await page.evaluate(() => 'showDirectoryPicker' in window)).toBe(false)

    // The standing is the same sentence — this world is not backed up.
    await expect(page.getByRole('button', { name: /^Backup:/ }))
      .toHaveAccessibleName('Backup: Not backed up', { timeout: 20_000 })

    // The offer is the one it can act on, and not the one it cannot.
    await expect(page.getByText('Keep a copy of this world somewhere safe')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Keep a copy of this world in a folder')).toHaveCount(0)

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')

    // Not "requires Chrome or Edge", which named the wrong thing and offered
    // nothing — a reader on Brave is on Chromium and was told otherwise.
    await expect(main.getByText(/does not offer the folder picker/)).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('button', { name: /Export a .pwk copy/ })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Choose sync folder…' })).toHaveCount(0)
  })

  // The presence half of the pair above: with the picker in place, the same
  // screen offers the folder and says nothing about exporting instead.
  test('while a browser that can be is still offered the folder', async ({ page }) => {
    const worldId = await worldWithAScene(page)
    await addACharacterAndScene(page, worldId)
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')

    await expect(main.getByRole('button', { name: 'Choose sync folder…' })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText(/does not offer the folder picker/)).toHaveCount(0)
  })
})
