import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * HB-7 and HB-8, the two remaining findings from the Highbarrow review.
 *
 * **HB-7:** *"Adding a Character returned to the collection, adding an Item
 * navigated directly to its detail page… Serial entry becomes unpredictable."*
 * The diff was the finding: the two dialogs were byte-identical apart from
 * which function they called, and differed only because one roster passed an
 * `onCreated` that navigated. Both stay on the roster now, and both offer
 * **Add another**, which is what the serial-entry half was about.
 *
 * **HB-8:** *"both showed 'no scenes tagged yet' without a visible action or
 * explanation."* Their recommendation to prefer a stable entity link over
 * free-text tags was already satisfied — a scene carries `threadIds` — so what
 * shipped is the way to reach it.
 */

async function worldWithScenes(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.bulkAdd([1, 2].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl1', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    const base = {
      worldId: id, timelineId: 'tl1', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.bulkAdd([
      { ...base, id: 'ev1', chapterId: 'ch1', title: 'The wreck', sortOrder: 0 },
      { ...base, id: 'ev2', chapterId: 'ch1', title: 'A letter arrives', sortOrder: 1 },
      { ...base, id: 'ev3', chapterId: 'ch2', title: 'The gate opens', sortOrder: 0 },
    ])
  }, worldId)
  await page.waitForTimeout(500)
  await dismissFirstRunGuide(page)
  return worldId
}

/** Scoped to the dialog: the chapter bar and the dashboard name chapters too. */
const attachDialog = (page: Page) => page.getByRole('dialog')

test.describe('HB-7: the two rosters create the same way', () => {
  test.describe.configure({ timeout: 180_000 })

  for (const kind of [
    { path: 'items', open: 'Add Item', submit: 'Add Item', field: 'Item name', another: 'Add another item', name: 'Excalibur' },
    { path: 'characters', open: 'Add Character', submit: 'Add Character', field: 'Character name', another: 'Add another character', name: 'Barnaby' },
  ]) {
    test(`${kind.path}: creating leaves you on the roster`, async ({ page }) => {
      const worldId = await worldWithScenes(page)
      await page.goto(`/#/worlds/${worldId}/${kind.path}`)
      await settle(page)

      await page.getByRole('button', { name: kind.open }).first().click()
      await page.getByPlaceholder(kind.field).fill(kind.name)
      await page.getByRole('button', { name: kind.submit }).last().click()

      // The URL is the assertion: Items used to navigate to the detail page and
      // Characters did not, off the same dialog.
      await expect(page).toHaveURL(new RegExp(`/${kind.path}$`))
      await expect(page.getByRole('main').getByText(kind.name).first()).toBeVisible()
    })

    test(`${kind.path}: "Add another" keeps the dialog open and clears it`, async ({ page }) => {
      const worldId = await worldWithScenes(page)
      await page.goto(`/#/worlds/${worldId}/${kind.path}`)
      await settle(page)

      await page.getByRole('button', { name: kind.open }).first().click()
      const nameField = page.getByPlaceholder(kind.field)
      await nameField.fill(`${kind.name} One`)
      await page.getByRole('button', { name: kind.another }).click()

      // Still open, empty, and focused — the whole point is typing a list.
      await expect(nameField).toBeVisible()
      await expect(nameField).toHaveValue('')
      await expect(nameField).toBeFocused()

      await nameField.fill(`${kind.name} Two`)
      await page.getByRole('button', { name: kind.submit }).last().click()

      // Absence paired with presence: the dialog is gone and both records exist.
      await expect(nameField).toHaveCount(0)
      await expect(page.getByRole('main').getByText(`${kind.name} One`)).toBeVisible()
      await expect(page.getByRole('main').getByText(`${kind.name} Two`)).toBeVisible()
    })
  }
})

test.describe('HB-8: a thread can be attached to scenes from where it is created', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the empty row offers the act, and tagging clears its warning', async ({ page }) => {
    await worldWithScenes(page)
    await page.waitForTimeout(600)

    await page.getByRole('button', { name: 'New thread' }).click({ timeout: 30_000 })
    await page.getByPlaceholder(/Thread name/).fill('The Rebellion')
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    // Presence of the complaint, before the fix for it.
    await expect(page.getByText('no scenes tagged yet')).toBeVisible()

    await page.getByRole('button', { name: 'Attach scenes to thread The Rebellion' }).click()
    const dialog = attachDialog(page)
    await expect(dialog.getByRole('heading', { name: /Attach .* to scenes/ })).toBeVisible()

    // Grouped by chapter, in the timeline's own reading order. Scoped, because
    // the chapter bar along the bottom names every chapter too.
    await expect(dialog.getByText('Ch. 1 — Chapter 1')).toBeVisible()
    await expect(dialog.getByText('Ch. 2 — Chapter 2')).toBeVisible()

    await dialog.getByRole('checkbox', { name: 'The wreck' }).check()
    await dialog.getByRole('checkbox', { name: 'The gate opens' }).check()
    await dialog.getByRole('button', { name: 'Save' }).click()

    // The warning is gone, and the count on the row says two.
    await expect(page.getByText('no scenes tagged yet')).toHaveCount(0)
    await expect(page.getByText('2 sc')).toBeVisible()

    // Written as the entity link the scenes already carried, not as free text.
    const tagged = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { toArray: () => Promise<{ id: string; threadIds?: string[] }[]> } }
      const rows = await db.events.toArray()
      return rows.filter((e) => (e.threadIds ?? []).length > 0).map((e) => e.id).sort()
    })
    expect(tagged).toEqual(['ev1', 'ev3'])
  })

  test('unticking a scene detaches it again', async ({ page }) => {
    await worldWithScenes(page)
    await page.waitForTimeout(600)

    await page.getByRole('button', { name: 'New thread' }).click({ timeout: 30_000 })
    await page.getByPlaceholder(/Thread name/).fill('The Rebellion')
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    await page.getByRole('button', { name: 'Attach scenes to thread The Rebellion' }).click()
    await attachDialog(page).getByRole('checkbox', { name: 'The wreck' }).check()
    await attachDialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('1 sc')).toBeVisible()

    // Re-opening shows what is already attached, rather than a blank slate —
    // otherwise saving twice would silently detach everything.
    await page.getByRole('button', { name: 'Attach scenes to thread The Rebellion' }).click()
    const wreck = attachDialog(page).getByRole('checkbox', { name: 'The wreck' })
    await expect(wreck).toBeChecked()

    await wreck.uncheck()
    await attachDialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('no scenes tagged yet')).toBeVisible()
  })
})
