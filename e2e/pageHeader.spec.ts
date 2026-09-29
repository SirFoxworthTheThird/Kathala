import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene header line on the Page — `[#Place @@Name]` as the first line under
 * a scene's title, drawn from its records, applied when the writer leaves it,
 * and never part of the prose.
 *
 * Where the line sits, what it does to the prose and what it does to the
 * records are unit-tested (`draftDocument`, `draftEditor`, `sceneHeader`). Here
 * is the real page: typing in it and leaving it, the records it changes, a
 * change made elsewhere arriving, and the prose that is saved around it.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    for (const [cid, name] of [['teo', 'Teodora Vance'], ['marn', 'Marn Holt']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.locationMarkers.add({
      id: 'quay', worldId: id, mapLayerId: null, name: 'The Quay', description: '',
      x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The assize rises', 'The court sat.', ['teo'], 'quay'],
      ['e2', 'Teodora at the table', 'She counted.', [], null],
    ] as const
    let i = 0
    for (const [eid, title, text, cast, place] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: place, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** Each scene's cast, setting and stored prose. */
const scenes = (page: Page) => page.evaluate(async () => {
  type Ev = { id: string; involvedCharacterIds: string[]; locationMarkerId: string | null }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Ev[]> }
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
  }
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return Object.fromEntries((await db.events.toArray()).map((e) => [e.id, {
    cast: e.involvedCharacterIds, place: e.locationMarkerId, prose: texts.get(e.id) ?? '',
  }]))
})

const setScene = (page: Page, id: string, changes: Record<string, unknown>) => page.evaluate(async ([eid, patch]) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { update: (k: string, v: unknown) => Promise<unknown> } }
  await db.events.update(eid, patch)
}, [id, changes] as const)

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'The book, as one page' })
  await expect(editor).toBeVisible({ timeout: 20_000 })
  return editor
}
const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
/** Replace the whole of the line holding `text` with `typed`, and leave it by going down a line. */
async function retype(page: Page, text: string, typed: string) {
  await line(page, text).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Home')
  await page.keyboard.type(typed)
  await page.keyboard.press('ArrowDown')
}

test.describe('the header line on the Page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('is drawn under a scene’s title from its records, tinted, and none of it is saved as prose', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const header = page.locator('.cm-draft-header')
    await expect(header).toHaveCount(1)
    await expect(header).toHaveText('[#The Quay @@Teodora Vance]')
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' More.')
    await expect.poll(async () => (await scenes(page)).e1.prose).toBe('The court sat. More.')
  })

  test('edited and left, it changes the scene; a name this world has not got keeps the cast and says so', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await retype(page, '[#The Quay', '[#The Quay @@Marm Holt]')
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world is called “Marm Holt”' })).toBeVisible()
    await expect(line(page, '@@Marm Holt')).toBeVisible()
    expect((await scenes(page)).e1.cast).toEqual(['teo'])

    await retype(page, '[#The Quay', '[#The Quay @@Marn Holt]')
    await expect.poll(async () => (await scenes(page)).e1).toEqual({ cast: ['marn'], place: 'quay', prose: 'The court sat.' })
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world' })).toHaveCount(0)
    await expect(page.locator('.cm-draft-header')).toHaveText('[#The Quay @@Marn Holt]')
  })

  test('typed as a scene’s first line, a header is one: it sets the scene, and is not saved into the prose', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[#The Quay @@Teodora Vance]')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await scenes(page)).e2.place).toBe('quay')
    await expect(page.locator('.cm-draft-header')).toHaveCount(2)
    // One line each for the two scenes: the one typed is the header, not a second one drawn above it.
    await expect(page.locator('.cm-line', { hasText: '[#The Quay @@Teodora Vance]' })).toHaveCount(2)
    // And a save of that scene's prose, after it, writes the prose alone.
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Twice.')
    await expect.poll(async () => (await scenes(page)).e2).toEqual({ cast: ['teo'], place: 'quay', prose: 'She counted. Twice.' })
  })

  test('a change made elsewhere arrives on the line, and a scene the records say nothing of has none', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await setScene(page, 'e2', { involvedCharacterIds: ['marn'] })
    await expect(page.locator('.cm-draft-header').filter({ hasText: '[@@Marn Holt]' })).toBeVisible()
    await setScene(page, 'e1', { involvedCharacterIds: [], locationMarkerId: null })
    await expect(page.locator('.cm-draft-header')).toHaveCount(1)
    await expect(editor).not.toContainText('The Quay')
    expect((await scenes(page)).e2.prose).toBe('She counted.')
  })

  test('a change made elsewhere does not take the line from under the writer typing on it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, '[#The Quay').click()
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type(' @@Marn Hol')
    await page.keyboard.press('Escape')
    await setScene(page, 'e1', { locationMarkerId: null })
    // Another scene, changed at the same time, does arrive: the page did look.
    await setScene(page, 'e2', { involvedCharacterIds: ['teo'] })
    await expect(page.locator('.cm-draft-header').filter({ hasText: '[@@Teodora Vance]' })).toBeVisible()
    await page.keyboard.type('t')
    await expect(line(page, '[#The Quay @@Teodora Vance @@Marn Holt]')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (await scenes(page)).e1).toEqual({ cast: ['teo', 'marn'], place: 'quay', prose: 'The court sat.' })
  })

  test('nothing is typed above it, and deleting it leaves the scene as it was and brings it back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, '[#The Quay').click()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('x')
    await expect(page.getByRole('status').filter({ hasText: 'stays first' })).toBeVisible()

    await line(page, '[#The Quay').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect(page.locator('.cm-draft-header')).toHaveCount(0)
    await line(page, 'She counted.').click()
    await expect(page.locator('.cm-draft-header')).toHaveText('[#The Quay @@Teodora Vance]')
    expect((await scenes(page)).e1).toEqual({ cast: ['teo'], place: 'quay', prose: 'The court sat.' })
  })

  test('joining a scene takes its header line with its heading, not into the prose it joins', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await setScene(page, 'e2', { involvedCharacterIds: ['marn'] })
    await expect(page.locator('.cm-draft-header')).toHaveCount(2)
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Backspace')
    await expect.poll(async () => Object.keys(await scenes(page))).toEqual(['e1'])
    await expect.poll(async () => (await scenes(page)).e1.prose).toBe('The court sat.\n\nShe counted.')
    await expect(page.locator('.cm-draft-header')).toHaveCount(1)
  })

  test('"@" in it names somebody present, and keeps the sigil', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, '[#The Quay').click()
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type(' @@Mar')
    await page.getByRole('button', { name: 'Marn Holt character', exact: true }).click()
    await expect(line(page, '@@Teodora Vance @@Marn Holt')).toBeVisible()
    await expect.poll(async () => (await scenes(page)).e1.cast).toEqual(['teo', 'marn'])
  })
})
