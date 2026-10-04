import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * Revealed to be the same person (docs/records/character-names-plan.md, Part 2,
 * first pull request): Hyde is Jekyll. The Library keeps them as two characters,
 * rightly — the book presents two men until Lanyon watches one become the other
 * — and nothing joined them, so a reader who had finished it saw two strangers.
 *
 * Here the two pages name each other from the reveal, and nothing before it
 * gives it away. Grouping them into one entry everywhere is the next pull
 * request.
 */

test.describe.configure({ timeout: 300_000 })

const JEKYLL = 'jekyll-hyde-char-jekyll'
const HYDE = 'jekyll-hyde-char-hyde'
/** Chapter 4: both men met, the murder done, nothing yet known. */
const CAREW = 'jekyll-hyde-event-15'
/** Chapter 9, Dr Lanyon's narrative: the reveal. */
const REVEAL = 'jekyll-hyde-event-37'

async function book(page: Page, opts: { linked: boolean }) {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'Strange Case of Dr Jekyll and Mr Hyde')
  await settle(page)
  await page.evaluate(async ([hyde, jekyll, reveal, carew, linked]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: { get: (id: string) => Promise<unknown>; update: (id: string, c: object) => Promise<unknown> }
      events: { get: (id: string) => Promise<unknown> }
    }
    for (const id of [hyde, jekyll]) if (!(await db.characters.get(id as string))) throw new Error(`no character ${id}`)
    for (const id of [reveal, carew]) if (!(await db.events.get(id as string))) throw new Error(`no scene ${id}`)
    if (linked) await db.characters.update(hyde as string, { revealedAs: { characterId: jekyll, eventId: reveal } })
  }, [HYDE, JEKYLL, REVEAL, CAREW, opts.linked] as const)
  return worldId
}

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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)).toBe(eventId)
}

async function openPage(page: Page, worldId: string, id: string) {
  await page.goto(`/#/worlds/${worldId}/characters/${id}`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 30_000 })
}

/** The characters a search answers with, by name. */
async function searchCharacters(page: Page, q: string, placeholder: RegExp) {
  await page.getByTitle('Search (Ctrl+K)').click()
  await page.getByPlaceholder(placeholder).fill(q)
  await page.waitForTimeout(500)
  const labels = await page.locator('[data-search-result-label]').allInnerTexts()
  await page.keyboard.press('Escape')
  return labels.filter((l) => l === 'Dr Henry Jekyll' || l === 'Edward Hyde').sort()
}

test('a reader is told Hyde is Jekyll from the reveal, and not a moment before', async ({ page }) => {
  const worldId = await book(page, { linked: true })
  const main = page.getByRole('main')

  // Chapter 4: two men, nothing between them.
  await readAt(page, CAREW)
  await openPage(page, worldId, HYDE)
  await expect(main.getByRole('heading', { level: 2 }).first()).toHaveText('Edward Hyde')
  await expect(main.getByText(/^Revealed to be/)).toHaveCount(0)
  await openPage(page, worldId, JEKYLL)
  await expect(main.getByText(/^Also /)).toHaveCount(0)
  expect(await searchCharacters(page, 'Jekyll', /as far as you have read/)).toEqual(['Dr Henry Jekyll'])

  // The reveal: each page names the other, and either name finds both.
  await readAt(page, REVEAL)
  await openPage(page, worldId, HYDE)
  await expect(main.getByText('Revealed to be Dr Henry Jekyll', { exact: true })).toBeVisible()
  await main.getByRole('link', { name: 'Dr Henry Jekyll', exact: true }).click()
  await expect(main.getByRole('heading', { level: 2 }).first()).toHaveText('Dr Henry Jekyll')
  await expect(main.getByText('Also Edward Hyde', { exact: true })).toBeVisible()
  expect(await searchCharacters(page, 'Jekyll', /as far as you have read/)).toEqual(['Dr Henry Jekyll', 'Edward Hyde'])
})

test('a writer joins them in the editor, sees where, and cannot make a chain', async ({ page }) => {
  const worldId = await book(page, { linked: false })
  await page.evaluate(async (w: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (id: string, c: object) => Promise<unknown> } }
    await db.worlds.update(w, { readingMode: false })
  }, worldId)
  const main = page.getByRole('main')

  // Before any link, Jekyll could be revealed as someone: the choice is offered.
  await openPage(page, worldId, JEKYLL)
  await main.getByRole('button', { name: 'Edit', exact: true }).click()
  const jekyllReveal = main.getByRole('group', { name: 'Revealed to be' })
  await expect(jekyllReveal.getByRole('button', { name: /^Revealed to be No one/ })).toBeVisible()
  await main.getByRole('button', { name: 'Cancel', exact: true }).click()

  // Hyde, revealed to be Jekyll, at the scene Lanyon watches it.
  await openPage(page, worldId, HYDE)
  await main.getByRole('button', { name: 'Edit', exact: true }).click()
  const reveal = main.getByRole('group', { name: 'Revealed to be' })
  await reveal.getByRole('button', { name: /^Revealed to be No one/ }).click()
  await page.getByRole('option', { name: 'Dr Henry Jekyll', exact: true }).click()
  await reveal.getByRole('button', { name: /^at choose the scene/ }).click()
  await page.getByRole('option', { name: 'Ch. 9 — Hyde Becomes Jekyll' }).click()
  await main.getByRole('button', { name: 'Save', exact: true }).click()

  await expect.poll(() => page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { get: (id: string) => Promise<{ revealedAs?: unknown }> } }
    return (await db.characters.get(id)).revealedAs ?? null
  }, HYDE)).toEqual({ characterId: JEKYLL, eventId: REVEAL })
  await expect(main.getByText('Revealed to be Dr Henry Jekyll at Ch. 9', { exact: true })).toBeVisible()

  // Jekyll's page names Hyde, and his editor refuses to make him someone else's.
  await openPage(page, worldId, JEKYLL)
  await expect(main.getByText('Also Edward Hyde (revealed at Ch. 9)', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(main.getByText(/Edward Hyde is revealed to be them, so they cannot be revealed to be someone else/)).toBeVisible()
  await expect(main.getByRole('group', { name: 'Revealed to be' }).getByRole('button', { name: /^Revealed to be No one/ })).toHaveCount(0)

  // A writer's search finds both under either name, whatever the cursor.
  expect(await searchCharacters(page, 'Hyde', /your world/)).toEqual(['Dr Henry Jekyll', 'Edward Hyde'])
})
