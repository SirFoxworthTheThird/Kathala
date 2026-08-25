import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide, settleNav } from './helpers/nav'

/**
 * N12, from a blind writer run, measured on Monte Cristo: 41 characters × 149
 * scenes = 6,150 cells, and clicking **Scenes** took **4,096 ms** from the
 * click to the grid being present, with no progress indication. Everything else
 * in that world was fast — Timeline with 117 chapters in 517 ms, the continuity
 * checker in 1,764 ms, search in 160–210 ms.
 *
 * This rebuilds that shape. It is kept for two reasons.
 *
 * The claim it asserts is a correctness one at scale: every scene gets a column
 * and every character a row, so a book-sized grid is not silently truncated —
 * which is the failure a slow grid would most plausibly be "fixed" into.
 *
 * The timing it prints is information, not a threshold. This container is not
 * the machine the finding was measured on, and a millisecond bound pinned to it
 * would go red for reasons nothing to do with the code. Measured here: 1,812 ms
 * before any attempt at a fix, and 1,870 ms after caching the per-cell class
 * strings — no improvement, since tailwind-merge already caches internally. That
 * optimisation was reverted rather than kept as an unearned claim, and the
 * finding is left open with the number recorded.
 */

const CHARACTERS = 41
const CHAPTERS = 30
const SCENES = 149

async function bigWorld(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('At Scale')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, chars, chapters, scenes]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { bulkAdd: (v: unknown[]) => Promise<unknown>; add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })

    await db.characters.bulkAdd(Array.from({ length: chars as number }, (_, i) => ({
      id: `c${i}`, worldId: id, name: `Character ${i}`, description: '', aliases: [], tags: [],
      portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now,
    })))

    await db.chapters.bulkAdd(Array.from({ length: chapters as number }, (_, i) => ({
      id: `ch${i}`, worldId: id, timelineId: 'tl', number: i + 1, title: `Chapter ${i + 1}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))

    const perChapter = Math.ceil((scenes as number) / (chapters as number))
    await db.events.bulkAdd(Array.from({ length: scenes as number }, (_, i) => ({
      id: `ev${i}`, worldId: id, chapterId: `ch${Math.floor(i / perChapter)}`, timelineId: 'tl',
      title: `Scene ${i}`, description: '', sortOrder: i % perChapter, tags: [],
      locationMarkerId: null,
      // A cast, so the roster has every character in it.
      involvedCharacterIds: [`c${i % (chars as number)}`],
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: `c${i % (chars as number)}`, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })))

    // Roughly the shipped world's density: a snapshot every few scenes.
    const snaps: unknown[] = []
    for (let i = 0; i < (scenes as number); i += 3) {
      const c = i % (chars as number)
      snaps.push({
        id: `s${i}`, worldId: id, characterId: `c${c}`, eventId: `ev${i}`, isAlive: true,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: `Note ${i}`, travelModeId: null,
        sortKey: Math.floor(i / perChapter) + 1 + (i % perChapter) / 1_000_000,
        createdAt: now, updatedAt: now,
      })
    }
    await db.characterSnapshots.bulkAdd(snaps)
  }, [worldId, CHARACTERS, CHAPTERS, SCENES] as [string, number, number, number])
  return worldId
}

test.describe('The Arc grid at the size of a real book', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a book-sized grid renders every scene and every character', async ({ page }) => {
    const worldId = await bigWorld(page)
    await page.goto(`/#/worlds/${worldId}/arc`, { waitUntil: 'load' })
    await settleNav(page)

    // Chapters mode is on screen first — 30 columns, which is never the problem.
    await expect(page.getByRole('button', { name: 'Scenes', exact: true })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Chapter 1', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    const started = Date.now()
    await page.getByRole('button', { name: 'Scenes', exact: true }).click()
    await expect(page.getByText('Scene 0', { exact: true }).first()).toBeVisible({ timeout: 120_000 })
    const elapsed = Date.now() - started

    // Information for whoever picks the performance up — see the note above.
    console.log(`ARC-SCENES-MS ${elapsed} (${CHARACTERS} characters × ${SCENES} scenes)`)

    /*
      The claim: nothing is dropped at this size. A column per scene, and the
      last scene and last character present rather than only the first.

      The table is `role="grid"`, not `role="table"`, and each scene column is a
      columnheader named "Chapter N, <scene title>" — so the count is taken from
      the named headers rather than from every header, which would also sweep in
      the unnamed sticky corner cell.
    */
    const grid = page.getByRole('grid', { name: 'Character arc grid' })
    await expect(grid.getByRole('columnheader', { name: /^Chapter \d+, Scene \d+$/ }))
      .toHaveCount(SCENES)
    await expect(grid.getByRole('columnheader', { name: `Chapter ${CHAPTERS}, Scene ${SCENES - 1}` }))
      .toBeAttached()
    await expect(page.getByText(`Character ${CHARACTERS - 1}`, { exact: true }).first()).toBeAttached()
  })
})
