import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { sidebarSection } from './helpers/map'

/*
  Overlays that should have been dialogs, and Escape (ux-expert-fixes-plan.md,
  Part 2):
  - the Library (UX-1-5), Focus mode (UX-2-12), Help (UX-3-14) and the narrow
    navigation drawer (UX-1-11) take focus, keep Tab inside, and give focus back
    when they close;
  - the world card's ⋯ and the map's Map tools are menus to the keyboard (UX-1-10,
    UX-3-5);
  - Escape closes the map's panels, the faction panel and the search palette,
    and cancels the item page's edit (UX-3-7).
*/

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

const MANUSCRIPT = ['# The Salt Ledger', '', '## Chapter 1: The Weighing House', '', 'The ferry left at dawn.'].join('\n')

/** Whether the element with focus is inside `scope`. */
const focusIn = (scope: Locator) => scope.evaluate((el) => el.contains(document.activeElement))

/** Tab `n` times (Shift+Tab when `back`), and say whether focus was inside `scope` after every press. */
async function tabStaysIn(page: Page, scope: Locator, n: number, back = false): Promise<boolean> {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
    if (!(await focusIn(scope))) return false
  }
  return true
}

async function newWorld(page: Page, name = 'Overlays'): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().match(/#\/worlds\/([^/]+)/)![1]
}

test.describe('overlays that hold focus', () => {
  test.describe.configure({ timeout: 120_000 })

  test('the Library is a dialog: focus goes in, stays in, and comes back to Library', async ({ page }) => {
    await resetDB(page)
    const opener = page.getByRole('button', { name: 'Library', exact: true }).first()
    await expect(page.getByRole('dialog', { name: 'Library' })).toHaveCount(0)
    await opener.focus()
    await page.keyboard.press('Enter')
    const library = page.getByRole('dialog', { name: 'Library' })
    await expect(library).toBeVisible()
    await expect(library).toHaveAttribute('aria-modal', 'true')
    expect(await focusIn(library)).toBe(true)
    expect(await tabStaysIn(page, library, 4, true)).toBe(true)
    expect(await tabStaysIn(page, library, 6)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(library).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('Focus mode is a modal: Tab stays in it, and leaving puts the caret back in the Page', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
    await page.getByRole('button', { name: /^Import/ }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Page', exact: true }).click()
    await page.locator('.cm-line', { hasText: 'The ferry left' }).click()
    await page.getByRole('button', { name: 'Focus', exact: true }).click()
    const focus = page.getByRole('dialog', { name: 'Focus mode' })
    await expect(focus).toBeVisible()
    await expect(focus.getByPlaceholder('Write…')).toBeFocused()
    expect(await tabStaysIn(page, focus, 8)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(focus).toHaveCount(0)
    // The Page puts the caret back in the prose, where the writing stopped: somewhere real, not <body>.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()
  })

  test('Help is a dialog: focus goes in, stays in, and comes back to Help', async ({ page }) => {
    // Off the dashboard, where a new world's setup guide opens a moment later and takes focus.
    const worldId = await newWorld(page)
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    const opener = page.getByRole('button', { name: 'Help', exact: true })
    await opener.click()
    const help = page.getByRole('dialog', { name: 'Help' })
    await expect(help).toBeVisible()
    expect(await focusIn(help)).toBe(true)
    expect(await tabStaysIn(page, help, 6)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(help).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('the navigation drawer on a narrow screen keeps focus in itself and gives it back to ☰', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 })
    const worldId = await newWorld(page)
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    const opener = page.getByRole('button', { name: 'Open navigation menu' })
    await opener.click()
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' })
    await expect(drawer).toBeVisible()
    expect(await focusIn(drawer)).toBe(true)
    expect(await tabStaysIn(page, drawer, 4, true)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
})

test.describe('menus and Escape', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a world card’s ⋯ is a menu: ↓ opens it on its first item, the arrows move, Escape closes it', async ({ page }) => {
    await newWorld(page, 'Hesk')
    await page.goto('/#/', { waitUntil: 'load' })
    const trigger = page.getByRole('button', { name: 'More actions for Hesk' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'More actions for Hesk' })
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const items = menu.getByRole('menuitem')
    await expect(items.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(items.last()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('Map tools is a menu, and Escape closes a location’s panel', async ({ page }) => {
    await newWorld(page, 'Mapped')
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    // The menu.
    const tools = page.getByRole('button', { name: 'Map tools' })
    await tools.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'Map tools' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(tools).toBeFocused()

    // A location's panel, opened from the sidebar, closes on Escape.
    await page.evaluate(async () => {
      const db = (window as unknown as { __pwdb: Record<string, { toArray: () => Promise<Array<Record<string, unknown>>>; add: (v: unknown) => Promise<unknown> }> }).__pwdb
      const layer = (await db.mapLayers.toArray())[0]
      await db.locationMarkers.add({
        id: 'loc-esc', worldId: layer.worldId, mapLayerId: layer.id, name: 'Southvale', description: '', type: 'town',
        x: Number(layer.imageWidth) / 2, y: Number(layer.imageHeight) / 2, factionId: null, linkedMapLayerId: null,
        iconType: 'town', color: null, createdAt: Date.now(), updatedAt: Date.now(),
      })
    })
    await sidebarSection(page, 'Locations').click()
    await page.getByRole('button', { name: 'Southvale' }).first().click()
    const close = page.getByRole('button', { name: 'Close location panel' })
    await expect(close).toBeVisible()
    await close.focus()
    await page.keyboard.press('Escape')
    await expect(close).toHaveCount(0)
  })

  test('Escape closes the faction panel, but not from a box being typed in', async ({ page }) => {
    const worldId = await newWorld(page, 'Factional')
    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('The Order')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close faction panel' })
    await expect(close).toBeVisible()

    // In the tag box, Escape is the box's: the panel stays.
    const tag = page.getByPlaceholder('Add tag…')
    await tag.fill('secret')
    await tag.press('Escape')
    await expect(close).toBeVisible()
    // From the panel's button, Escape closes it.
    await close.focus()
    await page.keyboard.press('Escape')
    await expect(close).toHaveCount(0)
  })

  test('Escape closes the search palette from anywhere in it', async ({ page }) => {
    const worldId = await newWorld(page, 'Searched')
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByTitle('Search (Ctrl+K)').click()
    const palette = page.getByRole('dialog', { name: 'Search' })
    await expect(palette).toBeVisible()
    await palette.getByRole('checkbox', { name: 'Whole words' }).focus()
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
  })

  test('Escape cancels the item page’s edit, keeping what was saved', async ({ page }) => {
    const worldId = await newWorld(page, 'Itemised')
    await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Bowie Knife')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.getByText('Bowie Knife').first().click()
    const edit = page.getByRole('button', { name: 'Edit', exact: true })
    await edit.click()
    const name = page.getByLabel('Name', { exact: true })
    await expect(name).toBeVisible()
    await name.fill('Another name')
    await page.keyboard.press('Escape')
    await expect(name).toHaveCount(0)
    await expect(edit).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bowie Knife' })).toBeVisible()
  })
})
