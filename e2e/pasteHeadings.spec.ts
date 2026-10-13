import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A drafted chapter pasted onto the Page (writer run 8): its `## ` scene
 * headings stayed text, and were counted as words. Pasted headings are now
 * made as typed ones are — each a scene, or with `# ` a chapter.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Arrival', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text: 'The road ran out at the shore.', wordCount: 7, updatedAt: now })
  }, worldId)
  return worldId
}

/** The book as the records hold it: each chapter's title, and its scenes' titles and prose, in order. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  const chapters = (await db.chapters.toArray()).sort((a, b) => (a.number as number) - (b.number as number))
  const events = (await db.events.toArray()).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
  const texts = await db.sceneTexts.toArray()
  return chapters.map((c) => [c.title, events.filter((e) => e.chapterId === c.id).map((e) => [e.title, texts.find((t) => t.eventId === e.id)?.text ?? ''])])
})

async function paste(page: Page, text: string) {
  await page.locator('.cm-content').evaluate((el, t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test.describe('headings pasted onto the Page', () => {
  test.describe.configure({ timeout: 150_000 })

  test('become scenes and a chapter, in order, and only lines that are headings do', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      'First light on the sands. #nofilter, and a ## in passing.',
      '',
      '## The archive',
      '',
      'Boxes to the ceiling.',
      '',
      '## The kiln',
      '',
      'Ash, still warm.',
      '',
      '# The Far Refuge',
      '',
      '## High water',
      '',
      'The tide came in.',
      '',
      'After.',
    ].join('\n'))

    await expect.poll(() => records(page), { timeout: 30_000 }).toEqual([
      ['The Causeway', [
        ['Arrival', 'The road ran out at the shore.\n\nFirst light on the sands. #nofilter, and a ## in passing.'],
        ['The archive', 'Boxes to the ceiling.'],
        ['The kiln', 'Ash, still warm.'],
      ]],
      ['The Far Refuge', [
        ['High water', 'The tide came in.\n\nAfter.'],
      ]],
    ])
    await expect(page.getByText('The pasted headings made 3 scenes and 1 chapter. Undo takes them back one at a time.')).toBeVisible()
    // On the page, as headings: one line each, and no `## ` left as text.
    await expect(page.locator('.cm-line', { hasText: /^## The kiln$/ })).toHaveCount(1)
    await expect(page.locator('.cm-line', { hasText: /^# The Far Refuge$/ })).toHaveCount(1)

    // And one Undo takes back one of them: the last made, the topmost.
    await page.locator('.cm-line', { hasText: 'Ash, still warm.' }).first().click()
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await records(page)).map(([chapter, scenes]) => [chapter, (scenes as string[][]).map(([title]) => title)]), { timeout: 20_000 })
      .toEqual([['The Causeway', ['Arrival', 'The kiln']], ['The Far Refuge', ['High water']]])
  })

  test('pasted into a scene card they stay text, and the card says where they would become scenes', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Arrival', exact: true }).click()
    const prose = page.getByRole('textbox', { name: 'Scene prose' }).first()
    await expect(prose).toBeVisible({ timeout: 20_000 })
    const hint = page.getByText(/lines stay text in a scene/)

    // Plain prose: nothing to say.
    await prose.click()
    await page.keyboard.press('Control+End')
    await page.evaluate((t) => navigator.clipboard.writeText(t), '\n\nFirst light. #nofilter')
    await page.keyboard.press('Control+v')
    await expect(prose).toHaveValue(/First light\. #nofilter$/)
    await expect(hint).toHaveCount(0)

    // A scene heading: kept as typed, and said.
    await page.evaluate((t) => navigator.clipboard.writeText(t), '\n\n## The archive\n\nBoxes.')
    await page.keyboard.press('Control+v')
    await expect(prose).toHaveValue(/## The archive\n\nBoxes\.$/)
    await expect(hint).toBeVisible()
  })
})
