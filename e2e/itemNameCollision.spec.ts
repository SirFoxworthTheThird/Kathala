import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The Current State panel's inventory has *Add existing item…* directly above
 * *New item name…*, and typing a name you already had into the second one made
 * a second item with the same name, silently. A blind writer run did it three
 * times without noticing and ended the morning with four records called
 * *Cathe's letter*, one of which had the description.
 *
 * The reason it matters is not tidiness: the hand-off that takes an item off
 * its previous holder, and the check that flags one object in two places, both
 * key on item **id**, so two records with one name are two objects and the
 * machinery stays quiet about them.
 */

const SLATE = 'The tally-slate'

async function worldWithSlate(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Bells')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, slate]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'cathe', worldId: id, name: 'Cathe Vaux', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'slate', worldId: id, name: slate, description: 'Chalked with the weights.', iconType: 'item', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The pour',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['cathe'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, [worldId, SLATE])
  return worldId
}

const itemNames = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { items: { toArray: () => Promise<Array<{ name: string }>> } }
  return (await db.items.toArray()).map((i) => i.name).sort()
})

const inventory = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { toArray: () => Promise<Array<{ inventoryItemIds: string[] }>> } }
  return (await db.characterSnapshots.toArray()).flatMap((s) => s.inventoryItemIds)
})

async function openState(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/characters/cathe?tab=state`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)
}

test.describe('typing an item name you already have', () => {
  test.describe.configure({ timeout: 240_000 })

  test('adds the item you had instead of minting a twin', async ({ page }) => {
    const worldId = await worldWithSlate(page)
    await openState(page, worldId)

    const field = page.getByLabel('New item name')
    await expect(field).toBeVisible({ timeout: 20_000 })

    // The warning arrives while typing, before anything is committed.
    await field.fill(SLATE)
    await expect(page.getByText(`"${SLATE}" already exists`)).toBeVisible()

    await page.getByRole('button', { name: `Add the existing "${SLATE}"` }).click()
    await settle(page)

    /*
      Polled, not slept on. Saving writes a snapshot through Dexie and `settle`
      watches the *screen*, which does not change when a write lands — so this
      read the database before the write arrived and failed intermittently in
      four consecutive runs, always with an empty inventory. Waiting for the
      condition is both correct and quicker than the sleep it replaces.
    */
    expect(await itemNames(page)).toEqual([SLATE])
    await page.getByRole('button', { name: 'Save State' }).click()
    await expect.poll(() => inventory(page), { timeout: 15_000 }).toEqual(['slate'])

    // And the presence half: a name the world does not have still creates one.
    await field.fill('The ninth bell')
    await expect(page.getByText('already exists')).toHaveCount(0)
    await page.getByRole('button', { name: 'Create item' }).click()
    await expect.poll(() => itemNames(page), { timeout: 15_000 }).toEqual(['The ninth bell', SLATE])
  })

  test('says so, and offers nothing, when they are already holding it', async ({ page }) => {
    const worldId = await worldWithSlate(page)
    await openState(page, worldId)

    const field = page.getByLabel('New item name')
    await expect(field).toBeVisible({ timeout: 20_000 })
    await field.fill(SLATE)
    await page.getByRole('button', { name: `Add the existing "${SLATE}"` }).click()
    await settle(page)

    // Type the same name a second time: it is hers now, so there is nothing to add.
    await field.fill(SLATE)
    await expect(page.getByText(`"${SLATE}" is already in this inventory.`)).toBeVisible()
    await expect(page.getByRole('button', { name: `Already holding "${SLATE}"` })).toBeDisabled()
    await expect.poll(() => itemNames(page), { timeout: 15_000 }).toEqual([SLATE])
  })
})
