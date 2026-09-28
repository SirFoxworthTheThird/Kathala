import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Timeline's Page view: the book as one document to write in.
 *
 * What the document is and which edits it refuses are unit-tested against
 * CodeMirror's own state (`draftDocument`, `draftEditor`, `draftSync`). Here is
 * what needs the real page: a caret in a real editor, the save that follows
 * typing, what the page says when it refuses, Ctrl+F reaching text that is not
 * on screen, the binder, and the store changing underneath the page.
 */

/** The last scene carries enough prose that its end is far off screen. */
const FILLER = Array.from({ length: 300 }, (_, i) => `Line ${i + 1} of the tide-table, copied fair.`).join('\n\n')
const LAST_WORDS = 'the heron flew east at dawn'

async function book(page: Page, opts: { readingMode?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, filler, last, reading]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat.\n\nThe water fell.'],
      ['e2', 'c1', 'Teodora at the table', 'She counted.'],
      ['e3', 'c2', 'The tide-table', `${filler}\n\nAnd ${last}.`],
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
    if (reading) await db.worlds.update(id, { readingMode: true })
  }, [worldId, FILLER, LAST_WORDS, !!opts.readingMode] as const)
  return worldId
}

/** "title: prose" for each scene, in book order. */
const stored = (page: Page) => page.evaluate(async () => {
  type Ev = { id: string; title: string; sortOrder: number }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Ev[]> }
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
  }
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return (await db.events.toArray())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => `${e.title}: ${(texts.get(e.id) ?? '').slice(0, 60)}`)
})

async function openPage(page: Page, worldId: string, chapter = '') {
  await page.goto(`/#/worlds/${worldId}/timeline${chapter ? `/${chapter}` : ''}`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Timeline layout' }).getByRole('button', { name: 'Page', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'The book, as one page' })
  await expect(editor).toBeVisible({ timeout: 20_000 })
  return editor
}
/** A line of the document, by text it holds. */
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()

test.describe('the Page view', () => {
  test.describe.configure({ timeout: 180_000 })

  test('shows the book as one document, and typing in a scene saves to that scene', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await expect(editor).toContainText('# Low Water')
    await expect(editor).toContainText('## Teodora at the table')
    await expect(editor).toContainText('# High Water')

    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Twice.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted. Twice.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
  })

  test('renaming a heading renames the scene, and Cards shows the new name', async ({ page }) => {
    const worldId = await book(page)
    // Open at chapter 1, so Cards has its scene cards unfolded to look at afterwards.
    await openPage(page, worldId, 'c1')
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('End')
    await page.keyboard.type(', again')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table, again: She counted.')

    await page.getByRole('group', { name: 'Timeline layout' }).getByRole('button', { name: 'Cards', exact: true }).click()
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Teodora at the table, again', exact: true })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Teodora at the table', exact: true })).toHaveCount(0)
  })

  test('refuses to join a scene by Backspace, and says why; Backspace in prose still works', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    const status = page.getByRole('status').filter({ hasText: 'Use Cards for that' })
    await expect(status).toHaveCount(0)

    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('Home')
    // Once for the blank line above the heading, which is the writer's to delete; once more would join.
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await expect(page.getByRole('status')).toContainText('not joined, split or removed from the page yet')
    await expect(editor).toContainText('## Teodora at the table')

    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Backspace')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: She counted')
    expect(await stored(page)).toHaveLength(3)
    // The message goes once the writer is writing again.
    await expect(page.getByRole('status')).not.toContainText('not joined')
  })

  test('Enter on a heading goes to its prose rather than breaking the title', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, '## The assize rises').click()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Dawn. ')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The assize rises: Dawn. The court sat.\n\nThe water fell.')
  })

  test('Ctrl+F finds words in a part of the book that is not on screen', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // Not in the page at all until the editor scrolls to it — which is why the browser's find cannot see it.
    await expect(page.locator('.cm-line', { hasText: LAST_WORDS })).toHaveCount(0)
    await line(page, 'She counted.').click()
    await page.keyboard.press('Control+f')
    const find = page.getByRole('textbox', { name: 'Find' })
    await expect(find).toBeFocused()
    // Typed, not filled: the search panel reads its query as keys are released.
    await page.keyboard.type(LAST_WORDS)
    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-line', { hasText: LAST_WORDS })).toBeInViewport()
  })

  test('the binder takes the page to a scene, ready to write in', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId, 'c2')
    const tree = page.getByRole('tree', { name: 'Chapters and scenes' })
    await expect(tree).toBeVisible({ timeout: 20_000 })
    await tree.getByRole('treeitem', { name: 'The tide-table' }).click()
    await expect(line(page, '## The tide-table')).toBeInViewport()
    await page.keyboard.type('Copied: ')
    await expect.poll(() => stored(page), { timeout: 10_000 })
      .toContain(`The tide-table: ${`Copied: ${FILLER}`.slice(0, 60)}`)
  })

  test('opening a chapter in the binder brings its heading to the top of the page', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // Against the scroller, which stays put — the text box itself scrolls with the heading.
    const top = async () => {
      const [h, e] = await Promise.all([line(page, '# High Water').boundingBox(), page.locator('.cm-scroller').boundingBox()])
      return h!.y - e!.y
    }
    // Where it starts: under chapter 1's two scenes, well down the page.
    expect(await top()).toBeGreaterThan(200)
    await page.getByRole('tree', { name: 'Chapters and scenes' }).getByRole('treeitem', { name: /Ch\. 2 · High Water/ }).click()
    await expect.poll(top, { timeout: 10_000 }).toBeLessThan(80)
  })

  test('a change made elsewhere shows on the page, without losing what is being typed here', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Twice.')
    // Another tab renames the first scene and rewrites its prose, before this page has saved.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { update: (k: string, v: unknown) => Promise<unknown> }>
      await db.events.update('e1', { title: 'The assize sits' })
      await db.sceneTexts.update('t1', { text: 'Rewritten elsewhere.' })
    })
    await expect(editor).toContainText('## The assize sits')
    await expect(editor).toContainText('Rewritten elsewhere.')
    await expect(editor).toContainText('She counted. Twice.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize sits: Rewritten elsewhere.',
      'Teodora at the table: She counted. Twice.',
      `The tide-table: ${FILLER.slice(0, 60)}`,
    ])
  })

  test('leaving for Cards straight after typing still saves it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Thrice.')
    await page.getByRole('group', { name: 'Timeline layout' }).getByRole('button', { name: 'Cards', exact: true }).click()
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: She counted. Thrice.')
  })

  test('is the writer’s: a world in reading mode has Cards and no Page', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('group', { name: 'Timeline layout' })).toBeVisible({ timeout: 20_000 })

    const reading = await book(page, { readingMode: true })
    await page.goto(`/#/worlds/${reading}/timeline`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('main').getByRole('button', { name: 'Low Water', exact: false }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('group', { name: 'Timeline layout' })).toHaveCount(0)
  })

  test('works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' On a phone.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: She counted. On a phone.')
  })
})
