/*
  Recapture the user guide's screenshots against a real build.

  Every image in `docs/images` came from one bulk re-render on 2026-09-04 (`docs:
  refresh screenshots for new logo`), and twenty-two view files changed after it.
  Some were captured at `deviceScaleFactor: 1` despite the guide rule, so the set
  is inconsistent as well as stale.

  **Books, not fixtures.** The guide shows the app doing real work, so the shots
  come from Library books installed through the same seam the e2e suite uses.
  Only books whose artwork is stored beside them in the Library repository can be
  used here: this machine has no route to the internet, and most books link their
  pictures to Wikimedia or elsewhere, which would photograph as broken images.
  *The Iliad* (52 characters, 23 relationships, 75 scenes of prose) and *Alice*
  (6 map layers, 37 markers) are the two richest that keep their art locally.

  Run against a staged preview:
    VITE_E2E=1 npm run build
    cp -r ../plotweave-library/library/{the-iliad,alice-in-wonderland} dist/library/
    npx vite preview --port 4173 --strictPort &
    node scripts/capture-guide-shots.mjs [name ...]
*/
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = process.env.SHOT_OUT ?? 'docs/images'
const VIEWPORT = { width: 1440, height: 900 }

const ILIAD = 'The Iliad'
const ALICE = 'Alice’s Adventures in Wonderland'
// Two timelines and a frame-narrative link between them — the only shipped book
// that can photograph the multi-timeline screens at all.
const JOURNEY = 'Journey to the West'

/** Install a Library book through the dev seam and return its world id. */
async function install(page, title) {
  return page.evaluate(async (name) => {
    const seam = window.__pwlibrary
    if (!seam) throw new Error('__pwlibrary seam missing — build with VITE_E2E=1')
    return seam.install(name)
  }, title)
}

/** Library books arrive in reading mode; most of the guide is the writer's app. */
async function setReadingMode(page, worldId, on) {
  await page.evaluate(async ([id, readingMode]) => {
    await window.__pwdb.worlds.update(id, { readingMode })
  }, [worldId, on])
}

/*
  Put the reading cursor at a chapter, and reload.

  A book installed and left alone sits at the end of itself, so the reading-mode
  banner reads "You have revealed the whole book, so nothing is being held back"
  — a photograph of the feature doing nothing, on the page whose section is
  called *What reading mode puts away*. The reload is not optional: these routes
  are hash-only, so a navigation does not rehydrate the persisted store, and
  `eventByWorld` is what an opening world restores `activeEventId` from.
*/
async function setCursor(page, worldId, chapterNumber) {
  const ok = await page.evaluate(async ([id, number]) => {
    const chapters = await window.__pwdb.chapters.where('worldId').equals(id).toArray()
    const chapter = chapters.find((c) => c.number === number)
    if (!chapter) return false
    const events = await window.__pwdb.events.where('chapterId').equals(chapter.id).toArray()
    if (!events.length) return false
    const eventId = events.sort((a, b) => a.sortOrder - b.sortOrder)[0].id
    const raw = JSON.parse(localStorage.getItem('kathala-ui') || '{}')
    const state = raw.state || {}
    raw.state = { ...state, activeEventId: eventId, eventByWorld: { ...(state.eventByWorld || {}), [id]: eventId } }
    localStorage.setItem('kathala-ui', JSON.stringify(raw))
    return true
  }, [worldId, chapterNumber])
  if (!ok) throw new Error(`no scene in chapter ${chapterNumber}`)
  await page.reload({ waitUntil: 'load' })
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

/*
  Wait for the screen itself, not for a clock.

  A fixed pause photographed *The Iliad*'s manuscript mid-spinner: the app is
  local-first, so `networkidle` resolves long before Dexie has answered, and
  seventy-five scenes take longer to lay out than any timeout worth hard-coding.
  Each shot names something only the finished screen shows, and the capture
  fails loudly rather than saving a picture of a loading state.
*/
async function ready(page, locator, name) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 30_000 })
  } catch {
    throw new Error(`${name}: the screen never finished rendering`)
  }
}

/*
  Ids are looked up in the world rather than written down. `iliad-char-achilles`
  is stable today and is still a fact about one book's export, not about the app
  this is photographing.
*/
/*
  Scoped to the world, which is not a detail. Both books are installed in the
  one context, so an unscoped `characters.toArray()[0]` returned *Alice* and the
  Iliad's character page was photographed showing somebody from another book.
*/
async function nthCharacter(page, worldId, n) {
  return page.evaluate(async ([id, index]) => {
    const all = await window.__pwdb.characters.where('worldId').equals(id).toArray()
    return all[index % all.length].id
  }, [worldId, n])
}
async function firstCharacter(page, worldId) {
  return page.evaluate(async (id) => {
    const all = await window.__pwdb.characters.where('worldId').equals(id).toArray()
    return all[0].id
  }, worldId)
}
async function firstChapter(page, worldId) {
  return page.evaluate(async (id) => {
    const all = await window.__pwdb.chapters.where('worldId').equals(id).toArray()
    return all.sort((a, b) => a.number - b.number)[0].id
  }, worldId)
}

const shots = [
  // ── The writer's app, on The Iliad ────────────────────────────────────────
  {
    name: '03-dashboard', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'The Iliad' }),
  },
  {
    name: '04-timeline', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' }),
    // The Timeline has no heading of its own — it is chapters all the way down.
    ready: (page) => page.getByRole('main').getByText('The Quarrel').first(),
  },
  {
    name: '05-chapter-detail', book: ILIAD, reading: false,
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/timeline/${chapter}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1/ }),
  },
  {
    name: '24-manuscript', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1 —/ }),
  },
  {
    name: '32-corkboard', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/corkboard`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Corkboard' }),
  },
  {
    name: '45-structure', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/structure`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Structure' }),
  },
  {
    name: '35-calendar-view', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/calendar`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Calendar' }),
  },
  {
    name: '59-character-tabs', book: ILIAD, reading: false,
    go: async (page, id) => {
      const c = await firstCharacter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/characters/${c}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('heading', { name: 'Achilles' }),
  },
  {
    name: '09-items', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/items`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Items' }),
  },
  {
    name: '10-relationships', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/relationships`, { waitUntil: 'load' }),
    // ReactFlow draws a canvas with no headings; a node is the screen arriving.
    ready: (page) => page.locator('.react-flow__node'),
    settle: 3000,
  },
  {
    name: '11-arc', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/arc`, { waitUntil: 'load' }),
    ready: (page) => page.locator('[role="grid"]'),
    settle: 2500,
  },
  {
    name: '12-lore', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/lore`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Lore' }),
  },
  {
    name: '13-factions', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/factions`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Factions' }),
  },
  {
    name: '14-knowledge', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/knowledge`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Knowledge' }),
  },
  {
    name: '15-settings', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'WORLD' }),
  },

  // ── The reader's app, same book ───────────────────────────────────────────
  {
    name: '61-reading-mode-dashboard', book: ILIAD, reading: true,
    // Three chapters in, so the banner has a number to give.
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' })
      await setCursor(page, id, 3)
    },
    ready: (page) => page.getByRole('heading', { name: 'The Iliad' }),
  },

  // ── Controls that need a click, not just a route ──────────────────────────
  // Every name below was read off the live app rather than guessed; a button
  // named from memory is how the first pass photographed the wrong screens.
  {
    name: '36-find-replace', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: /^Ch\. 1 —/ }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Find & replace' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '62-bar-rolled-up', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Hide the chapter bar' }).click()
    },
    ready: (page) => page.getByRole('button', { name: /Show the chapter bar/i }),
  },
  {
    name: '48-thread-filter', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'All threads' }).click()
    },
    ready: (page) => page.getByRole('button', { name: 'Honour and Command' }),
  },
  {
    name: '64-settings-collapsed', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'WORLD' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Collapse all' }).click()
    },
    ready: (page) => page.getByRole('button', { name: /Expand all/i }),
  },
  {
    name: '16-search', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Search (Ctrl+K)' }).click()
      await page.keyboard.type('Achilles')
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 2000,
  },
  {
    name: '19-help', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator('button[aria-label="Help"]').click()
    },
    ready: (page) => page.getByRole('heading', { name: 'Help' }),
  },
  {
    name: '53-recent-changes', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Recent changes' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '17-writers-brief', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: "Writer's Brief" }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '18-continuity', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Continuity Checker' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 3000,
  },
  {
    name: '51-character-goals', book: ILIAD, reading: false,
    go: async (page, id) => {
      const c = await firstCharacter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/characters/${c}?tab=goals`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('heading', { name: 'Achilles' }),
  },

  // ── The shelf, and screens that need a second state ───────────────────────
  {
    name: '01-home-empty', book: ILIAD, reading: false, fresh: true,
    ready: (page) => page.getByRole('button', { name: 'New World' }),
  },
  {
    name: '02-home-worlds', book: ILIAD, reading: false,
    go: (page) => page.goto(`${BASE}/#/`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('button', { name: 'Start from scratch' }),
  },
  {
    name: '07-character-detail', book: ILIAD, reading: false,
    go: async (page, id) => {
      const c = await nthCharacter(page, id, 1)
      await page.goto(`${BASE}/#/worlds/${id}/characters/${c}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('main').getByRole('heading').first(),
  },
  {
    name: '37-navigation', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Pin navigation open' }).click()
    },
    ready: (page) => page.getByRole('link', { name: 'Knowledge' }),
  },
  {
    name: '44-writing-goals', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' }),
    ready: (page) => page.getByText('words today'),
  },
  {
    name: '49-timeline-bar-scope', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'View all chapters' }).click()
    },
    ready: (page) => page.getByRole('button', { name: /Ch\. 24|The Ransom/ }).first(),
  },
  {
    name: '60-settings-index', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('button', { name: 'Collapse all' }),
  },
  {
    name: '43-settings-sync', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'WORLD' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByText(/sync/i).first().scrollIntoViewIfNeeded()
    },
    ready: (page) => page.getByText(/sync/i).first(),
  },
  {
    name: '50-arc-thread-lane', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/arc`, { waitUntil: 'load' }),
    ready: (page) => page.locator('[role="grid"]'),
    settle: 2500,
  },
  {
    name: '40-map-tools', book: ALICE, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' })
      await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 30_000 })
      await page.waitForTimeout(2500)
      await page.getByRole('button', { name: 'Play story on the map' }).click()
    },
    ready: (page) => page.locator('.leaflet-container'),
    settle: 3000,
  },
  {
    name: '29-map-levels', book: ALICE, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' })
      await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 30_000 })
      await page.waitForTimeout(2500)
      await page.getByRole('button', { name: 'The Queen of Hearts’ Grounds' }).click()
    },
    ready: (page) => page.locator('.leaflet-container'),
    settle: 3500,
  },

  // ── Controls behind a mode, a menu or a second world ──────────────────────
  {
    name: '58-row-menu', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'More actions for chapter 1', exact: true }).click()
    },
    ready: (page) => page.getByRole('menu').or(page.getByRole('menuitem').first()),
  },
  {
    name: '65-scene-standing', book: ILIAD, reading: false,
    // The X-ray gutter renders only in Reading mode, and only with prose.
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: /^Ch\. 1 —/ }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Reading' }).click()
    },
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1 —/ }),
    settle: 2500,
  },
  {
    name: '46-focus-mode', book: ILIAD, reading: false,
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/timeline/${chapter}`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('main').getByText('The Priest Is Rejected').first().click()
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /Focus/i }).first().click()
    },
    ready: (page) => page.getByRole('button', { name: /Exit focus|Leave focus|Close/i }).first(),
    settle: 2000,
  },
  {
    name: '34-scene-history', book: ILIAD, reading: false,
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/timeline/${chapter}`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: /histor|revision/i }).first().click()
    },
    ready: (page) => page.getByText(/revision|version/i).first(),
  },
  {
    name: '47-all-timelines', book: JOURNEY, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'All timelines' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'All timelines' }).click()
    },
    ready: (page) => page.getByRole('main').getByRole('button').first(),
    settle: 3000,
  },
  {
    name: '39-timeline-relationships', book: JOURNEY, reading: false,
    /*
      Journey to the West is the only shipped book with two timelines — and at a
      hundred chapters it is also the slowest to lay out, so this waits far
      longer than the usual budget. "Link Timelines" opens a panel, not a dialog;
      waiting for `role="dialog"` timed out on a panel that had opened.
    */
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/timeline`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Link Timelines' }).waitFor({ state: 'visible', timeout: 90_000 })
      await page.getByRole('button', { name: 'Link Timelines' }).click()
    },
    ready: (page) => page.getByText('Timeline Relationships'),
    settle: 2500,
  },

  // ── Behind a menu, or in a world nobody has built yet ─────────────────────
  {
    name: '38-onboarding', book: ILIAD, reading: false, fresh: true,
    /*
      The first-run guide exists only in an empty world, so this makes one
      rather than opening a book. Its steps are labelled "1 Begin your story",
      not "Step 1 of 4" — the heading is what identifies the screen.
    */
    go: async (page) => {
      await page.getByRole('button', { name: 'New World' }).click()
      await page.getByRole('heading', { name: 'Create New World' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('textbox').first().fill('The Salt Road')
      await page.getByRole('button', { name: 'Create World' }).click()
    },
    ready: (page) => page.getByRole('heading', { name: 'Your story begins with a moment' }),
    settle: 2500,
  },
  {
    name: '52-map-tools-menu', book: ALICE, reading: false,
    // The menu is a popover of plain items, not `role="menuitem"`, which is why
    // waiting for a menu role timed out on a menu that had opened.
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' })
      await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 40_000 })
      await page.waitForTimeout(3000)
      await page.getByRole('button', { name: 'Map tools' }).click()
    },
    ready: (page) => page.getByText('Measure distance'),
    settle: 1500,
  },
  {
    name: '28-replace-map-image', book: ALICE, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' })
      await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 40_000 })
      await page.waitForTimeout(3000)
      await page.getByRole('button', { name: 'Map tools' }).click()
      await page.getByText('Replace image').waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByText('Replace image').click()
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 1500,
  },

  // ── Maps, on Alice ────────────────────────────────────────────────────────
  // Six layers and thirty-seven markers, and its artwork is the Library's own
  // rather than a Wikimedia link, so it is one of the few that photograph whole.
  {
    name: '08-maps', book: ALICE, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' }),
    ready: (page) => page.locator('.leaflet-container'),
    settle: 4000,
  },
]

const only = process.argv.slice(2)
const wanted = only.length ? shots.filter((s) => only.includes(s.name)) : shots

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.SHOT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

/*
  One context for every shot, because a context is where IndexedDB lives.

  `browser.newPage()` opens a *fresh* context each time, so a book installed for
  the first shot did not exist for the second: the manuscript route rendered a
  spinner over an empty database and the wait above failed, which read exactly
  like a slow screen. The books go in once, here.
*/
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
const page = await context.newPage()

/*
  A shot marked `fresh` gets its own empty context, because the empty-shelf
  screen cannot be reached from a context that has books in it and deleting them
  is not the same picture — a world that has been removed is not a world that
  was never there.
*/
async function inFreshContext(shot) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const fresh = await ctx.newPage()
  try {
    await fresh.goto(`${BASE}/#/`, { waitUntil: 'load' })
    await settle(fresh, 1500)
    if (shot.go) await shot.go(fresh)
    await ready(fresh, shot.ready(fresh), shot.name)
    await settle(fresh, shot.settle ?? 1500)
    await fresh.screenshot({ path: `${OUT}/${shot.name}.png` })
  } finally {
    await ctx.close()
  }
}
await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
await settle(page, 800)

const worlds = new Map()
for (const book of new Set(wanted.filter((s) => !s.fresh).map((s) => s.book))) {
  worlds.set(book, await install(page, book))
}

/*
  One bad selector must not cost the other nineteen shots. A failure prints what
  the screen actually showed, which is the thing needed to fix it, and the run
  reports the skipped list at the end rather than leaving a stale file in place
  looking captured.
*/
const skipped = []
for (const shot of wanted) {
  try {
    if (shot.fresh) {
      await inFreshContext(shot)
      console.log(`  ${shot.name}`)
      continue
    }
  } catch (err) {
    console.log(`  ${shot.name} — SKIPPED: ${err.message}`)
    skipped.push(shot.name)
    continue
  }
  const id = worlds.get(shot.book)
  try {
    /*
      Shut whatever the last shot opened. A dialog survives a hash navigation,
      and its backdrop then intercepts every click: one open search palette cost
      four later shots, each failing as "the screen never finished rendering"
      while the screen underneath was fine.
    */
    for (let i = 0; i < 3 && await page.getByRole('dialog').count(); i += 1) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
    await setReadingMode(page, id, shot.reading)
    await shot.go(page, id)
    await ready(page, shot.ready(page), shot.name)
    await settle(page, shot.settle ?? 1500)
    await page.screenshot({ path: `${OUT}/${shot.name}.png` })
    console.log(`  ${shot.name}`)
  } catch (err) {
    const headings = await page.getByRole('heading').allInnerTexts().catch(() => [])
    console.log(`  ${shot.name} — SKIPPED: ${err.message}`)
    console.log(`      headings: ${JSON.stringify(headings.slice(0, 6))}`)
    skipped.push(shot.name)
  }
}

await browser.close()
console.log(`captured ${wanted.length - skipped.length} of ${wanted.length} into ${OUT}`)
if (skipped.length) { console.log(`skipped: ${skipped.join(', ')}`); process.exitCode = 1 }
