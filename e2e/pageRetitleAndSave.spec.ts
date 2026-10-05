import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Three findings from a blind writer run, on the Manuscript's Page.
 *
 * - **W-1.** Selecting a heading's line (End, Shift+Home) and typing a new one
 *   deleted the chapter: its scenes went into the chapter before and the typed
 *   title was saved as prose there, with nothing said. On the first chapter the
 *   typing was refused with a reason about joining. Typing over the line is now
 *   a retitle; the rules are unit-tested in `draftEditor.test.ts`, and this is
 *   the real keyboard, the real page and the records it writes.
 * - **W-3.** The last second of typing was lost on a reload: the page saves on
 *   a one-second timer and only flushed when it unmounted inside the app.
 * - **W-6.** A notice beside the key hints was squeezed to a 50px column.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Low Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    const chapters = [['c1', 1, 'The Quay'], ['c2', 2, 'The Second']] as const
    for (const [cid, n, title] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'Opening', 'The boats came in.'],
      ['e2', 'c1', 'Rain', 'It rained all evening.'],
      ['e3', 'c2', 'Morning', 'The tide was out.'],
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
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: text.split(' ').length, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** Chapters by number, scenes by chapter, and each scene's prose. */
const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    chapters: { toArray: () => Promise<Array<{ id: string; number: number; title: string }>> }
    events: { toArray: () => Promise<Array<{ id: string; chapterId: string; title: string }>> }
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
  }
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return {
    chapters: (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => c.title),
    scenes: Object.fromEntries((await db.events.toArray()).map((e) => [e.title, { chapter: e.chapterId, text: texts.get(e.id) ?? '' }])),
  }
})

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()

/** End, Shift+Home on a heading's line — what selecting a line to retype it is — then type, and leave it. */
async function retypeLine(page: Page, text: string, typed: string) {
  await line(page, text).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Home')
  await page.keyboard.type(typed)
  await page.keyboard.press('ArrowDown')
}

test.describe('the Page, from a writer’s run', () => {
  test.describe.configure({ timeout: 150_000 })

  test('W-1: a heading’s line typed over is a new title, on any chapter or scene', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)

    await retypeLine(page, '# The Second', '# Low Water and Sleet')
    await retypeLine(page, '# The Quay', '# Landfall')
    await retypeLine(page, '## Rain', '## Sleet')

    await expect.poll(() => stored(page), { timeout: 20_000 }).toEqual({
      // Both chapters still there, renamed — the second used to be deleted, the first refused.
      chapters: ['Landfall', 'Low Water and Sleet'],
      scenes: {
        Opening: { chapter: 'c1', text: 'The boats came in.' },
        // Renamed, and no typed title saved into the prose of the scene before.
        Sleet: { chapter: 'c1', text: 'It rained all evening.' },
        Morning: { chapter: 'c2', text: 'The tide was out.' },
      },
    })
    await expect(page.getByRole('status').filter({ hasText: /join|first chapter/i })).toHaveCount(0)

    // Paired: the same line deleted with nothing typed still joins, as the guide says.
    await line(page, '## Sleet').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect.poll(async () => Object.keys((await stored(page)).scenes).sort(), { timeout: 20_000 })
      .toEqual(['Morning', 'Opening'])
  })

  test('W-3: the last second of typing survives a reload, and the page says when it is written', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const state = page.locator('[data-save-state]')
    await expect(state).toHaveText('Saved')

    await line(page, 'The tide was out.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' The gulls waited.')
    // Said while it is only on screen…
    await expect(state).toHaveText('Saving…')
    // …and the page reloaded well inside the one-second timer.
    await page.waitForTimeout(150)
    await page.reload({ waitUntil: 'load' })

    await expect.poll(async () => (await stored(page)).scenes.Morning.text, { timeout: 20_000 })
      .toBe('The tide was out. The gulls waited.')

    // And said once it is written.
    await openPage(page, worldId)
    await line(page, 'The gulls waited.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Then they left.')
    await expect(state).toHaveText('Saved', { timeout: 10_000 })
    expect((await stored(page)).scenes.Morning.text).toBe('The tide was out. The gulls waited. Then they left.')
  })

  test('W-3: and a tab closed straight after typing', async ({ page, context }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The tide was out.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' The gulls waited.')
    await page.waitForTimeout(300)
    await page.close({ runBeforeUnload: true })

    // The next time the app is opened, in the same browser.
    const next = await context.newPage()
    await next.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await expect.poll(async () => (await stored(next)).scenes.Morning.text, { timeout: 20_000 })
      .toBe('The tide was out. The gulls waited.')
  })

  test('W-6: a notice has the row to itself, not a column beside the key hints', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const worldId = await book(page)
    await openPage(page, worldId)
    const hints = page.getByText('@ names someone · @@ says who is here')
    // The hints are there while there is nothing to say…
    await expect(hints).toBeVisible()

    // Backspace at the start of the book's first scene title: refused, and said.
    const title = line(page, '## Opening')
    await title.click()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Backspace')
    const notice = page.getByRole('status').filter({ hasText: /\S/ }).first()
    await expect(notice).toBeVisible({ timeout: 10_000 })
    // …and make way for it, which leaves it most of the row instead of 50px.
    await expect(hints).toBeHidden()
    const width = await notice.evaluate((el) => el.getBoundingClientRect().width)
    expect(width, `the notice is ${width}px wide`).toBeGreaterThan(400)
  })
})
