import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * An inferred custody row does not look like an asserted one.
 *
 * The item page's **Whereabouts** list mixes two different kinds of claim. A
 * `carried` or `placed` step is something the writer said. An `unlisted` step
 * is only an absence: the holder recorded a state at that scene and it did not
 * mention the item, which happens constantly under the ordinary order of work —
 * draft the scenes, record where everyone is, hand out the props afterwards.
 *
 * It was reported once, fixed by changing the *wording* (it stopped naming a
 * place it had invented), and **reported again at the next tip with the same
 * four-of-six ratio**: the row was still rendered through an identical `<li>`,
 * and a row's presence in a list of events is a claim whatever it says.
 *
 * Driven in a browser because the whole finding is what the two rows look like
 * beside each other, which no unit test can see.
 */

async function worldWithACarriedItem(page: Page): Promise<{ worldId: string; itemId: string }> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Custody')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'marn', worldId: id, name: 'Isko Marn', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'seal', worldId: id, name: 'Declarant Seal', description: '', iconType: 'tool', imageId: null, tags: [] })
    for (const [n, evId] of [[0, 'ev1'], [1, 'ev2']] as const) {
      await db.events.add({
        id: evId, worldId: id, chapterId: 'ch1', timelineId: 'tl',
        title: n === 0 ? 'The Body in the Freight Lock' : 'A Retainer in Cash',
        description: '', locationMarkerId: null, involvedCharacterIds: ['marn'],
        mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [], tags: [],
        sortOrder: n, travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
        status: 'draft', povCharacterId: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
    /*
      The asserted step and the inferred one, in that order: Marn carries the
      seal in the first scene, and the state recorded for him in the second
      simply does not list it. No hand-off was ever written.
    */
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'marn', eventId: 'ev1', isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: ['seal'],
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 1, createdAt: now, updatedAt: now,
    })
    await db.characterSnapshots.add({
      id: 's2', worldId: id, characterId: 'marn', eventId: 'ev2', isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
      inventoryNotes: '', statusNotes: 'counting the retainer', travelModeId: null,
      sortKey: 1.000001, createdAt: now, updatedAt: now,
    })
  }, worldId)

  return { worldId, itemId: 'seal' }
}

test.describe('the item page tells an assertion from a gap', () => {
  test.describe.configure({ timeout: 240_000 })

  test('marks the row nobody wrote, and leaves the one they did alone', async ({ page }) => {
    const { worldId, itemId } = await worldWithACarriedItem(page)
    await page.goto(`/#/worlds/${worldId}/items/${itemId}`, { waitUntil: 'load' })
    await settle(page)

    const rows = page.getByRole('main').locator('ol > li')
    await expect(rows).toHaveCount(2, { timeout: 20_000 })

    const asserted = rows.filter({ hasText: 'The Body in the Freight Lock' })
    const gap = rows.filter({ hasText: 'A Retainer in Cash' })

    // The sentence was already right after the first fix. These two are the
    // part that was still missing.
    await expect(gap).toContainText('no longer in Isko Marn')
    await expect(gap.getByText('gap', { exact: true })).toBeVisible()

    /*
      The presence/absence pair, and the half that actually failed before: the
      asserted row must NOT carry the marker. Without this, a change that
      labelled every row would pass.
    */
    await expect(asserted).toContainText('carried by Isko Marn')
    await expect(asserted.getByText('gap', { exact: true })).toHaveCount(0)

    // And they are distinguishable without reading either one.
    const borderOf = (l: typeof asserted) =>
      l.evaluate((el) => getComputedStyle(el).borderStyle)
    expect(await borderOf(gap)).toBe('dashed')
    expect(await borderOf(asserted)).toBe('solid')
  })
})
