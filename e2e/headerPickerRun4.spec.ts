import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The header's picker and note on the Page, as writer run 4 found them:
 *
 * - W-4: the Characters line offered a new *item* and a new *place*, and a
 *   second "Tobias" under the person already called Tobias.
 * - W-5: after "Create … as a place" the note went on saying nothing was
 *   called that.
 * - W-7: of three people a header made, only the last was asked for their
 *   other names.
 * - W-8: a click at the end of a name already written opened the picker, so
 *   the Enter meant for a new line completed the name instead.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The assize rises', 'The court sat.'], ['e2', 'Teodora at the table', 'She counted.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    // The foundling the book comes to call Tobias.
    await db.characters.add({ id: 'teo', worldId: id, name: 'Teodora Vance', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'fnd', worldId: id, name: 'The Foundling', description: '', aliases: ['Tobias'], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

/** The caret at the start of scene "Teodora at the table"'s prose, where its header goes. */
async function firstLine(page: Page) {
  await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
  await page.keyboard.press('Home')
}

const row = (page: Page, name: string, kind: string) => page.getByRole('button', { name: `${name} ${kind}`, exact: true })
const scene = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ involvedCharacterIds: string[]; locationMarkerId: string | null }> }
    characters: { toArray: () => Promise<Array<{ id: string; name: string }>> }
    locationMarkers: { toArray: () => Promise<Array<{ id: string; name: string }>> }
  }
  const e = await db.events.get('e2')
  const people = await db.characters.toArray()
  const places = await db.locationMarkers.toArray()
  return {
    cast: e.involvedCharacterIds.map((id) => people.find((p) => p.id === id)?.name).sort(),
    place: places.find((p) => p.id === e.locationMarkerId)?.name ?? null,
    people: people.map((p) => p.name).sort(),
  }
})

test.describe('the header picker and note on the Page, after writer run 4', () => {
  test.describe.configure({ timeout: 120_000 })

  test('the Characters line offers only new people, never a name somebody goes by; each person made is asked; a click opens nothing', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await firstLine(page)

    // W-4: a name nobody answers — a new character, and nothing but.
    await page.keyboard.type('[@@Brass Bell')
    await expect(row(page, 'Brass Bell', 'new character')).toBeVisible()
    await expect(row(page, 'Brass Bell', 'new item')).toHaveCount(0)
    await expect(row(page, 'Brass Bell', 'new place')).toHaveCount(0)
    for (let i = 0; i < '@@Brass Bell'.length; i++) await page.keyboard.press('Backspace')

    // W-4: Tobias is The Foundling's — offered as him, not as somebody new.
    await page.keyboard.type('@@Tobias')
    await expect(row(page, 'The Foundling', 'character')).toBeVisible()
    await expect(row(page, 'Tobias', 'new character')).toHaveCount(0)
    for (let i = 0; i < '@@Tobias'.length; i++) await page.keyboard.press('Backspace')

    // W-7: two made in one header, and both asked.
    await page.keyboard.type('@@Ann Bell')
    await row(page, 'Ann Bell', 'new character').click()
    await page.keyboard.type(' @@Bo Reed')
    await row(page, 'Bo Reed', 'new character').click()
    // Both asked, one at a time (writer run 11): Ann, made first, with Bo counted behind her.
    await expect(page.getByText('Ann Bell is new (1 of 2).')).toBeVisible()
    await expect(page.getByText(/Bo Reed is new/)).toHaveCount(0)
    await page.keyboard.type(']')
    // Leave it, so it is applied and drawn as the block.
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await scene(page)).cast).toEqual(['Ann Bell', 'Bo Reed'])
    await page.getByRole('button', { name: 'Not now: no other names for Ann Bell', exact: true }).click()
    await expect(page.getByText(/Ann Bell is new/)).toHaveCount(0)
    await expect(page.getByText('Bo Reed is new.')).toBeVisible()

    // W-8: a click at the end of the Characters line opens no picker…
    const line = page.locator('.cm-line', { hasText: 'Characters:' }).first()
    await expect(line).toContainText('@@Bo Reed')
    const box = (await line.boundingBox())!
    await line.click({ position: { x: box.width - 4, y: box.height / 2 } })
    await page.waitForTimeout(300)
    await expect(row(page, 'Bo Reed', 'character')).toHaveCount(0)
    // …and typing in the name does.
    await page.keyboard.press('Backspace')
    await expect(row(page, 'Bo Reed', 'character')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.type('d')
    expect((await scene(page)).people).toEqual(['Ann Bell', 'Bo Reed', 'Teodora Vance', 'The Foundling'])
  })

  test('on a scene card: each person made is asked, and a click in a name opens nothing', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('She counted.', { timeout: 20_000 })
    await draft.click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('[@@Ann Bell')
    await row(page, 'Ann Bell', 'new character').click()
    await page.keyboard.type(' @@Bo Reed')
    await row(page, 'Bo Reed', 'new character').click()
    // Both asked, one at a time (writer run 11): Ann, made first, with Bo counted behind her.
    await expect(page.getByText('Ann Bell is new (1 of 2).')).toBeVisible()
    await expect(page.getByText(/Bo Reed is new/)).toHaveCount(0)

    // A click with the caret at the end of "Bo Reed", already written: no picker…
    const at = await draft.evaluate((el: HTMLTextAreaElement) => el.value.indexOf('Bo Reed') + 'Bo Reed'.length)
    await draft.evaluate((el: HTMLTextAreaElement, n: number) => {
      el.setSelectionRange(n, n)
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, at)
    await page.waitForTimeout(300)
    await expect(row(page, 'Bo Reed', 'character')).toHaveCount(0)
    // …and typing in it does.
    await page.keyboard.press('Backspace')
    await expect(row(page, 'Bo Reed', 'character')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('a place made from the note: the note says so no longer', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // Another scene's line kept as typed, for a name nobody answers: the note was only ever cleared once no scene had one.
    await page.locator('.cm-line', { hasText: 'The court sat.' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[@@Nobody Knownat')
    await page.keyboard.press('Escape')
    await page.keyboard.type(']')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world is called “Nobody Knownat”' })).toBeVisible()

    await firstLine(page)
    // The writer's own steps: the header left open, somebody made in it, and the line left.
    await page.keyboard.type('[#Quay @@Ann Bell')
    await row(page, 'Ann Bell', 'new character').click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')

    const note = page.getByRole('status').filter({ hasText: 'Nothing in this world is called “Quay”' })
    await expect(note).toBeVisible()
    await page.getByRole('button', { name: 'Not now: no other names for Ann Bell', exact: true }).click()
    await page.getByRole('button', { name: 'Create “Quay” as a place', exact: true }).click()
    await expect.poll(async () => (await scene(page)).place).toBe('Quay')
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
    await page.waitForTimeout(1500)
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
  })
})
