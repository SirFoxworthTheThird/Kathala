import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Moving between scenes without leaving the draft.
 *
 * The binder is keyboard-driven, but a writer is not in the binder — they are
 * in a scene's prose, and the next scene was a trip to the mouse. Ctrl+Alt+↓/↑
 * goes to the next or previous scene and puts the caret in its prose; Ctrl+Enter
 * starts a new scene after this one. Everything here is focus, caret and keys,
 * which is why it is driven in a browser; which scene is next, and which key is
 * which, are unit-tested in `sceneStep.test.ts`.
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
    for (const [cid, n, t] of [['c1', 1, 'Low Water'], ['c2', 2, 'The Stair']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'First.', []],
      ['e2', 'c1', 'Teodora at the table', 'Second.', []],
      // A cast, so its draft opens with the bracket line above the prose.
      ['e3', 'c2', 'What the stair kept', 'Third.', ['tv']],
    ] as const
    let i = 0
    for (const [eid, cid, title, text, cast] of scenes) {
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: ++i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 1, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** Open a chapter, open one scene's card, and put the caret in its prose. */
async function writeIn(page: Page, worldId: string, chapterId: string, title: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/${chapterId}`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  await main.getByRole('button', { name: title, exact: true }).click()
  const prose = main.getByRole('textbox', { name: 'Scene prose' })
  await expect(prose).toHaveCount(1)
  await prose.click()
  return prose
}

/** The text box with focus: what it holds and where its caret is. */
const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null
  return el && 'value' in el
    ? { label: el.getAttribute('aria-label'), value: el.value, caret: el.selectionStart }
    : null
})

const cursor = (page: Page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null } catch { return null }
})

const prose = (page: Page) => page.getByRole('main').getByRole('textbox', { name: 'Scene prose' })

test.describe('scene keys in the draft', () => {
  test.describe.configure({ timeout: 240_000 })

  test('Ctrl+Alt+↓ goes to the next scene, saving and closing the one left', async ({ page }) => {
    const worldId = await book(page)
    const first = await writeIn(page, worldId, 'c1', 'The assize rises')
    await first.press('End')
    await page.keyboard.type(' More.')

    await page.keyboard.press('Control+Alt+ArrowDown')

    // In the next scene's prose, at its top, with the cursor there too…
    await expect.poll(() => focused(page)).toEqual({ label: 'Scene prose', value: 'Second.', caret: 0 })
    await expect.poll(() => cursor(page)).toBe('e2')
    // …the scene left behind closed, so one draft is open…
    await expect(prose(page)).toHaveCount(1)
    // …and what was typed in it kept.
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { sceneTexts: { where: (k: string) => { equals: (v: string) => { first: () => Promise<{ text: string } | undefined> } } } }
      return (await db.sceneTexts.where('eventId').equals('e1').first())?.text
    }), { timeout: 15_000 }).toBe('First. More.')
  })

  test('leaving by key applies a bracket line still being typed', async ({ page }) => {
    /*
      The line says who is in the scene, and it is applied when the writer
      moves off it — on blur. Leaving by key closes the card under the text
      box, and closing flushes the prose but not the line, so the key blurs
      first. Typed and left at once, with the caret still in the line.
    */
    const worldId = await book(page)
    const first = await writeIn(page, worldId, 'c1', 'The assize rises')
    await first.press('Control+Home')
    await page.keyboard.type('[@@Teodora Vance]\n\n')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')   // back in the line

    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect.poll(() => focused(page)).toMatchObject({ value: 'Second.' })
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { get: (id: string) => Promise<{ involvedCharacterIds: string[] } | undefined> } }
      return (await db.events.get('e1'))?.involvedCharacterIds
    }), { timeout: 15_000 }).toEqual(['tv'])
  })

  test('it crosses chapters: after the bracket line going on, at the end going back', async ({ page }) => {
    const worldId = await book(page)
    await writeIn(page, worldId, 'c1', 'Teodora at the table')

    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(page).toHaveURL(/\/manuscript\/c2$/)
    await expect.poll(() => focused(page)).toMatchObject({ label: 'Scene prose' })
    const there = (await focused(page))!
    expect(there.value.startsWith('[@@Teodora Vance]'), there.value).toBe(true)
    expect(there.value.slice(there.caret!)).toBe('Third.')

    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect(page).toHaveURL(/\/manuscript\/c1$/)
    await expect.poll(() => focused(page)).toEqual({ label: 'Scene prose', value: 'Second.', caret: 'Second.'.length })
  })

  test('at the end of the book the key goes nowhere, and leaves you where you were', async ({ page }) => {
    const worldId = await book(page)
    const last = await writeIn(page, worldId, 'c2', 'What the stair kept')
    await last.press('End')
    const before = (await focused(page))!

    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(page).toHaveURL(/\/manuscript\/c2$/)
    await expect(prose(page)).toHaveCount(1)
    expect(await focused(page)).toEqual(before)

    // Presence, from the same place: the other way does go.
    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect(page).toHaveURL(/\/manuscript\/c1$/)
  })

  test('Ctrl+Enter titles a new scene after this one and puts you in it', async ({ page }) => {
    const worldId = await book(page)
    await writeIn(page, worldId, 'c1', 'The assize rises')

    await page.keyboard.press('Control+Enter')
    const title = page.getByRole('textbox', { name: 'Title for the new scene' })
    await expect(title).toBeFocused()
    await title.fill('The clerk’s ledger')
    await page.keyboard.press('Enter')

    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ title: string; sortOrder: number }>> } } } }
      const rows = await db.events.where('chapterId').equals('c1').toArray()
      return rows.sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.title)
    }), { timeout: 15_000 }).toEqual(['The assize rises', 'The clerk’s ledger', 'Teodora at the table'])
    // Straight into its empty draft.
    await expect.poll(() => focused(page)).toEqual({ label: 'Scene prose', value: '', caret: 0 })
  })

  test('Escape from the new title hands you back your place', async ({ page }) => {
    const worldId = await book(page)
    const first = await writeIn(page, worldId, 'c1', 'The assize rises')
    await first.press('End')
    await first.press('ArrowLeft')   // somewhere that is not either end
    const before = (await focused(page))!

    await page.keyboard.press('Control+Enter')
    await expect(page.getByRole('textbox', { name: 'Title for the new scene' })).toBeFocused()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('textbox', { name: 'Title for the new scene' })).toHaveCount(0)
    await expect.poll(() => focused(page)).toEqual(before)
  })
})

test.describe('scene keys while reading', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a reader steps only through what they have reached, and makes nothing', async ({ page }) => {
    const worldId = await book(page)
    // The writer's arrival puts the cursor on chapter 1's first scene; step to
    // its second, and that is where the reader will have got to.
    await writeIn(page, worldId, 'c1', 'The assize rises')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect.poll(() => cursor(page)).toBe('e2')
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await expect(page.getByRole('button', { name: 'Turn off reading mode' })).toBeVisible()

    await writeIn(page, worldId, 'c1', 'Teodora at the table')
    // Chapter 2 is not reached: nothing to go to.
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect(page).toHaveURL(/\/manuscript\/c1$/)
    await expect.poll(() => focused(page)).toMatchObject({ value: 'Second.' })
    // No new scene in a book being read.
    await page.keyboard.press('Control+Enter')
    await expect(page.getByRole('textbox', { name: 'Title for the new scene' })).toHaveCount(0)

    // And back is somewhere they have been, so it goes — without moving their place.
    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect.poll(() => focused(page)).toMatchObject({ value: 'First.' })
    expect(await cursor(page)).toBe('e2')
  })
})
