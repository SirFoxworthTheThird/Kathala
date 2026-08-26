import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { unmetNames, benignText } from './helpers/unmet'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * The promise reading mode makes, checked as one property rather than screen by
 * screen: with the cursor at the opening moment, no name the reader has not met
 * appears anywhere in the app.
 *
 * Gating each view by hand would leave the *next* view unguarded — this is what
 * notices.
 *
 * **It used to claim it walked every world-scoped route.** It did not: `ROUTES`
 * was twelve hardcoded index segments with no detail route among them, and a
 * reader run walked in through the one it could not see. Opening a chapter the
 * reader had not reached showed its scenes, its synopsis and its Character
 * States — on *Philosopher's Stone* at chapter 4, Quirrell and Voldemort in the
 * same list. The comment had never been true, and a guard that overstates its
 * reach is worse than one that admits its edges, because it stops anyone
 * looking.
 *
 * The detail routes are enumerated from the store now, so the sweep covers the
 * pages a reader actually opens rather than only the ones that list them.
 */

test.describe.configure({ timeout: 180_000 })

/** The index screens — every one reachable from the nav. */
const INDEX_ROUTES = [
  '', 'timeline', 'corkboard', 'calendar', 'characters', 'maps', 'items',
  'relationships', 'arc', 'lore', 'factions', 'knowledge',
]

test('no unmet name appears anywhere in reading mode', async ({ page }) => {
  await resetDB(page)
  /*
    Named, not `.first()`. Filing the catalogue alphabetically (**LIB-1**) moved
    *Around the World in Eighty Days* to the top, so this spec's subject changed
    as a side effect of a UI change and nobody chose it.
  */
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await settle(page)
  const worldId = new URL(page.url()).hash.split('/')[2]

  // Step onto the opening moment, where nearly the whole book is still unread.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)

  const unmet = await unmetNames(page)
  const benign = await benignText(page)
  expect(unmet.characters.length, 'the fixture should leave plenty unmet').toBeGreaterThan(10)

  // Names long enough that a match is a real leak rather than a coincidence,
  // and not already given away by the book's own contents page.
  const needles = [
    ...unmet.characters.map((n) => ['character', n] as const),
    ...unmet.items.map((n) => ['item', n] as const),
    ...unmet.locations.map((n) => ['location', n] as const),
    ...unmet.threads.map((n) => ['subplot', n] as const),
  ].filter(([, n]) => n && n.trim().length >= 5 && !benign.includes(n.toLowerCase()))

  /*
    Every detail page a reader can open, read from the store rather than listed
    here — a chapter added to a book is covered without anyone remembering.
    Chapters are the ones that leaked; characters, items and lore are swept too
    because the same omission would look identical on any of them.
  */
  const detail = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
      string, { toArray: () => Promise<Array<{ id: string }>> }
    >
    const ids = async (table: string) => (await db[table].toArray()).map((r) => r.id)
    const [chapters, characters, items, lore] = await Promise.all([
      ids('chapters'), ids('characters'), ids('items'), ids('lorePages'),
    ])
    return [
      ...chapters.map((id) => `timeline/${id}`),
      ...characters.map((id) => `characters/${id}`),
      ...items.map((id) => `items/${id}`),
      ...lore.map((id) => `lore/${id}`),
    ]
  })
  expect(detail.length, 'the sweep should reach real detail pages').toBeGreaterThan(20)

  /*
    A met character's own description is prose the reader is entitled to — it is
    the app's answer to *who is this again* — and prose can name somebody they
    have not met: Petunia's reads "Harry's aunt and Lily Potter's sister". The
    app cannot gate that without redacting the author's sentence, and **X-8**
    already records the same limit for scene text. So a name is forgiven **only**
    inside the description of the character whose own page it is; the same name
    anywhere else on that page, or on any other, still fails.
  */
  const ownDescription = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: { toArray: () => Promise<Array<{ id: string; description?: string }>> }
    }
    return Object.fromEntries((await db.characters.toArray())
      .map((c) => [`characters/${c.id}`, (c.description ?? '').toLowerCase()]))
  }) as Record<string, string>

  const leaks: string[] = []
  /*
    Roughly a hundred routes, each of which used to be given a flat
    `waitForTimeout(1200)` — about two minutes of the suite's wall clock in this
    one test. `settle` waits for the screen to stop changing instead, which
    averages 463ms on this book and, on a slow one, waits longer than 1,200 ever
    did. See `helpers/settle.ts`.
  */
  for (const route of [...INDEX_ROUTES, ...detail]) {
    await page.goto(`/#/worlds/${worldId}/${route}`)
    await settle(page)

    /*
      Open everything that opens before reading the page.
      The timeline's chapter rows start collapsed, so this sweep was checking
      the closed state of the one screen that lists every scene in the book —
      the same blind spot `buttonNames` had under **WRUN-6**, where a sweep
      visited a state its target never rendered in. Expanding chapter 17 of
      *Philosopher's Stone* from chapter 4 listed "Quirrell and Voldemort".
    */
    if (route === 'timeline') {
      const disclosures = page.getByRole('button', { name: /^Ch\. \d+/ })
      const n = await disclosures.count()
      expect(n, 'the timeline should list this book\'s chapters').toBeGreaterThan(5)
      for (let i = 0; i < n; i++) {
        await disclosures.nth(i).click({ timeout: 5_000 }).catch(() => {})
      }
      await settle(page)
    }
    // The whole document, not just <main>. The time-cursor bar, the top bar and
    // the nav rail all sit outside it, and checking only <main> is how a
    // subplot filter listing "The Philosopher's Stone Mystery" went unnoticed.
    const text = (await page.evaluate(`(() => document.body.innerText)()`)) as string
    const forgiven = ownDescription[route] ?? ''
    for (const [kind, name] of needles) {
      if (forgiven.includes(name.toLowerCase())) continue
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (pattern.test(text)) leaks.push(`/${route || 'dashboard'} → ${kind} “${name}”`)
    }
  }

  expect(leaks, `unmet names on screen:\n${leaks.join('\n')}`).toEqual([])
})

/**
 * Search is the one screen the gate does not reach by walking routes: it is a
 * dialog, it reads eleven tables directly rather than through the entity hooks,
 * and a single letter matches most of the world. It gets its own pass.
 */
test('search does not answer with what the reader has not met', async ({ page }) => {
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await settle(page)

  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)

  const unmet = await unmetNames(page)
  const benign = await benignText(page)
  expect(unmet.characters.length).toBeGreaterThan(10)

  // Names must be matched against result *labels*, not the whole dialog: a
  // revealed record's own description may legitimately mention another place
  // in prose, and redacting authored text is not what the gate does.
  const needles = [
    ...unmet.characters.map((n) => ['character', n] as const),
    ...unmet.items.map((n) => ['item', n] as const),
    ...unmet.locations.map((n) => ['location', n] as const),
  ].filter(([, n]) => n && n.trim().length >= 5 && !benign.includes(n.toLowerCase()))

  const leaks: string[] = []
  for (const query of ['a', 'e', 'o', 'the']) {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(400)
    await page.keyboard.insertText(query)
    await page.waitForTimeout(700)

    const labels = (await page.evaluate(
      `(() => [...document.querySelectorAll('[data-search-result-label]')].map((n) => n.textContent ?? ''))()`,
    )) as string[]
    for (const [kind, name] of needles) {
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (labels.some((l) => pattern.test(l))) leaks.push(`“${query}” → ${kind} “${name}”`)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  expect(leaks, `search returned unmet names:\n${leaks.join('\n')}`).toEqual([])
})

/*
  R2 from a blind reader run, on the book that shows it.

  A map layer is revealed as soon as any marker on it is, and search gated
  routes and regions on the *layer* while the map screen gated them on their
  waypoints. Dracula's Europe layer opens in chapter 1, so "The Hunters to
  Varna" — the pursuit of chapters 24 to 26 — was searchable from the first page
  of the book, while the Maps screen at the same cursor showed `ROUTES 0`.

  Paired against reading mode off rather than against chapter 24: the route has
  to be findable *somewhere*, or "no results" would pass on a search that was
  broken rather than gated.
*/
test('search does not hand a reader a route from the end of the book', async ({ page }) => {
  const search = async (q: string) => {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(400)
    await page.keyboard.insertText(q)
    await page.waitForTimeout(800)
    const labels = (await page.evaluate(
      `(() => [...document.querySelectorAll('[data-search-result-label]')].map((n) => n.textContent ?? ''))()`,
    )) as string[]
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    return labels
  }

  await resetDB(page)
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)

  expect(await search('Hunters')).not.toContain('The Hunters to Varna')

  // The presence half: with the gate off, the very same query finds it.
  const worldPath = new URL(page.url()).hash.replace(/^#/, '').split('/').slice(0, 3).join('/')
  await page.goto(`/#${worldPath}/settings`)
  await settle(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await settle(page)
  expect(await search('Hunters')).toContain('The Hunters to Varna')
})

/**
 * The overlays mounted app-wide, checked as a set.
 *
 * Both holes the route walk missed were dialogs — the search palette, and the
 * chapter-diff modal that shows a later chapter's contents wholesale. Walking
 * routes cannot see either, because neither is a route. This asserts the way
 * *in* is gone, which is the property that actually matters: a panel nobody can
 * open cannot leak, and one left reachable is a hole waiting to be found.
 */
test('no writing-mode overlay is reachable while reading', async ({ page }) => {
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await settle(page)

  // Step onto a moment and open the timeline. The diff button lives in the
  // event bar and needs both: an active event, and the bar expanded on the
  // timeline route. Asserting from the dashboard passes for the wrong reason.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}/timeline`)
  await settle(page)
  await expect(page.getByTitle('Play story on the map')).toHaveCount(1)

  for (const label of ['Compare chapters', "Writer's Brief", 'Continuity Checker', 'Recent changes']) {
    await expect(page.getByTitle(label, { exact: true }), `${label} is reachable`).toHaveCount(0)
  }

  // Search is deliberately kept — a reader wants it, and it is gated instead.
  await expect(page.getByTitle('Search (Ctrl+K)')).toHaveCount(1)
})
