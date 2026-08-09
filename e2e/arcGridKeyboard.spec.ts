import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * X-7a, the Arc grid: 628 cells, every one a `<td>` with a click handler and no
 * tab stop. Giving each its own would have been worse than leaving it — 628
 * presses to cross the screen — so the grid follows the pattern a spreadsheet
 * already taught everyone: one tab stop, arrow keys inside.
 *
 * The movement arithmetic is unit-tested in
 * src/features/arc/__tests__/gridNavigation.test.ts. This drives the wiring.
 */
test.describe('Arc grid keyboard navigation', () => {
  test.describe.configure({ timeout: 150_000 })

  async function open(page: import('@playwright/test').Page) {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Arc')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string,
        { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }
      >
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
        id: `ch${i + 1}`, worldId, timelineId: 'tl', number: i + 1, title: `Chapter ${i + 1}`,
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })))
      await db.events.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
        id: `ev${i + 1}`, worldId, chapterId: `ch${i + 1}`, timelineId: 'tl',
        title: `Scene ${i + 1}`, description: '', locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], threadIds: [], motifIds: [], sortOrder: 0, travelDays: null,
        inWorldTime: null, tension: null, structureBeat: null, status: 'draft',
        povCharacterId: null, isFlashback: false, createdAt: now, updatedAt: now,
      })))
      await db.characters.bulkAdd(['Ada', 'Bram', 'Cleo', 'Dov'].map((name, i) => ({
        id: `c${i + 1}`, worldId, name, role: '', description: '', appearance: '',
        personality: '', backstory: '', notes: '', tags: [], aliases: [],
        portraitImageId: null, colorTag: null, status: 'alive', createdAt: now, updatedAt: now,
      })))
      // The grid also stands down when there are no snapshots at all, so give
      // each character one — and one with notes, which is the only cell type
      // that has an action to activate.
      await db.characterSnapshots.bulkAdd(['c1', 'c2', 'c3', 'c4'].map((characterId, i) => ({
        id: `s${i + 1}`, worldId, characterId, eventId: 'ev1', sortKey: 10_000,
        isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
        inventoryItemIds: [], inventoryNotes: '',
        statusNotes: i === 0 ? 'Shaken, but walking.' : '',
        travelModeId: null, createdAt: now, updatedAt: now,
      })))
      return true
    }, { worldId })

    await page.goto(`/#/worlds/${worldId}/arc`, { waitUntil: 'load' })
    await expect(page.getByRole('grid', { name: 'Character arc grid' })).toBeVisible({ timeout: 30_000 })
  }

  const cell = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.activeElement?.getAttribute('data-grid-cell') ?? null)

  test('the whole grid is one tab stop, and the arrows move within it', async ({ page }) => {
    await open(page)

    // Exactly one cell is in the tab order at a time. This is the assertion that
    // distinguishes the fix from "make every cell a button": 628 tab stops would
    // satisfy "reachable" and be unusable.
    const tabbable = page.locator('[data-grid-cell][tabindex="0"]')
    await expect(tabbable).toHaveCount(1)
    await expect(page.locator('[data-grid-cell]').first()).toHaveAttribute('tabindex', '0')

    await page.locator('[data-grid-cell="0-0"]').focus()
    expect(await cell(page)).toBe('0-0')

    await page.keyboard.press('ArrowRight')
    expect(await cell(page)).toBe('0-1')
    await page.keyboard.press('ArrowDown')
    expect(await cell(page)).toBe('1-1')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    expect(await cell(page)).toBe('2-2')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowUp')
    expect(await cell(page)).toBe('1-1')

    // Still exactly one tab stop after moving — the roving part of roving tabindex.
    await expect(tabbable).toHaveCount(1)
    await expect(page.locator('[data-grid-cell="1-1"]')).toHaveAttribute('tabindex', '0')

    // Home and End reach the ends of the row; Ctrl+Home the grid's corner.
    await page.keyboard.press('End')
    expect(await cell(page)).toBe('1-6')
    await page.keyboard.press('Home')
    expect(await cell(page)).toBe('1-0')
    await page.keyboard.press('Control+End')
    expect(await cell(page)).toBe('4-6')
    await page.keyboard.press('Control+Home')
    expect(await cell(page)).toBe('0-0')

    // It stops at the edge rather than wrapping into another character's row.
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowLeft')
    expect(await cell(page)).toBe('0-0')
  })

  test('Enter on a column header does what clicking it does', async ({ page }) => {
    await open(page)
    // Scoped to the top bar: the Arc toolbar has its own "All chapters" control,
    // and a page-wide locator matches that one instead of the time cursor.
    const cursor = page.locator('header').first()

    await expect(cursor).toContainText('All chapters')

    await page.locator('[data-grid-cell="0-1"]').focus()
    await page.keyboard.press('Enter')
    // Selecting Chapter 1 moves the time cursor, which the top bar reports.
    await expect(cursor).toContainText('Ch.1')
    await expect(cursor).not.toContainText('All chapters')

    // Pressing it again clears it — the same toggle a click gives, so the
    // keyboard is not a second, different behaviour.
    await page.keyboard.press('Enter')
    await expect(cursor).toContainText('All chapters')

    // And the mouse still agrees with the keyboard on a different column.
    await page.locator('[data-grid-cell="0-2"]').click()
    await expect(cursor).toContainText('Ch.2')
  })

  test('the grid keeps a tab stop when it shrinks under a filter', async ({ page }) => {
    await open(page)

    // Park focus on the last row, then filter it away.
    await page.locator('[data-grid-cell="0-0"]').focus()
    await page.keyboard.press('Control+End')
    expect(await cell(page)).toBe('4-6')

    await page.getByPlaceholder(/filter/i).fill('Ada')
    // One character left, so the grid is now 2 rows — and something must still
    // be tabbable, or the grid drops out of the tab order for good.
    await expect(page.locator('[data-grid-cell][tabindex="0"]')).toHaveCount(1)
    await expect(page.locator('[data-grid-cell="4-6"]')).toHaveCount(0)

    // The tab stop is inside the grid that is actually there.
    const remembered = await page.locator('[data-grid-cell][tabindex="0"]').getAttribute('data-grid-cell')
    const [row, col] = remembered!.split('-').map(Number)
    expect(row).toBeLessThanOrEqual(1)
    expect(col).toBeLessThanOrEqual(6)
  })
})
