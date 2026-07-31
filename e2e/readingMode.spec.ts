import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { unmetNames } from './helpers/unmet'

// Reading mode and spoiler gating, driven through the example library so the
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

async function downloadFirstLibraryWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Example Library' }).click()
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

  // At "all chapters" the reader has explicitly asked for everything. Poll:
  // the count renders as 0 until the live query resolves.
  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeGreaterThan(10)
  const total = await shownCount(page)

  // Step onto the opening moment: almost the whole cast is still unmet.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await expect(page.getByRole('note')).toContainText(/not yet met by chapter 1 are hidden/)

  await expect.poll(() => shownCount(page), { timeout: 15_000 }).toBeLessThan(total)
  expect(await shownCount(page)).toBeGreaterThan(0)
})

test('a hidden character is revealed by moving the cursor forward', async ({ page }) => {
  await downloadFirstLibraryWorld(page)
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)

  await page.getByRole('button', { name: 'Next moment' }).click()
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
  await page.getByRole('button', { name: 'Reading mode is on' }).click()
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
