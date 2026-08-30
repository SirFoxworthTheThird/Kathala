import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The `@`-mention list opened downward from the bottom of the scene textarea,
 * which auto-grows to its content. On a scene longer than the screen the list
 * was laid out past the bottom of `main` — which owns the scrolling — and never
 * painted. Measured in a 900px viewport: rows at 859, 887 and 915, the chapter
 * bar over the first two and `new place` below the viewport entirely, with
 * nothing scrollable to reach any of them.
 *
 * `new place` is the row that was always lost, and it is the only way to make a
 * location from inside the writing surface.
 */

/** Long enough that the auto-grown textarea runs past the fold. */
const LONG_SCENE = Array.from(
  { length: 40 },
  (_, i) => `Paragraph ${i + 1}. The towpath was slick with the morning and she kept to the inside of it.`,
).join('\n\n')

async function openScene(page: Page, prose: string | null): Promise<void> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Mention World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, prose]: readonly [string, string | null]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 2, title: 'The Long Reach', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The seal breaks',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    if (prose !== null) {
      await db.sceneTexts.add({
        id: 'st1', worldId: id, eventId: 'ev1', text: prose,
        wordCount: prose.split(' ').length, createdAt: now, updatedAt: now,
      })
    }
    // A map, so "new place" is offered at all.
    await db.mapLayers.add({ id: 'map1', worldId: id, name: 'The Salt Road', parentMapId: null, imageBlobId: null, width: 1000, height: 1000, createdAt: now, updatedAt: now })
  }, [worldId, prose] as const)

  await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: /^Expand/ }).first().click()
  await settle(page)
}

test.describe('the @-mention list stays on screen', () => {
  test.describe.configure({ timeout: 240_000 })

  /*
    Opening at the caret means the list can appear directly under a pointer that
    is not moving — the pointer sits wherever the writer last clicked into the
    prose. `mouseenter` fires on appearance, which silently moved the selection
    off the row the typing had chosen; Enter on an exact match then became a
    paragraph break, because the highlighted row had become a *create* row and
    Enter rightly refuses to invent a record. Two specs in
    `sceneMentionPicker` caught it, one as an outright failure and one as a
    flake, which is what a pointer-position-dependent bug looks like.
  */
  test('a list appearing under a still pointer does not steal the choice', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openScene(page, null)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { items: { add: (v: unknown) => Promise<unknown> }, worlds: { toArray: () => Promise<Array<{ id: string }>> } }
      const worlds = await db.worlds.toArray()
      const now = Date.now()
      await db.items.add({ id: 'it1', worldId: worlds[0].id, name: 'The Sealed Letter', description: '', tags: [], imageBlobId: null, createdAt: now, updatedAt: now })
    })
    await page.waitForTimeout(800)

    const box = page.getByRole('textbox', { name: 'Scene prose' })
    /*
      An empty five-row box, clicked in the middle: the caret goes to the
      top-left, so the list opens over the click point — and the pointer is
      still sitting there, untouched. That is the shape the failure had.
    */
    await box.click()
    await page.keyboard.type(' @Sealed')
    await page.waitForTimeout(600)
    await expect(page.getByRole('button', { name: /The Sealed Letter\s+item/ })).toBeVisible()

    // The pointer has not moved, so the typed choice still stands.
    await page.keyboard.press('Enter')
    await expect(box).toHaveValue(/The Sealed Letter/)
    await expect(box).not.toHaveValue(/@Sealed/)
  })

  test('but moving the pointer onto a row still chooses it', async ({ page }) => {
    // The pair: hover is not broken, only appearance-under-a-still-pointer is.
    await page.setViewportSize({ width: 1280, height: 900 })
    await openScene(page, null)

    const box = page.getByRole('textbox', { name: 'Scene prose' })
    await box.click()
    await page.keyboard.type(' @Hollowmere')
    await page.waitForTimeout(600)

    const placeRow = page.getByRole('button', { name: /new place/ })
    await expect(placeRow).toBeVisible()
    const rect = (await placeRow.boundingBox())!
    // A real movement onto the row, rather than the row arriving under a
    // pointer that never moved.
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await page.waitForTimeout(200)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(900)

    const created = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { locationMarkers: { toArray: () => Promise<Array<{ name: string }>> } }
      return (await db.locationMarkers.toArray()).map((m) => m.name)
    })
    expect(created).toContain('Hollowmere')
  })

  test('every row is inside the viewport at the end of a long scene', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openScene(page, LONG_SCENE)

    const box = page.getByRole('textbox', { name: 'Scene prose' })
    await box.click()
    // Caret to the very end of a scene taller than the window.
    await page.keyboard.press('Control+End')
    await page.keyboard.type('\n\n@Hollowmere')
    await page.waitForTimeout(600)

    const rows = page.getByRole('button', { name: /new place|new character|new item/ })
    await expect(rows.first()).toBeVisible()

    // The measurement the finding is made of: nothing below the fold.
    const viewport = page.viewportSize()!
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const rect = (await rows.nth(i).boundingBox())!
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height)
    }

    /*
      And reachable, not merely on screen: `new place` was the row always lost,
      and Playwright's click fails if another element covers the point — which
      is what the chapter bar was doing to the rows above it.
    */
    await page.getByRole('button', { name: /new place/ }).click()
    await settle(page)

    const created = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { locationMarkers: { toArray: () => Promise<Array<{ name: string }>> } }
      return (await db.locationMarkers.toArray()).map((m) => m.name)
    })
    expect(created).toContain('Hollowmere')
  })
})
