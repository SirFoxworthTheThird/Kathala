import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Two findings about the same control, from a blind writer run.
 *
 * **N8** — the Structure board's "+ Assign a scene…" offered every scene in the
 * book with nothing to type into: 149 options and about ten thousand pixels of
 * list on the shipped Monte Cristo, seen roughly four at a time. Marking the
 * Climax of a 117-chapter novel meant scrolling forty screenfuls. The Search
 * palette finds a scene by name in under a fifth of a second.
 *
 * **N9** — the Current Location picker was in Dexie's primary-key order, which
 * for nanoid ids is arbitrary: three places created Hollowmark Tower → The
 * Marrowgate → The Gullbone Cistern were offered Marrowgate, Cistern, Tower.
 * The seed below fixes ids whose key order is deliberately *not* name order,
 * because the library worlds' name-derived slugs are exactly why this went
 * unnoticed — their pickers came out alphabetical by accident.
 */

const SCENES = [
  'The gate opens', 'The ninth bell does not ring', 'A letter under the door',
  'What the tide left', 'The clapper changes hands', 'Salt on the threshold',
  'The cistern runs dry', 'Nobody answers the bell', 'The ledger is wrong',
  'Two names in one hand', 'The tower is emptied', 'A debt called in',
]

/** Key order (mk-1, mk-2, mk-3) is deliberately not name order. */
const PLACES: Array<[string, string]> = [
  ['mk-1', 'The Marrowgate'],
  ['mk-2', 'The Gullbone Cistern'],
  ['mk-3', 'Hollowmark Tower'],
]

async function seed(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Lists')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, scenes, places]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.mapLayers.add({ id: 'map-a', worldId: id, name: 'The City', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    for (const [mid, name] of places as Array<[string, string]>) {
      await db.locationMarkers.add({ id: mid, worldId: id, mapLayerId: 'map-a', name, description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Adze', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    ;(scenes as string[]).forEach((title, i) => {
      void db.events.add({
        id: `ev${i}`, worldId: id, chapterId: 'ch1', timelineId: 'tl', title,
        description: '', sortOrder: i, tags: [], locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
        structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      })
    })
  }, [worldId, SCENES, PLACES] as [string, string[], Array<[string, string]>])
  return worldId
}

test.describe('Pickers long enough to get lost in', () => {
  test.describe.configure({ timeout: 300_000 })

  test('N8: the scene picker can be typed into, and narrows to what you typed', async ({ page }) => {
    const worldId = await seed(page)
    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Structure' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Assign a scene to Hook' }).click()
    const options = page.getByRole('option')
    // Presence: the whole book is on offer, which is the finding's premise.
    await expect(options).toHaveCount(SCENES.length)

    const filter = page.getByRole('textbox', { name: 'Filter scenes…' })
    await expect(filter).toBeVisible()

    // One word from the middle of a title — not its "Ch. 1 · " prefix, which
    // every option shares.
    await filter.fill('cistern')
    await expect(options).toHaveCount(1)
    await expect(options.first()).toHaveText(/The cistern runs dry/)

    // Two terms narrow rather than widen, and the order they arrive in is the
    // writer's business.
    await filter.fill('dry cistern')
    await expect(options).toHaveCount(1)

    // Nothing matching empties the list and says so, rather than looking broken.
    await filter.fill('zzzz')
    await expect(options).toHaveCount(0)
    await expect(page.getByText('No scene matches')).toBeVisible()

    // And the filtered option is a real one: choosing it assigns the beat.
    await filter.fill('cistern')
    await options.first().click()
    await expect(page.getByText('1 / 7 beats placed')).toBeVisible()
  })

  test('N9: the location picker is in name order, not the order it was stored in', async ({ page }) => {
    const worldId = await seed(page)
    await page.goto(`/#/worlds/${worldId}/characters/corvin?tab=state`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Next moment' }).click()
    await settle(page)

    await page.getByRole('main').getByRole('button', { name: /Unknown \/ not set/ }).click()
    /*
      `allTextContents` does not auto-wait: with no matches it returns `[]` at
      once. This read raced the listbox mounting and failed intermittently with
      `Received: []` — and the page snapshot Playwright saved alongside it showed
      the listbox open with all four options in the right order, which is the
      shape of a test that measured too early rather than a screen that was
      wrong. So wait for the options to be there, and only then read them.

      A count rather than a visibility check on the first one: the risk is a
      partly-rendered list, which one visible option does not rule out.
    */
    const optionCount = PLACES.length + 1 // the places, plus "Unknown / not set"
    await expect(page.getByRole('option')).toHaveCount(optionCount, { timeout: 20_000 })
    const names = (await page.getByRole('option').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t !== 'Unknown / not set')

    expect(names).toEqual(['Hollowmark Tower', 'The Gullbone Cistern', 'The Marrowgate'])
    // The seed's own order, asserted so the expectation above is known to be a
    // reordering and not the order they happened to arrive in.
    expect(names).not.toEqual(PLACES.map(([, name]) => name))
  })
})
