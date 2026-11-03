import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Chapters pasted onto the Page in a book of two timelines (writer run 10): a
 * pasted `# ` chapter numbered in front of the other timeline's chapters, a
 * header pasted as a scene's first lines left as prose, a header applied but
 * left in the scene's stored text when the page was left soon after, and a
 * chapter body refused under a new chapter's heading.
 */

const BLOCK = (place: string) => ['[', `  Place: #${place}`, '  Characters: @@Neve Castellan', ']'].join('\n')

async function book(page: Page, opts: { emptyChapter?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Haul')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, emptyChapter }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tA', worldId: id, name: 'The First Age', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tB', worldId: id, name: 'The Second Age', description: '', color: '#f59e0b', dayOffset: 36500, createdAt: now, updatedAt: now })
    for (const [cid, tl, number, title] of [['c1', 'tA', 1, 'Ash'], ['c2', 'tB', 2, 'Brine'], ['c3', 'tB', 3, 'Cinder']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e-${cid}`, worldId: id, chapterId: cid, timelineId: tl, title: `${title} scene`, description: '', sortOrder: 0,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t-${cid}`, worldId: id, eventId: `e-${cid}`, text: `${title} fell on the colony.`, wordCount: 5, updatedAt: now })
    }
    // A chapter just made, with no scene yet: what Add Chapter leaves.
    if (emptyChapter) await db.chapters.add({ id: 'c4', worldId: id, timelineId: 'tA', number: 4, title: 'Margins', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'neve', worldId: id, name: 'Neve Castellan', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    for (const [pid, name] of [['hall', 'Hall of Muster'], ['bridge', 'The Bridge']]) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, name, description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    }
  }, { id: worldId, emptyChapter: !!opts.emptyChapter })
  return worldId
}

/** Open the First Age's Page. */
async function firstAgePage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

async function paste(page: Page, text: string) {
  await page.locator('.cm-content').evaluate((el, t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

/** The book's chapters in number order: number, title and timeline. */
const numbering = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { toArray: () => Promise<Array<{ number: number; title: string; timelineId: string }>> } }
  return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => `${c.number}:${c.title}:${c.timelineId}`)
})

/** The scenes, by title: place, cast and stored prose. */
const scenes = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  const texts = await db.sceneTexts.toArray()
  return Object.fromEntries((await db.events.toArray()).map((e) => [e.title as string, {
    place: e.locationMarkerId, cast: e.involvedCharacterIds, text: (texts.find((t) => t.eventId === e.id)?.text as string | undefined) ?? '',
  }]))
})

test.describe('chapters pasted onto the Page (writer run 10)', () => {
  test.describe.configure({ timeout: 150_000 })

  test('pasted at the end of a timeline’s Page, chapters go at the end of the book, in their order', async ({ page }) => {
    const worldId = await book(page)
    await firstAgePage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Ash fell on the colony.' }).first().click()
    await page.keyboard.press('End')
    await paste(page, ['', '', '# Ember', '', '## Kindling', '', 'Sparks.', '', '## Smoke', '', 'Grey.', '', '# Coals', '', '## Banked', '', 'Red.'].join('\n'))
    // The Second Age's chapters keep their numbers; the First Age's new two come after them.
    await expect.poll(() => numbering(page), { timeout: 30_000 }).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tB', '4:Ember:tA', '5:Coals:tA'])
    await expect.poll(async () => Object.keys(await scenes(page)).sort()).toEqual(['Ash scene', 'Banked', 'Brine scene', 'Cinder scene', 'Kindling', 'Smoke'])
  })

  test('a header pasted as a new scene’s first lines is its header, not its prose', async ({ page }) => {
    const worldId = await book(page)
    await firstAgePage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Ash fell on the colony.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## Iron Gall')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await scenes(page))['Iron Gall']?.text, { timeout: 15_000 }).toBe('')
    await paste(page, `${BLOCK('Hall of Muster')}\n\nShe found the dots.`)
    await expect.poll(async () => (await scenes(page))['Iron Gall'], { timeout: 30_000 })
      .toEqual({ place: 'hall', cast: ['neve'], text: 'She found the dots.' })
    // Drawn as the header, once; not left as a line of prose.
    await expect(page.locator('.cm-draft-header', { hasText: 'Neve Castellan' })).toHaveCount(1)
    await expect(page.locator('.cm-line', { hasText: /^\s*Place: #Hall of Muster/ }).locator('xpath=self::*[not(contains(@class, "cm-draft-header"))]')).toHaveCount(0)
  })

  test('a pasted scene’s header is out of its stored prose even when the page is left straight after', async ({ page }) => {
    const worldId = await book(page)
    await firstAgePage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Ash fell on the colony.' }).first().click()
    await page.keyboard.press('End')
    await paste(page, ['', '', '## The Delegation', BLOCK('The Bridge'), '', 'The talks were held in the bow.'].join('\n'))
    // Applied — and the page left the moment it is.
    await expect.poll(async () => (await scenes(page))['The Delegation']?.cast, { timeout: 30_000 }).toEqual(['neve'])
    await page.reload({ waitUntil: 'load' })
    await expect.poll(async () => (await scenes(page))['The Delegation'], { timeout: 15_000 })
      .toEqual({ place: 'bridge', cast: ['neve'], text: 'The talks were held in the bow.' })
  })

  test('a chapter’s body pasted under its new heading, starting with its first scene’s heading, is taken', async ({ page }) => {
    const worldId = await book(page, { emptyChapter: true })
    await firstAgePage(page, worldId)
    await page.locator('.cm-line', { hasText: /^# Margins$/ }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await paste(page, ['## Iron Gall', BLOCK('Hall of Muster'), '', 'She found the dots.', '', '## The Delegation', '', 'The talks were held in the bow.'].join('\n'))
    await expect.poll(async () => {
      const all = await scenes(page)
      return [all['Iron Gall'], all['The Delegation']?.text]
    }, { timeout: 30_000 }).toEqual([{ place: 'hall', cast: ['neve'], text: 'She found the dots.' }, 'The talks were held in the bow.'])
    await expect(page.getByText('Under a chapter heading only a heading can go')).toHaveCount(0)
    // Both scenes are the new chapter's.
    const chapterOf = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      return Object.fromEntries((await db.events.toArray()).map((e) => [e.title as string, e.chapterId]))
    })
    expect([chapterOf['Iron Gall'], chapterOf['The Delegation']]).toEqual(['c4', 'c4'])
  })
})
