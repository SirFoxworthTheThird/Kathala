import { test, expect, type Page, type Locator } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/*
  The phone, and the narrow laptop (ux-expert-fixes-plan.md, Part 3). Each test
  measures what the review measured, at the widths it measured them, and pairs
  the narrow case with the wide one it must not have broken.
*/

const PHONE = { width: 390, height: 664 }
const FILLER = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of the tide-table, copied fair.`).join('\n\n')

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>

/** A world of two chapters and three scenes, the last long enough to scroll. */
async function book(page: Page, name = 'The Salt Assize'): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, filler]) => {
    const db = (window as unknown as { __pwdb: Db }).__pwdb
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat.\n\nThe water fell.'],
      ['e2', 'c1', 'Teodora at the table', 'She counted.'],
      ['e3', 'c2', 'The tide-table', filler],
    ] as const
    let i = 0
    for (const [eid, cid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: 'inciting', status: 'final',
        povCharacterId: null, tension: 4, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    await db.characters.add({ id: 'teo', worldId: id, name: 'Teodora Vass', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  }, [worldId, FILLER] as const)
  return worldId
}

const seed = (page: Page, rows: Array<[string, Record<string, unknown>]>) => page.evaluate(async (rows) => {
  const db = (window as unknown as { __pwdb: Db }).__pwdb
  for (const [table, row] of rows) await db[table].add({ createdAt: Date.now(), updatedAt: Date.now(), ...row })
}, rows)

const box = async (l: Locator) => (await l.boundingBox())!

/** The reader scrolling `scroller` by `dy`, as a wheel does: the book's own scrolling is not the reader's. */
async function wheel(page: Page, scroller: Locator, dy: number) {
  const b = await box(scroller)
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 200))
  await page.mouse.wheel(0, dy)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
/** Whether the whole of `l` is inside the viewport's width. */
const onScreen = async (page: Page, l: Locator) => {
  const b = await box(l)
  return b.x >= 0 && b.x + b.width <= page.viewportSize()!.width + 0.5
}

test.describe('Read on a phone (D-5)', () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  test('the type and the readout fold into Aa, and the rows above go on a scroll down and come back on a scroll up', async ({ page }) => {
    const worldId = await book(page)
    await page.evaluate(async (id) => {
      await (window as unknown as { __pwdb: Db }).__pwdb.worlds.update(id, { readingMode: true })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    const scroller = main.locator('[data-book-scroller]')
    await expect(main.getByText('Line 1 of the tide-table, copied fair.')).toBeVisible()

    // Folded: Aa, and under it the type and how far through the book.
    const aa = main.getByRole('button', { name: 'Aa type and progress' })
    await expect(aa).toHaveAttribute('aria-expanded', 'false')
    await expect(main.getByRole('group', { name: 'How the book is set' })).toHaveCount(0)
    await expect(main.getByRole('progressbar', { name: 'Progress through the book' })).toHaveCount(0)
    await aa.tap()
    await expect(aa).toHaveAttribute('aria-expanded', 'true')
    await expect(main.getByRole('group', { name: 'How the book is set' })).toBeVisible()
    await expect(main.getByRole('progressbar', { name: 'Progress through the book' })).toBeVisible()
    await aa.tap()
    await expect(main.getByRole('group', { name: 'How the book is set' })).toHaveCount(0)

    // The book moving itself — to the reader's place, to a chapter — leaves the rows where they are.
    const chrome = main.locator('[data-read-chrome]')
    await expect(chrome.first()).toBeVisible()
    expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(1500)
    await scroller.evaluate((el) => el.scrollBy(0, 600))
    await page.waitForTimeout(300)
    await expect(chrome.first()).toBeVisible()
    const shownTop = (await box(scroller)).y

    // Reading down, the rows above go and the prose has the screen.
    for (let i = 0; i < 6; i++) await wheel(page, scroller, 120)
    await expect(chrome.first()).toBeHidden()
    await expect(chrome.last()).toBeHidden()
    const hiddenTop = (await box(scroller)).y
    // The two rows above were about 100px; the top bar is all that is left.
    expect(shownTop - hiddenTop).toBeGreaterThan(60)
    const s = await box(scroller)
    expect(s.height / PHONE.height).toBeGreaterThan(0.7)

    // A wobble on the way down does not bring them back; a scroll up does.
    await wheel(page, scroller, -10)
    await page.waitForTimeout(300)
    await expect(chrome.first()).toBeHidden()
    await wheel(page, scroller, -60)
    await expect(chrome.first()).toBeVisible()
    await expect(chrome.last()).toBeVisible()
    expect((await box(scroller)).y).toBeCloseTo(shownTop, 0)

    // Where there is room, the type and the readout are out, and nothing goes on a scroll.
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(main.getByRole('group', { name: 'How the book is set' })).toBeVisible()
    await expect(aa).toHaveCount(0)
    for (let i = 0; i < 6; i++) await wheel(page, scroller, 120)
    await page.waitForTimeout(300)
    await expect(main.getByRole('group', { name: 'How the book is set' })).toBeVisible()
  })
})

test.describe('the cramped rows', () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  test('a goal is shown whole, and the new goal’s box is wide enough to write in (UX-2-24)', async ({ page }) => {
    const worldId = await book(page)
    const text = 'To find out who signed the tide-table that drowned the ferry, and to say so in open court'
    await seed(page, [['characterGoals', { id: 'g1', worldId, characterId: 'teo', type: 'want', text, startEventId: null, endEventId: null }]])
    await page.goto(`/#/worlds/${worldId}/characters/teo`, { waitUntil: 'load' })
    await page.getByRole('tab', { name: 'Goals' }).tap()
    const goal = page.getByPlaceholder('What drives them…')
    await expect(goal).toHaveValue(text)
    // All of it shows: the box is as tall as what is in it, and more than one line.
    const fit = await goal.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }))
    expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1)
    expect((await box(goal)).height).toBeGreaterThan(40)
    // Enter keeps it on one goal: it saves, rather than starting a new line.
    await goal.tap()
    await goal.press('Control+End')
    await page.keyboard.type('.')
    await page.keyboard.press('Enter')
    await expect(goal).not.toBeFocused()
    await expect(goal).toHaveValue(`${text}.`)

    await page.getByRole('button', { name: 'Add a goal' }).tap()
    const fresh = page.getByRole('textbox').last()
    await expect(fresh).toBeFocused()
    // Measured at 94px; on its own line beside the type, it has the row.
    expect((await box(fresh)).width).toBeGreaterThan(180)
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
    expect(await onScreen(page, page.getByRole('button', { name: 'Cancel', exact: true }))).toBe(true)
  })

  test('a change’s words have the row on a phone, its buttons under them; beside them where there is room (UX-2-24)', async ({ page }) => {
    const worldId = await book(page)
    await seed(page, [['editSuggestions', {
      id: 's1', worldId, eventId: 'e2', importId: 'imp', source: 'edits.docx', kind: 'tracked',
      before: 'counted', after: 'counted twice', prefix: 'She ', suffix: '.', author: 'Ines',
    }]])
    await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Book tools' }).tap()
    await main.getByRole('button', { name: /^Changes · 1/ }).tap()
    const dialog = page.getByRole('dialog', { name: 'Changes from the editor' })
    const row = dialog.getByRole('listitem', { name: /^Tracked change: counted → counted twice/ })
    await expect(row).toBeVisible()
    const actions = row.locator('[data-change-actions]')
    const words = row.locator('p').first()
    // Measured at 125px beside the buttons.
    expect((await box(words)).width).toBeGreaterThan(280)
    expect((await box(actions)).y).toBeGreaterThan((await box(words)).y + (await box(words)).height - 1)
    // Under a finger, both are 44px.
    expect((await box(row.getByRole('button', { name: 'Accept' }))).height).toBeGreaterThanOrEqual(44)
    expect((await box(row.getByRole('button', { name: 'Reject' }))).height).toBeGreaterThanOrEqual(44)

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(async () => {
      const [a, w] = [await box(actions), await box(words)]
      expect(a.x).toBeGreaterThan(w.x + w.width - 1)
      expect(a.y).toBeLessThan(w.y + w.height)
    }).toPass()
  })
})

test.describe('Notes beside the Page at 1280 (UX-2-19)', () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the panel takes the binder’s column, and the binder’s button gives it back', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    const prose = page.locator('.cm-editor')
    await expect(prose).toBeVisible({ timeout: 20_000 })
    const binder = page.locator('#timeline-binder')
    const toggle = main.getByRole('button', { name: 'Binder' })
    await expect(binder).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const before = (await box(prose)).width

    await main.getByRole('button', { name: /^Notes/ }).click()
    const notes = page.getByRole('complementary', { name: 'Notes' })
    await expect(notes).toBeVisible()
    await expect(binder).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Measured at 364px with the binder still there; the binder's 224 are the prose's again.
    expect((await box(prose)).width).toBeGreaterThan(500)
    expect(before - (await box(prose)).width).toBeLessThan(150)

    // Closing Notes brings the binder back.
    await notes.getByRole('button', { name: 'Close notes' }).click()
    await expect(binder).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // The binder's button, with Notes in its column, closes Notes for it.
    await main.getByRole('button', { name: /^Notes/ }).click()
    await expect(binder).toHaveCount(0)
    await toggle.click()
    await expect(binder).toBeVisible()
    await expect(notes).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // A binder the writer hid stays hidden when Notes closes.
    await toggle.click()
    await expect(binder).toHaveCount(0)
    await main.getByRole('button', { name: /^Notes/ }).click()
    await notes.getByRole('button', { name: 'Close notes' }).click()
    await expect(notes).toHaveCount(0)
    await expect(binder).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
