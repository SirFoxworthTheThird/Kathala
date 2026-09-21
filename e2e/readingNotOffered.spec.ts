import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'
import { sidebarSection, waitForMapReady } from './helpers/map'

/**
 * Four things a reader was shown that only mean something to a writer.
 *
 * All four come from the same blind reader run, grouped under R9 as "smaller
 * things that made me stop reading for a second":
 *
 * - the shelf card counting a cast the reader has not met,
 * - a **carried forward** badge on every roster card, which the reader said
 *   they never worked out,
 * - *"Type @ in a scene's draft…"* on the Appearances tab of a book with no
 *   drafts to type in,
 * - **ROUTES 0** and **REGIONS 0** in the map sidebar: two things to open and
 *   find nothing in, every visit.
 *
 * Every test pairs the absence with the presence by turning reading mode off on
 * the same world and asserting the thing comes back. An assertion that
 * something is missing passes just as well on a screen that never had it, and
 * three of these four sit on screens with a lot else going on.
 *
 * **The cursor is chosen from the data, not guessed.** Two of these tests were
 * vacuous when written because the cursor was left where the book opens. At
 * chapter one nothing is inherited — every resolved snapshot *is* the current
 * scene's — so "no carried forward badge" passed on a screen that would not
 * have drawn one for a writer either. The helpers below search for a cursor
 * that makes the writer's version appear, and throw rather than settle for one
 * that does not.
 */

const ALICE = 'Alice’s Adventures in Wonderland'

async function download(page: Page, title: string) {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, title)
  await settle(page)
  return worldId
}

/**
 * Point the cursor at an event and reload.
 *
 * The reload is the point. These routes are hash-only, so navigating from one
 * `/#/worlds/…` to another does not reload the document and the persisted store
 * keeps whatever cursor it hydrated with — writing localStorage without this
 * left both callers still sitting on the opening scene.
 */
async function useCursor(page: Page, finder: string) {
  const chosen = await page.evaluate(`(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('KathalaDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll()
        q.onsuccess = () => r(q.result)
      })
      Promise.all([read('events'), read('chapters'), read('characterSnapshots')])
        .then(([events, chapters, snaps]) => {
          const num = new Map(chapters.map((c) => [c.id, c.number]))
          const key = (e) => (num.get(e.chapterId) ?? 0) + e.sortOrder / 1e6
          const chosen = (${finder})({ events, snaps, key })
          if (!chosen) return reject(new Error('no event in this world produces the state under test'))
          /*
            Both, and eventByWorld is the one that matters. The cursor is
            remembered per world so reopening a book resumes rather than
            restarts, and opening a world restores activeEventId from it.
            Setting activeEventId alone survived exactly until the world was
            opened and then went back to chapter one, which is how two earlier
            versions of these tests came to be asserting about the opening
            scene while claiming to be at the end of the book.
            (No backticks in here: this whole function is a template literal.)
          */
          const worldId = location.hash.split('/')[2]
          const raw = JSON.parse(localStorage.getItem('kathala-ui') || '{}')
          const state = raw.state || {}
          raw.state = {
            ...state,
            activeEventId: chosen,
            eventByWorld: { ...(state.eventByWorld || {}), [worldId]: chosen },
          }
          localStorage.setItem('kathala-ui', JSON.stringify(raw))
          resolve(chosen)
        })
    }
  }))()`)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  return chosen as string
}

/** The last scene in the book — everything the story ever reveals is revealed. */
const LAST_SCENE = `({ events, key }) => {
  let best = null
  for (const e of events) { const k = key(e); if (!best || k > best.k) best = { k, id: e.id } }
  return best && best.id
}`

/**
 * The first scene at which somebody's state is inherited.
 *
 * A snapshot is written only by a direct edit, so state at the cursor is
 * whatever was last recorded at or before it. This finds the earliest scene
 * where that resolves to an *earlier* scene for at least one character, which
 * is precisely when the badge has something to say.
 */
const AN_INHERITED_SCENE = `({ events, snaps, key }) => {
  const ordered = events.map((e) => ({ id: e.id, k: key(e) })).sort((a, b) => a.k - b.k)
  const byCharacter = new Map()
  for (const s of snaps) {
    if (!byCharacter.has(s.characterId)) byCharacter.set(s.characterId, [])
    const at = ordered.find((o) => o.id === s.eventId)
    if (at) byCharacter.get(s.characterId).push(at.k)
  }
  for (const scene of ordered) {
    for (const keys of byCharacter.values()) {
      const here = keys.some((k) => k === scene.k)
      const earlier = keys.some((k) => k < scene.k)
      if (earlier && !here) return scene.id
    }
  }
  return null
}`

/** The path a writer takes to stop a world being a book. */
async function turnReadingModeOff(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  const off = page.getByRole('button', { name: 'Turn off reading mode' })
  await expect(off, 'the world really did arrive as a book').toBeVisible()
  await off.click()
  await expect(page.getByRole('button', { name: 'Turn on reading mode' })).toBeVisible()
  await settle(page)
}

test('the shelf card does not tell a reader how large the cast is', async ({ page }) => {
  const worldId = await download(page, ALICE)

  const shelf = page.getByRole('main')
  const openShelf = async () => {
    await page.goto('/#/', { waitUntil: 'load' })
    await settle(page)
    // One download, so one card — which is what lets the counts be looked up on
    // the shelf itself rather than through a card locator built out of
    // ancestors, which found nothing.
    await expect(shelf.getByRole('heading', { name: ALICE })).toHaveCount(1)
  }

  await openShelf()
  await expect(shelf.getByText(/\d+ chapters?/), 'the book’s length is not a secret').toBeVisible()
  await expect(shelf.getByText(/\d+ characters?/), 'the cast size is').toHaveCount(0)

  await turnReadingModeOff(page, worldId)
  await openShelf()
  await expect(shelf.getByText(/\d+ characters?/), 'a writer is told').toBeVisible()
})

test('no "carried forward" badge while reading', async ({ page }) => {
  const worldId = await download(page, ALICE)

  const roster = async () => {
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('main').getByText('Alice').first(),
      'the roster is on screen').toBeVisible()
  }

  await useCursor(page, AN_INHERITED_SCENE)
  await roster()
  await expect(page.getByText('carried forward'), 'a reader has nowhere to edit')
    .toHaveCount(0)

  await turnReadingModeOff(page, worldId)
  await useCursor(page, AN_INHERITED_SCENE)
  await roster()
  await expect(page.getByText('carried forward').first(), 'a writer is told').toBeVisible()
})

test('the map sidebar hides an empty section from a reader but not a full one', async ({ page }) => {
  /*
    The Moonstone, not Alice. Alice's map carries exactly one route, and it can
    never be revealed to anybody: four of its twelve waypoints are markers no
    scene is ever set at, so `linksRevealed` holds it back at every cursor. A
    presence half that cannot be satisfied is not a test. All three of the
    Moonstone's routes are reachable and it has no regions at all, which is the
    pair this needs.
  */
  const worldId = await download(page, 'The Moonstone')

  /*
    And on the world map, chosen explicitly.

    The map opens on the layer the current scene is set on, so at the last scene
    the reader lands on an Indian sub-map that has no routes — which would have
    hidden the Routes section for a reason that is nothing to do with this
    change. The route under test is on the root layer.
  */
  const openRootMap = async () => {
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await waitForMapReady(page)
    await page.locator('[data-map-layer]').filter({ hasText: 'England and India' }).first().click()
    await settle(page)
    await expect(page.getByRole('banner').getByText(/England and India/).first(),
      'the root map is the one open').toBeVisible()
  }

  await useCursor(page, LAST_SCENE)
  await openRootMap()
  // `sidebarSection` rather than a bare role+name: the section headers do not
  // own these words, and a layer called "Locations" has landed a page-wide
  // lookup on the wrong control before. `aria-expanded` is what makes a header
  // a header.
  await expect(sidebarSection(page, /^Routes/),
    'a section with something in it is still offered').toBeVisible()
  await expect(sidebarSection(page, /^Regions/),
    'an empty one is a dead end').toHaveCount(0)

  await turnReadingModeOff(page, worldId)
  await openRootMap()
  await expect(sidebarSection(page, /^Regions/),
    'a writer keeps the empty section — it is where "New region" lives').toBeVisible()
})

test('the Appearances tab gives a reader no instruction to type into a draft', async ({ page }) => {
  const worldId = await download(page, ALICE)

  // A character present in scenes and mentioned in none: the tab has content,
  // so hiding empty tabs never reached this, and the empty half of it still
  // carried the instruction.
  const characterId = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: {
      characters: { toArray: () => Promise<{ id: string; name: string }[]> }
      events: { toArray: () => Promise<{ involvedCharacterIds?: string[]; mentionedCharacterIds?: string[] }[]> }
    } }).__pwdb
    const [characters, events] = await Promise.all([db!.characters.toArray(), db!.events.toArray()])
    const present = new Set<string>()
    const mentioned = new Set<string>()
    for (const e of events) {
      for (const id of e.involvedCharacterIds ?? []) present.add(id)
      for (const id of e.mentionedCharacterIds ?? []) mentioned.add(id)
    }
    const found = characters.find((c) => present.has(c.id) && !mentioned.has(c.id))
    if (!found) throw new Error('no character is on stage and mentioned nowhere')
    return found.id
  })

  const open = async () => {
    await page.goto(`/#/worlds/${worldId}/characters/${characterId}?tab=appearances`, { waitUntil: 'load' })
    await settle(page)
  }

  await open()
  await expect(page.getByText('Not mentioned in any scene yet'),
    'the empty half of the tab is on screen').toBeVisible()
  await expect(page.getByText(/in a scene's draft/), 'with no instruction for it')
    .toHaveCount(0)

  await turnReadingModeOff(page, worldId)
  await open()
  await expect(page.getByText(/in a scene's draft/), 'a writer is told how')
    .toBeVisible()
})
