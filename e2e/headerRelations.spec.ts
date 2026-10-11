import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Relationships line in a scene's header — `~Pell Okonjo/Sabine Varro:Debt`,
 * `:ended` (docs/records/scene-header-block-plan.md, part 5): a relationship
 * begun at a scene, a state recorded at another, drawn where each is, and taken
 * back.
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
    for (const [cid, name] of [['pell', 'Pell Okonjo'], ['sab', 'Sabine Varro'], ['idris', 'Idris Quell']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    // Sabine and Idris have been partners from the start, and strongly.
    await db.relationships.add({
      id: 'r-si', worldId: id, characterAId: 'sab', characterBId: 'idris', label: 'Partners', strength: 'strong', sentiment: 'positive',
      description: 'Ten years on the river.', isBidirectional: true, startEventId: null, createdAt: now, updatedAt: now,
    })
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

/** Each relationship (pair, label, where it starts), each state (pair, scene, label, active), and the chapel scene's cast. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    relationships: { toArray: () => Promise<Array<{ id: string; characterAId: string; characterBId: string; label: string; startEventId: string | null }>> }
    relationshipSnapshots: { toArray: () => Promise<Array<{ relationshipId: string; eventId: string; label: string; isActive: boolean; strength: string }>> }
    events: { get: (k: string) => Promise<{ involvedCharacterIds: string[] }> }
  }
  const rels = await db.relationships.toArray()
  const pair = (id: string) => { const r = rels.find((x) => x.id === id)!; return `${r.characterAId}/${r.characterBId}` }
  return {
    relationships: rels.map((r) => `${r.characterAId}/${r.characterBId}:${r.label}@${r.startEventId ?? 'start'}`).sort(),
    states: (await db.relationshipSnapshots.toArray()).map((s) => `${pair(s.relationshipId)}@${s.eventId}:${s.isActive ? s.label : 'ended'}:${s.strength}`).sort(),
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
/** A Relationships line added under scene `n`'s Characters line (0-based). */
async function addLine(page: Page, n: number, typed: string, leaveTo: string) {
  await page.locator('.cm-line', { hasText: 'Characters: @@Pell Okonjo @@Sabine Varro' }).nth(n).click()
  await page.keyboard.press('End')
  // The caret is at the end of a name, so the picker is open: Enter would complete the name, not start a line.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Home')
  await page.keyboard.type(typed)
  await page.keyboard.press('Escape')
  await line(page, leaveTo).click()
}

const CAST = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n]'
const BEGUN = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Relationships: ~Pell Okonjo/Sabine Varro:Debt\n]'
const ENDED = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Relationships: ~Pell Okonjo/Sabine Varro:ended\n]'

test.describe('the Relationships line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: begun at one scene, ended at the next, each drawn where it is, and the end taken back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([CAST, CAST, CAST])

    await addLine(page, 1, '  Relationships: ~Pell Okonjo/Sabine Varro:Debt', 'The bell rang')
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      relationships: ['pell/sab:Debt@e2', 'sab/idris:Partners@start'],
      states: [],
      cast: ['pell', 'sab'],
    })

    await addLine(page, 2, '  Relationships: ~Sabine Varro/Pell Okonjo:ended', 'Nobody spoke')
    await expect.poll(async () => (await records(page)).states, { timeout: 20_000 }).toEqual(['pell/sab@e3:ended:moderate'])

    // From the records, on a page opened afresh: begun at the chapel, ended after it, and nothing at the quay.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([CAST, BEGUN, ENDED])

    // The end taken off: the state at that scene goes; the relationship stays, begun where it was.
    await line(page, 'Relationships: ~Pell Okonjo/Sabine Varro:ended').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await line(page, 'Nobody spoke').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      relationships: ['pell/sab:Debt@e2', 'sab/idris:Partners@start'],
      states: [],
      cast: ['pell', 'sab'],
    })
  })

  test('on a scene card: a state for a relationship that already stands, keeping how strong it is', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${CAST}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    const typed = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Relationships: ~Idris Quell/Sabine Varro:Estranged\n]'
    await draft.fill(`${typed}\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect.poll(async () => (await records(page)).states, { timeout: 20_000 }).toEqual(['sab/idris@e2:Estranged:strong'])
    // Drawn back as the records give the pair.
    await expect(draft).toHaveValue('[\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Relationships: ~Sabine Varro/Idris Quell:Estranged\n]\n\nThe bell rang under the water.', { timeout: 20_000 })
    expect((await records(page)).cast).toEqual(['pell', 'sab'])
  })
})
