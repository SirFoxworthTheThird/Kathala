import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { unmetNames } from './helpers/unmet'

// Reading mode and spoiler gating, driven through the library so the
// test exercises the same path a reader takes. The reveal maths itself is unit
// tested in src/lib/__tests__/spoilers.test.ts.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/**
 * How many characters the roster is showing, read from the count beside the
 * title — the same number the reader sees, rather than a guess at the markup.
 */
async function shownCount(page: Page): Promise<number> {
  const badge = page.getByRole('heading', { name: 'Characters', level: 1 }).locator('+ span')
  return Number((await badge.innerText()).trim())
}

/** The world id of whichever library world the test downloaded. */
async function worldPath(page: Page): Promise<string> {
  return new URL(page.url()).hash.replace(/^#/, '').split('/').slice(0, 3).join('/')
}

/** Where the cursor pill says the reader is — the position, spelled out. */
async function cursorTitle(page: Page): Promise<string> {
  const pill = page.locator('button[title$="(open timeline)"], button[title^="Viewing all chapters"]').first()
  return (await pill.getAttribute('title')) ?? ''
}

/** The reader's deliberate "show me everything", confirm and all. */
async function revealAll(page: Page) {
  await page.getByRole('button', { name: 'View all chapters' }).click()
  await page.getByRole('button', { name: 'Show everything' }).click()
}

async function downloadFirstLibraryWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: /^Download \(/ }).first().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
  await page.waitForTimeout(1000)
}

test('a library world arrives in reading mode and hides the writing screens', async ({ page }) => {
  await downloadFirstLibraryWorld(page)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Characters' })).toBeVisible()
  // The manuscript is writing-only, and a library world carries no prose at all.
  await expect(nav.getByRole('link', { name: 'Manuscript' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Structure' })).toHaveCount(0)
})

test('the roster shows only characters the reader has met', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)

  // A freshly downloaded book opens at its first moment, so most of the cast is
  // still unmet. Poll: the count renders as 0 until the live query resolves.
  await expect(page.getByRole('note')).toContainText(/not yet met by chapter 1 are hidden/)
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(0)
  const atOpening = await shownCount(page)

  // Asking for everything is what shows the whole cast, and it has to be asked
  // for — the pairing is the point, since a count that is merely small proves
  // nothing on its own.
  await revealAll(page)
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(atOpening)
  expect(await shownCount(page)).toBeGreaterThan(10)
})

test('a hidden character is revealed by moving the cursor forward', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)

  await expect(page.getByRole('note')).toBeVisible()
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(0)
  const atOpening = await shownCount(page)

  // Walking forward can only ever reveal more — never fewer.
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: 'Next moment' }).click()
  }
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(atOpening)
})

test('reading mode offers no way to add to the cast, and can be turned off', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await expect(page.getByRole('button', { name: 'Add Character' })).toHaveCount(0)

  // Turning it off is the escape hatch for anyone who wants to edit. Settings
  // lives in the collapsed half of the nav rail, so go there directly — the
  // rail's own behaviour is not what this test is about.
  await page.goto(`/#${await worldPath(page)}/settings`)
  await settleNav(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await expect(page.getByRole('button', { name: 'Turn on reading mode' })).toBeVisible()

  await page.goto(`/#${await worldPath(page)}/characters`)
  await settleNav(page)
  await expect(page.getByRole('button', { name: 'Add Character' }).first()).toBeVisible()
  await expect(page.getByRole('note')).toHaveCount(0)
})

test('the dashboard does not give away the body count', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  // "7 dead" in chapter one tells you the toll of a book you have not read.
  await expect(page.getByRole('main')).not.toContainText('dead')
})

test('the dashboard drops the draft scorecard and speaks to a reader', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  const main = page.getByRole('main')

  // Everything here measures the manuscript, not the story: what is left to
  // write, how fast it is being written, and who the author is neglecting.
  for (const heading of ['Recent Events', 'Scene Status', 'Writing Progress', 'Cast Balance', 'Plot Threads']) {
    await expect(main.getByText(heading, { exact: true })).toHaveCount(0)
  }
  await expect(main).not.toContainText('snapshot coverage')

  // The tiles belong to whoever owns the world, and a reader owns none of it.
  await expect(main).not.toContainText('in your cast')
  await expect(main).not.toContainText('in your catalogue')
  await expect(main).not.toContainText('root map layers')
  await expect(main).toContainText('you have met so far')
})

test('settings keeps only what a reader can decide', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.goto(`/#${await worldPath(page)}/settings`)
  await settleNav(page)

  const sections = async () =>
    (await page.evaluate(`(() => [...document.querySelectorAll('main h2')].map((h) => h.textContent?.trim()))()`)) as string[]

  // How it looks, and whether to keep reading this way. Nothing else here is
  // the reader's to decide, and Export as HTML would write out the whole book.
  await expect.poll(sections, { timeout: 15_000 }).toEqual(['Reading mode', 'Theme'])
  await expect(page.getByRole('button', { name: 'Export as HTML' })).toHaveCount(0)

  // Turning reading mode off is the escape hatch, and it brings the rest back.
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await expect.poll(async () => (await sections()).length, { timeout: 15_000 }).toBeGreaterThan(2)
  await expect(page.getByRole('button', { name: 'Export as HTML' })).toBeVisible()
})

test('showing the whole book asks first, but only while reading', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  // The badge renders 0 until the live query resolves, so wait for the real
  // number before taking it as the baseline — otherwise "unchanged" is
  // measured against a count that was never on screen.
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(0)
  const met = await shownCount(page)

  // The control is an X beside the cursor, which reads as "dismiss" — so while
  // reading it must not silently hand over the whole cast.
  await page.getByRole('button', { name: 'View all chapters' }).click()
  await expect(page.getByRole('heading', { name: 'Show the whole book?' })).toBeVisible()
  await expect.poll(() => shownCount(page), { timeout: 10_000 }).toBe(met)

  // Confirming is the reader's deliberate choice, and it does reveal everything.
  await page.getByRole('button', { name: 'Show everything' }).click()
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(met)

  // A writer reaches for this constantly; it must stay a single click for them.
  await page.goto(`/#${await worldPath(page)}/settings`)
  await settleNav(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await page.waitForTimeout(800)
  await page.goto(`/#${await worldPath(page)}/characters`)
  await settleNav(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'View all chapters' }).click()
  await expect(page.getByRole('heading', { name: 'Show the whole book?' })).toHaveCount(0)
})

test('the corkboard is a plotting board, not a reading screen', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Corkboard' })).toHaveCount(0)
})

test('relationship counts do not betray the size of the cast', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)

  // Every relationship on show must join two characters the reader has met —
  // otherwise "61 connections" between three people gives the game away.
  const unmet = await unmetNames(page)
  const stray = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll(); q.onsuccess = () => r(q.result)
      })
      Promise.all([read('relationships'), read('characters')]).then(([rels, chars]) => {
        const nameById = new Map(chars.map((c) => [c.id, c.name]))
        resolve(rels.map((r) => [nameById.get(r.characterAId), nameById.get(r.characterBId)]))
      })
    }
  }))()`) as [string, string][]

  const unmetSet = new Set(unmet.characters)
  const hidden = stray.filter(([a, b]) => unmetSet.has(a) || unmetSet.has(b))
  expect(hidden.length, 'the fixture should hold relationships involving unmet characters').toBeGreaterThan(0)

  await page.goto(`/#${await worldPath(page)}/relationships`)
  await page.waitForTimeout(2000)
  const shown = await page.getByRole('main').innerText()
  const leaked = hidden.filter(([a, b]) => shown.includes(a) && shown.includes(b))
  expect(leaked, `relationships shown between unmet characters: ${JSON.stringify(leaked)}`).toEqual([])
})

test('a character page has nothing to edit and no future', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)

  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(0)
  // Roster cards are clickable divs, not buttons.
  await page.locator('main div.cursor-pointer').first().click()
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/./, { timeout: 15_000 })

  await expect(page.getByRole('button', { name: 'Delete character' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Upload portrait image' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)

  // Current State is a form for a writer; a reader gets the same facts as text.
  await page.getByRole('tab', { name: 'Current State' }).click()
  await page.waitForTimeout(600)
  await expect(page.getByRole('button', { name: 'Save State' })).toHaveCount(0)
  await expect(page.getByRole('main').locator('textarea')).toHaveCount(0)

  // History is a character's whole future — every chapter it lists must be one
  // the reader has already reached.
  await page.getByRole('tab', { name: 'History' }).click()
  await page.waitForTimeout(600)
  const history = await page.getByRole('main').innerText()
  const chapters = [...history.matchAll(/\bCh\.\s*(\d+)/g)].map((m) => Number(m[1]))
  expect(Math.max(0, ...chapters), `history listed ${history}`).toBeLessThanOrEqual(1)
})

test('a lore page reads as an article rather than a document', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.goto(`/#${await worldPath(page)}/lore`)
  await settleNav(page)
  await expect(page.getByRole('button', { name: 'New Page' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New category' })).toHaveCount(0)

  const firstPage = page.getByRole('main').getByRole('button').first()
  if (await firstPage.count()) {
    await firstPage.click()
    await page.waitForTimeout(800)
    await expect(page.locator('main textarea')).toHaveCount(0)
    await expect(page.getByPlaceholder('Add tag…')).toHaveCount(0)
  }
})

test('undo and redo shortcuts are inert while reading', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.goto(`/#${await worldPath(page)}/characters`)
  await settleNav(page)

  // Nothing must reach the store. Watching the journal is the direct check:
  // an undo of its own writes an operation, so a changed count means it ran.
  const ops = async () => page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const q = req.result.transaction('operations', 'readonly').objectStore('operations').count()
      q.onsuccess = () => resolve(q.result)
    }
  }))()`)

  const before = await ops()
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+y')
  await page.waitForTimeout(1000)
  expect(await ops()).toBe(before)
})

test('the map list keeps back places the reader has not been', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(800)

  // A sub-map is reached through the marker that links to it, so it is exactly
  // as much of a spoiler as that marker. Work out which maps are behind a
  // marker the reader has not met, and hold the sidebar to it.
  const unmet = await unmetNames(page)
  const behindUnmetMarkers = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll(); q.onsuccess = () => r(q.result)
      })
      Promise.all([read('mapLayers'), read('locationMarkers')]).then(([layers, markers]) => {
        const linkers = new Map()
        for (const m of markers) {
          if (!m.linkedMapLayerId) continue
          if (!linkers.has(m.linkedMapLayerId)) linkers.set(m.linkedMapLayerId, [])
          linkers.get(m.linkedMapLayerId).push(m.name)
        }
        resolve(layers
          .filter((l) => linkers.has(l.id))
          .map((l) => ({ layer: l.name, via: linkers.get(l.id) })))
      })
    }
  }))()`) as { layer: string; via: string[] }[]

  const unmetMarkers = new Set(unmet.locations)
  const shouldHide = behindUnmetMarkers.filter((l) => l.via.every((n) => unmetMarkers.has(n)))
  expect(shouldHide.length, 'the fixture should put at least one map behind an unmet place').toBeGreaterThan(0)

  await page.goto(`/#${await worldPath(page)}/maps`)
  await page.waitForTimeout(2500)

  // Read the layer tree itself rather than the page text: a chapter titled
  // after a place would otherwise look like a leak, and chapter titles stay
  // visible on purpose.
  const inTree = (await page.evaluate(
    `(() => [...document.querySelectorAll('[data-map-layer]')].map((n) => (n.textContent ?? '').trim()))()`,
  )) as string[]
  expect(inTree.length, 'the sidebar should be listing some maps').toBeGreaterThan(0)

  const listed = shouldHide.filter((l) => inTree.includes(l.layer)).map((l) => l.layer)
  expect(listed, `maps listed for places not yet reached: ${listed.join(', ')}`).toEqual([])
})

test('map territories wait for the story to reach them', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)

  // No library world records region state yet, so the rule would go untested on
  // the fixture as it stands — and a skipped test protects nothing. Seed both
  // cases instead: one territory whose state is first recorded at the moment
  // the reader is on, and one whose state is not recorded until the last event
  // in the book. The first should be on the map; the second gives away that the
  // story goes somewhere the reader has not been.
  const seeded = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll(); q.onsuccess = () => r(q.result)
      })
      Promise.all([read('events'), read('chapters'), read('mapLayers'), read('worlds')])
        .then(([events, chapters, layers, worlds]) => {
          const chapNum = new Map(chapters.map((c) => [c.id, c.number]))
          const key = (e) => (chapNum.get(e.chapterId) ?? 0) + e.sortOrder / 1e6
          const ordered = [...events].sort((a, b) => key(a) - key(b))
          const first = ordered[0]
          const last = ordered[ordered.length - 1]
          const worldId = worlds[0].id
          const now = Date.now()
          const region = (id, layerId, name) => ({
            id, worldId, mapLayerId: layerId, name,
            vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
            fillColor: '#888888', opacity: 0.3,
            linkedMapLayerId: null, factionId: null, createdAt: now, updatedAt: now,
          })
          const snap = (id, regionId, eventId) => ({
            id, worldId, regionId, eventId, status: 'held', updatedAt: now,
          })
          // Which layer the map opens on is the view's business, not this
          // test's, so put a pair on every one of them.
          const tx = db.transaction(['mapRegions', 'mapRegionSnapshots'], 'readwrite')
          layers.forEach((l, i) => {
            tx.objectStore('mapRegions').put(region('rgn-early-' + i, l.id, 'Marchlands of Testing'))
            tx.objectStore('mapRegions').put(region('rgn-late-' + i, l.id, 'Sundered Vale of Testing'))
            tx.objectStore('mapRegionSnapshots').put(snap('rs-early-' + i, 'rgn-early-' + i, first.id))
            tx.objectStore('mapRegionSnapshots').put(snap('rs-late-' + i, 'rgn-late-' + i, last.id))
          })
          tx.oncomplete = () => resolve({ layers: layers.length, lastEvent: last.id })
        })
    }
  }))()`) as { layers: number; lastEvent: string }
  expect(seeded.layers, 'the fixture should carry maps to put a territory on').toBeGreaterThan(0)

  // Seeding through raw IndexedDB is invisible to Dexie's live queries, and
  // moving between hash routes does not reload the document — so reload, or the
  // gate answers from the data it read before any of this existed.
  await page.reload()
  await page.waitForTimeout(1500)

  // The reload drops the persisted cursor, and a null cursor means "all
  // chapters", where everything is revealed on purpose. Step back onto the
  // opening moment or this asserts against a gate that is deliberately open.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)
  await page.goto(`/#${await worldPath(page)}/maps`)

  // Both directions: the rule has to hide the later one *and* keep the earlier
  // one, or it is not gating, it is just hiding regions.
  //
  // The presence half is an auto-waiting assertion rather than a snapshot of
  // body text taken after a fixed pause. That pause used to decide the result
  // under load — the snapshot caught the page shell before the map had drawn
  // anything — and waiting for the region that *must* appear also guarantees
  // the page has rendered before the absence half reads it.
  await expect(page.getByText('Marchlands of Testing').first(),
    'a territory recorded at the cursor should still be on the map').toBeVisible({ timeout: 30_000 })

  const shown = await page.evaluate(`(() => document.body.innerText)()`) as string
  expect(shown, 'a territory not recorded until the end of the book should not').not.toContain('Sundered Vale of Testing')
})

test('the map can be read and exported but not redrawn', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.goto(`/#${await worldPath(page)}/maps`)
  await page.waitForTimeout(2500)

  await expect(page.getByTitle('Add a location marker')).toHaveCount(0)
  await expect(page.getByTitle('Place a text label on the map')).toHaveCount(0)

  // The overflow menu keeps the one command that only reads the map.
  await page.getByRole('button', { name: 'Map tools' }).click()
  await expect(page.getByRole('button', { name: 'Export as PNG' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI Locations' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Replace image' })).toHaveCount(0)
})


test('a book opens where it was left, not at the whole plot', async ({ page }) => {
  // The bug this replaces: leaving a world cleared the cursor, and a null
  // cursor means "all chapters". A reader part-way through a book who closed it
  // and came back was handed the entire plot, silently, by the one feature
  // whose job is to prevent exactly that.
  await downloadFirstLibraryWorld(page)
  const book = await worldPath(page)

  // A freshly downloaded book starts at its opening moment rather than revealed.
  await expect.poll(() => cursorTitle(page), { timeout: 15_000 }).toMatch(/^Ch\.1 /)

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1000)
  const place = await cursorTitle(page)
  expect(place).toMatch(/^Ch\./)

  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(0)
  const met = await shownCount(page)

  // Leave to the shelf and come back, the way a reader does between sittings.
  await page.goto('/#/')
  await page.waitForTimeout(1200)
  await page.goto(`/#${book}/characters`)
  await settleNav(page)
  // Settle before asserting: the position is restored synchronously, but the
  // first-open rule runs after two Dexie reads, and an assertion that fires
  // before it would pass whatever it did.
  await page.waitForTimeout(2500)

  expect(await cursorTitle(page)).toBe(place)
  expect(await shownCount(page)).toBe(met)
})

test('coming back honours a deliberate "show everything"', async ({ page }) => {
  // The other half: once a reader has asked for the whole book, returning must
  // not quietly re-hide it or drag them back to chapter one.
  await downloadFirstLibraryWorld(page)
  const book = await worldPath(page)

  await revealAll(page)
  await expect.poll(() => cursorTitle(page), { timeout: 15_000 }).toMatch(/^Viewing all chapters/)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(10)
  const all = await shownCount(page)

  await page.goto('/#/')
  await page.waitForTimeout(1200)
  await page.goto(`/#${book}/characters`)
  await settleNav(page)
  await page.waitForTimeout(2500)

  // Still all chapters — not snapped back to the opening moment.
  expect(await cursorTitle(page)).toMatch(/^Viewing all chapters/)
  expect(await shownCount(page)).toBe(all)
})


test('the shelf shows how far into each book the reader has got', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  const book = await worldPath(page)

  // Freshly downloaded: chapter 1, and the card says so.
  await page.goto('/#/')
  await settleNav(page)
  await expect(page.getByText(/^Chapter 1 of \d+$/)).toBeVisible()

  // Read on, and the shelf follows.
  await page.goto(`/#${book}`)
  await settleNav(page)
  for (let i = 0; i < 14; i++) await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)
  const reached = (await cursorTitle(page)).match(/^Ch\.(\d+)/)![1]
  expect(Number(reached)).toBeGreaterThan(1)

  await page.goto('/#/')
  await settleNav(page)
  await expect(page.getByText(new RegExp(`^Chapter ${reached} of \\d+$`))).toBeVisible()

  // Asking for the whole book is not a place in it, so the bar goes away —
  // paired with the two assertions above so neither half can pass on its own.
  await page.goto(`/#${book}`)
  await settleNav(page)
  await revealAll(page)
  await page.waitForTimeout(800)
  await page.goto('/#/')
  await settleNav(page)
  await expect(page.getByText(/^Chapter \d+ of \d+$/)).toHaveCount(0)
})


test('the map cannot be redrawn by dragging what is on it', async ({ page }) => {
  // The toolbar buttons were already gated, but a map is direct manipulation:
  // dragging a pin writes exactly as surely as a button does, and an edit a
  // reader makes to a downloaded book is thrown away the next time they
  // download it. Driven for real, because "is this draggable" is a Leaflet
  // question rather than a React one.
  test.setTimeout(180_000)
  await downloadFirstLibraryWorld(page)
  const world = await worldPath(page)
  await page.goto(`/#${world}/maps`)
  await page.waitForTimeout(3000)

  const marker = page.locator('.leaflet-marker-icon').first()
  await expect(marker).toBeVisible()

  // Leaflet marks a draggable marker with this class, and only then binds the
  // handler that writes x/y back to the record.
  await expect(marker).not.toHaveClass(/leaflet-marker-draggable/)

  // Right-click offers add-location, annotation, route and region — all writes.
  await page.locator('.leaflet-container').click({ button: 'right', position: { x: 260, y: 200 } })
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: /add location/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /annotation/i })).toHaveCount(0)

  // Paired with the writing case, so this cannot pass because the map simply
  // failed to load: turn reading mode off and the same marker becomes draggable.
  await page.goto(`/#${world}/settings`)
  await settleNav(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await page.waitForTimeout(800)
  await page.goto(`/#${world}/maps`)
  await page.waitForTimeout(3000)

  await expect(page.locator('.leaflet-marker-icon').first()).toHaveClass(/leaflet-marker-draggable/)
})


test('the writing screens are closed by URL, not just hidden from the nav', async ({ page }) => {
  // Hiding a link is not closing a door. All three were reachable by typing the
  // address, and the corkboard then let a reader drag scene cards between
  // chapters — a write, on a world that gets replaced the next time they
  // download it.
  test.setTimeout(180_000)
  await downloadFirstLibraryWorld(page)
  const world = await worldPath(page)

  for (const screen of ['corkboard', 'structure', 'manuscript']) {
    await page.goto(`/#${world}/${screen}`)
    await page.waitForTimeout(1500)
    // Bounced back to the dashboard rather than served the writing screen.
    expect(new URL(page.url()).hash, screen).toBe(`#${world}`)
  }

  // Paired with the writing case, so this cannot pass because the routes are
  // broken for everyone: turn reading mode off and all three open.
  await page.goto(`/#${world}/settings`)
  await settleNav(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await page.waitForTimeout(800)

  for (const screen of ['corkboard', 'structure', 'manuscript']) {
    await page.goto(`/#${world}/${screen}`)
    await page.waitForTimeout(1500)
    expect(new URL(page.url()).hash, screen).toBe(`#${world}/${screen}`)
  }
})
