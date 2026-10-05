import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A second blind writer run, on the Manuscript's Page: writing a book scene by
 * scene with Ctrl+Enter, naming places and people in each scene's header line
 * as the guide says to. Each test is a finding's reproduction, made to pass.
 */

/** Two chapters; with `long`, a first scene long enough to push the rest of the book off screen. */
async function book(page: Page, { long = false } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Lantern Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, isLong]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'Sleet']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    for (const [cid, name] of [['ilse', 'Ilse Marrow'], ['wren', 'Wren Halloway']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    for (const [pid, name] of [['bell', 'The Drowned Bell'], ['road', 'Saltmarsh Road']] as const) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, linkedMapLayerId: null, name, description: '', x: 0, y: 0, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    const long = isLong ? Array.from({ length: 80 }, (_, k) => `The fog sat on the river, hour ${k + 1}.`).join('\n\n') : 'The fog sat on the river.'
    const scenes = [
      ['e1', 'c1', 'The boats', long, ['ilse'], 'bell'],
      ['e2', 'c1', 'The ledger is gone', 'Nobody had seen it.', ['ilse', 'wren'], 'bell'],
      ['e3', 'c2', 'Morning', 'The tide was out.', [], null],
    ] as const
    let i = 0
    for (const [eid, cid, title, text, cast, place] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: place, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: text.split(/\s+/).length, updatedAt: now })
    }
  }, [worldId, long] as const)
  return worldId
}

const db = <T,>(page: Page, read: string) => page.evaluate(async (src) => {
  const pwdb = (window as unknown as { __pwdb: unknown }).__pwdb
  return (new Function('db', `return (async () => { ${src} })()`))(pwdb)
}, read) as Promise<T>

const cursor = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)

/** Put the time cursor at a scene — written before a reload, since a running page writes its own store back. */
async function cursorAt(page: Page, worldId: string, eventId: string | null) {
  await page.evaluate(([wid, eid]) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}), [wid as string]: eid }
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, [worldId, eventId] as const)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()

test.describe('the Page, from a second writer run', () => {
  test.describe.configure({ timeout: 150_000 })

  test('P-1 and P-2: Ctrl+Enter makes an empty scene, its typed header line says where it is, and the cursor goes there', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'Nobody had seen it.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.type('The garden')
    await page.keyboard.press('Enter')

    const made = () => db<{ id: string; place: string | null; cast: string[]; text: string } | null>(page, `
      const ev = (await db.events.toArray()).find((e) => e.title === 'The garden')
      if (!ev) return null
      const t = await db.sceneTexts.where('eventId').equals(ev.id).first()
      return { id: ev.id, place: ev.locationMarkerId, cast: ev.involvedCharacterIds, text: t?.text ?? '' }`)
    // Made empty: not the Drowned Bell, not Ilse and Wren, carried from the scene it followed.
    await expect.poll(made, { timeout: 20_000 }).toMatchObject({ place: null, cast: [] })
    const id = (await made())!.id
    // P-2: the cursor is on the scene being written, not the one left.
    await expect.poll(() => cursor(page), { timeout: 20_000 }).toBe(id)

    // The writer's own header line, as its first line: read as the header, not as prose.
    await page.keyboard.insertText('[#Saltmarsh Road @@Wren Halloway]')
    await page.keyboard.press('Escape')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText('She went out.')
    await expect.poll(made, { timeout: 20_000 }).toEqual({ id, place: 'road', cast: ['wren'], text: 'She went out.' })
    // Paired: the scene before keeps everything of its own.
    expect(await db(page, `const e = await db.events.get('e2'); return [e.locationMarkerId, e.involvedCharacterIds]`))
      .toEqual(['bell', ['ilse', 'wren']])
  })

  test('P-3: @@ in a header line still being typed offers the person, and closes the line', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // Morning has no setting and no cast, so no header line: its first line is the writer's to type.
    await line(page, 'The tide was out.').click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('[#The Drowned Bell @@Wren Hal')
    const offered = page.getByRole('button', { name: 'Wren Halloway character', exact: true })
    await expect(offered).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Nobody called/)).toHaveCount(0)
    await page.keyboard.press('Enter')
    // The whole line, exactly: the scenes before are set at the Drowned Bell too, and their lines begin the same way.
    const whole = (text: string) => page.locator('.cm-line').filter({ hasText: new RegExp(`^${text.replace(/[[\]]/g, '\\$&')}$`) })
    await expect(whole('[#The Drowned Bell @@Wren Halloway]')).toHaveCount(1)
    // The caret is inside the ], so going on adds to the line.
    await page.keyboard.type(' @@Ilse Marrow')
    await page.keyboard.press('Escape')
    await expect(whole('[#The Drowned Bell @@Wren Halloway @@Ilse Marrow]')).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => db(page, `const e = await db.events.get('e3'); return [e.locationMarkerId, e.involvedCharacterIds]`), { timeout: 20_000 })
      .toEqual(['bell', ['wren', 'ilse']])
    expect(await db(page, `return (await db.sceneTexts.where('eventId').equals('e3').first()).text`)).toBe('The tide was out.')
  })

  test('P-5: a comma after a picked name takes the space the picker left, on the Page and on a card', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await line(page, 'The tide was out.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Then @Wren Hal')
    await expect(page.getByRole('button', { name: 'Wren Halloway character', exact: true })).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Enter')
    await page.keyboard.type(', who waited. And @Ilse Mar')
    await expect(page.getByRole('button', { name: 'Ilse Marrow character', exact: true })).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Enter')
    // Paired: a word after a picked name keeps its space.
    await page.keyboard.type('watched.')
    await expect.poll(() => db(page, `return (await db.sceneTexts.where('eventId').equals('e3').first()).text`), { timeout: 20_000 })
      .toBe('The tide was out. Then Wren Halloway, who waited. And Ilse Marrow watched.')

    // The scene card's box: the same rule.
    await page.goto(`/#/worlds/${worldId}/manuscript/c2?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Morning', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toBeVisible({ timeout: 20_000 })
    await draft.click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' @Ilse Mar')
    await expect(page.getByRole('button', { name: 'Ilse Marrow character', exact: true })).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Enter')
    await page.keyboard.type('.')
    await expect(draft).toHaveValue(/Ilse Marrow watched\. Ilse Marrow\.$/)
  })

  test('P-7: the Manuscript opens the Page at the scene the cursor is on', async ({ page }) => {
    const worldId = await book(page, { long: true })
    // On screen: CodeMirror does not draw a line far from the viewport at all, so "not drawn" counts as off it.
    const onScreen = async (text: string) => {
      const el = line(page, text)
      if (await el.count() === 0) return false
      const box = await el.boundingBox()
      return !!box && box.y >= 0 && box.y < (page.viewportSize()?.height ?? 0)
    }
    // Paired: with the cursor at the top of the book, Morning is far below the fold.
    await cursorAt(page, worldId, 'e1')
    await openPage(page, worldId)
    await expect.poll(() => onScreen('# Low Water'), { timeout: 20_000 }).toBe(true)
    expect(await onScreen('## Morning')).toBe(false)

    await cursorAt(page, worldId, 'e3')
    await openPage(page, worldId)
    await expect.poll(() => onScreen('## Morning'), { timeout: 20_000 }).toBe(true)
  })
})
