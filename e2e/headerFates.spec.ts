import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { wholeRecords } from './helpers/person'

/**
 * A fate on the header's Characters line — `@@Corwen Dask:dead`, `@@Pell:alive`
 * (docs/records/scene-header-block-plan.md, part 2): the state it records at
 * the scene, and the scene it is drawn on.
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
    for (const [cid, name] of [['dask', 'Corwen Dask'], ['pell', 'Pell Okonjo']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.locationMarkers.add({
      id: 'chapel', worldId: id, mapLayerId: null, name: 'The Drowned Chapel', description: '',
      x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The chapel', 'The bell rang under the water.', ['dask', 'pell']],
      ['e2', 'After', 'Nobody spoke of it.', ['dask', 'pell']],
    ] as const
    let i = 0
    for (const [eid, title, text, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: 'chapel', involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** A character's recorded state at each scene that has one. */
/** A person's records, read whole at their scenes as the screens read them (Part B2). */
const states = async (page: Page, characterId: string) => Object.fromEntries((await wholeRecords(page))
  .filter((s) => s.characterId === characterId)
  .map((s) => [s.eventId, { isAlive: s.isAlive, revived: !!s.revived, place: s.currentLocationMarkerId }]))

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
/** Each header on the page, its lines joined. */
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

test.describe('a fate on the header', () => {
  test.describe.configure({ timeout: 120_000 })

  test(':dead on the Page records the death at that scene, is drawn there and not after, and taken off, takes it back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const both = '[\n  Place: #The Drowned Chapel\n  Characters: @@Corwen Dask @@Pell Okonjo\n]'
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([both, both])

    // `:dead` typed after his name, on the first scene's header.
    await line(page, 'Characters: @@Corwen Dask @@Pell').click()
    await page.keyboard.press('End')
    for (let i = 0; i < ' @@Pell Okonjo'.length; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.type(':dead')
    await line(page, 'The bell rang').click()

    // Recorded at that scene, where the scene is set; nothing written at the scene after.
    await expect.poll(() => states(page, 'dask'), { timeout: 20_000 })
      // At the scene's place: the header records the cast there, before the death.
      .toEqual({ e1: { isAlive: false, revived: false, place: 'chapel' } })
    // Drawn on the scene he dies in, and not on the one after, where he is still in the cast — from the
    // records, on a page opened afresh, where nothing typed is left to show it.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    const dies = '[\n  Place: #The Drowned Chapel\n  Characters: @@Corwen Dask:dead @@Pell Okonjo\n]'
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([dies, both])

    // Taken off again: alive at that scene.
    await line(page, 'Characters: @@Corwen Dask:dead').click()
    await page.keyboard.press('End')
    for (let i = 0; i < ' @@Pell Okonjo'.length; i++) await page.keyboard.press('ArrowLeft')
    for (let i = 0; i < ':dead'.length; i++) await page.keyboard.press('Backspace')
    await line(page, 'The bell rang').click()
    await expect.poll(() => states(page, 'dask'), { timeout: 20_000 })
      .toEqual({ e1: { isAlive: true, revived: false, place: 'chapel' } })
    await expect.poll(() => headerTexts(page)).toEqual([both, both])
  })

  test(':alive on a scene card brings somebody back at that scene, and says so on their state', async ({ page }) => {
    const worldId = await book(page)
    // Pell died at the first scene. In this world: his place there is read from it (Part B2).
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.characterSnapshots.add({
        id: 'pell-dies', worldId: id, characterId: 'pell', eventId: 'e1', sortKey: 1.000001, isAlive: false,
        currentLocationMarkerId: 'chapel', currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
        createdAt: now, updatedAt: now,
      })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'After', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(/Characters: @@Corwen Dask @@Pell Okonjo\n/, { timeout: 20_000 })

    await draft.fill('[\n  Place: #The Drowned Chapel\n  Characters: @@Corwen Dask @@Pell Okonjo:alive\n]\n\nNobody spoke of it.')
    await draft.blur()
    await expect.poll(() => states(page, 'pell'), { timeout: 20_000 }).toEqual({
      e1: { isAlive: false, revived: false, place: 'chapel' },
      // Read from the state before: where he was.
      e2: { isAlive: true, revived: true, place: 'chapel' },
    })
    await expect(draft).toHaveValue('[\n  Place: #The Drowned Chapel\n  Characters: @@Corwen Dask @@Pell Okonjo:alive\n]\n\nNobody spoke of it.', { timeout: 20_000 })
    // Dask is in the cast, so the header records him at the scene's place; alive, and no fate of his own.
    expect(await states(page, 'dask')).toEqual({ e2: { isAlive: true, revived: false, place: 'chapel' } })
  })

  test('a death is drawn as a change when only another era said it before', async ({ page }) => {
    /*
      Corwen dies in the first scene (timeline Main); a second timeline holds a
      scene where he dies again. Centuries later it is this era's death and is
      drawn; on Main's own day 0 the two timelines are one era, the death
      repeats the one before it, and it is not.
    */
    const drawn = async (apart: boolean) => {
      const worldId = await book(page)
      await page.evaluate(async ({ id, offset }) => {
        const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
        const now = Date.now()
        await db.timelines.add({ id: 'later', worldId: id, name: 'Later', description: '', color: '#f59e0b', dayOffset: offset, createdAt: now, updatedAt: now })
        await db.chapters.add({ id: 'c2', worldId: id, timelineId: 'later', number: 2, title: 'Centuries On', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
        await db.events.add({
          id: 'e3', worldId: id, chapterId: 'c2', timelineId: 'later', title: 'The second bell', description: '', sortOrder: 1,
          tags: [], locationMarkerId: 'chapel', involvedCharacterIds: ['dask'], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], travelDays: 0, inWorldTime: null, structureBeat: null, status: 'draft',
          povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
        })
        await db.sceneTexts.add({ id: 't3', worldId: id, eventId: 'e3', text: 'It rang again.', wordCount: 3, updatedAt: now })
        for (const [sid, eid, sortKey] of [['dies-1', 'e1', 1.000001], ['dies-3', 'e3', 2.000001]] as const) {
          await db.characterSnapshots.add({
            id: sid, worldId: id, characterId: 'dask', eventId: eid, sortKey, isAlive: false,
            currentLocationMarkerId: 'chapel', currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
            createdAt: now, updatedAt: now,
          })
        }
      }, { id: worldId, offset: apart ? 100_000 : 0 })
      // The scene card's draft, and the Page, each draw the header from the records.
      await page.goto(`/#/worlds/${worldId}/manuscript/c2?view=cards`, { waitUntil: 'load' })
      await settle(page)
      await page.getByRole('main').getByRole('button', { name: 'The second bell', exact: true }).click()
      const card = await page.getByRole('textbox', { name: 'Scene prose' }).inputValue()
      await page.goto(`/#/worlds/${worldId}/manuscript/c2?view=page`, { waitUntil: 'load' })
      await settle(page)
      await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
      await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toHaveLength(1)
      return { card: card.includes('@@Corwen Dask:dead'), page: (await headerTexts(page))[0].includes('@@Corwen Dask:dead') }
    }
    expect(await drawn(true)).toEqual({ card: true, page: true })
    expect(await drawn(false)).toEqual({ card: false, page: false })
  })
})
