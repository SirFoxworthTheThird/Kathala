import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Marking an item as a kind of thing rather than one object.
 *
 * The continuity checker treats an item's whereabouts as unique, which is wrong
 * for lembas or a cloak the whole Fellowship carries — that one rule produced 71
 * of the 97 issues the shipped Fellowship reported. The flag is only useful if a
 * writer can actually set it, so this drives it through the editor.
 */
test('an item can be marked as something there is more than one of', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Quartermaster')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /items/i }).first().click()
  await page.getByRole('button', { name: 'Add Item' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Item' })).toBeVisible()
  await page.getByPlaceholder('Item name').fill('Elven Cloak')
  await page.getByRole('button', { name: 'Add Item' }).last().click()
  await page.getByText('Elven Cloak').first().click()

  await page.getByRole('button', { name: /^Edit/ }).first().click()
  const box = page.getByRole('checkbox', { name: /more than one of these/i })
  await expect(box, 'the control should be offered').toBeVisible()
  await expect(box, 'a new item is a unique object by default').not.toBeChecked()
  // A book of one timeline has no era to keep an item in (`eraState.spec.ts` offers it in one that has).
  await expect(page.getByRole('checkbox', { name: /condition stays in its era/i })).toHaveCount(0)

  await box.check()
  await page.getByRole('button', { name: 'Save' }).first().click()

  // Saving writes to Dexie and only then closes the editor, so the form going
  // away is the signal that the write landed. Reloading straight after the
  // click raced it — the flake this test showed on a loaded machine.
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)

  // It survives a reload, which is the part that proves it was written rather
  // than only held in component state.
  await page.reload()
  await page.getByRole('button', { name: /^Edit/ }).first().click()
  await expect(page.getByRole('checkbox', { name: /more than one of these/i })).toBeChecked()
})

test('Whereabouts names every holder of a thing there is more than one of (UX-3-11)', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Fellowship')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#888', createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c20', worldId: id, timelineId: 'tl', number: 20, title: 'The Ring Goes South', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({ id: 'e1', worldId: id, chapterId: 'c20', timelineId: 'tl', title: 'Outfitting the Fellowship', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now })
    await db.characters.bulkAdd([['gimli', 'Gimli'], ['legolas', 'Legolas'], ['sam', 'Samwise Gamgee']].map(([cid, name]) => ({ id: cid, worldId: id, name, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now })))
    await db.items.add({ id: 'cloak', worldId: id, name: 'Elven Cloak', description: '', iconType: 'other', tags: [], imageId: null, isCollective: true })
    await db.itemCustody.bulkAdd(['gimli', 'legolas', 'sam'].map((h) => ({ id: `cu-${h}`, worldId: id, itemId: 'cloak', eventId: 'e1', holderId: h, placeId: null, has: true, createdAt: now, updatedAt: now })))
  }, worldId)
  await page.goto(`/#/worlds/${worldId}/items/cloak`, { waitUntil: 'load' })
  const where = page.getByText('Whereabouts', { exact: true }).locator('xpath=../..')
  // All three, as the roster names them: it said "carried by Gimli" alone.
  await expect(where.getByRole('listitem')).toHaveCount(1, { timeout: 30_000 })
  await expect(where.getByRole('listitem')).toContainText('carried by Gimli, Legolas, Samwise Gamgee')
})
