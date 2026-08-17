import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The scene draft is the one box in the app holding prose that exists nowhere
 * else, and it used to reach the database on **blur alone**. Reload the tab,
 * follow a link, or close a laptop mid-sentence and the writing was gone —
 * while Writer's Notes on the same screen debounced at 600ms and said
 * "Auto-saved", and Focus mode autosaved at 1s and flushed on unmount.
 *
 * Both halves are here in one test, because either alone is satisfied by the
 * bug: the *presence* — a pause writes it, with nothing clicked and no focus
 * moved — and the *absence* — the line under the box says "Saving draft…" while
 * there is genuinely something not yet written, rather than printing a
 * permanent "Auto-saved" that would be a lie for a second at a time.
 */

const PROSE = 'The gate opened on a courtyard full of rain, and nobody was waiting.'

async function chapterWithAScene(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Ashcorn')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

/** What is actually in the database for this scene — not what is on screen. */
const storedProse = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { sceneTexts: { toArray: () => Promise<Array<{ text: string }>> } }
  return (await db.sceneTexts.toArray()).map((t) => t.text).join('')
})

test.describe('Scene prose survives without being blurred', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a pause writes it, and the line under the box says which state it is in', async ({ page }) => {
    const worldId = await chapterWithAScene(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1800)

    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await page.waitForTimeout(900)

    const box = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(box).toBeVisible()
    // Nothing written yet, and nothing pending either.
    await expect(page.getByText('Draft auto-saved', { exact: true })).toBeVisible()
    expect(await storedProse(page)).toBe('')

    /*
      `pressSequentially`, not `fill`: the point is that a person typed, with
      the caret still in the box. Nothing below moves focus, clicks away, or
      leaves the page — the old code needed one of those and this test gives it
      none.
    */
    await box.click()
    await box.pressSequentially(PROSE, { delay: 8 })

    // The pending half. It has been typed and is not yet stored.
    await expect(page.getByText('Saving draft…', { exact: true })).toBeVisible()

    // The written half — this is the assertion the old code fails.
    await expect.poll(() => storedProse(page), { timeout: 15_000 }).toBe(PROSE)
    await expect(page.getByText('Draft auto-saved', { exact: true })).toBeVisible()

    // And the writer sees it again on the way back in. A reload is the case
    // that lost the work: React never unmounts, so no flush can help here.
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1800)
    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await page.waitForTimeout(900)
    await expect(page.getByRole('textbox', { name: 'Scene prose' })).toHaveValue(PROSE)
  })

  /**
   * A burst of autosaves must not become a wall of near-identical versions in
   * History — `setSceneText` coalesces revisions over two minutes, and the
   * debounce leans on that. Without it, autosaving would have made History
   * useless as the price of not losing prose.
   */
  test('and History does not fill up with one version per pause', async ({ page }) => {
    const worldId = await chapterWithAScene(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1800)

    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await page.waitForTimeout(900)

    const box = page.getByRole('textbox', { name: 'Scene prose' })
    await box.click()
    for (const sentence of ['One. ', 'Two. ', 'Three. ', 'Four. ']) {
      await box.pressSequentially(sentence, { delay: 8 })
      await page.waitForTimeout(1400) // longer than the debounce: each one lands
    }

    await expect.poll(() => storedProse(page), { timeout: 15_000 }).toBe('One. Two. Three. Four. ')
    const revisions = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { sceneRevisions: { toArray: () => Promise<unknown[]> } }
      return (await db.sceneRevisions.toArray()).length
    })
    /*
      Exactly one, and the arithmetic is worth stating because it is what makes
      this a real bound rather than a small number: the first write creates the
      record and has no outgoing prose to snapshot, the second snapshots what
      the first stored, and the third and fourth land inside
      `REVISION_COALESCE_MS` of that snapshot and are skipped.
    */
    expect(revisions).toBe(1)
  })
})
