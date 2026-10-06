import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene header as a block (docs/records/scene-header-block-plan.md): one
 * labelled line for each kind of record, typed by hand or drawn from the
 * records, on the Page and on a scene card.
 *
 * `pageHeader.spec.ts` and `sceneHeader.spec.ts` drive the header the records
 * draw. Here is what the block adds: a block typed by the writer, a token on
 * the wrong line, and a bracket block holding prose, which must stay prose.
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

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}
const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
/** Each header on the page, its lines joined. */
const headerTexts = (page: Page) => page.evaluate(() => {
  const blocks: string[][] = []
  for (const el of document.querySelectorAll('.cm-line.cm-draft-header')) {
    if (el.classList.contains('cm-draft-header-start')) blocks.push([])
    blocks[blocks.length - 1]?.push(el.textContent ?? '')
  }
  return blocks.map((b) => b.join('\n'))
})

/** Type lines one at a time, as a writer does: Enter between them, typing over any indentation the editor carried onto the new line. */
async function typeLines(page: Page, lines: string[]) {
  for (const [i, text] of lines.entries()) {
    if (i > 0) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('Shift+Home')
    }
    if (text) await page.keyboard.type(text)
    // A name typed after a sigil opens the picker; the line ends where the writer says, not on its row.
    await page.keyboard.press('Escape')
  }
}

test.describe('the header as a block', () => {
  test.describe.configure({ timeout: 120_000 })

  test('typed by hand on the Page, it sets the scene and none of it is saved as prose — a bracket block holding prose stays prose', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)

    // A header block, typed as the second scene's first lines.
    await line(page, 'She counted.').click()
    await page.keyboard.press('Home')
    await typeLines(page, ['[', '  Place: #The Quay', '  Characters: @@Marn Holt', ']', ''])
    await line(page, 'She counted.').click()
    await expect.poll(async () => (await scenes(page)).e2, { timeout: 20_000 })
      .toEqual({ cast: ['marn'], place: 'quay', prose: 'She counted.' })
    await expect.poll(() => headerTexts(page)).toEqual([
      '[\n  Place: #The Quay\n  Characters: @@Teodora Vance\n]',
      '[\n  Place: #The Quay\n  Characters: @@Marn Holt\n]',
    ])

    // The pair: brackets around a line of prose are not a header, wherever a name sits in them.
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await typeLines(page, ['[', 'She wrote it down for @@Marn Holt', ']'])
    await line(page, 'Characters: @@Marn').click()
    await expect.poll(async () => (await scenes(page)).e2.prose, { timeout: 20_000 })
      .toBe('She counted.\n\n[\nShe wrote it down for @@Marn Holt\n]')
    expect((await scenes(page)).e2.cast).toEqual(['marn'])
  })

  test('a token typed on the wrong line means what its sigil says, and is drawn on its own line', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'Place: #The Quay').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Marn Holt')
    await page.keyboard.press('Escape')
    await line(page, 'The court sat.').click()
    // Named first in the header, so first in the cast.
    await expect.poll(async () => (await scenes(page)).e1, { timeout: 20_000 })
      .toEqual({ cast: ['marn', 'teo'], place: 'quay', prose: 'The court sat.' })
    await expect.poll(() => headerTexts(page)).toEqual(['[\n  Place: #The Quay\n  Characters: @@Marn Holt @@Teodora Vance\n]'])
  })

  test('typed by hand in a scene card, it sets the scene, and is drawn back as the block', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('She counted.', { timeout: 20_000 })

    // Labels in any order, and one of them left off.
    await draft.fill('[\n  Characters: @@Marn Holt @@Teodora Vance\n  #The Quay\n]\n\nShe counted.')
    await draft.blur()
    await expect.poll(async () => (await scenes(page)).e2, { timeout: 20_000 })
      .toEqual({ cast: ['marn', 'teo'], place: 'quay', prose: 'She counted.' })
    await expect(draft).toHaveValue('[\n  Place: #The Quay\n  Characters: @@Marn Holt @@Teodora Vance\n]\n\nShe counted.', { timeout: 20_000 })
  })
})
