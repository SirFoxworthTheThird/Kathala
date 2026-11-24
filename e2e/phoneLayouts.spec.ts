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

    // The reader's row is one line: its buttons as icons, their names kept.
    const notesForAuthor = main.getByRole('button', { name: 'Notes for the author' })
    await expect(notesForAuthor).toBeVisible()
    // Read to a screen reader, not drawn: a screen reader's text is 1px.
    const label = main.getByText('Notes for the author', { exact: true })
    expect((await box(label)).width).toBeLessThanOrEqual(1)
    expect((await box(main.locator('[data-read-chrome]').last())).height).toBeLessThan(80)

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
    expect((await box(label)).width).toBeGreaterThan(50)
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

    // A window narrowed under it is not the binder asking for its column: Notes stays, over the page.
    await toggle.click()
    await main.getByRole('button', { name: /^Notes/ }).click()
    await expect(notes).toBeVisible()
    await page.setViewportSize({ width: 900, height: 800 })
    await expect(notes).toBeVisible()
    await page.waitForTimeout(300)
    await expect(notes).toBeVisible()
  })
})

test.describe('on the screen, at 390 and 320', () => {
  test.describe.configure({ timeout: 150_000 })
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  test('the sprint menu and Export’s six formats are all on the screen (UX-1-3, UX-2-2)', async ({ page }) => {
    const worldId = await book(page)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: PHONE.height })
      await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
      await settle(page)
      await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
      const main = page.getByRole('main')
      // The same address again is not a reload: the tools are as the last width left them.
      const tools = main.getByRole('button', { name: 'Book tools' })
      if (await tools.getAttribute('aria-expanded') !== 'true') await tools.tap()
      // The layouts under a finger are 44px, as every other control here (G10).
      for (const l of await main.getByRole('group', { name: 'Layout' }).getByRole('button').all()) {
        expect((await box(l)).height).toBeGreaterThanOrEqual(44)
      }
      await main.getByRole('button', { name: 'Sprint', exact: true }).tap()
      const chooser = page.getByRole('group', { name: 'Start a sprint' })
      await expect(chooser).toBeVisible()
      expect(await onScreen(page, chooser), `sprint menu at ${width}`).toBe(true)
      await page.keyboard.press('Escape')
      await expect(chooser).toHaveCount(0)

      await main.getByRole('button', { name: 'Export', exact: true }).tap()
      const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
      const formats = ['Markdown', 'HTML', 'Plain text', 'Word', 'EPUB', 'PDF'].map((f) => dialog.getByRole('button', { name: f, exact: true }))
      const rows = new Set<number>()
      for (const f of formats) {
        await expect(f).toBeVisible()
        expect(await onScreen(page, f), `a format at ${width}`).toBe(true)
        rows.add(Math.round((await box(f)).y))
      }
      // Two rows of three: none of them past the edge, where PDF was at 390.
      expect(rows.size).toBe(2)
      await dialog.getByRole('button', { name: 'PDF', exact: true }).tap()
      await expect(dialog.getByRole('button', { name: 'PDF', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    }
    // Where there is room, one row of six, as it always was.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
    const ys = new Set<number>()
    for (const f of ['Markdown', 'PDF']) ys.add(Math.round((await box(dialog.getByRole('button', { name: f, exact: true }))).y))
    expect(ys.size).toBe(1)
  })

  test('a roster’s heading and its actions stay on the screen, and a faction member’s name is read (UX-3-3, UX-3-2)', async ({ page }) => {
    const worldId = await book(page)
    await seed(page, [
      ['factions', { id: 'guild', worldId, name: 'The Ferry Guild', description: '', color: '#888888', coverImageId: null, tags: [] }],
      ['factionMemberships', { id: 'm1', worldId, factionId: 'guild', characterId: 'teo', role: 'Keeper of the long ledger and the tide-table', startEventId: 'e1', endEventId: null }],
    ])
    for (const width of [390, 360, 320]) {
      await page.setViewportSize({ width, height: PHONE.height })
      await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
      const main = page.getByRole('main')
      const heading = main.getByRole('heading', { name: 'Knowledge', exact: true })
      await expect(heading).toBeVisible()
      expect(await onScreen(page, heading), `Knowledge at ${width}`).toBe(true)
      expect(await onScreen(page, main.getByRole('button', { name: 'New Fact' })), `New Fact at ${width}`).toBe(true)
      // Adding one, the box and its Create are on the screen too.
      await main.getByRole('button', { name: 'New Fact' }).tap()
      expect(await onScreen(page, main.getByRole('button', { name: 'Create', exact: true })), `Create at ${width}`).toBe(true)
      await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
      await expect(main.getByRole('heading', { name: 'Items', exact: true })).toBeVisible()
      expect(await onScreen(page, main.getByRole('button', { name: 'Add Item' }).first()), `Add Item at ${width}`).toBe(true)
    }

    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
    await page.getByRole('main').getByText('The Ferry Guild', { exact: true }).first().tap()
    const remove = page.getByRole('button', { name: 'Remove Teodora Vass from the faction' })
    await expect(remove).toBeVisible()
    const row = remove.locator('xpath=..')
    const name = row.getByText('Teodora Vass', { exact: true })
    // Five of six names were 0px wide, the role and dates taking the row.
    expect((await box(name)).width).toBeGreaterThan(60)
    await expect(row.getByText(/^Keeper of the long ledger/)).toBeVisible()
    expect((await box(remove)).height).toBeGreaterThanOrEqual(44)
    await expect(row.getByRole('button', { name: 'Teodora Vass’s membership' })).toHaveAttribute('aria-expanded', 'false')
  })

  test('a thread’s strip and its warning are there on a phone, and line up down the widget where wide (UX-2-4, UX-2-11)', async ({ page }) => {
    const worldId = await book(page)
    await page.evaluate(async (id) => {
      const db = (window as unknown as { __pwdb: Db }).__pwdb
      const now = Date.now()
      for (const n of [3, 4, 5]) {
        await db.chapters.add({ id: `c${n}`, worldId: id, timelineId: 'tl', number: n, title: `Ch ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
        await db.events.add({
          id: `e${n + 1}`, worldId: id, chapterId: `c${n}`, timelineId: 'tl', title: `Scene ${n}`, description: '', sortOrder: 1,
          tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: n === 5 ? ['tide'] : [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: 'inciting', status: 'final',
          povCharacterId: null, tension: 4, isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
      await db.plotThreads.add({ id: 'ledger', worldId: id, name: 'The missing ledger', color: '#e11d48', description: '', createdAt: now, updatedAt: now })
      await db.plotThreads.add({ id: 'tide', worldId: id, name: 'The tide', color: '#0ea5e9', description: '', createdAt: now, updatedAt: now })
      await db.events.update('e1', { threadIds: ['ledger', 'tide'] })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    const strips = page.locator('[data-cadence-strip]')
    await expect(strips).toHaveCount(2)
    // Measured at 0px wide on a phone.
    expect((await box(strips.first())).width).toBeGreaterThan(250)
    // And the warning, not drawn below 1024px at all.
    const warning = page.locator('[data-cadence-warning]')
    await expect(warning).toHaveCount(1)
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('dangling')
    // A screen reader is told the cadence in words.
    await expect(page.getByText(/^In 2 of 5 chapters/)).toHaveCount(1)

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(async () => {
      const [a, b] = [await box(strips.first()), await box(strips.last())]
      // Every row's strip in the same columns, so a chapter lines up down the widget.
      expect(Math.abs(a.x - b.x)).toBeLessThan(1)
      expect(Math.abs(a.width - b.width)).toBeLessThan(1)
      expect(Math.abs(a.y - b.y)).toBeGreaterThan(20)
    }).toPass()
  })

  test('the Settings index is one row on a phone, and a jump lands below it (UX-3-13)', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    const nav = page.getByRole('navigation', { name: 'Settings sections' })
    await expect(nav).toBeVisible()
    // Measured at 169px tall, wrapped.
    expect((await box(nav)).height).toBeLessThan(60)
    const chips = nav.getByRole('link')
    // A section in the middle of the page, so there is page below it to scroll to.
    const chip = chips.nth(Math.floor((await chips.count()) / 2))
    const label = (await chip.textContent())!.trim()
    await chip.scrollIntoViewIfNeeded()
    await chip.tap()
    const heading = page.getByRole('main').getByRole('heading', { name: label, exact: true }).first()
    await expect(async () => {
      const [n, h] = [await box(nav), await box(heading)]
      expect(h.y).toBeGreaterThanOrEqual(n.y + n.height - 1)
      expect(h.y).toBeLessThan(n.y + n.height + 120)
    }).toPass()

    // Where there is room the chips wrap, every one of them in view.
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(async () => expect(await onScreen(page, chips.last())).toBe(true)).toPass()

    // Wrapped into a taller bar, a jump still lands below it: the margin is the bar's height, not a guess.
    await page.setViewportSize({ width: 700, height: 800 })
    await page.reload({ waitUntil: 'load' })
    await expect(nav).toBeVisible()
    expect((await box(nav)).height).toBeGreaterThan(80)
    await chip.click()
    await expect(async () => {
      const [n, h] = [await box(nav), await box(heading)]
      expect(h.y).toBeGreaterThanOrEqual(n.y + n.height - 1)
      expect(h.y).toBeLessThan(n.y + n.height + 120)
    }).toPass()
  })

  test('the Link and Attach lists have a filter that finds inside their groups (UX-2-13)', async ({ page }) => {
    const worldId = await book(page)
    await seed(page, [
      ['revisionTasks', { id: 'k1', worldId, text: 'Say who signed the tide-table', links: [], done: false, order: 0 }],
      ['researchItems', { id: 'tides', worldId, kind: 'link', title: 'Tide tables', note: '', url: 'https://example.org/tides', attachedTo: [], toWorld: false, order: 0 }],
    ])
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Link to…' }).first().tap()
    let filter = page.getByPlaceholder('Filter chapters, scenes and characters…')
    await expect(filter).toBeVisible()
    await filter.fill('tide')
    let list = page.getByRole('listbox')
    await expect(list.getByRole('option', { name: /The tide-table/ })).toBeVisible()
    await expect(list.getByRole('option', { name: /Teodora at the table/ })).toHaveCount(0)
    await filter.fill('teodora')
    await expect(list.getByRole('option', { name: /Teodora Vass/ })).toBeVisible()
    await expect(list.getByRole('option', { name: /The tide-table/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.goto(`/#/worlds/${worldId}/research`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Attach to… (Tide tables)' }).tap()
    filter = page.getByPlaceholder('Filter scenes, places, characters…')
    await expect(filter).toBeVisible()
    await filter.fill('assize')
    list = page.getByRole('listbox')
    await expect(list.getByRole('option', { name: /The assize rises/ })).toBeVisible()
    await expect(list.getByRole('option', { name: /Teodora Vass/ })).toHaveCount(0)
    await filter.fill('nothing like this')
    await expect(list.getByRole('option')).toHaveCount(0)
  })
})
