import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * A character's names over the book (docs/records/character-names-plan.md, Part 1).
 *
 * The Library's *Fellowship* names Aragorn "Aragorn", with the aliases Strider
 * and Elessar, and a reader who had just met Strider at Bree opened his page to
 * read *Aragorn — also known as Strider, Elessar*: the reveal, and a name the
 * book gives him eleven chapters later. Here he is given what the book does:
 * Strider from The Common Room, Aragorn from Gandalf's letter, and Elessar
 * learned with the gifts of Galadriel. The Library's own data says so in a
 * later change; this spec sets it, so it tests the app and not the data.
 */

test.describe.configure({ timeout: 300_000 })

const COMMON_ROOM = '5146c2f3-18d4-482a-a92c-61d0f5e18231'
const LETTER = 'f9a72d3e-6184-47b2-9df8-013ac108ea49'
const GIFTS = 'c9e2b1d4-8f5a-4376-90a1-5d6b8c7e2f3a'

async function fellowship(page: Page) {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'The Fellowship of the Ring')
  await settle(page)
  const aragorn = await page.evaluate(async ([w, common, letter, gifts]) => {
    type C = { id: string; name: string }
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: {
        where: (k: string) => { equals: (v: string) => { toArray: () => Promise<C[]> } }
        update: (id: string, changes: object) => Promise<unknown>
      }
      events: { get: (id: string) => Promise<unknown> }
    }
    // The scenes this spec is about are the book's, by id: say so if the Library moved them.
    for (const id of [common, letter, gifts]) if (!(await db.events.get(id))) throw new Error(`no scene ${id}`)
    const a = (await db.characters.where('worldId').equals(w).toArray()).find((c) => c.name === 'Aragorn')!
    await db.characters.update(a.id, {
      aliases: ['Strider', 'Elessar'],
      nameChanges: [{ eventId: common, name: 'Strider' }, { eventId: letter, name: 'Aragorn' }],
      aliasesFrom: [{ alias: 'Elessar', eventId: gifts }],
    })
    return a.id
  }, [worldId, COMMON_ROOM, LETTER, GIFTS] as const)
  return { worldId, aragorn }
}

/** Put the reader at a scene — written before a reload, since a running page writes its own store back. */
async function readAt(page: Page, eventId: string) {
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, eventId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  const landed = await page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)
  expect(landed, 'the reader was actually placed').toBe(eventId)
}

async function openPage(page: Page, worldId: string, id: string) {
  await page.goto(`/#/worlds/${worldId}/characters/${id}`, { waitUntil: 'load' })
  await settle(page)
  const name = page.getByRole('main').getByRole('heading', { level: 2 }).first()
  await expect(name).toBeVisible({ timeout: 30_000 })
  return name
}

async function search(page: Page, q: string) {
  await page.getByTitle('Search (Ctrl+K)').click()
  const box = page.getByPlaceholder('Search this book, as far as you have read…')
  await box.fill(q)
  await page.waitForTimeout(500)
  // The character's result carries the start of their description as its second line.
  const found = await page.getByRole('button', { name: /A Ranger of the North/ }).count()
  await page.keyboard.press('Escape')
  return found
}

test('a reader is told what the book calls him where they are, and nothing ahead of it', async ({ page }) => {
  const { worldId, aragorn } = await fellowship(page)
  const main = page.getByRole('main')
  const roster = async () => {
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settle(page)
    await expect(main.getByRole('link').first()).toBeVisible({ timeout: 30_000 })
  }

  // At Bree, in The Common Room: Strider, and only Strider.
  await readAt(page, COMMON_ROOM)
  const name = await openPage(page, worldId, aragorn)
  await expect(name).toHaveText('Strider')
  await expect(main.getByText(/^Also known as/)).toHaveCount(0)
  await roster()
  await expect(main.getByRole('link', { name: /^Strider/ })).toBeVisible()
  await expect(main.getByRole('link', { name: /Aragorn/ })).toHaveCount(0)
  expect(await search(page, 'Strider')).toBe(1)
  expect(await search(page, 'Aragorn')).toBe(0)
  expect(await search(page, 'Elessar')).toBe(0)

  // Gandalf's letter: Aragorn, who has been Strider.
  await readAt(page, LETTER)
  await expect(await openPage(page, worldId, aragorn)).toHaveText('Aragorn')
  await expect(main.getByText('Also known as Strider', { exact: true })).toBeVisible()
  expect(await search(page, 'Aragorn')).toBe(1)
  expect(await search(page, 'Elessar')).toBe(0)

  // The gifts of Galadriel: Elessar too.
  await readAt(page, GIFTS)
  await openPage(page, worldId, aragorn)
  await expect(main.getByText('Also known as Strider, Elessar', { exact: true })).toBeVisible()
  expect(await search(page, 'Elessar')).toBe(1)
})

test('a writer sees his own name, is told what the book calls him here, and edits the names', async ({ page }) => {
  const { worldId, aragorn } = await fellowship(page)
  await page.evaluate(async (w: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (id: string, c: object) => Promise<unknown> } }
    await db.worlds.update(w, { readingMode: false })
  }, worldId)
  const main = page.getByRole('main')

  await readAt(page, COMMON_ROOM)
  await expect(await openPage(page, worldId, aragorn)).toHaveText('Aragorn')
  await expect(main.getByText('Called Strider at Ch. 9')).toBeVisible()
  await expect(main.getByText('Also known as Strider, Elessar', { exact: true })).toBeVisible()

  // Past the reveal his own name is the book's, and nothing needs saying.
  await readAt(page, LETTER)
  await openPage(page, worldId, aragorn)
  await expect(main.getByText(/^Called /)).toHaveCount(0)

  // The editor: one change taken out, one put in, and Elessar learned from the start.
  await main.getByRole('button', { name: 'Edit', exact: true }).click()
  const names = main.getByRole('group', { name: 'Names over the book' })
  await expect(names.getByRole('textbox', { name: 'called' })).toHaveCount(2)
  await names.getByRole('button', { name: /^Remove name change 2, Aragorn/ }).click()
  await names.getByRole('button', { name: 'Add a name change' }).click()
  await names.getByRole('button', { name: 'From choose a scene' }).click()
  await page.getByRole('option', { name: 'Ch. 20 — The Gifts of Galadriel' }).click()
  await names.getByRole('textbox', { name: 'called' }).nth(1).fill('Elessar')
  const learned = main.getByRole('group', { name: 'When each alias is learned' })
  await learned.getByRole('button', { name: /^Elessar known from/ }).click()
  await page.getByRole('option', { name: 'The start' }).click()
  await main.getByRole('button', { name: 'Save', exact: true }).click()

  await expect.poll(() => page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: { get: (id: string) => Promise<{ nameChanges?: Array<{ name: string }>; aliasesFrom?: unknown[] }> }
    }
    const c = await db.characters.get(id)
    return { changes: (c.nameChanges ?? []).map((n) => n.name), learned: c.aliasesFrom?.length ?? 0 }
  }, aragorn)).toEqual({ changes: ['Strider', 'Elessar'], learned: 0 })
  // And the page says so.
  await expect(main.getByText(/^Strider from Ch\. 9 — The Common Room; Elessar from Ch\. 20 — The Gifts of Galadriel$/)).toBeVisible()
})
