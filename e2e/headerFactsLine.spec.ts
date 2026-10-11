import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Facts line in a scene's header — `?Dask is the Grey Notary:@Sabine Varro`,
 * `?…:reader` (docs/records/scene-header-block-plan.md, part 4): the reveals and
 * the reader's scene it records, the scene it is drawn on, taking it back, and a
 * fact made from the note.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ash Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    for (const [cid, name] of [['pell', 'Pell Okonjo'], ['sab', 'Sabine Varro']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.knowledgeFacts.add({ id: 'notary', worldId: id, title: 'Dask is the Grey Notary', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The quay', 'The boats were in.'],
      ['e2', 'The chapel', 'The bell rang under the water.'],
      ['e3', 'After', 'Nobody spoke of it.'],
    ] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: ['pell', 'sab'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** The reveals, each fact's reader scene, and the chapel scene's cast. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    knowledgeReveals: { toArray: () => Promise<Array<{ factId: string; characterId: string; eventId: string }>> }
    knowledgeFacts: { toArray: () => Promise<Array<{ id: string; title: string; readerLearnsAtEventId: string | null }>> }
    events: { get: (k: string) => Promise<{ involvedCharacterIds: string[] }> }
  }
  const facts = await db.knowledgeFacts.toArray()
  const title = (id: string) => facts.find((f) => f.id === id)?.title
  return {
    learned: (await db.knowledgeReveals.toArray()).map((r) => `${title(r.factId)}:${r.characterId}@${r.eventId}`).sort(),
    reader: Object.fromEntries(facts.map((f) => [f.title, f.readerLearnsAtEventId])),
    cast: (await db.events.get('e2')).involvedCharacterIds,
  }
})

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
const headerTexts = (page: Page) => page.evaluate(() => {
  const blocks: string[][] = []
  for (const el of document.querySelectorAll('.cm-line.cm-draft-header')) {
    if (el.classList.contains('cm-draft-header-start')) blocks.push([])
    blocks[blocks.length - 1]?.push(el.textContent ?? '')
  }
  return blocks.map((b) => b.join('\n'))
})
async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const CAST = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n]'
const LEARNS = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Facts: ?Dask is the Grey Notary:@Sabine Varro ?Dask is the Grey Notary:reader\n]'

test.describe('the Facts line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: who learns a fact here, and the reader, recorded at that scene, drawn there and not elsewhere, and taken back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([CAST, CAST, CAST])

    await page.locator('.cm-line', { hasText: 'Characters: @@Pell Okonjo @@Sabine Varro' }).nth(1).click()
    await page.keyboard.press('End')
    // The caret is at the end of a name, so the picker is open: Enter would complete the name, not start a line.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Facts: ?Dask is the Grey Notary:@Sabine Varro')
    await page.keyboard.press('Escape')
    await page.keyboard.type(' ?Dask is the Grey Notary:reader')
    await line(page, 'The bell rang').click()

    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      learned: ['Dask is the Grey Notary:sab@e2'],
      reader: { 'Dask is the Grey Notary': 'e2' },
      cast: ['pell', 'sab'],
    })
    // From the records, on a page opened afresh: at the chapel, and at neither scene beside it.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([CAST, LEARNS, CAST])

    // Sabine's taken off: her reveal goes, the reader's stays.
    await line(page, 'Facts: ?Dask').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Facts: ?Dask is the Grey Notary:reader')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      learned: [],
      reader: { 'Dask is the Grey Notary': 'e2' },
      cast: ['pell', 'sab'],
    })
  })

  test('on a scene card: a fact nothing answers is said and changes nothing, and Create makes it and records who learns it', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${CAST}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    const typed = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Facts: ?The ledger is forged:@Pell Okonjo\n]'
    await draft.fill(`${typed}\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called “The ledger is forged”/)).toBeVisible({ timeout: 20_000 })
    const create = page.getByRole('button', { name: 'Create “The ledger is forged” as a fact', exact: true })
    await expect(create).toBeVisible()
    expect((await records(page)).learned).toEqual([])

    await create.click()
    await expect.poll(async () => (await records(page)).learned, { timeout: 20_000 }).toEqual(['The ledger is forged:pell@e2'])
    await expect(create).toHaveCount(0)
    await expect(draft).toHaveValue(`${typed}\n\nThe bell rang under the water.`, { timeout: 20_000 })
    expect((await records(page)).cast).toEqual(['pell', 'sab'])
  })
})
