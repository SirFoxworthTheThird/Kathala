import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene keys and Focus mode on the Page, as a scene card's draft has them.
 *
 * Which scene a key goes to, where the line it opens goes, and when that line
 * is taken away again are unit-tested against CodeMirror's own state
 * (`draftEditor`). Here is the real page: the keys pressed in a real editor,
 * the scene the typed heading makes, and Focus mode opened from the page and
 * written back into it.
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
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat.\n\nThe water fell.'],
      ['e2', 'c1', 'Teodora at the table', 'She counted.'],
      ['e3', 'c2', 'The tide-table', 'The heron flew east.'],
    ] as const
    let i = 0
    for (const [eid, cid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** "title: prose" for each scene, in book order. */
const stored = (page: Page) => page.evaluate(async () => {
  type Ch = { id: string; number: number }
  type Ev = { id: string; chapterId: string; title: string; sortOrder: number }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    chapters: { toArray: () => Promise<Ch[]> }
    events: { toArray: () => Promise<Ev[]> }
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
  }
  const number = new Map((await db.chapters.toArray()).map((c) => [c.id, c.number]))
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return (await db.events.toArray())
    .sort((a, b) => number.get(a.chapterId)! - number.get(b.chapterId)! || a.sortOrder - b.sortOrder)
    .map((e) => `${e.title}: ${texts.get(e.id) ?? ''}`)
})

const BOOK = [
  'The assize rises: The court sat.\n\nThe water fell.',
  'Teodora at the table: She counted.',
  'The tide-table: The heron flew east.',
]

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'The book, as one page' })
  await expect(editor).toBeVisible({ timeout: 20_000 })
  return editor
}
/** A line of the document, by text it holds. */
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()
/** The caret at the end of the line holding `text`. */
async function caretAfter(page: Page, text: string) {
  await line(page, text).click()
  await page.keyboard.press('End')
}

test.describe('the scene keys and Focus mode on the Page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('Ctrl+Alt+↓ and ↑ go from scene to scene, across a chapter, and stop at the end of the book', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await caretAfter(page, 'The court sat.')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await page.keyboard.type('A. ')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await page.keyboard.type('B. ')
    // The last scene: nowhere further to go, so the caret stays in it.
    await page.keyboard.press('Control+Alt+ArrowDown')
    await page.keyboard.type('C. ')
    await page.keyboard.press('Control+Alt+ArrowUp')
    await page.keyboard.press('Control+Alt+ArrowUp')
    await page.keyboard.type('D. ')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: D. The court sat.\n\nThe water fell.',
      'Teodora at the table: A. She counted.',
      'The tide-table: B. C. The heron flew east.',
    ])
  })

  test('Ctrl+Enter opens the line for a new scene after this one, and the title typed there makes it', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await caretAfter(page, 'The court sat.')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.type('The ledger')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Figures.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      BOOK[0],
      'The ledger: Figures.',
      BOOK[1],
      BOOK[2],
    ])
    await expect(editor).toContainText('## The ledger')
  })

  test('Ctrl+Shift+Enter splits the scene at the caret', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The water fell.').click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Control+Shift+Enter')
    await page.keyboard.type('Low tide')
    await page.keyboard.press('Enter')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.',
      'Low tide: The water fell.',
      BOOK[1],
      BOOK[2],
    ])
  })

  test('a line a key opened and the writer left untitled goes, and nothing of it is saved', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const bare = page.locator('.cm-line').filter({ hasText: /^##\s*$/ })
    await caretAfter(page, 'She counted.')
    await page.keyboard.press('Control+Enter')
    // It is there while the caret is on it…
    await expect(bare).toHaveCount(1)
    // …and gone once the writer goes elsewhere without naming it.
    await caretAfter(page, 'The court sat.')
    await expect(bare).toHaveCount(0)
    await page.keyboard.type(' Then.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat. Then.\n\nThe water fell.',
      BOOK[1],
      BOOK[2],
    ])
  })

  test('Focus opens the scene the caret is in, with what was just typed, and writes back into the page', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await caretAfter(page, 'She counted.')
    // Straight to Focus mode, before the page's own save has had its second.
    await page.keyboard.type(' Twice.')
    await page.getByRole('button', { name: 'Focus', exact: true }).click()
    const surface = page.getByPlaceholder('Write…')
    await expect(surface).toHaveValue('She counted. Twice.')
    await expect(page.getByText('Teodora at the table', { exact: true }).last()).toBeVisible()
    await surface.press('End')
    await page.keyboard.type(' Thrice.')
    await page.keyboard.press('Escape')
    await expect(surface).toHaveCount(0)
    await expect(editor).toContainText('She counted. Twice. Thrice.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      BOOK[0],
      'Teodora at the table: She counted. Twice. Thrice.',
      BOOK[2],
    ])
    // Back in the page, in the scene Focus mode had.
    await page.keyboard.type('Z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: ZShe counted. Twice. Thrice.')
  })

  test('in Focus mode the scene keys go on through the page’s scenes, and make new ones', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await caretAfter(page, 'The court sat.')
    await page.getByRole('button', { name: 'Focus', exact: true }).click()
    const surface = page.getByPlaceholder('Write…')
    await expect(surface).toHaveValue('The court sat.\n\nThe water fell.')
    await surface.focus()
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(surface).toHaveValue('She counted.')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(surface).toHaveValue('The heron flew east.')

    await surface.press('End')
    await page.keyboard.press('Control+Enter')
    await page.getByLabel('Title for the new scene').fill('Coda')
    await page.keyboard.press('Enter')
    await expect(surface).toHaveValue('')
    await surface.focus()
    await page.keyboard.type('Fin.')
    await page.keyboard.press('Escape')
    await expect(surface).toHaveCount(0)
    await expect(editor).toContainText('## Coda')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([...BOOK, 'Coda: Fin.'])
  })
})
