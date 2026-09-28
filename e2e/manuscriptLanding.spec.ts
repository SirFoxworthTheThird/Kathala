import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Manuscript is the Timeline's now: its address, and the navigation's
 * Manuscript (for a reader, Read), land on the Timeline — on Page for the
 * author, who writes the book there, and on Read for a reader. And the Timeline
 * remembers the layout a world was left on, because a reader who steps out of
 * the book to look someone up has to come back to the book.
 */

async function book(page: Page, readingMode = false): Promise<string> {
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
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'The assize rises', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text: 'The court sat and the water fell.', wordCount: 7, updatedAt: now })
    if (reading) await db.worlds.update(id, { readingMode: true })
  }, [worldId, readingMode] as const)
  return worldId
}

const pageEditor = (page: Page) => page.getByRole('textbox', { name: 'The book, as one page' })
const readBook = (page: Page) => page.locator('[data-book-scroller]')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })

test.describe('the Manuscript lands on the Timeline', () => {
  test.describe.configure({ timeout: 120_000 })

  test('its address takes the author to Page, and leaves a plain Timeline address behind', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })
    await expect(readBook(page)).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`#/worlds/${worldId}/timeline$`))
  })

  test('its address takes a reader to Read — the book they are reading', async ({ page }) => {
    const worldId = await book(page, true)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await expect(readBook(page).getByText('The court sat and the water fell.')).toBeVisible({ timeout: 30_000 })
    await expect(pageEditor(page)).toHaveCount(0)
  })

  test('the navigation’s Manuscript and Read go the same way', async ({ page }) => {
    const author = await book(page)
    await page.goto(`/#/worlds/${author}/characters`, { waitUntil: 'load' })
    await settle(page)
    await nav(page).getByRole('link', { name: 'Manuscript', exact: true }).click()
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })

    const reader = await book(page, true)
    await page.goto(`/#/worlds/${reader}/characters`, { waitUntil: 'load' })
    await settle(page)
    await nav(page).getByRole('link', { name: 'Read', exact: true }).click()
    await expect(readBook(page)).toBeVisible({ timeout: 30_000 })
  })

  test('?view= asks for a layout on arrival', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline?view=read`, { waitUntil: 'load' })
    await expect(readBook(page)).toBeVisible({ timeout: 30_000 })
    await page.goto(`/#/worlds/${worldId}/timeline?view=cards`, { waitUntil: 'load' })
    await expect(readBook(page)).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible()
  })

  test('the Timeline comes back on the layout it was left on, and after a reload', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)
    // Cards first — so what follows is a remembered choice, not a default.
    await expect(pageEditor(page)).toHaveCount(0)
    await page.getByRole('group', { name: 'Timeline layout' }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(pageEditor(page)).toBeVisible()

    await nav(page).getByRole('link', { name: 'Characters', exact: true }).click()
    await settle(page)
    await nav(page).getByRole('link', { name: 'Timeline', exact: true }).click()
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })

    await page.reload({ waitUntil: 'load' })
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })
  })
})
