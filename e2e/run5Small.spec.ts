import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The smaller things writer run 5 found:
 *
 * - U3: the "other names" question for somebody the picker made went with a reload.
 * - U4: no way to say a character knew a fact before the book begins.
 * - U5: Cast Balance warned that a dead character had gone quiet.
 * - S3: a header line still being typed went with the tab; now it is applied when the page comes back.
 * - S4: the Brief's "Knowledge in the room" listed the dead, and people not in the scene.
 */

const SCENES = [
  ['e1', 'c1', 'The reading of the will', 'They sat.', ['eleanor', 'tobias', 'agnes']],
  ['e2', 'c2', 'The study', 'Dust.', ['eleanor', 'tobias']],
  ['e3', 'c3', 'The garden', 'Wind.', ['eleanor']],
  ['e4', 'c4', 'The cellar', 'Damp.', ['eleanor']],
  ['e5', 'c5', 'The road out', 'Rain fell.', []],
] as const

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Thorne Inheritance')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, scenes }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [name, cid] of [['Eleanor Vane', 'eleanor'], ['Tobias Grell', 'tobias'], ['Agnes Thorne', 'agnes']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    let n = 0
    for (const [eid, cid, title, text, cast] of scenes) {
      n++
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: 1,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${n}`, worldId: id, eventId: eid, text, wordCount: text.split(' ').length, updatedAt: now })
    }
    // Everyone has a state in the first scene; Tobias dies in it.
    for (const cid of ['eleanor', 'tobias', 'agnes']) {
      await db.characterSnapshots.add({
        id: `s-${cid}`, worldId: id, characterId: cid, eventId: 'e1', sortKey: 1.000001, isAlive: cid !== 'tobias',
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '',
        travelModeId: null, createdAt: now, updatedAt: now,
      })
    }
    // All three learn at the reading; nobody learns the second.
    await db.knowledgeFacts.add({ id: 'will', worldId: id, title: 'The will was forged', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
    await db.knowledgeFacts.add({ id: 'ship', worldId: id, title: 'The ship sailed late', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
    for (const cid of ['eleanor', 'tobias', 'agnes']) {
      await db.knowledgeReveals.add({ id: `r-${cid}`, worldId: id, factId: 'will', characterId: cid, eventId: 'e1', createdAt: now, updatedAt: now })
    }
  }, { id: worldId, scenes: SCENES })
  return worldId
}

async function openPage(page: Page, worldId: string) {
  // Tall enough that the last scene is drawn: the page draws only what is in view.
  await page.setViewportSize({ width: 1280, height: 2000 })
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const stored = <T,>(page: Page, read: string) => page.evaluate(async (src) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown
  return (new Function('db', `return (async () => ${src})()`) as (db: unknown) => Promise<unknown>)(db)
}, read) as Promise<T>

test.describe('the smaller findings of writer run 5', () => {
  test.describe.configure({ timeout: 150_000 })

  test('U5: Cast Balance says when the dead died, and still warns of the living gone quiet', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    // The heading's own row, then the section around it.
    const section = page.getByRole('heading', { name: 'Cast Balance', exact: true }).locator('xpath=../..')
    const row = (name: string) => section.locator('div.rounded-md').filter({ hasText: name })
    await expect(row('Tobias Grell')).toContainText('dies in Ch. 1')
    await expect(row('Tobias Grell')).not.toContainText('quiet')
    // Agnes is as silent after Ch. 1 as Tobias, and alive: warned of.
    await expect(row('Agnes Thorne')).toContainText('last on-stage Ch. 1 · quiet 4 chapters')
    await expect(row('Agnes Thorne')).not.toContainText('dies in')
  })

  test("S4: the Brief's knowledge in the room is the scene's living people", async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    // The cursor on the study, where Eleanor and the dead Tobias are, and Agnes is not.
    await page.getByTitle('The study', { exact: true }).first().click()
    await page.waitForTimeout(600)
    await page.getByTitle("Writer's Brief").click()
    const brief = page.getByRole('dialog', { name: "Writer's Brief" })
    await expect(brief.getByText('Knowledge in the room')).toBeVisible()
    const fact = brief.locator('div.rounded', { hasText: 'The will was forged' })
    await expect(fact).toContainText('known by Eleanor Vane')
    await expect(fact).not.toContainText('Tobias')
    await expect(fact).not.toContainText('Agnes')
  })

  test('U4: a reveal can be recorded as known before the story, at its first scene', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: /The ship sailed late/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: 'Character…', exact: true }).click()
    await page.getByRole('option', { name: 'Agnes Thorne', exact: true }).click()
    await page.getByRole('button', { name: 'Learns it at…', exact: true }).click()
    // Listed first, ahead of the scenes themselves.
    await expect(page.locator('[role="option"]:visible').first()).toHaveText('Before the story (from the first scene)')
    await page.getByRole('option', { name: 'Before the story (from the first scene)', exact: true }).click()
    await page.getByRole('button', { name: 'Record who learns it' }).click()
    await expect.poll(() => stored<string[]>(page, `(await db.knowledgeReveals.toArray()).filter((r) => r.factId === 'ship').map((r) => r.characterId + '@' + r.eventId)`))
      .toEqual(['agnes@e1'])
  })

  test('U3: the question about somebody just made outlasts a reload, and goes once answered', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Rain fell.' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[@@Ann Bell')
    await page.getByRole('button', { name: 'Ann Bell new character', exact: true }).click()
    await expect(page.getByText('Ann Bell is new.')).toBeVisible()
    await expect.poll(() => stored<string[]>(page, `(await db.characters.toArray()).map((c) => c.name)`)).toContain('Ann Bell')

    await page.reload({ waitUntil: 'load' })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Ann Bell is new.')).toBeVisible()

    await page.getByRole('button', { name: 'Not now: no other names for Ann Bell', exact: true }).click()
    await expect(page.getByText('Ann Bell is new.')).toHaveCount(0)
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await settle(page)
    await expect(page.getByText('Ann Bell is new.')).toHaveCount(0)
  })

  test('S3: a header line the tab closed on is applied when the page comes back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Rain fell.' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[@@Agnes Thorne')
    await page.keyboard.press('Escape')
    await page.keyboard.type(']')
    // Still on the line: nothing applied yet.
    expect(await stored<string[]>(page, `(await db.events.get('e5')).involvedCharacterIds`)).toEqual([])

    /*
      Watched from the first moment of the next load: a note about the line would
      be cleared once it is applied, so a look afterwards could not see one shown
      in between.
    */
    await page.addInitScript(() => {
      const w = window as { __sawNote?: boolean }
      w.__sawNote = false
      new MutationObserver((changes) => {
        for (const c of changes) for (const n of c.addedNodes) if (/kept as typed|Nothing in this world is called/.test(n.textContent ?? '')) w.__sawNote = true
      }).observe(document, { childList: true, subtree: true })
    })
    // The tab closed on it: it was left by the closing, and is applied when the page comes back.
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => stored<string[]>(page, `(await db.events.get('e5')).involvedCharacterIds`)).toEqual(['agnes'])
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kathala-kept-headers'))).toBeNull()
    // Drawn from the records now, as any header is — and with no note, since nothing on it was unknown.
    await expect.poll(async () => {
      const lines = (await page.locator('.cm-line').allTextContents()).map((l) => l.trim()).filter(Boolean)
      const at = lines.indexOf('## The road out')
      return lines.slice(at, at + 4)
    }).toEqual(['## The road out', '[', 'Characters: @@Agnes Thorne', ']'])
    await expect(page.getByText(/kept as typed|Nothing in this world is called/)).toHaveCount(0)
    expect(await page.evaluate(() => (window as { __sawNote?: boolean }).__sawNote)).toBe(false)
  })
})
