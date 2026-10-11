import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A place's status on the Place line — `#The Drowned Chapel:ruined` — recorded
 * as its state at the scene, drawn where it changes and not after, and taken
 * back.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ash Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.characters.add({ id: 'sab', worldId: id, name: 'Sabine Varro', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    for (const [mid, name] of [['chapel', 'The Drowned Chapel'], ['quay', 'The Quay']] as const) {
      await db.locationMarkers.add({ id: mid, worldId: id, mapLayerId: null, name, description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The quay', 'The boats were in.'],
      ['e2', 'The chapel', 'The bell rang under the water.'],
      ['e3', 'After', 'Nobody spoke of it.'],
    ] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: 'chapel', involvedCharacterIds: ['sab'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
    // In use from the first scene, with a note on it.
    await db.locationSnapshots.add({ id: 'p1', worldId: id, locationMarkerId: 'chapel', eventId: 'e1', sortKey: 1.000001, status: 'active', notes: 'The bell still rings.', createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

/** Each place's state at each scene that has one, and where the chapel scene is set. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    locationSnapshots: { toArray: () => Promise<Array<{ locationMarkerId: string; eventId: string; status: string; notes: string }>> }
    events: { get: (k: string) => Promise<{ locationMarkerId: string | null }> }
  }
  return {
    states: (await db.locationSnapshots.toArray()).map((s) => `${s.locationMarkerId}@${s.eventId}:${s.status}:${s.notes}`).sort(),
    place: (await db.events.get('e2')).locationMarkerId,
  }
})

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
const headerTexts = (page: Page) => page.evaluate(() => {
  const blocks: string[][] = []
  for (const el of document.querySelectorAll('.cm-line.cm-draft-header')) {
    if (el.classList.contains('cm-draft-header-start')) blocks.push([])
    blocks[blocks.length - 1]?.push(el.textContent ?? '')
  }
  return blocks.map((b) => b.join('\n'))
})
async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const at = (place: string) => `[\n  Place: #${place}\n  Characters: @@Sabine Varro\n]`
const ACTIVE = 'chapel@e1:active:The bell still rings.'

test.describe('a place’s status on the Place line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: recorded at the scene with the note it had, drawn there and not after, and taken back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([at('The Drowned Chapel:active'), at('The Drowned Chapel'), at('The Drowned Chapel')])

    // The second scene's Place line: the first is the first scene's, which says `:active`.
    const second = page.locator('.cm-line', { hasText: /^\s*Place: #The Drowned Chapel$/ }).first()
    await second.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Escape')
    await page.keyboard.type(':ruined')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      states: [ACTIVE, 'chapel@e2:ruined:The bell still rings.'],
      place: 'chapel',
    })

    // From the records, on a page opened afresh: ruined at the chapel scene, and not drawn again after it.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([at('The Drowned Chapel:active'), at('The Drowned Chapel:ruined'), at('The Drowned Chapel')])

    // Taken off: the state at the chapel scene goes; the scene stays set there.
    await line(page, 'Place: #The Drowned Chapel:ruined').click()
    await page.keyboard.press('End')
    for (let i = 0; i < ':ruined'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({ states: [ACTIVE], place: 'chapel' })
    await expect.poll(() => headerTexts(page)).toEqual([at('The Drowned Chapel:active'), at('The Drowned Chapel'), at('The Drowned Chapel')])
  })

  test('on a scene card: a new place with a status; what was said of the old place here is taken back', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${at('The Drowned Chapel')}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    await draft.fill(`${at('The Drowned Chapel:ruined')}\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect.poll(async () => (await records(page)).states, { timeout: 20_000 }).toEqual([ACTIVE, 'chapel@e2:ruined:The bell still rings.'])
    await expect(draft).toHaveValue(`${at('The Drowned Chapel:ruined')}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    // Set at the quay instead, sieged: the ruin was said of the chapel, so it goes with it.
    await draft.fill(`${at('The Quay:sieged')}\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({ states: [ACTIVE, 'quay@e2:sieged:'], place: 'quay' })
    await expect(draft).toHaveValue(`${at('The Quay:sieged')}\n\nThe bell rang under the water.`, { timeout: 20_000 })
  })
})
