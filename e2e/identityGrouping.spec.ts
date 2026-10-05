import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'
import { waitForMapReady } from './helpers/map'

/**
 * Part 2b (docs/records/character-names-plan.md, §3; the audit is
 * docs/records/identity-audit-2b.md): from the reveal a reader has reached, Hyde
 * is shown as Jekyll — one person on every screen that looks a character up.
 *
 * Every screen is paired: in chapter 4, before the reveal, the two men are two
 * entries on it; at Lanyon's narrative they are one. Vacuity cannot satisfy both
 * halves, and a screen missed by the grouping fails the second half by still
 * showing Hyde, or by losing him from scenes that were his.
 */

test.describe.configure({ timeout: 300_000 })

const JEKYLL = 'jekyll-hyde-char-jekyll'
const HYDE = 'jekyll-hyde-char-hyde'
/** Chapter 4: both men met, the murder done, nothing yet known. */
const CAREW = 'jekyll-hyde-event-15'
/** Chapter 9, Dr Lanyon's narrative: the reveal, where both men are recorded. */
const REVEAL = 'jekyll-hyde-event-37'

async function book(page: Page) {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'Strange Case of Dr Jekyll and Mr Hyde')
  await settle(page)
  // The book carries the link; checked rather than assumed, so a regenerated Library cannot empty this spec.
  expect(await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { get: (id: string) => Promise<{ revealedAs?: unknown }> } }
    return (await db.characters.get(id)).revealedAs ?? null
  }, HYDE)).toEqual({ characterId: JEKYLL, eventId: REVEAL })
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

const go = async (page: Page, worldId: string, path: string) => {
  await page.goto(`/#/worlds/${worldId}/${path}`, { waitUntil: 'load' })
  await settle(page)
}

test('before the reveal two men, from it one person: roster, page, appearances, history and state', async ({ page }) => {
  const worldId = await book(page)
  const main = page.getByRole('main')
  const person = (name: string) => main.getByRole('link', { name: new RegExp(`^${name}\\b`) })

  // Chapter 4: two entries, and Jekyll's appearances are his own.
  await readAt(page, CAREW)
  await go(page, worldId, 'characters')
  await expect(person('Edward Hyde')).toHaveCount(1, { timeout: 20_000 })
  await expect(person('Dr Henry Jekyll')).toHaveCount(1)
  await go(page, worldId, `characters/${JEKYLL}?tab=appearances`)
  await expect(main.getByText('Dinner at Jekyll’s House')).toBeVisible({ timeout: 20_000 })
  await expect(main.getByText('Hyde Tramples the Child')).toHaveCount(0)

  // The reveal: one entry; Hyde's scenes are Jekyll's; his records are there under his other name.
  await readAt(page, REVEAL)
  await go(page, worldId, 'characters')
  await expect(person('Dr Henry Jekyll')).toHaveCount(1, { timeout: 20_000 })
  await expect(person('Edward Hyde')).toHaveCount(0)
  await go(page, worldId, `characters/${JEKYLL}?tab=appearances`)
  await expect(main.getByText('Hyde Tramples the Child')).toBeVisible({ timeout: 20_000 })
  await expect(main.getByText('Dinner at Jekyll’s House')).toBeVisible()

  // Hyde's address, with its tab, is the person's.
  await go(page, worldId, `characters/${HYDE}?tab=history`)
  await expect(page).toHaveURL(new RegExp(`/characters/${JEKYLL}\\?tab=history`))
  const asHyde = main.getByRole('region', { name: 'As Edward Hyde' })
  await expect(asHyde).toBeVisible({ timeout: 20_000 })
  await expect(asHyde.getByText('Hyde Tramples the Child')).toBeVisible()

  // Current State at the reveal, where both are recorded: Jekyll's own, then Hyde's.
  await go(page, worldId, `characters/${JEKYLL}?tab=state`)
  await expect(main.getByRole('region', { name: 'As Edward Hyde' })).toBeVisible({ timeout: 20_000 })

  // His bonds are the person's: Hyde's victim is on Jekyll's tab, and the bond between the two halves is not.
  await go(page, worldId, `characters/${JEKYLL}?tab=relationships`)
  await expect(main.getByText('Murderer and victim')).toBeVisible({ timeout: 20_000 })
  await expect(main.getByText('Old friendship and legal trust')).toBeVisible()
  await expect(main.getByText('Two identities in one body')).toHaveCount(0)
})

test('before the reveal, Jekyll’s bonds are his own', async ({ page }) => {
  // The other half of the pair above, kept apart so each half reads on its own.
  const worldId = await book(page)
  const main = page.getByRole('main')
  await readAt(page, CAREW)
  await go(page, worldId, `characters/${JEKYLL}?tab=relationships`)
  await expect(main.getByText('Old friendship and legal trust')).toBeVisible({ timeout: 20_000 })
  await expect(main.getByText('Murderer and victim')).toHaveCount(0)
})

test('a fact both halves learn is known by the person once, from the first of them', async ({ page }) => {
  const worldId = await book(page)
  const main = page.getByRole('main')
  // The book has Jekyll learn this at 10.7; Hyde is given it at 10.5, so the person knows it from there.
  await page.evaluate(async ([hyde]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, string>>>; add: (v: unknown) => Promise<unknown> }>
    const fact = (await db.knowledgeFacts.toArray()).find((f) => f.title === 'Hyde can emerge without the draught')!
    const now = Date.now()
    await db.knowledgeReveals.add({ id: 'kr-hyde', worldId: fact.worldId, factId: fact.id, characterId: hyde, eventId: 'jekyll-hyde-event-43', note: '', createdAt: now, updatedAt: now })
  }, [HYDE] as const)
  await readAt(page, 'jekyll-hyde-event-47')
  await go(page, worldId, 'knowledge')
  await main.getByText('Hyde can emerge without the draught', { exact: true }).first().click()
  const knowers = main.getByText('Dr Henry Jekyll', { exact: true })
  await expect(knowers.first()).toBeVisible({ timeout: 20_000 })
  await expect(knowers).toHaveCount(1)
  await expect(main.getByText('Edward Hyde', { exact: true })).toHaveCount(0)
})

test('before the reveal two, from it one: the graph, the map and the Arc grid', async ({ page }) => {
  const worldId = await book(page)
  const main = page.getByRole('main')

  for (const [at, hydeShown] of [[CAREW, true], [REVEAL, false]] as const) {
    await readAt(page, at)

    // The relationship graph: Hyde's node, or none — and his bonds still drawn, to Jekyll.
    await go(page, worldId, 'relationships')
    await expect(main.getByText('Dr Henry Jekyll', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    // His name is on the node and in the graph's own list beside it: shown, or nowhere.
    if (hydeShown) await expect(main.getByText('Edward Hyde', { exact: true }).first()).toBeVisible()
    else await expect(main.getByText('Edward Hyde', { exact: true })).toHaveCount(0)

    // The map's cast: a row for each, or one.
    await go(page, worldId, 'maps')
    await waitForMapReady(page)
    const castRow = (name: string) => main.getByRole('button', { name: new RegExp(`^${name}\\b`) })
    await expect(castRow('Dr Henry Jekyll')).toHaveCount(1, { timeout: 20_000 })
    await expect(castRow('Edward Hyde')).toHaveCount(hydeShown ? 1 : 0)

    // The Arc grid: a row each, or one — marked where both were recorded at a scene.
    await go(page, worldId, 'arc')
    // A row's name is the first cell's; a state note naming Hyde elsewhere in the grid is not a row.
    const rowNamed = (name: string) => main.locator('tbody tr > td:first-child > span.font-medium').filter({ hasText: new RegExp(`^${name}$`) })
    await expect(rowNamed('Dr Henry Jekyll')).toHaveCount(1, { timeout: 20_000 })
    await expect(rowNamed('Edward Hyde')).toHaveCount(hydeShown ? 1 : 0)
    await expect(main.getByText('Also recorded here as Edward Hyde')).toHaveCount(hydeShown ? 0 : 1)
  }

  // A scene after the reveal where only Hyde is recorded: the person is where Hyde is, not where Jekyll last was.
  await readAt(page, 'jekyll-hyde-event-44')
  await go(page, worldId, 'maps')
  await waitForMapReady(page)
  const jekyllRow = main.getByRole('button', { name: /^Dr Henry Jekyll\b/ })
  await expect(jekyllRow).toContainText('Carew Murder Site', { timeout: 20_000 })
  await expect(jekyllRow).not.toContainText('Hyde’s Soho Rooms')
})
