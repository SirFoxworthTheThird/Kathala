import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * What writer run 6 found on the Manuscript and beside it:
 *
 * - F1: after a chapter was opened in one world, a bookmark to another world's
 *   Manuscript showed — and wrote into — the first world's book.
 * - F2: the chapter panel's title kept the old title after a rename on the Page,
 *   and typing in it wrote the old title back.
 * - F3: the panel's "Relationship States — end of chapter" said none were
 *   recorded unless one was recorded at the chapter's very last scene.
 * - F5: the Maps location panel called its per-scene state "Chapter State".
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('North')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (north) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.worlds.add({ id: 'south', name: 'South', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: now, updatedAt: now })
    const worlds = [[north, 'tlN', 'n'], ['south', 'tlS', 's']] as const
    for (const [wid, tl, p] of worlds) {
      await db.timelines.add({ id: tl, worldId: wid, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      for (const n of [1, 2]) {
        await db.chapters.add({ id: `${p}c${n}`, worldId: wid, timelineId: tl, number: n, title: `${wid === north ? 'North' : 'South'} chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      }
      const scenes = [[`${p}e1`, `${p}c1`, 1], [`${p}e2`, `${p}c1`, 2], [`${p}e3`, `${p}c2`, 1]] as const
      for (const [eid, cid, order] of scenes) {
        const title = `${wid === north ? 'North' : 'South'} scene ${eid.slice(-1)}`
        await db.events.add({
          id: eid, worldId: wid, chapterId: cid, timelineId: tl, title, description: '', sortOrder: order,
          tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
          povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
        })
        await db.sceneTexts.add({ id: `t-${eid}`, worldId: wid, eventId: eid, text: `${title} prose.`, wordCount: 4, updatedAt: now })
      }
    }
    // Two of North's people, and how they stand — recorded in the chapter's first scene, not its last.
    for (const [cid, name] of [['ann', 'Ann Hale'], ['bo', 'Bo Reed'], ['cy', 'Cy Mott']]) {
      await db.characters.add({ id: cid, worldId: north, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    const rel = (id: string, a: string, b: string) => ({ id, worldId: north, characterAId: a, characterBId: b, label: 'Acquainted', strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, createdAt: now, updatedAt: now })
    await db.relationships.add(rel('r1', 'ann', 'bo'))
    await db.relationships.add(rel('r2', 'ann', 'cy'))
    const state = (id: string, relationshipId: string, eventId: string, sortKey: number, label: string) => ({ id, worldId: north, relationshipId, eventId, sortKey, label, strength: 'strong', sentiment: 'negative', description: '', isActive: true, createdAt: now, updatedAt: now })
    await db.relationshipSnapshots.add(state('rs1', 'r1', 'ne1', 1.000001, 'Uneasy allies'))
    // Ann and Cy fall out only in chapter 2: not part of how chapter 1 ends.
    await db.relationshipSnapshots.add(state('rs2', 'r2', 'ne3', 2.000001, 'Sworn enemies'))
    // A place with no map, for the Maps screen's list of them.
    await db.locationMarkers.add({ id: 'quay', worldId: north, mapLayerId: null, name: 'The Quay', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'city', color: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function onPage(page: Page) {
  const pageButton = page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true })
  await pageButton.click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const textOf = (page: Page, eventId: string) => page.evaluate(async (id) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    sceneTexts: { where: (k: string) => { equals: (v: string) => { first: () => Promise<{ text: string } | undefined> } } }
  }
  return (await db.sceneTexts.where('eventId').equals(id).first())?.text ?? null
}, eventId)

const chapterTitle = (page: Page, id: string) => page.evaluate(async (cid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { get: (id: string) => Promise<{ title: string }> } }
  return (await db.chapters.get(cid)).title
}, id)

test.describe('the Manuscript and its panels, after writer run 6', () => {
  test.describe.configure({ timeout: 150_000 })

  test('F1: another world’s Manuscript shows and writes that world’s book, after a chapter was open in this one', async ({ page }) => {
    const north = await book(page)
    // A chapter opened in South, on the Page…
    await page.goto('/#/worlds/south/manuscript/sc1', { waitUntil: 'load' })
    await settle(page)
    await onPage(page)
    const book1 = page.getByRole('textbox', { name: 'The book, as one page' })
    await expect(book1).toContainText('South scene 1 prose.')

    // …then North's Manuscript by its address, as a bookmark goes.
    await page.goto(`/#/worlds/${north}/manuscript`)
    await settle(page)
    const pageBox = page.getByRole('textbox', { name: 'The book, as one page' })
    await expect(pageBox).toContainText('North scene 1 prose.', { timeout: 20_000 })
    await expect(pageBox).not.toContainText('South scene')

    // And what is typed goes into North's scene, not South's.
    await page.locator('.cm-line', { hasText: 'North scene 1 prose.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Cold.')
    await expect.poll(() => textOf(page, 'ne1'), { timeout: 15_000 }).toBe('North scene 1 prose. Cold.')
    expect(await textOf(page, 'se1')).toBe('South scene 1 prose.')
  })

  test('F2: the panel’s title follows a rename on the Page, and typing in it keeps the rename', async ({ page }) => {
    const north = await book(page)
    await page.goto(`/#/worlds/${north}/manuscript/nc1`, { waitUntil: 'load' })
    await settle(page)
    await onPage(page)
    const panel = page.getByRole('region', { name: 'Chapter 1' })
    const field = panel.getByLabel('Chapter title')
    await expect(field).toHaveValue('North chapter 1')

    // Retitled on the Page, the guide's way: the heading line typed over.
    await page.locator('.cm-line', { hasText: '# North chapter 1' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.keyboard.type('# The North Road')
    await page.locator('.cm-line', { hasText: 'North scene 1 prose.' }).first().click()
    await expect.poll(() => chapterTitle(page, 'nc1'), { timeout: 15_000 }).toBe('The North Road')
    await expect(field).toHaveValue('The North Road')

    // Typing in the field goes on from the new title, not the old one.
    await field.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' (draft)')
    await expect.poll(() => chapterTitle(page, 'nc1'), { timeout: 15_000 }).toBe('The North Road (draft)')

    // The synopsis the same way: saved, then taken back by Undo, and the field says so.
    const synopsis = panel.getByLabel('Chapter synopsis')
    await synopsis.fill('They walk north.')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { get: (id: string) => Promise<{ synopsis: string }> } }
      return (await db.chapters.get('nc1')).synopsis
    }), { timeout: 15_000 }).toBe('They walk north.')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(synopsis).toHaveValue('')

    // And the notes.
    const notes = page.getByLabel("Writer's notes for this chapter")
    await notes.fill('Mind the tide.')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { get: (id: string) => Promise<{ notes: string }> } }
      return (await db.chapters.get('nc1')).notes
    }), { timeout: 15_000 }).toBe('Mind the tide.')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(notes).toHaveValue('')
  })

  test('F3: the panel says how relationships stand at the chapter’s end, wherever in it or before it they changed', async ({ page }) => {
    const north = await book(page)
    await page.goto(`/#/worlds/${north}/manuscript/nc1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const one = page.getByRole('region', { name: 'Chapter 1' })
    await expect(one.getByText('Relationship States')).toBeVisible({ timeout: 20_000 })
    // Recorded at the first of the chapter's two scenes: still how it ends.
    await expect(one.getByText('Uneasy allies · negative · strong')).toBeVisible()
    await expect(one.getByText('No relationship states recorded.')).toHaveCount(0)
    // Ann and Cy's falling-out is chapter 2's.
    await expect(one.getByText(/Sworn enemies/)).toHaveCount(0)

    // Chapter 2 records only the falling-out, and carries the alliance from chapter 1.
    await page.goto(`/#/worlds/${north}/manuscript/nc2?view=cards`)
    await settle(page)
    const two = page.getByRole('region', { name: 'Chapter 2' })
    await expect(two.getByText('Sworn enemies · negative · strong')).toBeVisible({ timeout: 20_000 })
    await expect(two.getByText('Uneasy allies · negative · strong')).toBeVisible()
  })

  test('F5: a place’s state on the Maps panel is said to be the scene’s', async ({ page }) => {
    const north = await book(page)
    // The cursor on a scene: the state section is shown only at one.
    await page.goto(`/#/worlds/${north}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByTitle('North scene 2', { exact: true }).first().click()
    await page.waitForTimeout(600)
    await page.goto(`/#/worlds/${north}/maps`)
    await settle(page)
    await page.getByRole('region', { name: /^Not on a map/ }).getByRole('button', { name: 'The Quay', exact: true }).click()
    await expect(page.getByText('State at this scene', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Notes for this scene...')).toBeVisible()
    await expect(page.getByText('Chapter State', { exact: true })).toHaveCount(0)
    await expect(page.getByPlaceholder('Notes for this chapter...')).toHaveCount(0)
  })
})
