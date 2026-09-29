import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene being written, beside the Page: the chapter panel's *This scene*.
 *
 * A writer drafting on the Page had to leave for Cards to mark a scene final,
 * rate it, name its point of view or take somebody out of it. These are that
 * block, driven where it lives — beside a real editor, following a real caret —
 * and read back from the store, since the same fields on a card are what the
 * rest of the suite already covers.
 */

async function book(page: Page, opts: { readingMode?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, reading]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, name] of [['teo', 'Teodora'], ['clerk', 'The Clerk'], ['oskar', 'Oskar']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.items.add({ id: 'ledger', worldId: id, name: 'The tide ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat.', ['teo', 'clerk'], ['oskar'], ['ledger']],
      ['e2', 'c1', 'Teodora at the table', 'She counted.', [], [], []],
      ['e3', 'c2', 'The tide-table', 'The water rose.', [], [], []],
    ] as const
    let i = 0
    for (const [eid, cid, title, text, cast, mentioned, items] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [...mentioned], involvedItemIds: [...items],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    if (reading) await db.worlds.update(id, { readingMode: true })
  }, [worldId, !!opts.readingMode] as const)
  return worldId
}

type Ev = { id: string; status: string; tension: number | null; povCharacterId: string | null; description: string; involvedCharacterIds: string[]; mentionedCharacterIds: string[]; involvedItemIds: string[]; tags: string[]; isFlashback: boolean }
const stored = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (k: string) => Promise<Ev> } }
  return db.events.get(eid)
}, id)

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()
const block = (page: Page) => page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'This scene' })

test.describe('the scene’s details beside the Page', () => {
  test.describe.configure({ timeout: 180_000 })

  test('status, tension and point of view are set beside the page, for the scene the caret is in', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const scene = block(page)
    await line(page, 'The court sat.').click()
    await expect(scene.getByRole('heading')).toHaveText('The assize rises')

    await scene.getByRole('button', { name: 'Final', exact: true }).click()
    await scene.getByRole('button', { name: '4', exact: true }).click()
    await scene.getByRole('button', { name: 'No POV character', exact: true }).click()
    await page.getByRole('option', { name: 'Teodora' }).click()
    await expect.poll(async () => { const e = await stored(page, 'e1'); return `${e.status} ${e.tension} ${e.povCharacterId}` })
      .toBe('final 4 teo')

    // Into the next scene: the block is that scene's, and shows none of the first one's answers.
    await line(page, 'She counted.').click()
    await expect(scene.getByRole('heading')).toHaveText('Teodora at the table')
    await expect(scene.getByRole('button', { name: 'Final', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(scene.getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'false')
    expect((await stored(page, 'e2')).status).toBe('draft')

    // And back: the first scene's answers are there again.
    await line(page, 'The court sat.').click()
    await expect(scene.getByRole('button', { name: 'Final', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // Clicking the rated level again clears it, as on a card.
    await scene.getByRole('button', { name: '4', exact: true }).click()
    await expect.poll(async () => (await stored(page, 'e1')).tension).toBeNull()
  })

  test('taking somebody out of a scene takes them off its header line on the page', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const scene = block(page)
    const header = line(page, '[@@')
    await expect(header).toContainText('@@The Clerk')
    await line(page, 'The court sat.').click()

    await scene.getByRole('button', { name: 'Remove The Clerk from this scene' }).click()
    await expect.poll(async () => (await stored(page, 'e1')).involvedCharacterIds).toEqual(['teo'])
    await expect(header).not.toContainText('@@The Clerk')
    await expect(header).toContainText('@@Teodora')

    // The mentioned and the carried, which the page can add and never took away.
    await scene.getByRole('button', { name: 'Remove mention of Oskar' }).click()
    await scene.getByRole('button', { name: 'Remove The tide ledger from this scene' }).click()
    await expect.poll(async () => { const e = await stored(page, 'e1'); return [e.mentionedCharacterIds, e.involvedItemIds] })
      .toEqual([[], []])
  })

  test('the description is typed beside the page, and the rest waits under More', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const scene = block(page)
    await line(page, 'She counted.').click()

    await scene.getByRole('textbox', { name: 'Scene description' }).fill('Teodora finds the error.')
    await expect.poll(async () => (await stored(page, 'e2')).description, { timeout: 10_000 }).toBe('Teodora finds the error.')

    const more = scene.getByRole('button', { name: 'More about this scene' })
    await expect(scene.getByRole('textbox', { name: 'Add a tag to this scene' })).toHaveCount(0)
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await scene.getByRole('textbox', { name: 'Add a tag to this scene' }).fill('ledger work')
    await page.keyboard.press('Enter')
    await scene.getByRole('button', { name: /Flashback/ }).click()
    await expect.poll(async () => { const e = await stored(page, 'e2'); return `${e.tags.join(',')} ${e.isFlashback}` }).toBe('ledger-work true')
  })

  test('is the Page’s: not on Cards, where the card holds them, nor while reading', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await expect(block(page)).toBeVisible()

    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    const panel = page.getByRole('complementary', { name: 'The open chapter' })
    await expect(panel.getByRole('region', { name: 'Chapter 1' })).toBeVisible({ timeout: 20_000 })
    await expect(block(page)).toHaveCount(0)

    const reading = await book(page, { readingMode: true })
    await page.goto(`/#/worlds/${reading}/manuscript/c1?view=read`, { waitUntil: 'load' })
    await expect(panel.getByRole('region', { name: 'Chapter 1' })).toBeVisible({ timeout: 20_000 })
    await expect(block(page)).toHaveCount(0)
  })

  test('on a phone it leads the chapter’s sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 })
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.getByRole('main').getByRole('button', { name: 'Ch. 1', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'The open chapter' })
    await expect(sheet.getByRole('region', { name: 'This scene' }).getByRole('heading')).toHaveText('The assize rises')
    await sheet.getByRole('region', { name: 'This scene' }).getByRole('button', { name: 'Final', exact: true }).click()
    await expect.poll(async () => (await stored(page, 'e1')).status).toBe('final')
  })
})
