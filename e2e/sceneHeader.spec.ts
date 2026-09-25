import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * `[#The Kitchen @@Wren @@Sal'ka]` — where the scene happens and who is in it,
 * said in the act of writing.
 *
 * The header is **rendered from the scene's own records, never stored**, so a
 * change made anywhere shows up in the line by construction. These tests drive
 * both directions, because the whole design rests on there being one copy of
 * the fact: type the line and the records follow; change the records and the
 * line follows.
 */
async function sceneWithCast(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Header')
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
    for (const [cid, name] of [['wren', 'Wren Halloway'], ['salka', "Sal'ka"]] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    // A place with no map — which is now an ordinary thing for a place to be.
    await db.locationMarkers.add({
      id: 'kitchen', worldId: id, mapLayerId: null, linkedMapLayerId: null,
      name: 'The Kitchen', description: '', x: 0, y: 0, imageId: null,
      iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Kettle', description: '',
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
      tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ involvedCharacterIds: string[]; locationMarkerId: string | null }> }
    sceneTexts: { toArray: () => Promise<Array<{ text: string; wordCount: number }>> }
  }
  const ev = await db.events.get('ev1')
  const texts = await db.sceneTexts.toArray()
  return { cast: ev.involvedCharacterIds, place: ev.locationMarkerId, prose: texts[0]?.text ?? '', words: texts[0]?.wordCount ?? 0 }
})

test.describe('the scene header', () => {
  test.describe.configure({ timeout: 240_000 })

  test('records the place and the cast, and keeps itself out of the prose', async ({ page }) => {
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toBeVisible({ timeout: 20_000 })

    await draft.fill("[#The Kitchen @@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()

    await expect.poll(stored.bind(null, page), { timeout: 20_000 }).toEqual({
      cast: ['wren', 'salka'],
      place: 'kitchen',
      // The header is nowhere in the stored prose, and nowhere in the count.
      prose: 'She put the kettle on.',
      words: 5,
    })
  })

  test('and comes back on screen, rendered from what it recorded', async ({ page }) => {
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren'])

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()
    // Not read back from the text — there is none. Rebuilt from the record.
    await expect(page.getByRole('textbox', { name: 'Scene prose' }))
      .toHaveValue(/^\[@@Wren Halloway\]/, { timeout: 20_000 })
  })

  test('follows a change made in the panel instead of the line', async ({ page }) => {
    /*
      The half that decides the whole design. The header is not a second copy
      kept in step by a sync routine — it is drawn from the records, so a cast
      change made anywhere else is already in it. Two copies of one fact is
      the shape that silently destroyed a writer's cast this morning.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect(draft).toHaveValue(/@@Wren Halloway/, { timeout: 20_000 })

    // Add the other character through the card's own control.
    await page.getByRole('main').getByRole('button', { name: /Add character/ }).click()
    await page.getByRole('option', { name: "Sal'ka" }).click()

    await expect(draft).toHaveValue(/@@Wren Halloway @@Sal'ka/, { timeout: 20_000 })
  })

  test('says so when the line names somebody the world does not have', async ({ page }) => {
    // Typed blind, with no picker inside the brackets to correct a spelling —
    // so silence would drop a character out of the scene saying nothing.
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway @@Yevet du Marr]\n\nShe put the kettle on.')
    await draft.blur()

    await expect(page.getByText(/Nothing in this world is called/)).toBeVisible({ timeout: 20_000 })
    // The rest of the line still landed, which is the other half of the claim.
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren'])
  })
})
