import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene header on the Page — a block under a scene's title, drawn from its
 * records, applied when the writer leaves a line of it, and never part of the
 * prose. Typed as one line, `[#Place @@Name]`, it is read the same and drawn as
 * the block.
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
/** One locator per header on the page: a block's first line. */
const headerStarts = (page: Page) => page.locator('.cm-draft-header-start')
/** Each header on the page, its lines joined: what the writer sees, block by block. */
const headerTexts = (page: Page) => page.evaluate(() => {
  const blocks: string[][] = []
  for (const el of document.querySelectorAll('.cm-line.cm-draft-header')) {
    if (el.classList.contains('cm-draft-header-start')) blocks.push([])
    blocks[blocks.length - 1]?.push(el.textContent ?? '')
  }
  return blocks.map((b) => b.join('\n'))
})
const QUAY = '[\n  Place: #The Quay\n  Characters: @@Teodora Vance\n]'
/** Replace the line holding `text` with `typed` — after its indentation, which Home stops at — and leave it by going down a line. */
async function retype(page: Page, text: string, typed: string) {
  await line(page, text).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Home')
  await page.keyboard.type(typed)
  // A name typed after a sigil opens the picker, and ArrowDown would move in it rather than off the line.
  await page.keyboard.press('Escape')
  await page.keyboard.press('ArrowDown')
}

test.describe('the header on the Page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('is drawn under a scene’s title from its records as a block, tinted, and none of it is saved as prose', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect(headerStarts(page)).toHaveCount(1)
    await expect.poll(() => headerTexts(page)).toEqual([QUAY])
    // Every line of it is tinted, and the prose under it is not.
    await expect(line(page, 'Characters: @@Teodora Vance')).toHaveClass(/cm-draft-header/)
    await expect(line(page, 'The court sat.')).not.toHaveClass(/cm-draft-header/)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' More.')
    await expect.poll(async () => (await scenes(page)).e1.prose).toBe('The court sat. More.')
  })

  test('a line of it edited and left changes the scene; a name this world has not got keeps the cast and says so', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await retype(page, 'Characters: @@Teodora', 'Characters: @@Marm Holt')
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world is called “Marm Holt”' })).toBeVisible()
    await expect(line(page, '@@Marm Holt')).toBeVisible()
    expect((await scenes(page)).e1.cast).toEqual(['teo'])

    await retype(page, 'Characters: @@Marm', 'Characters: @@Marn Holt')
    await expect.poll(async () => (await scenes(page)).e1).toEqual({ cast: ['marn'], place: 'quay', prose: 'The court sat.' })
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world' })).toHaveCount(0)
    await line(page, 'The court sat.').click()
    await expect.poll(() => headerTexts(page)).toEqual(['[\n  Place: #The Quay\n  Characters: @@Marn Holt\n]'])
  })

  test('typed as a scene’s first line, a header is one: it sets the scene, is drawn as a block, and is not saved into the prose', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[#The Quay @@Teodora Vance]')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await scenes(page)).e2.place).toBe('quay')
    // The line typed is the header, redrawn as the block: not a second one drawn above it, and not left behind as prose.
    await expect.poll(() => headerTexts(page)).toEqual([QUAY, QUAY])
    await expect(page.locator('.cm-line', { hasText: '[#The Quay @@Teodora Vance]' })).toHaveCount(0)
    // And a save of that scene's prose, after it, writes the prose alone.
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Twice.')
    await expect.poll(async () => (await scenes(page)).e2).toEqual({ cast: ['teo'], place: 'quay', prose: 'She counted. Twice.' })
  })

  test('a change made elsewhere arrives in the block, and a scene the records say nothing of has none', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await setScene(page, 'e2', { involvedCharacterIds: ['marn'] })
    await expect.poll(() => headerTexts(page)).toEqual([QUAY, '[\n  Characters: @@Marn Holt\n]'])
    await setScene(page, 'e1', { involvedCharacterIds: [], locationMarkerId: null })
    await expect(headerStarts(page)).toHaveCount(1)
    await expect(editor).not.toContainText('The Quay')
    expect((await scenes(page)).e2.prose).toBe('She counted.')
  })

  test('a change made elsewhere does not take the block from under the writer typing in it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'Characters: @@Teodora').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Marn Hol')
    await page.keyboard.press('Escape')
    await setScene(page, 'e1', { locationMarkerId: null })
    // Another scene, changed at the same time, does arrive: the page did look.
    await setScene(page, 'e2', { involvedCharacterIds: ['teo'] })
    await expect(headerStarts(page)).toHaveCount(2)
    await page.keyboard.type('t')
    // The block being typed in is the writer's, its Place line included.
    await expect(line(page, 'Characters: @@Teodora Vance @@Marn Holt')).toBeVisible()
    await expect(line(page, 'Place: #The Quay')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (await scenes(page)).e1).toEqual({ cast: ['teo', 'marn'], place: 'quay', prose: 'The court sat.' })
  })

  test('nothing is typed above it, and deleting it leaves the scene as it was and brings it back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await headerStarts(page).click()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('x')
    await expect(page.getByRole('status').filter({ hasText: 'stays first' })).toBeVisible()

    // The whole block selected and deleted.
    await headerStarts(page).click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Shift+End')
    await page.keyboard.press('Backspace')
    await expect(page.locator('.cm-draft-header')).toHaveCount(0)
    await line(page, 'She counted.').click()
    await expect.poll(() => headerTexts(page)).toEqual([QUAY])
    expect((await scenes(page)).e1).toEqual({ cast: ['teo'], place: 'quay', prose: 'The court sat.' })
  })

  test('joining a scene takes its header with its heading, every line of it, not into the prose it joins', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await setScene(page, 'e2', { involvedCharacterIds: ['marn'] })
    await expect(headerStarts(page)).toHaveCount(2)
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Backspace')
    await expect.poll(async () => Object.keys(await scenes(page))).toEqual(['e1'])
    await expect.poll(async () => (await scenes(page)).e1.prose).toBe('The court sat.\n\nShe counted.')
    await expect(headerStarts(page)).toHaveCount(1)
  })

  test('"@" in it names somebody present, and keeps the sigil', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'Characters: @@Teodora').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Mar')
    await page.getByRole('button', { name: 'Marn Holt character', exact: true }).click()
    await expect(line(page, 'Characters: @@Teodora Vance @@Marn Holt')).toBeVisible()
    await expect.poll(async () => (await scenes(page)).e1.cast).toEqual(['teo', 'marn'])
  })

  test('taking the ## off a scene that has a header joins it, the title kept and the block taken with it', async ({ page }) => {
    const worldId = await book(page)
    await setScene(page, 'e2', { involvedCharacterIds: ['marn'] })
    await openPage(page, worldId)
    const own = page.locator('.cm-line', { hasText: /^\s*Characters: @@Marn Holt$/ })
    await expect(own).toHaveClass(/cm-draft-header/)
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Backspace')

    // One paragraph break under the title, not the gap the header left behind it.
    await expect.poll(async () => (await scenes(page)).e1?.prose, { timeout: 10_000 })
      .toBe('The court sat.\n\nTeodora at the table\n\nShe counted.')
    expect((await scenes(page)).e2).toBeUndefined()
    // Who was in it joins the scene it joined, as a join always takes them.
    expect((await scenes(page)).e1.cast).toEqual(expect.arrayContaining(['teo', 'marn']))
    await expect(own).toHaveCount(0)
  })
})
