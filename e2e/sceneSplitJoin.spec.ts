import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Splitting and joining scenes, and the scene keys in Focus mode.
 *
 * What the writes do and what one undo puts back is `sceneStructure.test.ts`,
 * against the real hooks. Here is what needs a browser: the caret the split is
 * cut at, the title line, the confirmation, the app's own Undo, and moving
 * between scenes without leaving Focus mode.
 */
async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'tv', worldId: id, name: 'Teodora Vance', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The assize rises', 'The court sat.\n\nThe water fell.', ['tv']],
      ['e2', 'Teodora at the table', 'She counted.', []],
    ] as const
    let i = 0
    for (const [eid, title, text, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** "title: prose" for each scene in the chapter, in order. */
const stored = (page: Page) => page.evaluate(async () => {
  type Ev = { id: string; title: string; sortOrder: number; chapterId: string }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Ev[]> }
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
  }
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return (await db.events.toArray())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((e) => `${e.title}: ${texts.get(e.id) ?? ''}`)
})

async function openScene(page: Page, worldId: string, title: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  await main.getByRole('button', { name: title, exact: true }).click()
  const prose = main.getByRole('textbox', { name: 'Scene prose' })
  await expect(prose).toHaveCount(1)
  return prose
}

/** Put the caret just before `marker` in the focused text box. */
const caretBefore = (page: Page, marker: string) => page.evaluate((m) => {
  const el = document.activeElement as HTMLTextAreaElement
  const at = el.value.indexOf(m)
  el.setSelectionRange(at, at)
}, marker)

test.describe('splitting and joining scenes', () => {
  test.describe.configure({ timeout: 240_000 })

  test('Ctrl+Shift+Enter splits at the caret, and one Undo puts it back', async ({ page }) => {
    const worldId = await book(page)
    const prose = await openScene(page, worldId, 'The assize rises')
    await prose.click()
    await caretBefore(page, 'The water fell.')

    await page.keyboard.press('Control+Shift+Enter')
    const title = page.getByRole('textbox', { name: 'Title for the new scene' })
    await expect(title).toBeFocused()
    await title.fill('Low tide')
    await page.keyboard.press('Enter')

    await expect.poll(() => stored(page)).toEqual([
      'The assize rises: The court sat.',
      'Low tide: The water fell.',
      'Teodora at the table: She counted.',
    ])
    // Straight into the second half, its cast carried over.
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement)?.value))
      .toBe('[\n  Characters: @@Teodora Vance\n]\n\nThe water fell.')

    // The app's Undo, outside a text box.
    await page.getByTitle(/^Undo: /).click()
    await expect.poll(() => stored(page)).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
    ])
  })

  test('Join with next scene asks, then joins; and one Undo parts them again', async ({ page }) => {
    const worldId = await book(page)
    await openScene(page, worldId, 'The assize rises')
    const main = page.getByRole('main')

    await main.getByRole('button', { name: 'More actions for “The assize rises”' }).click()
    await page.getByRole('menuitem', { name: 'Join with next scene…' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Teodora at the table')
    await dialog.getByRole('button', { name: 'Join' }).click()

    await expect.poll(() => stored(page)).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.\n\nShe counted.',
    ])
    // A join is not a loss: no "Deleted scene" notice, and Undo names the scene
    // that remains, not the one that went into it.
    await expect(page.getByTitle(/^Undo: .*The assize rises/)).toBeVisible()
    await expect(page.getByText(/Deleted scene/)).toHaveCount(0)
    await page.getByTitle(/^Undo: /).click()
    await expect.poll(() => stored(page)).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
    ])
  })

  test('the last scene of a chapter has nothing to join, and a reader has neither', async ({ page }) => {
    const worldId = await book(page)
    await openScene(page, worldId, 'Teodora at the table')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for “Teodora at the table”' }).click()
    await expect(page.getByRole('menuitem', { name: 'Move to chapter…' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Join with next scene…' })).toHaveCount(0)
    // …and the first one does.
    await page.keyboard.press('Escape')
    await main.getByRole('button', { name: 'More actions for “The assize rises”' }).click()
    await expect(page.getByRole('menuitem', { name: 'Join with next scene…' })).toBeVisible()
  })
})

test.describe('the scene keys in Focus mode', () => {
  test.describe.configure({ timeout: 240_000 })

  const focusBox = (page: Page) => page.getByPlaceholder('Write…')

  test('Ctrl+Alt+↓ goes to the next scene and stays in Focus mode, keeping what was typed', async ({ page }) => {
    const worldId = await book(page)
    await openScene(page, worldId, 'The assize rises')
    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(focusBox(page)).toBeFocused()
    await page.keyboard.type(' The gulls came.')

    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(focusBox(page)).toHaveValue('She counted.')
    await expect(focusBox(page)).toBeFocused()
    await expect.poll(() => stored(page)).toContain('The assize rises: The court sat.\n\nThe water fell. The gulls came.')
  })

  test('Ctrl+Shift+Enter in Focus mode splits there, and the second half opens in Focus mode', async ({ page }) => {
    const worldId = await book(page)
    await openScene(page, worldId, 'The assize rises')
    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(focusBox(page)).toBeFocused()
    await caretBefore(page, 'The water fell.')

    await page.keyboard.press('Control+Shift+Enter')
    const title = page.getByRole('textbox', { name: 'Title for the new scene' })
    await expect(title).toBeFocused()
    await title.fill('Low tide')
    await page.keyboard.press('Enter')

    await expect(focusBox(page)).toHaveValue('The water fell.')
    // One Focus mode, not two stacked.
    await expect(focusBox(page)).toHaveCount(1)
    await expect.poll(() => stored(page)).toEqual([
      'The assize rises: The court sat.',
      'Low tide: The water fell.',
      'Teodora at the table: She counted.',
    ])
  })

  test('Escape from the title prompt stays in Focus mode, caret where it was', async ({ page }) => {
    const worldId = await book(page)
    await openScene(page, worldId, 'The assize rises')
    await page.getByRole('button', { name: 'Focus' }).click()
    await caretBefore(page, 'water')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByRole('textbox', { name: 'Title for the new scene' })).toBeFocused()
    await page.keyboard.press('Escape')

    await expect(focusBox(page)).toBeFocused()
    expect(await focusBox(page).evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart))).toBe('water fell.')
  })
})
