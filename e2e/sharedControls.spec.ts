import { test, expect, devices, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { IMAGE_URL } from './helpers/imageUrl'

/*
  The shared controls the UX expert review found broken on every screen that uses
  them (ux-expert-fixes-plan.md, Part 1): a dropdown chosen from the keyboard
  (UX-2-1), a dialog's ✕ in its corner on touch and with a ring for the keyboard
  (UX-1-2, UX-2-5, UX-2-16), one Escape closing one of two stacked dialogs
  (UX-2-6), a portrait that opens on a tap (UX-2-9), and Find & replace named and
  heard (UX-2-15).
*/

const MANUSCRIPT = [
  '# The Salt Ledger',
  '',
  '## Chapter 1: The Weighing House',
  '',
  'The ferry left at dawn. Mira counted the crates.',
  '',
  '## Chapter 2: The Tide Office',
  '',
  'Mira wrote the tide down twice.',
].join('\n')

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

async function onCards(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  const layout = page.getByRole('main').getByRole('group', { name: 'Layout', exact: true })
  await layout.getByRole('button', { name: 'Cards', exact: true }).click()
  await expect(layout.getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** The option the keyboard is on: what the focused list, or its filter box, points at. */
const activeOption = (page: Page) => page.evaluate(() => {
  const at = document.activeElement?.getAttribute('aria-activedescendant')
  return at ? document.getElementById(at)?.textContent?.trim() ?? null : null
})
const focusedRole = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName ?? null)

test('a dropdown is chosen from the keyboard, and Escape and Tab close only the list', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await onCards(page, worldId)
  await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
  const scenes = dialog.getByRole('button', { name: /^Scenes to include/ })
  await expect(scenes).toHaveAccessibleName('Scenes to include Every scene')

  // Enter opens it on the option chosen, with focus in the list.
  await scenes.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  expect(await focusedRole(page)).toBe('listbox')
  expect(await activeOption(page)).toBe('Every scene')

  // ↓ moves, Enter chooses: the list shuts, the trigger has focus and the answer, and the dialog is still there.
  await page.keyboard.press('ArrowDown')
  expect(await activeOption(page)).toBe('Revised and final')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(scenes).toHaveAccessibleName('Scenes to include Revised and final')
  await expect(scenes).toBeFocused()
  await expect(dialog).toBeVisible()

  // ↓ on the trigger opens it too; Escape closes the list and not the dialog.
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(scenes).toBeFocused()

  // Typing jumps to what starts with it; Tab leaves without choosing.
  await page.keyboard.press('Enter')
  await page.keyboard.press('f')
  expect(await activeOption(page)).toBe('Final only')
  await page.keyboard.press('End')
  expect(await activeOption(page)).toBe('Final only')
  await page.keyboard.press('Home')
  expect(await activeOption(page)).toBe('Every scene')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(scenes).toHaveAccessibleName('Scenes to include Revised and final')

  // And the dialog's own Escape still works once the list is shut.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('a filtered list keeps focus in its box, and the arrows and Enter choose from what is shown', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await onCards(page, worldId)
  // Chapter 1 open, by its address: a chapter's scenes are on Cards only while it is.
  const first = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb: Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }> }).__pwdb
    const chapter = (await db.chapters.toArray()).find((c) => c.number === 1)!
    const scene = (await db.events.toArray()).find((e) => e.chapterId === chapter.id)!
    return { chapterId: chapter.id as string, title: scene.title as string }
  })
  await page.goto(`/#/worlds/${worldId}/manuscript/${first.chapterId}`, { waitUntil: 'load' })
  const main = page.getByRole('main')
  await main.getByRole('button', { name: `More actions for “${first.title}”`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Move to chapter…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Move/ })
  const to = dialog.getByRole('button', { name: /^Move to chapter/ })
  await to.focus()
  await page.keyboard.press('Enter')
  const filter = page.getByRole('combobox', { name: 'Filter chapters…' })
  await expect(filter).toBeFocused()
  await filter.fill('tide')
  expect(await activeOption(page)).toBe('Ch. 2 — The Tide Office')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(to).toHaveAccessibleName(/Ch\. 2 — The Tide Office$/)
  await expect(to).toBeFocused()

  // Escape in the filter closes the list, and only the list.
  await page.keyboard.press('Enter')
  await expect(filter).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()
})

test('one Escape on a confirm over Drafts closes the confirm, and Drafts stays', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await onCards(page, worldId)
  await page.getByRole('main').getByRole('button', { name: 'Drafts', exact: true }).click()
  const drafts = page.getByRole('dialog', { name: 'Drafts of the book' })
  await drafts.getByRole('textbox', { name: 'Name this draft' }).fill('First')
  await drafts.getByRole('button', { name: 'Save a draft' }).click()
  await drafts.getByRole('button', { name: 'Delete “First”' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete this draft?' })
  await expect(confirm).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(2)

  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(drafts).toBeVisible()
  await expect(drafts.getByRole('list', { name: 'Drafts' }).getByRole('listitem')).toHaveCount(1)
  // A second Escape is the one that closes Drafts.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Find & replace is a named dialog, says which scene each Replace is for, and is heard when it is done', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await onCards(page, worldId)
  await page.getByRole('main').getByRole('button', { name: 'Find & replace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Find & replace in the manuscript' })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder(/^Find/).fill('Mira')
  await dialog.getByPlaceholder('Replace with…').fill('Mara')
  const perScene = dialog.getByRole('button', { name: /^Replace in / })
  await expect(perScene).toHaveCount(2)
  const names = await perScene.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(new Set(names).size).toBe(2)
  await expect(dialog.getByRole('status')).toHaveText('')
  await dialog.getByRole('button', { name: 'Replace all' }).click()
  await expect(dialog.getByRole('status')).toContainText('Replaced 2 occurrences in 2 scenes')
})

test.describe('on a touch screen', () => {
  // An iPhone 13's screen and touch, without its browser: the suite runs Chromium only.
  const { defaultBrowserType: _browser, ...phone } = devices['iPhone 13']
  void _browser
  test.use(phone)

  test('a dialog’s ✕ is in its top-right corner, and the keyboard sees it', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    const dialog = page.getByRole('dialog')
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    const d = (await dialog.boundingBox())!
    const c = (await close.boundingBox())!
    // In its corner: within the dialog's last 60px across and first 60px down.
    expect(c.x + c.width).toBeGreaterThan(d.x + d.width - 60)
    expect(c.y).toBeLessThan(d.y + 60)
    expect(await close.evaluate((el) => getComputedStyle(el).position)).toBe('absolute')
    // A centred 44px hit area still hangs off it.
    expect(await close.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('44px')

    // Focused from the keyboard, it shows a ring; unfocused, none.
    expect(await close.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    expect(await close.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
  })

  test('a tap on a portrait opens it, and its corner opens the menu', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Gallery')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().tap()
    await page.getByPlaceholder('Character name').fill('Aria')
    await page.getByRole('button', { name: 'Add Character' }).last().tap()
    await page.getByText('Aria').first().tap()
    await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+/)
    await page.getByRole('button', { name: 'Portrait for Aria' }).tap()
    await page.getByRole('menuitem', { name: 'Link by URL' }).tap()
    await page.getByPlaceholder('https://…/image.png').fill(IMAGE_URL)
    await page.getByRole('button', { name: 'Add linked image' }).tap()
    const portrait = page.locator(`img[src="${IMAGE_URL}"][role="button"]`).first()
    await expect(portrait).toBeVisible()

    // The middle of the portrait is the portrait, not the menu at its corner.
    const p = (await portrait.boundingBox())!
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el?.closest('[aria-label^="Portrait for"]') ? 'menu' : el?.tagName ?? null
    }, [p.x + p.width / 2, p.y + p.height / 2])
    expect(hit).toBe('IMG')
    await page.touchscreen.tap(p.x + p.width / 2, p.y + p.height / 2)
    await expect(page.getByTestId('image-lightbox')).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('image-lightbox')).toHaveCount(0)

    // And the corner is still the menu.
    await page.getByRole('button', { name: 'Portrait for Aria' }).tap()
    await expect(page.getByRole('menu')).toBeVisible()
  })
})
