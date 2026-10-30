import { test, expect, type Page } from '@playwright/test'
import { settle } from './helpers/settle'
import { braid, numbering } from './helpers/braid'

/**
 * Moving a chapter anywhere in the book (run-10 plan, Part 2): on *All
 * timelines* the binder lists every timeline's chapters in reading order, and
 * Alt+↑ ↓ or a drag moves one past any other — the book's numbers between
 * change, and the chapter keeps its timeline. Run 10's writer made placeholder
 * chapters to get one where it belonged.
 */

async function binderOn(page: Page, worldId: string, all: boolean) {
  await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('tablist', { name: 'Timelines' })
    .getByRole('tab', { name: all ? /All timelines/ : /The First Age/ }).click()
  const tree = page.getByRole('tree', { name: 'Chapters and scenes' })
  await expect(tree).toBeVisible({ timeout: 20_000 })
  return tree
}

test.describe('The binder on All timelines', () => {
  test.describe.configure({ timeout: 150_000 })

  test('Alt+↓ moves a chapter past another timeline’s, and keeps the focus for the next press', async ({ page }) => {
    const worldId = await braid(page)
    // (On the First Age's own tab Ash is its only chapter and cannot move: allTimelinesStructure.test.ts.)
    const tree = await binderOn(page, worldId, true)
    await tree.getByRole('treeitem', { name: /^Ch\. 1 · Ash/ }).focus()
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Brine:tB', '2:Ash:tA', '3:Cinder:tB'])
    await expect(tree.getByRole('treeitem', { name: /Ash/ }).first()).toBeFocused()
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Brine:tB', '2:Cinder:tB', '3:Ash:tA'])
  })

  test('dragging a chapter puts it before the one it is dropped on, of any timeline', async ({ page }) => {
    const worldId = await braid(page)
    const tree = await binderOn(page, worldId, true)
    await tree.getByRole('treeitem', { name: /^Ch\. 3 · Cinder/ })
      .dragTo(tree.getByRole('treeitem', { name: /^Ch\. 1 · Ash/ }), { targetPosition: { x: 20, y: 3 } })
    await expect.poll(() => numbering(page), { timeout: 15_000 }).toEqual(['1:Cinder:tB', '2:Ash:tA', '3:Brine:tB'])
  })

  test('a scene steps into the next chapter of another timeline, and is that timeline’s', async ({ page }) => {
    const worldId = await braid(page)
    const tree = await binderOn(page, worldId, true)
    await tree.getByRole('treeitem', { name: /^Ch\. 1 · Ash/ }).focus()
    await page.keyboard.press('ArrowRight')
    await tree.getByRole('treeitem', { name: 'Ash scene', exact: true }).focus()
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { get: (id: string) => Promise<Record<string, string> | undefined> }>
      const e = await db.events.get('e-c1')
      return `${e?.chapterId}:${e?.timelineId}`
    }), { timeout: 15_000 }).toBe('c2:tB')
  })

  test('offers no New chapter, which would have no timeline to go into; a timeline’s tab does', async ({ page }) => {
    const worldId = await braid(page)
    await binderOn(page, worldId, false)
    await expect(page.getByRole('button', { name: 'New chapter', exact: true })).toBeVisible()
    await binderOn(page, worldId, true)
    await expect(page.getByRole('button', { name: 'New scene', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New chapter', exact: true })).toHaveCount(0)
  })
})
