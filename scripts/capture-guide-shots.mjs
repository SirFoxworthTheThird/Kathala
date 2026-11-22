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
    cp -r ../Kathala-Library/library/{the-iliad,alice-in-wonderland} dist/library/
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
// Three generations, an adoption and a second marriage: the family tree's book (issue #702).
const HEIGHTS = 'Wuthering Heights'

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

/** A small book for the custom-fields shots: three chapters of a scene each, two suspects. */
async function saltLedger(page) {
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await page.waitForURL(/#\/worlds\//)
  const id = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (worldId) => {
    const now = Date.now()
    const db = window.__pwdb
    await db.timelines.add({ id: 'sl-tl', worldId, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    const person = (pid, name, description) => ({ id: pid, worldId, name, description, aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.bulkAdd([person('ines', 'Ines Varga', 'Clerk at the weighing house, who found the ledger.'), person('tomas', 'Tomas Brell', 'The harbourmaster.')])
    const titles = ['The Weighing House', 'The Quay', 'The Counting Room']
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `sl-ch${n}`, worldId, timelineId: 'sl-tl', number: n, title: titles[n - 1], synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({ id: `sl${n}`, worldId, chapterId: `sl-ch${n}`, timelineId: 'sl-tl', title: titles[n - 1], description: '', locationMarkerId: null, involvedCharacterIds: ['ines', 'tomas'], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: now, updatedAt: now })
    }
  }, id)
  return id
}

/**
 * A short book with research on its first scene (issue #700): three pictures
 * drawn here, so they are the app's own and nobody else's, a link, and a
 * clipping; the pictures on the scene's mood board.
 */
async function researchBook(page) {
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(['# The Salt Ledger', '', '## Chapter 1: The Weighing House', '', 'The weighing house opened before the tide turned. Ines had the ledger under her arm before the porter had the shutters up.', '', 'Salt came in by the cartload and went out by the ounce, and every ounce was written down.', '', '## Chapter 2: The Quay', '', 'The first cart came up the quay at six.'].join('\n'))
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await page.waitForURL(/#\/worlds\//)
  const id = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (worldId) => {
    const db = window.__pwdb
    const [scene] = (await db.events.where('worldId').equals(worldId).toArray()).sort((a, b) => a.sortOrder - b.sortOrder)
    const draw = async (paint) => {
      const c = new OffscreenCanvas(480, 360)
      paint(c.getContext('2d'))
      return c.convertToBlob({ type: 'image/png' })
    }
    const sky = (g, top, bottom) => { const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 480, 360) }
    const pictures = [
      ['The weighing house, from the quay', 'Two storeys, a bell over the door. The scales are on the ground floor, the counting room above.', (g) => {
        sky(g, '#c9d6df', '#f1e9da'); g.fillStyle = '#7a6a58'; g.fillRect(120, 140, 240, 160); g.fillStyle = '#5b4d3f'; g.beginPath(); g.moveTo(100, 140); g.lineTo(240, 70); g.lineTo(380, 140); g.fill()
        g.fillStyle = '#e8dcc4'; for (const x of [150, 210, 270, 320]) g.fillRect(x, 170, 26, 36); g.fillStyle = '#3d342b'; g.fillRect(222, 240, 36, 60); g.fillStyle = '#6d8796'; g.fillRect(0, 300, 480, 60)
      }],
      ['Salt pans at low tide', '', (g) => {
        sky(g, '#dfe7ea', '#bccbd1'); g.fillStyle = '#eef0ee'; for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) g.fillRect(20 + k * 92, 170 + r * 46, 80, 36)
        g.strokeStyle = '#8b9ba3'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 160); g.lineTo(480, 150); g.stroke()
      }],
      ['A merchant’s balance', 'The pans hang from chains; the beam is marked in ounces.', (g) => {
        sky(g, '#efe6d4', '#e2d4b8'); g.strokeStyle = '#4a3b2a'; g.lineWidth = 8; g.beginPath(); g.moveTo(240, 60); g.lineTo(240, 300); g.moveTo(110, 110); g.lineTo(370, 110); g.stroke()
        g.lineWidth = 2; for (const x of [130, 350]) { g.beginPath(); g.moveTo(x - 20, 110); g.lineTo(x - 50, 220); g.moveTo(x + 20, 110); g.lineTo(x + 50, 220); g.stroke(); g.fillStyle = '#a0783e'; g.beginPath(); g.ellipse(x, 225, 60, 14, 0, 0, Math.PI * 2); g.fill() }
        g.fillStyle = '#4a3b2a'; g.fillRect(180, 296, 120, 20)
      }],
    ]
    const now = Date.now()
    let order = 0
    for (const [title, note, paint] of pictures) {
      const data = await draw(paint)
      const blobId = `res-blob-${order}`
      await db.blobs.add({ id: blobId, worldId, mimeType: 'image/png', data, createdAt: now })
      await db.researchItems.add({ id: `res-${order}`, worldId, kind: 'file', title, note, blobId, mimeType: 'image/png', size: data.size, fileName: `${title}.png`, attachedTo: [{ kind: 'scene', id: scene.id }], toWorld: false, order: order++, createdAt: now, updatedAt: now })
    }
    await db.researchItems.add({ id: 'res-link', worldId, kind: 'link', title: 'Tide tables for the estuary', note: 'When the carts can cross the flats.', url: 'https://example.org/tides', attachedTo: [{ kind: 'scene', id: scene.id }], toWorld: false, order: order++, createdAt: now, updatedAt: now })
    await db.researchItems.add({ id: 'res-clip', worldId, kind: 'clip', title: 'Salt was taxed by weight', note: '', text: 'Salt was taxed by weight at the point of sale, and a dishonest beam was the commonest fraud of the trade.', source: 'A History of the Salt Trade, p. 112', attachedTo: [], toWorld: true, order: order++, createdAt: now, updatedAt: now })
  }, id)
  return id
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

/*
  Two controls in SceneDraftSection carry a `title` that is not their accessible
  name. `title="Write this scene distraction-free"` sits on a button whose text
  is "Focus"; `title="View earlier drafts of this scene"` sits on one reading
  "History (2)". Text content wins, so `getByRole('button', { name: <title> })`
  matched nothing — `count` was 0, not merely hidden.

  This is why a probe and a run disagreed for three sittings: the probe read the
  `title` attribute off the element, and the run asked for the accessible name.
  Both were right about different strings.
*/
/*
  Open a scene card on the chapter screen, and leave it open.

  Two traps met here. The row is a **button**, and a bare `getByText(title)`
  also matches the chapter bar along the bottom, which carries every scene's
  title — `.first()` was picking a copy that never becomes visible. And clicking
  the title *toggles*, so on a card already open it closed the very draft the
  next step was waiting for.
*/
async function openScene(page, title, control) {
  const row = page.getByRole('main').getByRole('button', { name: title }).first()
  await row.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(1500)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.getByRole('button', { name: control }).first().isVisible().catch(() => false)) return
    await row.click()
    await page.waitForTimeout(1500)
  }
  throw new Error(`"${title}" never offered its draft controls`)
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
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' }),
    // The Manuscript has no heading of its own — it is chapters all the way down.
    ready: (page) => page.getByRole('main').getByText('The Quarrel').first(),
  },
  {
    name: '05-chapter-detail', book: ILIAD, reading: false,
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1/ }),
  },
  {
    name: '24-manuscript', book: ILIAD, reading: false,
    // The book on Read; ?view= asks for it on arrival.
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/manuscript?view=read`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1 —/ }),
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript?view=read`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: /^Ch\. 1 —/ }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Find & replace' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '62-bar-rolled-up', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Hide the chapter bar' }).click()
    },
    ready: (page) => page.getByRole('button', { name: /Show the chapter bar/i }),
  },
  {
    name: '48-thread-filter', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator('button[aria-label="Help"]').click()
    },
    ready: (page) => page.getByRole('heading', { name: 'Help' }),
  },
  {
    name: '53-recent-changes', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Recent changes' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '17-writers-brief', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: "Writer's Brief" }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '18-continuity', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
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
    /*
      A series on the shelf (issue #698): a book made a series from its card,
      a second book added, and a book of its own beside it for contrast. Made
      in an empty context through the shelf's own controls, as a writer would.
    */
    name: '25b-series', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const world = async (name) => {
        await page.getByRole('button', { name: 'New World' }).click()
        await page.getByLabel('Name').fill(name)
        await page.getByRole('button', { name: 'Create World' }).last().click()
        await page.waitForURL(/#\/worlds\//)
        await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      }
      await world('Notes for a Ghost Story')
      await world('The Salt Road')
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
      await main.getByRole('button', { name: /Make a series/ }).click()
      await page.getByLabel('Series name').fill('The Salt Books')
      await page.getByRole('button', { name: 'Make the series' }).click()
      await main.getByRole('region', { name: 'Series: The Salt Books' }).getByRole('button', { name: 'Add a book' }).click()
      await page.getByLabel('Title').fill('The Second Road')
      await page.getByRole('button', { name: 'Add the book' }).click()
      await page.waitForURL(/#\/worlds\//)
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByText('Series · 2 books'),
  },
  {
    /*
      The PDF export (issue #701): the Export dialog on PDF, set for a print
      interior, with its trim size and front and back matter.
    */
    name: '117-pdf-export', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
      await page.getByLabel('Manuscript text').fill(['# The Salt Ledger', '', '## Chapter 1: The Weighing House', '', 'The weighing house opened before the tide turned.', '', '## Chapter 2: The Quay', '', 'The first cart came up the quay at six.'].join('\n'))
      await page.getByRole('button', { name: /^Import/ }).last().click()
      await page.waitForURL(/#\/worlds\//)
      const id = page.url().split('/worlds/')[1].split('/')[0]
      await page.goto(`${BASE}/#/worlds/${id}/manuscript?view=read`, { waitUntil: 'load' })
      await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
      await dialog.getByRole('button', { name: 'PDF', exact: true }).click()
      await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Print interior' }).click()
      await dialog.getByRole('textbox', { name: 'Copyright page (optional)' }).fill('© 2026 Ines Varga. All rights reserved.')
      await dialog.getByRole('textbox', { name: 'Dedication (optional)' }).fill('For the harbourmaster.')
      await dialog.getByRole('textbox', { name: 'Author (optional)' }).fill('Ines Varga')
    },
    ready: (page) => page.getByRole('dialog', { name: 'Export manuscript' }).getByRole('button', { name: /^Trim size/ }),
  },
  {
    /*
      Custom fields (issue #699): World settings' section with two templates
      added — Mystery suspects for characters, Ships for items.
    */
    name: '142-custom-fields-settings', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const id = await saltLedger(page)
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      const section = page.locator('#settings-custom-fields')
      await section.getByRole('button', { name: 'Add the Mystery suspects fields' }).click()
      await section.getByRole('button', { name: 'Add the Ships fields' }).click()
      await section.getByText('Added Class, Crew, Captain to items.').waitFor()
      await section.scrollIntoViewIfNeeded()
      await page.evaluate(() => document.querySelector('#settings-custom-fields')?.scrollIntoView({ block: 'start' }))
    },
    ready: (page) => page.locator('#settings-custom-fields').getByText('Captain', { exact: true }),
  },
  {
    /*
      A suspect's page at chapter 2: the fixed fields edited in place, and
      Suspicion as it holds at the cursor, said here.
    */
    name: '143-custom-fields-character', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const id = await saltLedger(page)
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      await page.locator('#settings-custom-fields').getByRole('button', { name: 'Add the Mystery suspects fields' }).click()
      await page.locator('#settings-custom-fields').getByText('Added Alibi, Motive, Means, Suspicion to characters.').waitFor()
      await page.evaluate(async (worldId) => {
        const defs = await window.__pwdb.customFieldDefs.where('worldId').equals(worldId).toArray()
        const def = (name) => defs.find((d) => d.name === name)
        const suspicion = def('Suspicion')
        const option = (label) => suspicion.options.find((o) => o.label === label).id
        await window.__pwdb.characters.update('ines', { customValues: {
          [def('Alibi').id]: 'At the weighing house until the tide turned, by her own account and the porter’s.',
          [def('Motive').id]: 'The ledger names her father as the man who sold the salt short.',
          [def('Means').id]: 'A key to the counting room',
        } })
        const now = Date.now()
        for (const [ev, label, key] of [['sl1', 'Unsuspected', 1], ['sl2', 'Suspected', 2]]) {
          await window.__pwdb.fieldValues.add({ id: `fv:${suspicion.id}:ines:${ev}`, worldId, defId: suspicion.id, entityId: 'ines', eventId: ev, sortKey: key, value: option(label), createdAt: now, updatedAt: now })
        }
      }, id)
      await page.goto(`${BASE}/#/worlds/${id}/characters/ines`, { waitUntil: 'load' })
      await setCursor(page, id, 2)
    },
    ready: (page) => page.getByRole('region', { name: 'Custom fields' }).getByText('said here'),
    scrollTo: 'Over time, at',
  },
  {
    /*
      Research beside the Page (issue #700): the caret in the first scene, and
      its mood board and sources in the column the Notes panel takes.
    */
    name: '144-research-page', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const id = await researchBook(page)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Page', exact: true }).click()
      // The page built first: a click while it is still being laid out lands on nothing.
      await page.locator('[data-save-state="saved"]').waitFor()
      await page.waitForTimeout(800)
      await page.locator('.cm-line', { hasText: 'Salt came in by the cartload' }).click()
      await page.getByRole('button', { name: 'Research', exact: true }).click()
    },
    ready: (page) => page.getByRole('complementary', { name: 'Scene research' }).getByRole('list', { name: 'Mood board' }),
  },
  {
    /* The Research screen: everything kept, filtered by kind and by what it is on. */
    name: '145-research-screen', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const id = await researchBook(page)
      await page.goto(`${BASE}/#/worlds/${id}/research`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('main').getByRole('article', { name: 'Research: Salt was taxed by weight' }),
  },
  {
    /*
      The family tree (issue #702): Wuthering Heights' kinship entered on its
      own relationships, Edgar's parents never on stage, the whole family at
      the end of the book, and the Heights' succession beside it.
    */
    name: '146-family-tree', book: HEIGHTS, reading: false,
    go: async (page, id) => {
      await page.evaluate(async (worldId) => {
        const db = window.__pwdb
        const now = Date.now()
        const people = await db.characters.where('worldId').equals(worldId).toArray()
        const add = async (name) => {
          const c = { id: `wh-${name.replace(/\W/g, '')}`, worldId, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: false, color: null, offStage: true, createdAt: now, updatedAt: now }
          await db.characters.put(c)
          people.push(c)
        }
        await add('Mr Linton')
        await add('Mrs Linton')
        const id = (name) => people.find((c) => c.name === name).id
        const rels = await db.relationships.where('worldId').equals(worldId).toArray()
        let n = 0
        const kin = async (a, b, kinship) => {
          const [x, y] = [id(a), id(b)]
          const theirs = rels.find((r) => !r.kinship && ((r.characterAId === x && r.characterBId === y) || (r.characterAId === y && r.characterBId === x)))
          const k = kinship.kind === 'parent' ? { ...kinship, parentId: x } : kinship
          if (theirs) { theirs.kinship = k; await db.relationships.update(theirs.id, { kinship: k }); return }
          await db.relationships.put({ id: `wh-kin-${n++}`, worldId, characterAId: x, characterBId: y, label: k.kind === 'parent' ? 'parent and child' : k.partner, strength: 'bond', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, kinship: { ...k, own: true }, createdAt: now, updatedAt: now })
        }
        const birth = (order) => ({ kind: 'parent', parent: 'birth', order })
        await kin('Mr Earnshaw', 'Mrs Earnshaw', { kind: 'partner', partner: 'married' })
        for (const p of ['Mr Earnshaw', 'Mrs Earnshaw']) { await kin(p, 'Hindley Earnshaw', birth(0)); await kin(p, 'Catherine Earnshaw', birth(1)) }
        await kin('Mr Earnshaw', 'Heathcliff', { kind: 'parent', parent: 'adoptive', order: 2 })
        await kin('Mr Linton', 'Mrs Linton', { kind: 'partner', partner: 'married' })
        for (const p of ['Mr Linton', 'Mrs Linton']) { await kin(p, 'Edgar Linton', birth(0)); await kin(p, 'Isabella Linton', birth(1)) }
        await kin('Hindley Earnshaw', 'Frances Earnshaw', { kind: 'partner', partner: 'married' })
        await kin('Catherine Earnshaw', 'Edgar Linton', { kind: 'partner', partner: 'married' })
        await kin('Heathcliff', 'Isabella Linton', { kind: 'partner', partner: 'married' })
        for (const p of ['Hindley Earnshaw', 'Frances Earnshaw']) await kin(p, 'Hareton Earnshaw', birth(0))
        for (const p of ['Catherine Earnshaw', 'Edgar Linton']) await kin(p, 'Catherine ‘Cathy’ Linton', birth(0))
        for (const p of ['Heathcliff', 'Isabella Linton']) await kin(p, 'Linton Heathcliff', birth(0))
        await kin('Catherine ‘Cathy’ Linton', 'Linton Heathcliff', { kind: 'partner', partner: 'married' })
        await kin('Catherine ‘Cathy’ Linton', 'Hareton Earnshaw', { kind: 'partner', partner: 'betrothed' })
        await db.successions.put({ id: 'wh-heights', worldId, title: 'Wuthering Heights', founderId: id('Mr Earnshaw'), rule: 'eldest', line: [], createdAt: now, updatedAt: now })
      }, id)
      /*
        Chapter 20: Mr Earnshaw, Catherine and Hindley dead, and the Heights
        Hareton's. Written by the next document before the app starts, as
        e2e/helpers/cursor.ts does: an installed book's open page writes its own
        cursor back over one written into it.
      */
      const scene = await page.evaluate(async (worldId) => {
        const chapter = (await window.__pwdb.chapters.where('worldId').equals(worldId).toArray()).find((c) => c.number === 20)
        return (await window.__pwdb.events.where('chapterId').equals(chapter.id).toArray()).sort((x, y) => x.sortOrder - y.sortOrder)[0].id
      }, id)
      const token = `${scene}:${Math.random()}`
      await page.addInitScript(([eid, armed, worldId]) => {
        if (sessionStorage.getItem('shot-park') !== armed) return
        sessionStorage.removeItem('shot-park')
        const st = JSON.parse(localStorage.getItem('kathala-ui') || '{"state":{},"version":0}')
        st.state = { ...(st.state || {}), activeEventId: eid, eventByWorld: { ...((st.state || {}).eventByWorld || {}), [worldId]: eid } }
        localStorage.setItem('kathala-ui', JSON.stringify(st))
      }, [scene, token, id])
      await page.goto(`${BASE}/#/worlds/${id}/family`, { waitUntil: 'load' })
      await page.evaluate((t) => sessionStorage.setItem('shot-park', t), token)
      await page.reload({ waitUntil: 'load' })
      await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Whole family' }).click()
    },
    ready: (page) => page.getByRole('region', { name: 'Family tree' }).locator('[data-person="Linton Heathcliff"]'),
    settle: 2500,
  },
  {
    /*
      A series in a folder (issue #698): book two's Cloud Sync, its folder the
      series', saved. The folder picker hands back a stand-in kept in the
      browser's private folder, as e2e/seriesSync.spec.ts explains: a headless
      browser has no dialog to answer, and closes when a private folder's own
      handle is read back from the store.
    */
    name: '43b-series-sync', book: ILIAD, reading: false, fresh: true,
    init: () => {
      const dir = () => navigator.storage.getDirectory().then((root) => root.getDirectoryHandle('sync', { create: true }))
      const method = (name, fn) => Object.defineProperty(Object.prototype, name, { value: fn, configurable: true, writable: true })
      method('getFileHandle', async function (name, options) { return (await dir()).getFileHandle(name, options) })
      method('queryPermission', async function () { return 'granted' })
      method('requestPermission', async function () { return 'granted' })
      window.showDirectoryPicker = async () => ({ standIn: true, kind: 'directory', name: 'Dropbox' })
    },
    go: async (page) => {
      await page.getByRole('button', { name: 'New World' }).click()
      await page.getByLabel('Name').fill('The Salt Road')
      await page.getByRole('button', { name: 'Create World' }).last().click()
      await page.waitForURL(/#\/worlds\//)
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
      await main.getByRole('button', { name: /Make a series/ }).click()
      await page.getByLabel('Series name').fill('The Salt Books')
      await page.getByRole('button', { name: 'Make the series' }).click()
      await main.getByRole('region', { name: 'Series: The Salt Books' }).getByRole('button', { name: 'Add a book' }).click()
      await page.getByLabel('Title').fill('The Second Road')
      await page.getByRole('button', { name: 'Add the book' }).click()
      await page.waitForURL(/#\/worlds\//)
      const two = page.url().split('/worlds/')[1].split('/')[0]
      await page.goto(`${BASE}/#/worlds/${two}/settings`, { waitUntil: 'load' })
      const sync = page.locator('#settings-cloud-sync')
      await sync.getByRole('button', { name: 'Choose sync folder…' }).click()
      await sync.getByRole('button', { name: 'Save', exact: true }).click()
      await sync.getByText('Up to date').waitFor({ state: 'visible', timeout: 30_000 })
      // The chip looks again every 20 s: wait for it to say so too, not the "Not backed up" of before the save.
      await page.getByRole('button', { name: /^Backup: Backed up/ }).waitFor({ state: 'visible', timeout: 40_000 })
      await page.evaluate(() => document.querySelector('#settings-cloud-sync')?.scrollIntoView({ block: 'start' }))
    },
    ready: (page) => page.locator('#settings-cloud-sync').getByText('Up to date'),
  },
  {
    /*
      Book one's cast in a series (issue #698, part 4): Cara arrives in book two
      and says so; Anna and Bo, whom book one tells of, say nothing of it.
    */
    name: '25d-series-first-in', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      await page.getByRole('button', { name: 'New World' }).click()
      await page.getByLabel('Name').fill('The Salt Road')
      await page.getByRole('button', { name: 'Create World' }).last().click()
      await page.waitForURL(/#\/worlds\//)
      const one = page.url().split('/worlds/')[1].split('/')[0]
      const person = (id, worldId, name, description) => ({ id, worldId, name, description, aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: Date.now(), updatedAt: Date.now() })
      const scene = async (worldId, id, cast) => page.evaluate(async ([worldId, id, cast]) => {
        const now = Date.now()
        await window.__pwdb.timelines.add({ id: `tl-${id}`, worldId, name: 'Main', description: '', color: '#fff', createdAt: now, updatedAt: now })
        await window.__pwdb.chapters.add({ id: `ch-${id}`, worldId, timelineId: `tl-${id}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
        await window.__pwdb.events.add({ id, worldId, chapterId: `ch-${id}`, timelineId: `tl-${id}`, title: 'The ford', description: '', locationMarkerId: null, involvedCharacterIds: cast, involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now })
      }, [worldId, id, cast])
      await page.evaluate(async (rows) => { await window.__pwdb.characters.bulkAdd(rows) }, [person('anna', one, 'Anna Vell', 'A ferrywoman.'), person('bo', one, 'Bo', 'Her brother.')])
      await scene(one, 'b1s1', ['anna', 'bo'])
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
      await main.getByRole('button', { name: /Make a series/ }).click()
      await page.getByLabel('Series name').fill('The Salt Books')
      await page.getByRole('button', { name: 'Make the series' }).click()
      await main.getByRole('region', { name: 'Series: The Salt Books' }).getByRole('button', { name: 'Add a book' }).click()
      await page.getByLabel('Title').fill('The Second Road')
      await page.getByRole('button', { name: 'Add the book' }).click()
      await page.waitForURL(/#\/worlds\//)
      const two = page.url().split('/worlds/')[1].split('/')[0]
      await page.evaluate(async (row) => { await window.__pwdb.characters.add(row) }, person('cara', two, 'Cara', 'A stranger at the inn.'))
      await scene(two, 'b2s1', ['anna', 'cara'])
      await page.goto(`${BASE}/#/worlds/${one}/characters`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByText('First in The Second Road'),
  },
  {
    /*
      Reading mode in a series (issue #698, D-3): opening book two to read it,
      the reader is asked once whether they have read book one.
    */
    name: '25e-series-reading', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      await page.getByRole('button', { name: 'New World' }).click()
      await page.getByLabel('Name').fill('The Salt Road')
      await page.getByRole('button', { name: 'Create World' }).last().click()
      await page.waitForURL(/#\/worlds\//)
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
      await main.getByRole('button', { name: /Make a series/ }).click()
      await page.getByLabel('Series name').fill('The Salt Books')
      await page.getByRole('button', { name: 'Make the series' }).click()
      await main.getByRole('region', { name: 'Series: The Salt Books' }).getByRole('button', { name: 'Add a book' }).click()
      await page.getByLabel('Title').fill('The Second Road')
      await page.getByRole('button', { name: 'Add the book' }).click()
      await page.waitForURL(/#\/worlds\//)
      const two = page.url().split('/worlds/')[1].split('/')[0]
      await page.evaluate(async (id) => { await window.__pwdb.worlds.update(id, { readingMode: true }) }, two)
      await page.goto(`${BASE}/#/worlds/${two}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByRole('dialog', { name: 'Have you read the earlier books?' }),
  },
  {
    /*
      Join a series (issue #698, part 3): a sequel written on its own, with its
      own Anna, Bo and the harbour, joining the series its first book became.
      Bo is the one namesake said not to be the same man.
    */
    name: '25c-join-series', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      const world = async (name) => {
        await page.getByRole('button', { name: 'New World' }).click()
        await page.getByLabel('Name').fill(name)
        await page.getByRole('button', { name: 'Create World' }).last().click()
        await page.waitForURL(/#\/worlds\//)
        const id = page.url().split('/worlds/')[1].split('/')[0]
        await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
        return id
      }
      const one = await world('The Salt Road')
      const two = await world('The Second Road')
      await page.evaluate(async ([one, two]) => {
        const now = Date.now()
        const person = (id, worldId, name, aliases = []) => ({ id, worldId, name, aliases, description: '', color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
        await window.__pwdb.characters.bulkAdd([
          person('anna', one, 'Anna Vell', ['Annie']), person('bo', one, 'Bo'), person('wren', one, 'Wren'),
          person('anna-2', two, 'Annie'), person('bo-2', two, 'Bo'), person('wren-2', two, 'Wren'), person('cara', two, 'Cara'),
        ])
        await window.__pwdb.items.bulkAdd([
          { id: 'key', worldId: one, name: 'Brass Key', description: '', iconType: 'key', imageId: null, tags: [] },
          { id: 'key-2', worldId: two, name: 'Brass Key', description: '', iconType: 'key', imageId: null, tags: [] },
        ])
      }, [one, two])
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
      await main.getByRole('button', { name: /Make a series/ }).click()
      await page.getByLabel('Series name').fill('The Salt Books')
      await page.getByRole('button', { name: 'Make the series' }).click()
      await main.getByRole('button', { name: 'More actions for The Second Road' }).click()
      await main.getByRole('button', { name: /Join a series/ }).click()
      const join = page.getByRole('dialog', { name: 'Join a series' })
      await join.getByRole('region', { name: 'People' }).getByLabel('Bo', { exact: true }).selectOption({ label: 'Not a match: joins as new' })
    },
    ready: (page) => page.getByRole('dialog', { name: 'Join a series' }).getByText(/Joining as new/),
  },
  {
    /*
      The catalogue, in a context with nothing installed, so every card offers
      Download rather than Open — which is what a reader meets first.
    */
    name: '64-library', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      await page.getByRole('button', { name: 'Library', exact: true }).click()
    },
    ready: (page) => page.getByRole('tab', { name: /Books you can read/ }),
  },
  {
    /*
      Where the shelf changes over. The two headings are thirty-nine cards
      apart, so the split cannot be photographed from the top of the dialog —
      and the split is the thing the section is about.
    */
    name: '65-library-structure-only', book: ILIAD, reading: false, fresh: true,
    go: async (page) => {
      await page.getByRole('button', { name: 'Library', exact: true }).click()
      await page.getByRole('tab', { name: /Structure only/ }).click()
    },
    ready: (page) => page.getByText('no text from the book'),
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'View all chapters' }).click()
    },
    ready: (page) => page.getByRole('button', { name: /Ch\. 24|The Ransom/ }).first(),
  },
  {
    name: '60-settings-index', book: ILIAD, reading: false,
    /*
      Expanded, whatever the last shot left behind. `64-settings-collapsed`
      clicks "Collapse all", and that choice persists in localStorage — so this
      shot found "Expand all" instead and reported the screen as never having
      rendered, on a screen that had.
    */
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'WORLD' }).waitFor({ state: 'visible', timeout: 30_000 })
      const expand = page.getByRole('button', { name: /Expand all/i })
      if (await expand.isVisible().catch(() => false)) await expand.click()
    },
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'More actions for chapter 1', exact: true }).click()
    },
    ready: (page) => page.getByRole('menu').or(page.getByRole('menuitem').first()),
  },
  {
    name: '72-page-view', book: ILIAD, reading: false,
    // Opened at chapter 1, so the binder lists its scenes beside the page.
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
      await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true })
        .click({ timeout: 30_000 })
    },
    ready: (page) => page.getByRole('textbox', { name: 'The book, as one page' }),
    settle: 2500,
  },
  {
    name: '73-timeline-read', book: ILIAD, reading: false,
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
      await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Read', exact: true })
        .click({ timeout: 30_000 })
    },
    ready: (page) => page.getByRole('main').getByText('Sing, O goddess').first(),
    settle: 2500,
  },
  {
    name: '71-join-scene', book: ILIAD, reading: false,
    // The Iliad's chapter 1 opens on "The Priest Is Rejected"; the scene after
    // it in the same chapter is what the dialog names.
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'The Priest Is Rejected', exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
      await main.getByRole('button', { name: 'More actions for “The Priest Is Rejected”' }).click()
      await page.getByRole('menuitem', { name: 'Join with next scene…' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    name: '65-scene-standing', book: ILIAD, reading: false,
    // The X-ray gutter renders only in Reading mode, and only with prose.
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript?view=read`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: /^Ch\. 1 —/ }).waitFor({ state: 'visible', timeout: 30_000 })
    },
    ready: (page) => page.getByRole('heading', { name: /^Ch\. 1 —/ }),
    settle: 2500,
  },
  {
    name: '46-focus-mode', book: ILIAD, reading: false,
    // The button reads "Focus"; its title is "Write this scene
    // distraction-free", which is not its accessible name because text content
    // wins over `title`.
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
      await openScene(page, 'The Priest Is Rejected', 'Focus')
      await page.getByRole('button', { name: 'Focus', exact: true }).first().click()
    },
    ready: (page) => page.getByRole('textbox').first(),
    settle: 2500,
  },
  {
    name: '34-scene-history', book: ILIAD, reading: false,
    /*
      Seeded: the History button renders only when `sceneRevisions.length > 0`,
      and not one of the 41 Library books carries a single revision — a book
      that arrived whole has never been edited and paused.
    */
    seed: (page, id) => page.evaluate(async (worldId) => {
      const chapters = await window.__pwdb.chapters.where('worldId').equals(worldId).toArray()
      const chapter = chapters.sort((a, b) => a.number - b.number)[0]
      const events = await window.__pwdb.events.where('chapterId').equals(chapter.id).toArray()
      const event = events.sort((a, b) => a.sortOrder - b.sortOrder)[0]
      const day = 86_400_000
      for (const [ago, text] of [
        [3, 'Sing, O goddess, the wrath of Achilles.'],
        [1, 'Sing, O goddess, the anger of Achilles son of Peleus, that brought countless ills upon the Achaeans.'],
      ]) {
        await window.__pwdb.sceneRevisions.put({
          id: `guide-revision-${ago}`, worldId, eventId: event.id, text,
          wordCount: text.split(/\s+/).length, createdAt: Date.now() - ago * day,
        })
      }
    }, id),
    go: async (page, id) => {
      const chapter = await firstChapter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/manuscript/${chapter}`, { waitUntil: 'load' })
      await openScene(page, 'The Priest Is Rejected', /^History/)
      await page.getByRole('button', { name: /^History/ }).first().click()
    },
    ready: (page) => page.getByRole('dialog').or(page.getByRole('button', { name: /^History/ }).first()),
    settle: 2000,
  },
  {
    name: '47-all-timelines', book: JOURNEY, reading: false,
    /*
      "All timelines" is an <optgroup> label inside the chapter bar's scope
      <select>, not a button — which is why every button-shaped attempt reported
      `count = 0`. It was correct: there is no such button. The option under it
      is "All · Chapter order".

      Journey to the West is the only shipped book with two timelines, and at a
      hundred chapters it is the slowest screen in the app to settle.
    */
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      const scope = page.locator('select[aria-label="Timeline bar scope"]')
      await scope.waitFor({ state: 'visible', timeout: 90_000 })
      await scope.selectOption({ label: 'All · Chapter order' })
    },
    ready: (page) => page.locator('select[aria-label="Timeline bar scope"]'),
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
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
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

  // ── Dialogs on the shelf ──────────────────────────────────────────────────
  {
    name: '22-import-manuscript', book: ILIAD, reading: false,
    go: async (page) => {
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Import Manuscript' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },
  {
    // A Word draft chosen: the file named, and what came in besides the words (issue #697).
    name: '22b-import-word-draft', book: ILIAD, reading: false,
    go: async (page) => {
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Import Manuscript' }).click()
      await page.getByLabel('Choose manuscript file').setInputFiles('src/lib/__tests__/fixtures/docx/import/08-tracked-and-comments.docx')
    },
    ready: (page) => page.getByRole('list', { name: 'From the Word draft' }),
  },
  {
    name: '23-generate-ai', book: ILIAD, reading: false,
    go: async (page) => {
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Generate World from AI' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },

  // ── Generation dialogs inside a world ─────────────────────────────────────
  {
    name: '26-generate-characters', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/characters`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'Characters' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Generate with AI' }).click()
    },
    ready: (page) => page.getByRole('dialog'),
  },

  // ── Dashboard panels, which sit below the tiles ───────────────────────────
  {
    name: '20-cast-balance', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'The Iliad' }),
    scrollTo: 'Cast Balance',
  },
  {
    name: '21-plot-threads', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'The Iliad' }),
    scrollTo: 'Plot Threads',
  },
  {
    name: '33-motifs', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'The Iliad' }),
    scrollTo: 'Motifs',
  },

  // ── Screens with a control that opens something ───────────────────────────
  {
    name: '30-calendar', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/calendar`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Calendar' }),
    settle: 2500,
  },
  {
    name: '42-lore-editor', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/lore`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'Textual Basis' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('heading', { name: 'Textual Basis' }).click()
    },
    ready: (page) => page.getByRole('heading', { name: 'Textual Basis' }),
    settle: 2000,
  },
  {
    name: '55-structure-proportion', book: ILIAD, reading: false,
    go: (page, id) => page.goto(`${BASE}/#/worlds/${id}/structure`, { waitUntil: 'load' }),
    ready: (page) => page.getByRole('heading', { name: 'Structure' }),
    scrollTo: 'Hook',
    settle: 2000,
  },

  {
    name: '27-generate-locations', book: ALICE, reading: false,
    // Location generation is inside the map's own tools menu, not on a toolbar.
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/maps`, { waitUntil: 'load' })
      await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 40_000 })
      await page.waitForTimeout(3000)
      await page.getByRole('button', { name: 'Map tools' }).click()
      await page.getByText('AI Locations').waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByText('AI Locations').click()
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 2000,
  },
  {
    name: '54-image-lightbox', book: ILIAD, reading: false,
    // A portrait opens full size; the character page is where one is.
    go: async (page, id) => {
      const c = await firstCharacter(page, id)
      await page.goto(`${BASE}/#/worlds/${id}/characters/${c}`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'Achilles' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.waitForTimeout(1500)
      await page.getByRole('main').locator('img').first().click()
    },
    ready: (page) => page.getByRole('dialog').or(page.locator('[data-lightbox]')),
    settle: 2000,
  },
  {
    name: '57-brief-scene-picker', book: ILIAD, reading: false,
    /*
      The brief with no scene chosen, which is the state the section is about.
      Clearing the cursor is what produces it.
    */
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/manuscript`, { waitUntil: 'load' })
      await page.getByRole('main').getByText('The Quarrel').first().waitFor({ state: 'visible', timeout: 30_000 })
      const clear = page.getByRole('button', { name: /Clear the selected moment/i }).first()
      if (await clear.isVisible().catch(() => false)) await clear.click()
      await page.waitForTimeout(1200)
      await page.locator('button[aria-label="Writer\'s Brief"]').click()
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 2000,
  },

  {
    name: '25-start-sequel', book: ILIAD, reading: false,
    // Starting a sequel is in a world card's own menu on the shelf, not in
    // settings — the menu is titled "More actions" rather than named for export.
    go: async (page) => {
      await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'The Iliad' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator('button[title="More actions"]').first().click()
      await page.getByText('Start a sequel').waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByText('Start a sequel').click()
    },
    ready: (page) => page.getByRole('dialog'),
    settle: 2000,
  },
  {
    name: '56-relationship-focus', book: ILIAD, reading: false,
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/relationships`, { waitUntil: 'load' })
      await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 40_000 })
      await page.waitForTimeout(2500)
      /*
        A <select>, not a button — which is why clicking a
        `button[aria-label=...]` timed out on a control that was on screen.
        Choosing somebody is also the point of the shot: the section is about
        keeping a large cast readable by drawing less of it.
      */
      await page.selectOption('select[aria-label="Focus on one character"]', { label: 'Achilles' })
    },
    ready: (page) => page.locator('.react-flow__node').first(),
    settle: 2000,
  },
  {
    name: '63-calendar-presets', book: ILIAD, reading: false,
    /*
      The presets are in the CalendarEditor, which lives in World Settings —
      not on the Calendar screen, which is where a probe looked for them.
    */
    go: async (page, id) => {
      await page.goto(`${BASE}/#/worlds/${id}/settings`, { waitUntil: 'load' })
      await page.getByRole('heading', { name: 'WORLD' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('heading', { name: /CALENDAR/i }).first().scrollIntoViewIfNeeded()
    },
    ready: (page) => page.getByRole('heading', { name: /CALENDAR/i }).first(),
    settle: 2000,
  },

  {
    name: '41-item-cross-timeline', book: JOURNEY, reading: false,
    /*
      Seeded, and it has to be. **No shipped book has a single
      crossTimelineArtifact** — measured across all 41 — so this screen cannot
      be photographed from the Library at all, the same problem scene revisions
      had. It also needs two timelines to be meaningful, which only Journey to
      the West has: an artifact is an item that exists on one timeline and is
      encountered on another.
    */
    seed: (page, id) => page.evaluate(async (worldId) => {
      const timelines = await window.__pwdb.timelines.where('worldId').equals(worldId).toArray()
      const items = await window.__pwdb.items.where('worldId').equals(worldId).toArray()
      if (timelines.length < 2 || !items.length) throw new Error('needs two timelines and an item')
      const now = Date.now()
      await window.__pwdb.crossTimelineArtifacts.put({
        id: 'guide-artifact', worldId, itemId: items[0].id,
        originTimelineId: timelines[0].id, encounterTimelineId: timelines[1].id,
        encounterNotes: 'Carried out of the age of the monkey and met again on the road west.',
        createdAt: now, updatedAt: now,
      })
      return items[0].id
    }, id),
    go: async (page, id) => {
      const itemId = await page.evaluate(async (worldId) => {
        const items = await window.__pwdb.items.where('worldId').equals(worldId).toArray()
        return items[0].id
      }, id)
      await page.goto(`${BASE}/#/worlds/${id}/items/${itemId}`, { waitUntil: 'load' })
    },
    ready: (page) => page.getByText(/Carried out of the age of the monkey/),
    settle: 2500,
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
  if (shot.init) await ctx.addInitScript(shot.init)
  const fresh = await ctx.newPage()
  try {
    await fresh.goto(`${BASE}/#/`, { waitUntil: 'load' })
    await settle(fresh, 1500)
    if (shot.go) await shot.go(fresh)
    await ready(fresh, shot.ready(fresh), shot.name)
    if (shot.scrollTo) await fresh.getByText(shot.scrollTo).first().scrollIntoViewIfNeeded()
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
      Shut whatever the last shot opened, unconditionally.

      This used to press Escape only while a `role="dialog"` was present, which
      is exactly the assumption that broke it: the Help panel is a panel, not a
      dialog, so the guard could not see it, and it stayed open over eleven
      later shots. Every one reported `headings: ["Help"]` and a click timeout —
      including two that failed as strict-mode violations, because the open
      panel contributed a second "Writer's Brief" and "Continuity Checker" to
      the page.

      Pressing Escape on an already-clean screen costs nothing, since every shot
      navigates afterwards anyway. Not knowing what kind of thing is open costs
      a whole run.
    */
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(250)
    }
    await setReadingMode(page, id, shot.reading)
    // A shot may need state no shipped book is in — see 34-scene-history, where
    // the control renders only when the scene has revisions and no Library book
    // has one. Defined but never called is how that shot failed twice.
    if (shot.seed) await shot.seed(page, id)
    await shot.go(page, id)
    await ready(page, shot.ready(page), shot.name)
    // Panels below the fold: a viewport screenshot of a dashboard shows the
    // tiles, not the Cast Balance chart eight hundred pixels further down.
    if (shot.scrollTo) await page.getByText(shot.scrollTo).first().scrollIntoViewIfNeeded()
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
