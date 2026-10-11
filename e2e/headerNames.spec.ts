import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * `:called …` and `:is …` on a scene header's Characters line: the name the
 * book uses from a scene, and who somebody is revealed to be there — recorded
 * on the character, drawn on that scene and not after, taken back, and a
 * reveal the rules forbid refused and said.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Long Road')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    const person = (cid: string, name: string, extra: object = {}) => db.characters.add({
      id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now, ...extra,
    })
    // Called Strider from the first scene.
    await person('ara', 'Aragorn', { nameChanges: [{ eventId: 'e1', name: 'Strider' }] })
    await person('hyde', 'Edward Hyde')
    await person('jek', 'Dr Henry Jekyll')
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Bree', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The inn', 'Rain on the road.'], ['e2', 'The door', 'The lamp went out.'], ['e3', 'After', 'Nobody spoke of it.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: ['ara', 'hyde'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 4, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** Aragorn's name changes, and who Hyde is revealed to be and where. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characters: { get: (k: string) => Promise<{ nameChanges?: Array<{ eventId: string; name: string }>; revealedAs?: { characterId: string; eventId: string } }> }
  }
  return {
    called: ((await db.characters.get('ara')).nameChanges ?? []).map((n) => `${n.eventId}:${n.name}`),
    hyde: (await db.characters.get('hyde')).revealedAs ?? null,
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

const cast = (chars: string) => `[\n  Characters: ${chars}\n]`
const PLAIN = cast('@@Aragorn @@Edward Hyde')
const FIRST = cast('@@Aragorn:called Strider @@Edward Hyde')
const SAID = cast('@@Aragorn:called Elessar @@Edward Hyde:is Dr Henry Jekyll')

test.describe('a name, or a reveal, on the Characters line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: recorded at the scene, drawn there and not after, and taken back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([FIRST, PLAIN, PLAIN])

    // The second scene's Characters line, typed over.
    await page.locator('.cm-line', { hasText: /^\s*Characters: @@Aragorn @@Edward Hyde$/ }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Characters: @@Aragorn:called Elessar @@Edward Hyde:is Dr Henry Jekyll')
    await page.keyboard.press('Escape')
    await line(page, 'The lamp went out').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      called: ['e1:Strider', 'e2:Elessar'],
      hyde: { characterId: 'jek', eventId: 'e2' },
    })

    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([FIRST, SAID, PLAIN])

    // Both taken off: the name change at this scene goes, and the reveal; the first scene's name stays.
    await line(page, 'Characters: @@Aragorn:called Elessar').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Characters: @@Aragorn @@Edward Hyde')
    await page.keyboard.press('Escape')
    await line(page, 'The lamp went out').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({ called: ['e1:Strider'], hyde: null })
  })

  test('on a scene card: a reveal the rules forbid is said and recorded nowhere; put right, it is recorded', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The door', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${PLAIN}\n\nThe lamp went out.`, { timeout: 20_000 })

    const typed = cast('@@Aragorn @@Edward Hyde:is Edward Hyde')
    await draft.fill(`${typed}\n\nThe lamp went out.`)
    await draft.blur()
    await expect(page.getByText(/Edward Hyde cannot be revealed to be themself\./)).toBeVisible({ timeout: 20_000 })
    expect((await records(page)).hyde).toBeNull()
    // Kept as typed, to be put right on the line.
    await expect(draft).toHaveValue(`${typed}\n\nThe lamp went out.`)

    await draft.fill(`${cast('@@Aragorn @@Edward Hyde:is Dr Henry Jekyll')}\n\nThe lamp went out.`)
    await draft.blur()
    await expect.poll(async () => (await records(page)).hyde, { timeout: 20_000 }).toEqual({ characterId: 'jek', eventId: 'e2' })
    await expect(page.getByText(/cannot be revealed/)).toHaveCount(0)
  })
})
