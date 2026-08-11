import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * Three findings about numbers and dates that do not say what they mean.
 *
 * **MS-5** — *"1 scenes"* in the export dialog. Not one slip: the same shape,
 * a raw number and a hard-coded plural, was written out at two dozen call
 * sites, each wrong exactly when the count is one — the most common count on a
 * new world. `src/lib/plural.ts` is unit-tested; this drives the screen the
 * finding names.
 *
 * **CD-3** — `Day 6223` on a scene card. When the world has a calendar the app
 * can say what day that is, and already does in the Writer's Brief.
 *
 * **LORE-3** — an unlabelled date on every lore card. The format half is fixed
 * in `relativeTime` for all its callers and unit-tested there; the "which date"
 * half is the word on the card.
 */

const SPEC = JSON.stringify({
  world: { name: 'Countworld' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] }],
})

async function world(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('Counts and dates say what they mean', () => {
  test.describe.configure({ timeout: 180_000 })

  test('MS-5: one scene of one word is "1 scene · 1 word"', async ({ page }) => {
    const worldId = await world(page)

    // One scene, one word — the case every hard-coded plural gets wrong.
    const seeded = await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { toArray: () => Promise<{ id: string }[]> }
        sceneTexts: { add: (v: Record<string, unknown>) => Promise<unknown> }
      }
      const events = await db.events.toArray()
      const now = Date.now()
      await db.sceneTexts.add({
        id: 'st-1', worldId, eventId: events[0].id, text: 'Rain.', wordCount: 1,
        createdAt: now, updatedAt: now,
      })
      return events.length
    }, worldId)
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(1)

    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByRole('button', { name: 'Export' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog.getByText('1 scene', { exact: true })).toBeVisible()
    await expect(dialog.getByText('1 word', { exact: true })).toBeVisible()
    // Absence, paired: the broken form is gone from the dialog entirely.
    await expect(dialog.getByText('1 scenes')).toHaveCount(0)
    await expect(dialog.getByText('1 words')).toHaveCount(0)
  })

  test('CD-3: the day chip becomes a date when the world keeps a calendar', async ({ page }) => {
    const worldId = await world(page)

    // A second scene four days along, so the chapter has an in-world day to
    // show at all. Day 0 draws nothing — the chip is for elapsed time.
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { toArray: () => Promise<Record<string, unknown>[]>; add: (v: unknown) => Promise<unknown> }
      }
      const [first] = await db.events.toArray()
      const now = Date.now()
      await db.events.add({
        ...first, id: 'ev-later', title: 'Four days on', sortOrder: 1, travelDays: 4,
        worldId, createdAt: now, updatedAt: now,
      })
    }, worldId)

    const openChapter = async () => {
      await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
      await settleNav(page)
      await page.getByTitle('Open chapter detail').first().click()
      await expect(page.getByText('Four days on').first()).toBeVisible({ timeout: 30_000 })
    }

    // Without a calendar there is no date to give, so it stays a day count.
    await openChapter()
    const chip = page.getByRole('main').getByText(/^Day \d/)
    await expect(chip).toBeVisible({ timeout: 15_000 })
    await expect(chip).toHaveText('Day 4')

    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<unknown> }
      }
      await db.worlds.update(worldId, {
        calendar: {
          months: [{ name: 'Thawmonth', days: 30 }, { name: 'Seedmonth', days: 30 }],
          startYear: 998,
          yearSuffix: 'AC',
        },
      })
    }, worldId)

    // With one, the same chip says which day it is — and the day count is gone
    // from the card, so this cannot pass by both being shown.
    await openChapter()
    await expect(page.getByRole('main').getByText('5 Thawmonth, 998 AC')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('main').getByText(/^Day \d/)).toHaveCount(0)
  })

  test('LORE-3: a lore card says which date it is showing', async ({ page }) => {
    const worldId = await world(page)

    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        lorePages: { add: (v: Record<string, unknown>) => Promise<unknown> }
      }
      const now = Date.now()
      await db.lorePages.add({
        id: 'lp-1', worldId, categoryId: null, title: 'The Salt Accord',
        body: 'A treaty nobody honours.', tags: [], coverImageId: null,
        visibleFromEventId: null, linkedEntityIds: [], createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
    await expect(page.getByText('The Salt Accord').first()).toBeVisible({ timeout: 30_000 })
    // Which date it is, answered on the card rather than guessed at.
    await expect(page.getByText('Edited just now').first()).toBeVisible()
  })
})
