import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * CH-1, CH-2 and CH-3 — what the character screen tells you before you click.
 *
 * CH-1 was filed as "the Overview shows the name and biography only"; measured,
 * two of the three fields it named were already there and the third — the birth
 * date — was dropped whenever the world had no calendar to format it with. The
 * first test below is that measurement, kept.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [
    { name: 'Kestrel', aliases: ['The Gull'], description: 'A pilot who knows the shoals.' },
    { name: 'Bram', description: 'A harbourmaster who keeps no records.' },
  ],
  relationships: [{ a: 'Kestrel', b: 'Bram', label: 'allies', sentiment: 'complex' }],
  factions: [{ name: 'The Salt Guild', members: ['Kestrel'] }],
  chapters: [{
    title: 'Landfall',
    events: [
      { id: 'e1', title: 'The wreck', characters: ['Kestrel'] },
      { id: 'e2', title: 'The harbour', characters: ['Kestrel'] },
    ],
  }],
})

async function worldFromSpec(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

/** A world seeded straight into Dexie, so birth date and colour can be set —
 *  neither is expressible in the import spec. */
async function seedCharacters(page: Page, withCalendar: boolean) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Seeded')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ worldId, withCalendar }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
      string,
      { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }
    >
    const now = Date.now()
    if (withCalendar) {
      await db.worlds.update(worldId, {
        calendar: {
          months: [
            { name: 'Frostmoon', days: 30 },
            { name: 'Thawmoon', days: 30 },
            { name: 'Seedmoon', days: 30 },
          ],
          startYear: 1,
          yearSuffix: 'TA',
        },
      })
    }
    await db.characters.add({
      id: 'c-full', worldId, name: 'Aragorn', description: 'A ranger of the North.',
      aliases: ['Strider', 'Elessar'], color: '#f59e0b',
      birthDate: { year: 2, month: 2, day: 3 },
      portraitImageId: null, tags: [], createdAt: now, updatedAt: now,
    })
  }, { worldId, withCalendar })

  await page.goto(`/#/worlds/${worldId}/characters/c-full`, { waitUntil: 'load' })
  return worldId
}

test.describe('The character screen before you click anything', () => {
  test.describe.configure({ timeout: 120_000 })

  test('CH-1: a birth date that is set is shown, calendar or no calendar', async ({ page }) => {
    // With a calendar, the date is formatted — the behaviour that already
    // worked, asserted here so the case below cannot be satisfied by a screen
    // that simply prints numbers at everyone.
    await seedCharacters(page, true)
    const panel = page.getByRole('tabpanel').first()
    await expect(panel.getByText('Born')).toBeVisible({ timeout: 30_000 })
    // month 2 is 0-based, so it is the third month — Seedmoon.
    await expect(panel.getByText(/Seedmoon/)).toBeVisible()
    await expect(panel.getByText(/year 2, month 3/)).toHaveCount(0)

    // Without one, the stored value stands in raw. It used to vanish: the data
    // was there and the read view said nothing at all about it.
    await seedCharacters(page, false)
    const bare = page.getByRole('tabpanel').first()
    await expect(bare.getByText('Born')).toBeVisible({ timeout: 30_000 })
    // Month is 0-based in storage; the reader is shown the third month as 3.
    await expect(bare.getByText(/year 2, month 3, day 3/)).toBeVisible()

    // The colour, which was a bare dot beside the name and said nothing about
    // what it was for.
    await expect(bare.getByText('Colour')).toBeVisible()

    // Aliases were the half of the finding that was already handled — they sit
    // in the page header, which owns identity, and are not repeated here.
    await expect(page.getByText('Also known as Strider, Elessar')).toBeVisible()
    await expect(bare.getByText(/Strider/)).toHaveCount(0)
  })

  test('CH-2: the name is printed once', async ({ page }) => {
    await seedCharacters(page, false)
    await expect(page.getByRole('tabpanel').first().getByText('Colour'))
      .toBeVisible({ timeout: 30_000 })

    // Once in the page header, and not again as a heading under the tabs.
    await expect(page.getByText('Aragorn', { exact: true })).toHaveCount(1)
    // The opposite condition: the header is still there and still says who this
    // is — so this is not passing because the identity block vanished.
    await expect(page.getByText('Also known as Strider, Elessar')).toHaveCount(1)
  })

  test('CH-3: the tabs say how much is behind them', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.getByRole('link', { name: /Kestrel/ }).first().click()

    // Kestrel is in two scenes, has one relationship and one faction, and no
    // goals or lore at all — so the same tab strip carries both answers.
    await expect(page.getByRole('tab', { name: 'Appearances 2' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab', { name: 'Relationships 1' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Factions 1' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Goals 0' })).toBeVisible()

    // The counts have to be this character's, not the world's. Bram shares the
    // relationship and none of the rest, which nothing hardcoded could satisfy
    // at the same time as the assertions above.
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.getByRole('link', { name: /Bram/ }).first().click()
    await expect(page.getByRole('tab', { name: 'Relationships 1' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab', { name: 'Appearances 0' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Factions 0' })).toBeVisible()

    // And a count agrees with the list behind it rather than being a second,
    // separately-derived number.
    await page.getByRole('tab', { name: 'Relationships 1' }).click()
    await expect(page.getByRole('tabpanel').first().getByText(/Kestrel/).first()).toBeVisible()
  })
})
