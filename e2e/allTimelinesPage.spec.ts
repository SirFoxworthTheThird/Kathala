import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A Page on *All timelines* (run-10 plan, Part 2): the braided book written in
 * reading order, on one page. Run 10's writer switched tabs every chapter, 21
 * times. A `# Chapter` typed there takes the timeline of the chapter above it,
 * and its heading's chip — or Alt+T — gives it to another (Decision 1).
 */

/** Two ages braided: the First Age's chapter 1, the Second Age's 2 and 3. */
async function braid(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Haul')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tA', worldId: id, name: 'The First Age', description: '', color: '#6366f1', dayOffset: 0, position: 0, createdAt: now })
    await db.timelines.add({ id: 'tB', worldId: id, name: 'The Second Age', description: '', color: '#f59e0b', dayOffset: 36500, position: 1, createdAt: now })
    const chapters: Array<[string, string, number, string, string, number | null]> = [
      ['c1', 'tA', 1, 'Ash', 'Ash fell on the colony.', null],
      ['c2', 'tB', 2, 'Brine', 'Brine in the pipes again.', 5],
      ['c3', 'tB', 3, 'Cinder', 'Cinder light over the yards.', null],
    ]
    for (const [cid, tl, number, title, prose, day] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e-${cid}`, worldId: id, chapterId: cid, timelineId: tl, title: `${title} scene`, description: '', sortOrder: 0,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: day, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t-${cid}`, worldId: id, eventId: `e-${cid}`, text: prose, wordCount: 5, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** The book's chapters in number order, and each scene's timeline: number:title:timeline. */
const numbering = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, string & number>>> }>
  const scenes = await db.events.toArray()
  return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => {
    const own = scenes.filter((e) => e.chapterId === c.id)
    // A chapter's scenes are in its timeline: say where one is not.
    const stray = own.some((e) => e.timelineId !== c.timelineId) ? ' (scene elsewhere)' : ''
    return `${c.number}:${c.title}:${c.timelineId}${stray}`
  })
})

async function allTimelinesPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('tablist', { name: 'Timelines' }).getByRole('tab', { name: /All timelines/ }).click()
  await page.getByRole('main').getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

test.describe('A Page on All timelines', () => {
  test.describe.configure({ timeout: 150_000 })

  test('is every timeline’s chapters in reading order, each scene dated from its own timeline’s start', async ({ page }) => {
    const worldId = await braid(page)
    await allTimelinesPage(page, worldId)
    const lines = page.locator('.cm-line')
    await expect(lines.filter({ hasText: 'Ash fell on the colony.' })).toHaveCount(1)
    await expect(lines.filter({ hasText: 'Brine in the pipes again.' })).toHaveCount(1)
    await expect(lines.filter({ hasText: 'Cinder light over the yards.' })).toHaveCount(1)
    // Each chapter's heading names its timeline.
    await expect(page.getByLabel('Timeline of “Ash”')).toHaveValue('tA')
    await expect(page.getByLabel('Timeline of “Brine”')).toHaveValue('tB')
    // Brine is pinned at day 5 of the Second Age, which starts at day 36500 of the world.
    await expect(lines.filter({ hasText: /\bday 36505\b/ })).toHaveCount(1)
    await expect(lines.filter({ hasText: /\bday 5\b/ })).toHaveCount(0)
  })

  test('a # typed there goes straight after the chapter above, in that chapter’s timeline', async ({ page }) => {
    const worldId = await braid(page)
    await allTimelinesPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Ash fell on the colony.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# Ember')
    await page.keyboard.press('Enter')
    // On the First Age's own tab it would go at the end of the book (bookNumbering.spec.ts); here, where it was typed.
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '2:Ember:tA', '3:Brine:tB', '4:Cinder:tB'])
  })

  test('deleting a chapter’s heading joins it to the book’s chapter above, whose timeline its scenes take', async ({ page }) => {
    const worldId = await braid(page)
    await allTimelinesPage(page, worldId)
    // Brine is the Second Age's first chapter: on its own tab there is nothing above to join it to.
    await page.locator('.cm-line', { hasText: '# Brine' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tA', '3:Cinder:tB'])
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { get: (id: string) => Promise<Record<string, string> | undefined> }>
      const e = await db.events.get('e-c2')
      return `${e?.chapterId}:${e?.timelineId}`
    })).toBe('c1:tA')
  })

  test('the chip on a chapter’s heading, or Alt+T, gives it and its scenes to another timeline', async ({ page }) => {
    const worldId = await braid(page)
    await allTimelinesPage(page, worldId)
    await page.getByLabel('Timeline of “Ash”').selectOption('tB')
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tB', '2:Brine:tB', '3:Cinder:tB'])
    await expect(page.getByLabel('Timeline of “Ash”')).toHaveValue('tB')

    // Alt+T, in Brine: on to the next timeline, round to the first.
    await page.locator('.cm-line', { hasText: 'Brine in the pipes again.' }).first().click()
    await page.keyboard.press('Alt+t')
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tB', '2:Brine:tA', '3:Cinder:tB'])
    await expect(page.getByText('“Brine” is now The First Age’s.')).toBeVisible()

    // One undo each.
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Ash:tB', '2:Brine:tB', '3:Cinder:tB'])
  })

  test('on one timeline’s tab there is no chip, and Alt+T moves nothing', async ({ page }) => {
    const worldId = await braid(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c2?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.cm-line', { hasText: 'Brine in the pipes again.' })).toHaveCount(1)
    await expect(page.getByLabel(/^Timeline of “/)).toHaveCount(0)
    await page.locator('.cm-line', { hasText: 'Brine in the pipes again.' }).first().click()
    await page.keyboard.press('Alt+t')
    // A real change follows, so the absence above is not read before it could be wrong.
    await page.keyboard.press('End')
    await page.keyboard.type(' Still.')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, string>>> }>
      return (await db.sceneTexts.toArray()).find((t) => t.eventId === 'e-c2')?.text
    }), { timeout: 15_000 }).toBe('Brine in the pipes again. Still.')
    expect(await numbering(page)).toEqual(['1:Ash:tA', '2:Brine:tB', '3:Cinder:tB'])
  })
})
