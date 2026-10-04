import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Manuscript on a phone.
 *
 * Measured at 390×664 before any of this: the Page's prose began at y=329,
 * under the title, both orders, the layouts, the word count, the goal and six
 * buttons, and with the keyboard up (508px) there were 115px left to write in.
 * The first tap into the prose then opened its chapter — the page follows the
 * caret — and the chapter's panel was put *above* the prose, which moved to
 * y=3179: the line the writer tapped was gone, and their next tap landed in
 * the chapter's notes. There was no binder at all below 1024px.
 *
 * All of it is layout on a real touch screen, so all of it is here.
 */

test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true })

const FILLER = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of the tide-table, copied fair.`).join('\n\n')

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, filler]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
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
  }, [worldId, FILLER] as const)
  return worldId
}

async function open(page: Page, worldId: string, view: 'page' | 'read' | 'cards', chapter = '') {
  await page.goto(`/#/worlds/${worldId}/manuscript${chapter ? `/${chapter}` : ''}?view=${view}`, { waitUntil: 'load' })
  await settle(page)
  if (view === 'page') await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()
const top = async (page: Page, text: string) => (await line(page, text).boundingBox())!.y
const editorBox = (page: Page) => page.evaluate(() => {
  const r = document.querySelector('.cm-editor')!.getBoundingClientRect()
  return { top: r.top, visible: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) }
})

test.describe('the Manuscript on a phone', () => {
  test.describe.configure({ timeout: 120_000 })

  test('tapping into the prose leaves it where it is; the chapter waits in a sheet', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'page')
    const before = await top(page, 'She counted.')
    await line(page, 'She counted.').tap()
    // The page still follows the caret into its chapter…
    await expect(page).toHaveURL(/\/manuscript\/c1/)
    await settle(page)
    // …and the line tapped is where it was, not three thousand pixels down.
    expect(Math.abs((await top(page, 'She counted.')) - before)).toBeLessThan(4)
    const main = page.getByRole('main')
    await expect(main.getByRole('region', { name: 'Chapter 1' })).toHaveCount(0)

    // The chapter is a tap away, over the page.
    await main.getByRole('button', { name: 'Ch. 1', exact: true }).tap()
    const sheet = page.getByRole('dialog', { name: 'The open chapter' })
    await expect(sheet.getByRole('region', { name: 'Chapter 1' })).toBeVisible()
    await expect(sheet.getByLabel('Chapter title')).toHaveValue('Low Water')
    await sheet.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(sheet).toHaveCount(0)
    // Closing it closes the sheet, not the chapter.
    await expect(page).toHaveURL(/\/manuscript\/c1/)
    expect(Math.abs((await top(page, 'She counted.')) - before)).toBeLessThan(4)

    // Where there is room, the same chapter is beside the page, as it always was.
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'Chapter 1' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Ch. 1', exact: true })).toHaveCount(0)
  })

  test('Read, open at a chapter, starts with the book, the chapter in a sheet', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'read', 'c2')
    const main = page.getByRole('main')
    await expect(main.getByText('Line 1 of the tide-table, copied fair.')).toBeVisible()
    await expect(main.getByRole('region', { name: 'Chapter 2' })).toHaveCount(0)
    await main.getByRole('button', { name: 'Ch. 2', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'The open chapter' }).getByLabel('Chapter title')).toHaveValue('High Water')
  })

  test('the header is one row, with the book’s tools folded under it', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'page')
    const main = page.getByRole('main')
    // Measured at 103, and 329 before the header folded.
    expect((await editorBox(page)).top).toBeLessThan(160)
    await expect(main.getByRole('button', { name: 'Add Chapter' })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Export' })).toHaveCount(0)

    const tools = main.getByRole('button', { name: 'Book tools' })
    await tools.tap()
    await expect(tools).toHaveAttribute('aria-expanded', 'true')
    await expect(main.getByRole('button', { name: 'Add Chapter' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Export' })).toBeVisible()
    await expect(main.getByRole('group', { name: 'Timeline order' })).toBeVisible()
    await tools.tap()
    await expect(main.getByRole('button', { name: 'Add Chapter' })).toHaveCount(0)

    // Focus is in the header's row, not a row of the page's own.
    await line(page, 'She counted.').tap()
    const focus = main.getByRole('button', { name: 'Focus', exact: true })
    const [f, t] = [(await focus.boundingBox())!, (await tools.boundingBox())!]
    expect(Math.abs(f.y - t.y)).toBeLessThan(2)
    await focus.tap()
    await expect(page.getByPlaceholder('Write…')).toHaveValue(/She counted\./)
  })

  test('with the keyboard up there is still a page to write in', async ({ page }) => {
    // 508px: an iPhone 13's 664 less its keyboard. Measured at 341px of prose, and 115 before.
    await page.setViewportSize({ width: 390, height: 508 })
    const worldId = await book(page)
    await open(page, worldId, 'page', 'c1')
    expect((await editorBox(page)).visible).toBeGreaterThan(300)
  })

  test('the binder slides in, and a chapter or scene chosen there is where the page goes', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'page', 'c2')
    const main = page.getByRole('main')
    const sheet = page.getByRole('dialog', { name: 'Binder' })
    const toTheEnd = () => page.evaluate(() => { const s = document.querySelector('.cm-scroller')!; s.scrollTop = s.scrollHeight })
    await toTheEnd()
    await expect(line(page, '# Low Water')).not.toBeInViewport()
    await expect(sheet).toHaveCount(0)
    await main.getByRole('button', { name: 'Binder', exact: true }).tap()
    await expect(sheet.getByRole('tree', { name: 'Chapters and scenes' })).toBeVisible()
    await sheet.getByRole('treeitem', { name: /Low Water/ }).tap()
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/manuscript\/c1/)
    await expect(line(page, '# Low Water')).toBeInViewport()

    // A scene, from far away in the book.
    await toTheEnd()
    await expect(line(page, 'She counted.')).not.toBeInViewport()
    await main.getByRole('button', { name: 'Binder', exact: true }).tap()
    await sheet.getByRole('treeitem', { name: 'Teodora at the table' }).tap()
    await expect(sheet).toHaveCount(0)
    await expect(line(page, 'She counted.')).toBeInViewport()
  })

  test('the binder closes from its own button', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'cards')
    await page.getByRole('main').getByRole('button', { name: 'Binder', exact: true }).tap()
    const sheet = page.getByRole('dialog', { name: 'Binder' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Close the binder' }).tap()
    await expect(sheet).toHaveCount(0)
  })

  test('every control in the header is a finger wide', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'page', 'c1')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Book tools' }).tap()
    const controls = [
      main.getByRole('button', { name: 'Binder', exact: true }),
      main.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }),
      main.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Read', exact: true }),
      main.getByRole('button', { name: 'Ch. 1', exact: true }),
      main.getByRole('button', { name: 'Focus', exact: true }),
      main.getByRole('button', { name: 'Book tools' }),
      main.getByRole('group', { name: 'Timeline order' }).getByRole('button', { name: /Narrative/ }),
      main.getByRole('button', { name: 'Export' }),
      main.getByRole('button', { name: 'Add Chapter' }),
    ]
    for (const c of controls) {
      const box = (await c.boundingBox())!
      expect(Math.min(box.width, box.height), await c.textContent() ?? '').toBeGreaterThanOrEqual(44)
    }
  })

  test('the pacing chart and thread strip fold away until asked for, so the chapters come first', async ({ page }) => {
    const worldId = await book(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.plotThreads.add({ id: 'th', worldId: id, name: 'The Marrow Conspiracy', color: '#f59e0b', description: '', createdAt: now, updatedAt: now })
    }, worldId)
    await open(page, worldId, 'cards')
    const main = page.getByRole('main')
    const fold = main.getByRole('button', { name: /^Pacing and plot threads/ })
    const pacing = main.getByText('Pacing — dramatic tension')
    const strip = main.getByRole('group', { name: 'Filter by plot thread' })
    const first = main.getByRole('button', { name: /^Ch\. 1 — / })

    // Folded: the first chapter is on the first screen, under the header.
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect(pacing).toHaveCount(0)
    await expect(strip).toHaveCount(0)
    const folded = (await first.boundingBox())!.y
    expect(folded).toBeLessThan(250)

    // Unfolded, both are there, above the chapters.
    await fold.tap()
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await expect(pacing).toBeVisible()
    await expect(strip).toBeVisible()
    expect((await first.boundingBox())!.y).toBeGreaterThan(folded + 150)

    // A thread filtered on and folded away again is still said, on the button.
    await strip.getByRole('button', { name: 'The Marrow Conspiracy' }).tap()
    await fold.tap()
    await expect(fold).toHaveAccessibleName(/showing The Marrow Conspiracy/)
  })

  test('the chapter bar’s buttons are a finger wide', async ({ page }) => {
    const worldId = await book(page)
    // Enough chapters that the strip runs off the screen, so its scroll arrow is shown.
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      for (let n = 3; n <= 14; n++) {
        await db.chapters.add({ id: `x${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
        await db.events.add({
          id: `xe${n}`, worldId: id, chapterId: `x${n}`, timelineId: 'tl', title: `Scene ${n}`, description: '', sortOrder: n,
          tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
          povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
    }, worldId)
    await open(page, worldId, 'cards', 'c1')
    for (const name of ['Compare chapters', 'Clear the selected moment', 'Hide the chapter bar']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!
      expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(44)
    }
    // The two scene steppers are stacked in a 64px bar: as wide, and as tall as the stack holds.
    for (const name of ['Previous scene in this chapter', 'Next scene in this chapter']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!
      expect(box.width, name).toBeGreaterThanOrEqual(44)
      expect(box.height, name).toBeGreaterThanOrEqual(30)
    }
    const arrow = (await page.getByRole('button', { name: 'Later chapters', exact: true }).boundingBox())!
    expect(arrow.width).toBeGreaterThanOrEqual(44)
  })

  test('a scene card keeps its title, and stays inside its card', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'cards', 'c1')
    const card = page.getByRole('main').getByRole('button', { name: 'The assize rises', exact: true })
    await expect(card).toBeVisible()
    // The title had gone to nothing: the badges and icons beside it do not shrink.
    expect((await card.boundingBox())!.width).toBeGreaterThan(150)
    const spill = await page.evaluate(() => {
      const title = [...document.querySelectorAll('main button')].find((b) => b.textContent === 'The assize rises')!
      let el: Element | null = title
      while (el && !el.classList.contains('@container')) el = el.parentElement
      const edge = el!.getBoundingClientRect().right
      return [...el!.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().right > edge + 1).map((b) => b.getAttribute('aria-label') ?? b.textContent)
    })
    expect(spill).toEqual([])
  })
})

test.describe('the same, with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false })

  test('the chapter bar keeps its smaller buttons, and the pacing chart is shown without a fold', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId, 'cards', 'c1')
    const main = page.getByRole('main')
    await expect(main.getByText('Pacing — dramatic tension')).toBeVisible()
    await expect(main.getByRole('button', { name: /^Pacing and plot threads/ })).toHaveCount(0)
    for (const name of ['Hide the chapter bar', 'Previous scene in this chapter']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!
      expect(box.width, name).toBeGreaterThanOrEqual(24)
      expect(box.width, name).toBeLessThan(44)
    }
  })
})
