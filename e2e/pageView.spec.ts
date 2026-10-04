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

/** "Chapter: scene, scene" for each chapter, in book order. */
const outline = (page: Page) => page.evaluate(async () => {
  type Ch = { id: string; title: string; number: number }
  type Ev = { id: string; chapterId: string; title: string; sortOrder: number }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    chapters: { toArray: () => Promise<Ch[]> }
    events: { toArray: () => Promise<Ev[]> }
  }
  const events = await db.events.toArray()
  return (await db.chapters.toArray())
    .sort((a, b) => a.number - b.number)
    .map((c) => `${c.title}: ${events.filter((e) => e.chapterId === c.id).sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.title).join(', ')}`)
})
const BOOK = ['Low Water: The assize rises, Teodora at the table', 'High Water: The tide-table']

async function openPage(page: Page, worldId: string, chapter = '') {
  await page.goto(`/#/worlds/${worldId}/manuscript${chapter ? `/${chapter}` : ''}`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
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

    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click()
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Teodora at the table, again', exact: true })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Teodora at the table', exact: true })).toHaveCount(0)
  })

  test('refuses part of a heading, and says how to join; Backspace in prose still works', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    const status = page.getByRole('status').filter({ hasText: 'delete its entire line' })
    await expect(status).toHaveCount(0)

    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('Home')
    // Once for the blank line above the heading, which is the writer's to delete; once more is the heading's own.
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await expect(status).toHaveCount(1)
    await expect(editor).toContainText('## Teodora at the table')

    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Backspace')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: She counted')
    expect(await stored(page)).toHaveLength(3)
    // The message goes once the writer is writing again.
    await expect(status).toHaveCount(0)
  })

  test('a scene heading typed into a scene splits it once the caret leaves the line, and typing goes on in the new scene', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    // Still on the line: it is being typed, not made. The autosave has saved it as prose.
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The assize rises: The court sat.\n## The gate\n\nThe water fell.')
    expect(await stored(page)).toHaveLength(3)

    await page.keyboard.press('Enter')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.',
      'The gate: The water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
    await expect(line(page, '## The gate')).toHaveClass(/cm-draft-scene/)
    await page.keyboard.type('Open. ')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The gate: Open. The water fell.')
    await expect(editor).toContainText('## The gate')
  })

  test('Ctrl+Z straight after a split takes it back, and Ctrl+Shift+Z puts it back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    await page.keyboard.press('Enter')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toHaveLength(4)
    await expect(line(page, '## The gate')).toHaveClass(/cm-draft-scene/)

    await page.keyboard.press('Control+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
    await expect(page.locator('.cm-line', { hasText: '## The gate' })).toHaveCount(0)

    await page.keyboard.press('Control+Shift+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toHaveLength(4)
    await expect(line(page, '## The gate')).toHaveClass(/cm-draft-scene/)
  })

  test('typing straight on after a split, with no pause, is all kept in the new scene', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    // Enter and the first words in one burst, while the split is still being written.
    await page.keyboard.press('Enter')
    await page.keyboard.type('Open. ')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.',
      'The gate: Open. The water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
  })

  test('typing on after a split and leaving for Cards at once still saves the typing', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    // Enter, a word, and away — all while the split is being written.
    await page.keyboard.press('Enter')
    await page.keyboard.type('Open. ')
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click()
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The gate: Open. The water fell.')
  })

  test('Ctrl+Z pressed while a split is still being written waits for it, then takes it back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
    // And stays taken back: nothing half-written comes after it.
    await page.waitForTimeout(1500)
    expect(await stored(page)).toHaveLength(3)
  })

  test('Ctrl+Z takes back the typing since a split, and then the split', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## The gate')
    await page.keyboard.press('Enter')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toHaveLength(4)
    await page.keyboard.type('Open. ')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The gate: Open. The water fell.')

    // The typing first, word by word as the editor groups it, until there is none left.
    for (let i = 0; i < 5 && (await stored(page)).includes('The gate: Open. The water fell.'); i++) {
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(1500)
    }
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The gate: The water fell.')
    expect(await stored(page)).toHaveLength(4)
    // Then the split.
    await page.keyboard.press('Control+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
  })

  test('a heading typed and left by clicking away splits too', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## After dark')
    // Out of the page altogether: the book's word goal, in the header.
    await page.getByLabel('Word goal for the book').click()
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('After dark: ')
    expect(await stored(page)).toHaveLength(4)
  })

  test('deleting a scene heading’s whole line joins it to the scene before, and Ctrl+Z parts them again', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.\n\nShe counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
    await expect(editor).not.toContainText('Teodora at the table')
    await expect(page.getByRole('status')).toHaveText('')

    await page.keyboard.press('Control+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
    await expect(line(page, '## Teodora at the table')).toHaveClass(/cm-draft-scene/)
  })

  test('words typed just before a join are kept, in the scene they were typed in, when the join is undone', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Twice.')
    // Straight on, inside the autosave's second: the typing is not saved yet.
    await line(page, '## Teodora at the table').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    // The whole join, not just the scene gone: it removes the scene before it writes the prose.
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.\n\nShe counted. Twice.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])

    await page.keyboard.press('Control+z')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.\n\nThe water fell.',
      'Teodora at the table: She counted. Twice.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ])
  })

  test('the first scene of a chapter has nothing before it to join, and the page says so', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, '## The assize rises').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect(page.getByRole('status')).toContainText('first scene of its chapter')
    await expect(editor).toContainText('## The assize rises')
    expect(await stored(page)).toHaveLength(3)
  })

  test('# and a title typed between scenes starts a chapter holding the scenes after it, and Ctrl+Z takes it back', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, 'The water fell.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# Slack Water')
    await page.keyboard.press('Enter')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual([
      'Low Water: The assize rises', 'Slack Water: Teodora at the table', 'High Water: The tide-table',
    ])
    await expect(line(page, '# Slack Water')).toHaveClass(/cm-draft-chapter/)
    await expect(editor).toContainText('## Teodora at the table')

    await page.keyboard.press('Control+z')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual(BOOK)
    await expect(page.locator('.cm-line', { hasText: '# Slack Water' })).toHaveCount(0)
  })

  test('# and a title typed inside a scene: the rest of the scene goes on in the new chapter, under the same title', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# Slack Water')
    await page.keyboard.press('Enter')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual([
      'Low Water: The assize rises', 'Slack Water: The assize rises, Teodora at the table', 'High Water: The tide-table',
    ])
    // Straight on, in the scene that goes on.
    await page.keyboard.type('Still, ')
    // Sorted: scenes in two chapters share position numbers, so their order is not the book's.
    await expect.poll(async () => (await stored(page)).sort(), { timeout: 10_000 }).toEqual([
      'The assize rises: The court sat.',
      'The assize rises: Still, The water fell.',
      'Teodora at the table: She counted.',
      `The tide-table: ${`${FILLER}`.slice(0, 60)}`,
    ].sort())
  })

  test('deleting a chapter heading’s whole line joins it to the chapter before, and Ctrl+Z parts them again', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, '# High Water').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual([
      'Low Water: The assize rises, Teodora at the table, The tide-table',
    ])
    await expect(editor).not.toContainText('# High Water')

    await page.keyboard.press('Control+z')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual(BOOK)
    await expect(line(page, '# High Water')).toHaveClass(/cm-draft-chapter/)
  })

  test('the first chapter has nothing before it to join, and the page says so', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await line(page, '# Low Water').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect(page.getByRole('status')).toContainText('first chapter')
    await expect(editor).toContainText('# Low Water')
    expect(await outline(page)).toEqual(BOOK)
  })

  test('a chapter started at the end of the book, and its first scene typed under it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // The end of the book is far off screen, and the page draws only what is on it.
    await line(page, 'The court sat.').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# Coda')
    await page.keyboard.press('Enter')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual([...BOOK, 'Coda: '])
    // Prose has no place under a chapter heading, and the page says what does.
    await page.keyboard.type('H')
    await expect(page.getByRole('status')).toContainText('only a heading can go')
    // A mark that never became a heading is taken away when it is left, with the same reason.
    await page.keyboard.type('#')
    await expect(page.locator('.cm-line').filter({ hasText: /^#$/ })).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-line').filter({ hasText: /^#$/ })).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText('only a heading can go')
    await page.keyboard.type('## After')
    await page.keyboard.press('Enter')
    await expect.poll(() => outline(page), { timeout: 10_000 }).toEqual([...BOOK, 'Coda: After'])
    await page.keyboard.type('Quiet.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('After: Quiet.')
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
    // Opened at chapter 2, the scene is on screen before the click: what says the page took it is the caret.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()
    await page.keyboard.type('Copied: ')
    await expect.poll(() => stored(page), { timeout: 10_000 })
      .toContain(`The tide-table: ${`Copied: ${FILLER}`.slice(0, 60)}`)
  })

  test('the chapter open beside the page follows the caret into another chapter, and the caret stays where it is', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId, 'c1')
    const one = page.getByRole('region', { name: 'Chapter 1' })
    const two = page.getByRole('region', { name: 'Chapter 2' })
    await expect(one).toBeVisible({ timeout: 20_000 })
    await line(page, 'She counted.').click()
    // Down into the next chapter by the scene key, as a writer going on would.
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(two).toBeVisible()
    await expect(one).toHaveCount(0)
    await expect(page).toHaveURL(/\/manuscript\/c2/)
    // The time cursor is the scene the caret went into, not the chapter's first by default.
    await expect(page.getByRole('banner')).toContainText('The tide-table')
    // And the caret was not moved by the chapter opening: typing lands where it went.
    await page.keyboard.type('Copied: ')
    await expect.poll(() => stored(page), { timeout: 10_000 })
      .toContain(`The tide-table: ${`Copied: ${FILLER}`.slice(0, 60)}`)
    // Back up by the key, into the first chapter's second scene: its panel comes back, and the cursor is that scene.
    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect(one).toBeVisible()
    await expect(two).toHaveCount(0)
    await expect(page.getByRole('banner')).toContainText('Teodora at the table')
  })

  test('within a chapter, the time cursor follows the caret from scene to scene, once on the way in', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId, 'c1')
    const bar = page.getByRole('banner')
    await line(page, 'She counted.').click()
    await expect(bar).toContainText('Teodora at the table')
    // A click into the scene before, in the same chapter: the cursor goes with it.
    await line(page, 'The court sat.').click()
    await expect(bar).toContainText('The assize rises')
    await expect(bar).not.toContainText('Teodora at the table')
    // Moved on deliberately from the top bar, it is not pulled back by typing on in the scene the caret is still in…
    await page.getByRole('button', { name: 'Next moment' }).click()
    await expect(bar).toContainText('Teodora at the table')
    await line(page, 'The court sat.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Again.')
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('The assize rises: The court sat. Again.\n\nThe water fell.')
    await expect(bar).toContainText('Teodora at the table')
    // …and going into another scene takes it there.
    await line(page, 'She counted.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect(bar).toContainText('The assize rises')
  })

  test('the chapter beside the page follows the caret from scene to scene, not only chapter to chapter', async ({ page }) => {
    const worldId = await book(page)
    // A crowd in the first scene, so the second one's Character States start below the panel's fold.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }>
      const now = Date.now()
      const crowd: string[] = []
      for (let i = 1; i <= 16; i++) {
        const cid = `ch${i}`
        crowd.push(cid)
        await db.characters.add({ id: cid, worldId: id, name: `Juror ${i}`, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now })
      }
      await db.events.update('e1', { involvedCharacterIds: crowd })
      await db.events.update('e2', { involvedCharacterIds: ['ch1'] })
    }, worldId)
    await openPage(page, worldId, 'c1')
    const panel = page.getByRole('complementary', { name: 'The open chapter' })
    const section = (id: string) => panel.locator(`[data-scene-section="${id}"]`)
    await expect(panel.getByRole('region', { name: 'Chapter 1' })).toBeVisible({ timeout: 20_000 })

    await line(page, 'The court sat.').click()
    await expect(section('e1')).toHaveAttribute('aria-current', 'true')
    await expect(section('e2')).not.toHaveAttribute('aria-current', 'true')
    const scene = panel.getByRole('region', { name: 'This scene' })
    await expect(scene.getByRole('heading')).toHaveText('The assize rises')

    // Into the next scene, in the same chapter: the panel marks it, and its details lead the panel.
    // Scrolled away first, so bringing them back is something the panel had to do.
    await panel.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await expect(scene).not.toBeInViewport()
    await line(page, 'She counted.').click()
    await expect(section('e2')).toHaveAttribute('aria-current', 'true')
    await expect(section('e1')).not.toHaveAttribute('aria-current', 'true')
    await expect(scene.getByRole('heading')).toHaveText('Teodora at the table')
    await expect(scene).toBeInViewport()

    // A scene nobody is in yet still has its place in the panel while it is the one being written.
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(section('e3')).toHaveAttribute('aria-current', 'true')
    await expect(section('e3')).toContainText('No one in this scene yet')

    // On Cards there are no details leading the panel — the scene's card holds them — so there the
    // Character States are what follow: moved to a scene below the fold, they come into view.
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await expect(section('e1')).toHaveAttribute('aria-current', 'true', { timeout: 20_000 })
    await expect(scene).toHaveCount(0)
    await expect(section('e2')).not.toBeInViewport()
    const main = page.getByRole('main')
    const title = main.getByRole('button', { name: 'Teodora at the table', exact: true })
    await title.click()
    await title.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]').getByRole('button', { name: 'View from here' }).click()
    await expect(section('e2')).toHaveAttribute('aria-current', 'true')
    await expect(section('e2')).toBeInViewport()
  })

  test('a writer’s Manuscript opens on the Page until another layout is chosen', async ({ page }) => {
    const worldId = await book(page)
    const layouts = page.getByRole('group', { name: 'Layout', exact: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await expect(layouts.getByRole('button', { name: 'Page', exact: true })).toHaveAttribute('aria-pressed', 'true')

    // A choice of Cards is the writer's, and outlasts a reload.
    await layouts.getByRole('button', { name: 'Cards', exact: true }).click()
    await page.reload({ waitUntil: 'load' })
    await expect(layouts.getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toHaveCount(0)
  })

  test('a book with no chapters yet has no page to open on, and shows its cards', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('An Empty Ledger')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    const main = page.getByRole('main')
    await expect(main.getByRole('tabpanel').getByText('No chapters yet', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toHaveCount(0)
  })

  test('opened at the whole book, the page opens no chapter until the writer goes into one', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const one = page.getByRole('region', { name: 'Chapter 1' })
    await page.waitForTimeout(800)
    await expect(one).toHaveCount(0)
    // Nor when the page is rebuilt under the caret by a change made elsewhere: that is not the writer going anywhere.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { add: (v: unknown) => Promise<unknown> } }
      const now = Date.now()
      await db.events.add({
        id: 'e4', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'A scene from elsewhere', description: '', sortOrder: 9,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }, worldId)
    // The page has it: it was rebuilt.
    await expect(page.locator('.cm-line', { hasText: '## A scene from elsewhere' })).toHaveCount(1)
    await page.waitForTimeout(500)
    await expect(one).toHaveCount(0)
    await line(page, 'She counted.').click()
    await expect(one).toBeVisible()
    // Closed from the binder, it opens again when the writer goes back into it.
    await page.getByRole('button', { name: 'Whole book' }).click()
    await expect(one).toHaveCount(0)
    await line(page, 'The court sat.').click()
    await expect(one).toBeVisible()
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
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click()
    await expect.poll(() => stored(page), { timeout: 10_000 }).toContain('Teodora at the table: She counted. Thrice.')
  })

  test('is the writer’s: a world in reading mode has Cards and Read, and no Page', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Layout', exact: true })
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await expect(group.getByRole('button', { name: 'Page', exact: true })).toBeVisible({ timeout: 20_000 })

    const reading = await book(page, { readingMode: true })
    await page.goto(`/#/worlds/${reading}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    // The reader's layouts are there — so the missing Page is missing, not unloaded.
    await expect(group.getByRole('button', { name: 'Read', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(group.getByRole('button', { name: 'Page', exact: true })).toHaveCount(0)
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
