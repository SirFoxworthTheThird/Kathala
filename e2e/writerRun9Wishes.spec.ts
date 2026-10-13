import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * What writer run 9 wished for while writing *Short Weight*
 * (`docs/records/run-9-wishes-plan.md`).
 */

const EARTH_2025 = {
  startYear: 2025, yearSuffix: '',
  months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]]
    .map(([name, days]) => ({ name, days })),
}

/** Short Weight's opening: a clock that starts on 8 October 2025 (day 280), and a second scene a day later. */
async function book(page: Page, opts: { calendar?: boolean; cast?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Short Weight')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, calendar, cast }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    if (calendar) await db.worlds.update(id, { calendar })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Merrow, October', description: '', color: '#6366f1', dayOffset: 280, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Cold Room', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'Flat 114', 'The lift worked on alternate days.', null], ['e2', 'Custom House', 'The scales were older than the building.', 1]] as const
    let i = 0
    for (const [eid, title, text, travelDays] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: cast ? ['nell'] : [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 6, updatedAt: now })
    }
    if (!cast) return
    for (const [cid, name] of [['nell', 'Nell Ashdown'], ['jordan', 'Jordan Kelly'], ['lenny', 'Lenny Quaife']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    // Two places, and Jordan and Lenny last recorded at Cobden Tower, in the first scene.
    for (const [pid, name] of [['cobden', 'Cobden Tower'], ['house', 'Custom House']]) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, name, description: '', iconType: 'building', x: 0, y: 0, factionId: null, linkedMapLayerId: null, color: null, createdAt: now, updatedAt: now })
    }
    await db.events.update('e2', { locationMarkerId: 'house' })
    for (const cid of ['jordan', 'lenny']) {
      await db.characterSnapshots.add({ id: `s-${cid}`, worldId: id, characterId: cid, eventId: 'e1', sortKey: 1.000001, isAlive: true, currentLocationMarkerId: 'cobden', currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now })
    }
    await db.knowledgeFacts.add({ id: 'short', worldId: id, title: 'The Exchange weighs short', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
  }, { id: worldId, calendar: opts.calendar ? EARTH_2025 : null, cast: !!opts.cast })
  return worldId
}

const pinOf = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ inWorldTime: number | null }> } }
  return (await db.events.get(eid)).inWorldTime
}, id)

async function sceneMore(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
  await page.locator('.cm-line', { hasText: 'The scales were older' }).first().click()
  const scene = page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'This scene' })
  await expect(scene).toContainText('Custom House')
  await scene.getByRole('button', { name: 'More about this scene' }).click()
  return scene
}

test.describe('writer run 9’s wishes', () => {
  test.describe.configure({ timeout: 150_000 })

  test('a pin is a date where the book has a calendar, starting from the date the scene is on', async ({ page }) => {
    const worldId = await book(page, { calendar: true })
    const scene = await sceneMore(page, worldId)
    const pinned = scene.getByRole('group', { name: 'Pinned date' })
    await expect(scene.getByLabel('Exact in-world day for this scene')).toHaveCount(0)

    // From the day the scene is on now: 9 October, the day after the story's first.
    await pinned.getByRole('button', { name: 'Pin to a date' }).click()
    await expect.poll(() => pinOf(page, 'e2')).toBe(281)
    await expect(pinned.getByLabel('Month')).toHaveValue('9')
    await expect(pinned.getByLabel('Day')).toHaveValue('9')

    // 16 October is day 288.
    await pinned.getByLabel('Day').fill('16')
    await expect.poll(() => pinOf(page, 'e2')).toBe(288)

    await pinned.getByRole('button', { name: 'Clear' }).click()
    await expect.poll(() => pinOf(page, 'e2')).toBeNull()
  })

  test('without a calendar the pin is still the day number', async ({ page }) => {
    const worldId = await book(page)
    const scene = await sceneMore(page, worldId)
    await expect(scene.getByLabel('Exact in-world day for this scene')).toBeVisible()
    await expect(scene.getByRole('group', { name: 'Pinned date' })).toHaveCount(0)
    await scene.getByLabel('Exact in-world day for this scene').fill('300')
    await expect.poll(() => pinOf(page, 'e2')).toBe(300)
  })

  test('`:before` in a later scene’s header: known before the story, filed and drawn at the first scene, and said', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    const lines = page.locator('.cm-line', { hasText: 'Characters: @@Nell Ashdown' })
    await expect(lines).toHaveCount(2, { timeout: 20_000 })

    // The second scene's header: the fact, known to Nell before the story began.
    await lines.nth(1).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' ?The Exchange weighs short:@Nell Ashdown:before', { delay: 20 })
    await page.keyboard.press('Escape')
    await page.locator('.cm-line', { hasText: 'The scales were older' }).first().click()

    const reveals = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { knowledgeReveals: { toArray: () => Promise<Array<{ characterId: string; eventId: string; beforeStory?: boolean }>> } }
      return (await db.knowledgeReveals.toArray()).map((r) => [r.characterId, r.eventId, !!r.beforeStory])
    })
    await expect.poll(reveals, { timeout: 15_000 }).toEqual([['nell', 'e1', true]])
    await expect(page.getByText('Known before the story: shown on the first scene, Flat 114.', { exact: true })).toBeVisible()
    // Drawn on the first scene's header, and only there.
    await expect(page.locator('.cm-line', { hasText: 'Facts: ?The Exchange weighs short:@Nell Ashdown:before' })).toHaveCount(1)
    const first = page.locator('.cm-line', { hasText: 'The lift worked' }).first()
    const factsLine = page.locator('.cm-line', { hasText: ':before' }).first()
    expect((await factsLine.boundingBox())!.y).toBeLessThan((await first.boundingBox())!.y)
  })

  test('`:dead elsewhere`: the death recorded where they were, and the scene tells of it; a plain `:dead` is in the room', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    const line = page.locator('.cm-line', { hasText: 'Characters: @@Nell Ashdown' }).nth(1)
    await expect(line).toBeVisible({ timeout: 20_000 })

    await line.click()
    await page.keyboard.press('End')
    for (const [first, fate] of [['Jordan', ':dead elsewhere'], ['Lenny', ':dead']]) {
      await page.keyboard.type(` @@${first}`, { delay: 30 })
      await page.waitForTimeout(400)
      await page.keyboard.press('Tab')
      await page.keyboard.press('Backspace')
      await page.keyboard.type(fate)
    }
    await page.locator('.cm-line', { hasText: 'The scales were older' }).first().click()

    const records = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { get: (id: string) => Promise<Record<string, unknown>>; toArray: () => Promise<Array<Record<string, unknown>>> }>
      const e = await db.events.get('e2')
      const at = (await db.characterSnapshots.toArray()).filter((s) => s.eventId === 'e2')
      const of = (cid: string) => at.filter((s) => s.characterId === cid).map((s) => [s.isAlive, s.currentLocationMarkerId])
      return { cast: e.involvedCharacterIds, mentioned: e.mentionedCharacterIds, jordan: of('jordan'), lenny: of('lenny') }
    })
    await expect.poll(records, { timeout: 15_000 }).toEqual({
      cast: ['nell', 'lenny'], mentioned: ['jordan'],
      // Dead where he was last; Lenny, in the room, dead in it.
      jordan: [[false, 'cobden']], lenny: [[false, 'house']],
    })
    await expect(page.locator('.cm-line', { hasText: '@@Jordan Kelly:dead elsewhere' })).toHaveCount(1)
  })

  test('chapter headings: chosen for the book in the export dialog, remembered, and in the EPUB; Markdown is not offered them', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    const headings = dialog.getByRole('button', { name: /^Chapter headings/ })

    // Markdown keeps "Ch. N — Title" for its round trip, so nothing to choose.
    await expect(dialog.getByRole('button', { name: 'Markdown', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(headings).toHaveCount(0)
    await dialog.getByRole('button', { name: 'EPUB', exact: true }).click()
    await expect(headings).toHaveAccessibleName(/Ch\. 1 — Flat 114/)
    await headings.click()
    await page.getByRole('option', { name: 'Chapter One / Flat 114', exact: true }).click()

    const chosen = () => page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { get: (id: string) => Promise<{ chapterHeading?: string }> } }
      return (await db.worlds.get(id)).chapterHeading ?? null
    }, worldId)
    await expect.poll(chosen).toBe('chapter-words-title')

    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Download/ }).click()])
    const epub = readFileSync((await download.path())!).toString('utf8')
    expect(epub).toContain('<h2>Chapter One<br/>Cold Room</h2>')
    expect(epub).not.toContain('Ch. 1 —')

    // Remembered: the book's own, the next time.
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await dialog.getByRole('button', { name: 'EPUB', exact: true }).click()
    await expect(headings).toHaveAccessibleName(/Chapter One \/ Flat 114/)
  })
})
