import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Timeline and the Manuscript are one screen, called the Manuscript, at
 * /manuscript. The Timeline's addresses are in links, bookmarks and browser
 * history, and each still lands where it did — the chapter it named, and what
 * it asked for on the end.
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
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
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
  }, worldId)
  return worldId
}

const pageEditor = (page: Page) => page.getByRole('textbox', { name: 'The book, as one page' })
const hash = (page: Page) => new URL(page.url()).hash
const readBook = (page: Page) => page.locator('[data-book-scroller]')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })

test.describe('the Timeline’s addresses land in the Manuscript', () => {
  test.describe.configure({ timeout: 120_000 })

  test('/timeline is the Manuscript', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible({ timeout: 30_000 })
    expect(hash(page)).toBe(`#/worlds/${worldId}/manuscript`)
  })

  test('a chapter’s old address opens that chapter', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline/c1`, { waitUntil: 'load' })
    await expect(page.getByRole('region', { name: 'Chapter 1' })).toBeVisible({ timeout: 30_000 })
    expect(hash(page)).toBe(`#/worlds/${worldId}/manuscript/c1`)
  })

  test('what the address asked for comes with it', async ({ page }) => {
    const worldId = await book(page)
    // Cards first, from the plain address: so Read below is the query's doing.
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible({ timeout: 30_000 })
    await expect(readBook(page)).toHaveCount(0)
    await page.goto(`/#/worlds/${worldId}/timeline?view=read`, { waitUntil: 'load' })
    await expect(readBook(page).getByText('The court sat and the water fell.')).toBeVisible({ timeout: 30_000 })
    expect(hash(page)).toBe(`#/worlds/${worldId}/manuscript`)
  })

  test('/corkboard, whose screen is gone, is the Manuscript too — and the navigation no longer offers it', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/corkboard`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible({ timeout: 30_000 })
    expect(hash(page)).toBe(`#/worlds/${worldId}/manuscript`)
    await expect(nav(page).getByRole('link', { name: 'Corkboard' })).toHaveCount(0)
    // Paired: the navigation is there, and still offers its neighbour.
    await expect(nav(page).getByRole('link', { name: 'Structure' })).toBeVisible()
  })

  test('the navigation has the book once, and it is the Manuscript', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settle(page)
    await expect(nav(page).getByRole('link', { name: 'Timeline', exact: true })).toHaveCount(0)
    await nav(page).getByRole('link', { name: 'Manuscript', exact: true }).click()
    await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible({ timeout: 30_000 })
    expect(hash(page)).toBe(`#/worlds/${worldId}/manuscript`)
  })

  test('the Manuscript comes back on the layout it was left on, and after a reload', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    // Cards first — so what follows is a remembered choice, not a default. The
    // pressed button, not only the editor's absence: the editor loads late, so
    // its absence holds for a moment on Page too.
    const layouts = page.getByRole('group', { name: 'Layout', exact: true })
    await expect(layouts.getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(pageEditor(page)).toHaveCount(0)
    await layouts.getByRole('button', { name: 'Page', exact: true }).click()
    await expect(pageEditor(page)).toBeVisible()

    await nav(page).getByRole('link', { name: 'Characters', exact: true }).click()
    await settle(page)
    await nav(page).getByRole('link', { name: 'Manuscript', exact: true }).click()
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })

    await page.reload({ waitUntil: 'load' })
    await expect(pageEditor(page)).toBeVisible({ timeout: 30_000 })
  })
})
