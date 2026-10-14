import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { waitForMapReady } from './helpers/map'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * One book, one numbering (docs/records/chapter-numbering-plan.md): a book is
 * read in one order however many timelines feed it, so its chapters are
 * numbered in one order too.
 */

type Chapters = Array<[id: string, timeline: 'tA' | 'tB', number: number, title: string, prose: string]>

/** Two eras braided: the First Age's chapter 1, the Second Age's 2 and 3 — unless told otherwise. */
const BRAID: Chapters = [
  ['c1', 'tA', 1, 'Ash', 'Ash fell on the colony.'],
  ['c2', 'tB', 2, 'Brine', 'Brine in the pipes again.'],
  ['c3', 'tB', 3, 'Cinder', 'Cinder light over the yards.'],
]

async function book(page: Page, chapters: Chapters = BRAID): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Haul')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, chapters }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tA', worldId: id, name: 'The First Age', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tB', worldId: id, name: 'The Second Age', description: '', color: '#f59e0b', dayOffset: 36500, createdAt: now, updatedAt: now })
    for (const [cid, tl, number, title, prose] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e-${cid}`, worldId: id, chapterId: cid, timelineId: tl, title: `${title} scene`, description: '', sortOrder: 0,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t-${cid}`, worldId: id, eventId: `e-${cid}`, text: prose, wordCount: 5, updatedAt: now })
    }
  }, { id: worldId, chapters })
  return worldId
}

/** The book's chapters, in number order: number, title and timeline. */
const numbering = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { toArray: () => Promise<Array<{ number: number; title: string; timelineId: string }>> } }
  return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => `${c.number}:${c.title}:${c.timelineId}`)
})

test.describe('one book, one numbering', () => {
  test.describe.configure({ timeout: 150_000 })

  test('# typed after the First Age’s last chapter on its Page goes at the end of the book', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'Ash fell on the colony.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# Ember')
    await page.keyboard.press('Enter')
    // The Second Age's chapters keep their places; the First Age's new one is the book's fourth.
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tB', '4:Ember:tA'])
  })

  test('a new chapter is offered the book’s next number, from the dialog, the binder and the AI chapter', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    // The binder's new chapter, on the First Age's tab: 4, not the First Age's 2.
    await main.getByRole('button', { name: 'New chapter', exact: true }).click()
    await expect(main.getByLabel('New chapter number')).toHaveValue('4', { timeout: 15_000 })
    await page.keyboard.press('Escape')

    // The AI chapter's prompt asks for the same number.
    await page.getByRole('button', { name: 'Generate with AI', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('New chapter number: 4')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // The dialog says the same, and makes it there.
    await page.getByRole('button', { name: 'Add Chapter', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Number')).toHaveValue('4')
    await dialog.getByLabel('Title').fill('Ember')
    await dialog.getByRole('button', { name: /^Add/ }).click()
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tB', '4:Ember:tA'])
  })

  test('a chapter made from a place’s panel on the map is the book’s next too', async ({ page }) => {
    const worldId = await book(page)
    // A real uploaded map: the map screen's panels mount on an active layer, which a seeded one never becomes.
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').fill('The Yards')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.locationMarkers.add({ id: 'dock', worldId: id, mapLayerId: null, linkedMapLayerId: null, name: 'The dock', description: '', x: 0, y: 0, imageId: null, iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }, worldId)
    await settle(page)
    await page.getByRole('button', { name: 'The dock' }).click()
    await page.getByRole('button', { name: 'New chapter', exact: true }).click()
    await page.getByPlaceholder('Chapter title...').fill('Harbour')
    await page.keyboard.press('Enter')
    // Into the first timeline, numbered after the book's last chapter, which is the Second Age's.
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tB', '4:Harbour:tA'])
  })

  test('a book numbered per timeline is offered one numbering on All timelines; one numbered once is not', async ({ page }) => {
    // Before: each age began at chapter 1.
    const worldId = await book(page, [
      ['c1', 'tA', 1, 'Ash', 'Ash fell on the colony.'],
      ['c2', 'tB', 1, 'Brine', 'Brine in the pipes again.'],
      ['c3', 'tA', 2, 'Cinder', 'Cinder light over the yards.'],
    ])
    await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('tab', { name: /All timelines/ }).click()
    const notice = page.getByRole('status').filter({ hasText: 'numbered in more than one timeline' })
    await expect(notice).toContainText('Chapter 1 is numbered in more than one timeline', { timeout: 15_000 })
    await expect(notice).toContainText('2 chapters are renumbered')
    await notice.getByRole('button', { name: 'Number the chapters as one book' }).click()
    // In the order it read: chapter 1 of the First Age, then of the Second, then the First's 2 — tab order breaking the tie.
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tA'])
    await expect(notice).toHaveCount(0)

    // A braided book, numbered once, has nothing to be offered.
    const braided = await book(page)
    await page.goto(`/#/worlds/${braided}/manuscript?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('tab', { name: /All timelines/ }).click()
    await expect(page.getByRole('main').getByText('Every timeline merged', { exact: false })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('status').filter({ hasText: 'numbered in more than one timeline' })).toHaveCount(0)
  })
})
