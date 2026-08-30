import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * SB-2: sidebar names were truncated far earlier than the column required —
 * *The Witch-kin…*, *Samwise Gam…*, *Radagast the …* — and measured at
 * `lg:w-52` a row's name got 101px once the place-on-map control appeared.
 * *The Witch-king of Angmar* and *The Witch-king of the North* came out
 * character-for-character identical.
 *
 * SB-3: only some rows carried their per-event state, so a row with no second
 * line could mean "nowhere" or "nothing loaded", at identical weight.
 *
 * Both are measured rather than read off `textContent`, which a CSS ellipsis
 * leaves untouched: the spec works out what is actually legible by finding the
 * longest prefix of each name that fits the width it was given.
 */

const TWINS = ['The Witch-king of Angmar', 'The Witch-king of the North']
const FITTING = ['Samwise Gamgee', 'Radagast the Brown']

async function mapWithCast(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Names')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /maps/i }).first().click()
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)

  const seeded = await page.evaluate(async (names) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
      timelines: { toArray: () => Promise<{ id: string }[]>; add: (v: unknown) => Promise<unknown> }
      chapters: { add: (v: unknown) => Promise<unknown> }
      events: { add: (v: unknown) => Promise<unknown> }
      characters: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      locationMarkers: { add: (v: unknown) => Promise<unknown> }
      characterSnapshots: { add: (v: unknown) => Promise<unknown> }
    }
    const layer = (await db.mapLayers.toArray())[0]
    const worldId = layer.worldId as string
    const now = Date.now()
    await db.characters.bulkAdd(names.map((name, i) => ({
      id: `chr-${i}`, worldId, name,
      role: '', description: '', tags: [], portraitImageId: null, createdAt: now, updatedAt: now,
    })))
    await db.locationMarkers.add({
      id: 'loc-riv', worldId, mapLayerId: layer.id, name: 'Rivendell',
      description: '', type: 'landmark',
      x: Number(layer.imageWidth) * 0.3, y: Number(layer.imageHeight) * 0.3,
      factionId: null, linkedMapLayerId: null, iconType: 'city', color: null,
      createdAt: now, updatedAt: now,
    })
    let tl = (await db.timelines.toArray())[0]
    if (!tl) {
      await db.timelines.add({ id: 'tl-1', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      tl = { id: 'tl-1' }
    }
    await db.chapters.add({
      id: 'ch-1', worldId, timelineId: tl.id, number: 1, title: 'Landfall',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev-1', worldId, chapterId: 'ch-1', timelineId: tl.id, title: 'The wreck',
      description: '', locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
      travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
      threadIds: [], status: 'idea', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    // One character placed, the rest not — SB-3's "some rows carry state".
    await db.characterSnapshots.add({
      id: 'snap-1', worldId, characterId: 'chr-0', eventId: 'ev-1',
      isAlive: true, currentLocationMarkerId: 'loc-riv', currentMapLayerId: layer.id,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
    return true
  }, [...TWINS, ...FITTING])
  expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

  // Opening a chapter sets the cursor, which is what puts the sidebar into its
  // per-event state — the state the finding was measured in.
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settle(page)
  await page.getByTitle('Open chapter detail').first().click()
  await page.waitForTimeout(1000)
  await page.getByRole('link', { name: /maps/i }).first().click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)
}

/** What each sidebar name row actually renders, not what it contains. */
async function readRows(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector('[data-sidebar-section-body]')
    if (!body?.parentElement) return null
    const col = body.parentElement
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    return {
      columnWidth: Math.round(col.getBoundingClientRect().width),
      names: [...col.querySelectorAll<HTMLElement>('p.truncate, span.truncate')]
        .filter((n) => (n.textContent ?? '').trim())
        .map((n) => {
          const full = (n.textContent ?? '').trim()
          const cs = getComputedStyle(n)
          ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
          // The longest prefix that fits — i.e. what a reader can actually see.
          let visible = ''
          for (let i = 1; i <= full.length; i++) {
            if (ctx.measureText(full.slice(0, i)).width > n.clientWidth) break
            visible = full.slice(0, i)
          }
          return { full, visible, clipped: n.scrollWidth > n.clientWidth + 1, title: n.getAttribute('title') }
        }),
    }
  })
}

test.describe('The map sidebar says which name is which', () => {
  test.describe.configure({ timeout: 180_000 })

  test('SB-2: two names sharing a long prefix do not render alike', async ({ page }) => {
    await mapWithCast(page)
    const read = await readRows(page)
    expect(read, 'the sidebar should have rendered').not.toBeNull()

    const byName = (n: string) => read!.names.find((r) => r.full === n)

    // Presence: names that comfortably fit are shown whole. Both of these were
    // clipped before — *Samwise Gam…*, *Radagast the …* — so an assertion that
    // nothing is cut would have failed here rather than passing vacuously.
    for (const name of FITTING) {
      const row = byName(name)
      expect(row, `${name} should be in the sidebar`).toBeTruthy()
      expect(row!.clipped, `${name} is still truncated`).toBe(false)
    }

    // The finding itself: the two Witch-kings must not read identically.
    const [a, b] = TWINS.map(byName)
    expect(a && b, 'both long names should be in the sidebar').toBeTruthy()
    expect(a!.visible).not.toBe(b!.visible)
    // And not merely by a character — they diverge at "of the"/"of An".
    expect(a!.visible.length, `only "${a!.visible}" is legible`)
      .toBeGreaterThan('The Witch-king of '.length)

    // Whatever is still cut can be read in full on hover.
    const untitled = read!.names.filter((r) => r.clipped && !r.title).map((r) => r.full)
    expect(untitled, `truncated with no title: ${untitled.join(', ')}`).toEqual([])
  })

  test('SB-3: every row says where it stands, placed or not', async ({ page }) => {
    await mapWithCast(page)
    const characters = page.locator('[data-sidebar-section-body="Characters"]')

    // Presence: the one placed character names its location.
    await expect(characters.getByText('Rivendell')).toBeVisible({ timeout: 15_000 })
    // Absence, stated rather than left blank: the other three say so. Exact,
    // because the group heading above them reads "Not placed (3)" (MW-3) and a
    // substring match counts it as a fourth row.
    await expect(characters.getByText('Not placed', { exact: true })).toHaveCount(3)

    // The opposite condition, in the same test: with no moment selected there
    // is no per-event state to report, so neither line is drawn.
    await page.getByRole('button', { name: 'View all chapters' }).click()
    await settle(page)
    await expect(characters.getByText('Not placed', { exact: true })).toHaveCount(0)
    await expect(characters.getByText('Rivendell')).toHaveCount(0)
  })
})
