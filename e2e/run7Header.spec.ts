import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * What writer run 7 found writing on the Page:
 *
 * - W7-1: a line added to a header block — `Place: #…` typed under its `[` —
 *   left the block as prose in the book, under a second header drawn from the
 *   records: while its label was half-typed the block was not a header, and
 *   the records arriving from a name just picked were drawn in over it.
 * - W7-4: the chapter panel's relationship states left out a relationship
 *   that began and never changed.
 * - W7-3: going back to the book's last scene, when it had only a header, put
 *   the caret at the end of its title, and what was typed renamed it.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Black Lamb')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The First Snow', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The inn', 'Snow on the sill.', ['alice']], ['e2', 'The road', 'Wheel ruts.', []], ['e3', 'Thaw', '', ['bob']]] as const
    let i = 0
    for (const [eid, title, text, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 4, updatedAt: now })
    }
    for (const [cid, name] of [['alice', 'Alice Grey'], ['bob', 'Bob Black']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const stored = (page: Page, eventId: string) => page.evaluate(async (id) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    sceneTexts: { where: (k: string) => { equals: (v: string) => { first: () => Promise<{ text: string } | undefined> } } }
    events: { get: (id: string) => Promise<{ involvedCharacterIds: string[] }> }
  }
  return { text: (await db.sceneTexts.where('eventId').equals(id).first())?.text ?? null, cast: (await db.events.get(id)).involvedCharacterIds }
}, eventId)

/** Lines of the page from scene `title`'s heading to the next heading, as shown. */
const sceneLines = (page: Page, title: string) => page.evaluate((t) => {
  const lines = [...document.querySelectorAll('.cm-line')].map((l) => l.textContent ?? '')
  const at = lines.indexOf(`## ${t}`)
  const next = lines.findIndex((l, i) => i > at && l.startsWith('#'))
  return lines.slice(at + 1, next < 0 ? undefined : next).filter((l) => l.trim() !== '')
}, title)

test.describe('the Page, after writer run 7', () => {
  test.describe.configure({ timeout: 150_000 })

  test('W7-1: a line added to a header block, while its other lines are still being applied, stays the header', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'Characters: @@Alice Grey' })).toHaveCount(1, { timeout: 20_000 })

    // Bob picked on the Characters line, with Tab — the picker leaves a space after him.
    await page.locator('.cm-line', { hasText: 'Characters: @@Alice Grey' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Bob', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Tab')
    // The binder hands the keyboard to the page once it has gone there.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()

    // Then up to the `[`, and a Place line under it; the writer stays on it.
    await page.locator('.cm-line').filter({ hasText: /^\[$/ }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    // A pause with the label half-typed, long enough for the page to save: the block is saved as a header, not as prose.
    await page.keyboard.type('Pla')
    await page.waitForTimeout(2500)
    expect((await stored(page, 'e1')).text).toBe('Snow on the sill.')
    await page.keyboard.type('ce: #The Black Lamb', { delay: 30 })
    await page.waitForTimeout(1500)
    const lines = await sceneLines(page, 'The inn')
    // One header — the writer's, with the line added to it — and the prose stored as it was.
    expect(lines).toEqual(['[', 'Place: #The Black Lamb', '  Characters: @@Alice Grey @@Bob Black ', ']', 'Snow on the sill.'])
    expect(await stored(page, 'e1')).toEqual({ text: 'Snow on the sill.', cast: ['alice', 'bob'] })
  })

  test('W7-1: and the same with a typo where the label goes — a line that is no label at all while it is typed', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'Characters: @@Alice Grey' })).toHaveCount(1, { timeout: 20_000 })

    // Bob picked on the Characters line, with Tab — the picker leaves a space after him.
    await page.locator('.cm-line', { hasText: 'Characters: @@Alice Grey' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Bob', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Tab')
    // The binder hands the keyboard to the page once it has gone there.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()

    // Then up to the `[`, and a Place line under it; the writer stays on it.
    await page.locator('.cm-line').filter({ hasText: /^\[$/ }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    // A word that is no label, while the records from leaving the Characters line come back: they are not drawn over the block.
    await page.keyboard.type('Plcae')
    await page.waitForTimeout(1500)
    await page.keyboard.type(': #The Black Lamb', { delay: 30 })
    await page.waitForTimeout(1500)
    const lines = await sceneLines(page, 'The inn')
    // One header — the writer's, with the line added to it — and the prose stored as it was.
    expect(lines).toEqual(['[', 'Plcae: #The Black Lamb', '  Characters: @@Alice Grey @@Bob Black ', ']', 'Snow on the sill.'])
    expect(await stored(page, 'e1')).toEqual({ text: 'Snow on the sill.', cast: ['alice', 'bob'] })
  })

  test('W7-3: the last scene, with only a header, is gone back to under its header — what is typed is its prose', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.cm-line', { hasText: 'Characters: @@Bob Black' })).toHaveCount(1, { timeout: 20_000 })
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await settle(page)

    // Somewhere else first, then the last scene from the binder.
    await page.locator('.cm-line', { hasText: 'Snow on the sill.' }).first().click()
    await page.getByRole('tree', { name: 'Chapters and scenes' }).getByRole('treeitem', { name: 'Thaw' }).click()
    // The binder hands the keyboard to the page once it has gone there.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()
    await page.keyboard.type('Water ran.')
    await page.keyboard.press('Control+Home')

    const scene = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { get: (id: string) => Promise<{ title: string }> }
        sceneTexts: { where: (k: string) => { equals: (v: string) => { first: () => Promise<{ text: string } | undefined> } } }
      }
      return { title: (await db.events.get('e3')).title, text: (await db.sceneTexts.where('eventId').equals('e3').first())?.text ?? null }
    })
    await expect.poll(scene, { timeout: 15_000 }).toEqual({ title: 'Thaw', text: 'Water ran.' })
    await expect(page.locator('.cm-line', { hasText: '## Thaw' })).toHaveCount(1)
  })

  test('W7-4: the chapter panel lists a relationship that began in the chapter and never changed', async ({ page }) => {
    const worldId = await book(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      const world = (await (db.events as unknown as { get: (id: string) => Promise<{ worldId: string }> }).get('e1')).worldId
      await db.relationships.add({ id: 'host', worldId: world, characterAId: 'alice', characterBId: 'bob', label: 'Host and guest', strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: 'e2', createdAt: now, updatedAt: now })
    })
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const panel = page.getByRole('region', { name: 'Chapter 1' })
    await expect(panel.getByText('Relationship States')).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText('Host and guest · neutral · moderate')).toBeVisible()
    await expect(panel.getByText(/No relationship/)).toHaveCount(0)
  })
})
