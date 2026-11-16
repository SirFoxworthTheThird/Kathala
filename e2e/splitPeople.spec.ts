import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/*
  A split records the new scene's people (round-trip-plan-4.md, T14.3; the
  third loop's W3-1), as the writer did it: a header typed on the Page, the
  scene split with Ctrl+Shift+Enter, then the first half's place changed. The
  second half's header said the first place, and the person was at the second:
  nothing had said where they were in the new scene.
*/

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.characters.add({ id: 'pia', worldId: id, name: 'Pia Lund', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    for (const [pid, name] of [['kitchen', 'Kitchen'], ['cellar', 'Cellar']] as const) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, name, description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The House', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'hall', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Hall', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'hall', text: 'She waited in the hall.\n\nThen she went out to the garden.', wordCount: 11, updatedAt: now })
  }, worldId)
  return worldId
}

/** Each scene, by title: its place and cast, and where the store says Pia is at it. */
const scenes = (page: Page) => page.evaluate(async () => {
  type Ev = { id: string; title: string; locationMarkerId: string | null; involvedCharacterIds: string[] }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Ev[]> }
    characterSnapshots: { toArray: () => Promise<Array<{ eventId: string; characterId: string; currentLocationMarkerId?: string | null }>> }
  }
  const records = await db.characterSnapshots.toArray()
  return Object.fromEntries((await db.events.toArray()).map((e) => [e.title, {
    place: e.locationMarkerId, cast: e.involvedCharacterIds,
    pia: records.find((r) => r.eventId === e.id && r.characterId === 'pia')?.currentLocationMarkerId,
  }]))
})

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()

test('split after a typed header, then the first half moved: the second half’s person stays where its header says', async ({ page }) => {
  test.setTimeout(90_000)
  const worldId = await book(page)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

  // The header, typed above the scene's first line, and left.
  await line(page, 'She waited in the hall.').click()
  await page.keyboard.press('Home')
  await page.keyboard.type('[#Kitchen @@Pia Lund]')
  await page.keyboard.press('Enter')
  await line(page, 'Then she went out to the garden.').click()
  await expect.poll(() => scenes(page), { timeout: 10_000 }).toMatchObject({ Hall: { place: 'kitchen', cast: ['pia'], pia: 'kitchen' } })

  // Split before the second paragraph.
  await page.keyboard.press('Home')
  await page.keyboard.press('Control+Shift+Enter')
  await page.keyboard.type('Garden')
  await page.keyboard.press('Enter')
  await expect.poll(() => scenes(page), { timeout: 10_000 }).toMatchObject({
    Hall: { place: 'kitchen', pia: 'kitchen' },
    Garden: { place: 'kitchen', cast: ['pia'], pia: 'kitchen' },
  })

  // The first half's place changed on its header: the second half's person does not go with it.
  await line(page, 'Place: #Kitchen').click()
  await page.keyboard.press('End')
  for (let i = 0; i < 'Kitchen'.length; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('Cellar')
  await line(page, 'She waited in the hall.').click()
  await expect.poll(() => scenes(page), { timeout: 10_000 }).toMatchObject({
    Hall: { place: 'cellar', pia: 'cellar' },
    Garden: { place: 'kitchen', pia: 'kitchen' },
  })
})
