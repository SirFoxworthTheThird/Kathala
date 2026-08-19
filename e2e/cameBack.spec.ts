import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Coming back — the character half.
 *
 * A revival used to produce an **error per subsequent scene**, and recording it
 * was what created them: the check read the *earliest* death and flagged every
 * later alive snapshot, so it could never be satisfied. It reports the return
 * once now, as a warning, and goes quiet when the writer states what happened.
 *
 * The state is the point. A suppression is keyed on a derived issue id, so
 * moving the scene orphans it and the warning comes back; `revived` is on the
 * snapshot, travels in the `.pwk`, and any screen can read it.
 *
 * What is driven here is the part that only exists in the browser: the checkbox
 * appearing where it can mean something, staying away where it cannot, and
 * writing the field.
 */

async function worldWithADeath(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Moria')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl1', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2, 3].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl1', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.add({
      id: 'gandalf', worldId: id, name: 'Gandalf', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd([1, 2, 3].map((n) => ({
      id: `ev${n}`, worldId: id, chapterId: `ch${n}`, timelineId: 'tl1',
      title: `Scene ${n}`, description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['gandalf'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null,
      status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })))
    // Alive in Ch.1, dead in Ch.2. Ch.3 is where he might come back.
    // `sortKey` is `chapter.number + sortOrder / 1_000_000`, which is what
    // `computeSortKey` writes — not the ×10_000 form the type comments claimed
    // until now. Seeded from the comment, these were a thousandfold too large
    // and the panel disagreed with the test without either being wrong.
    await db.characterSnapshots.bulkAdd([
      { id: 'cs1', eventId: 'ev1', isAlive: true, sortKey: 1 },
      { id: 'cs2', eventId: 'ev2', isAlive: false, sortKey: 2 },
    ].map((s) => ({
      id: s.id, worldId: id, characterId: 'gandalf', eventId: s.eventId, sortKey: s.sortKey,
      isAlive: s.isAlive, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })))
  }, worldId)
  return worldId
}

/**
 * Open Gandalf's Current State with the time cursor on a given scene.
 *
 * The cursor is set by clicking the scene in the chapter bar rather than by
 * writing `plotweave-ui` directly. Two separate things defeat the direct route:
 * a hash change is not a document load, so the store never re-hydrates, and
 * opening a world calls `setActiveWorldId`, which deliberately *resumes* that
 * world's own last scene and overwrites whatever was planted.
 */
async function currentStateAt(page: Page, worldId: string, sceneTitle: string) {
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.getByTitle(sceneTitle, { exact: true }).first().click()
  await page.waitForTimeout(600)

  await page.goto(`/#/worlds/${worldId}/characters/gandalf`)
  await page.waitForTimeout(1200)
  // Unconditionally, and as a tab — an `if (await tab.count())` guard here hid
  // the fact that the locator matched nothing, and both tests "passed" their
  // way to a screen that was still showing Overview.
  await page.getByRole('tab', { name: 'Current State' }).click()
  await page.waitForTimeout(600)
}

const storedRevived = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characterSnapshots: { toArray: () => Promise<Array<{ eventId: string; revived?: boolean }>> }
  }
  return (await db.characterSnapshots.toArray()).find((s) => s.eventId === 'ev3')?.revived ?? null
})

test.describe('Saying that a character came back', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the option appears after a death and writes the state', async ({ page }) => {
    const worldId = await worldWithADeath(page)
    await currentStateAt(page, worldId, 'Scene 3')

    /*
      The real flow. At Ch.3 the inherited state is "Deceased", carried forward
      from the death in Ch.2 — so the writer says they are alive first, and the
      question of how only then becomes one worth asking.
    */
    await expect(page.getByLabel('They came back in this scene')).toHaveCount(0)
    await page.getByRole('button', { name: 'Alive' }).click()

    const cameBack = page.getByLabel('They came back in this scene')
    await expect(cameBack).toBeVisible()
    await cameBack.check()
    await page.getByRole('button', { name: /^Save/ }).first().click()

    await expect.poll(async () => await storedRevived(page), { timeout: 15_000 }).toBe(true)
  })

  test('and is not offered before there is a death to come back from', async ({ page }) => {
    // The presence/absence pair: same screen, same character, earlier moment.
    // Without this half, "no checkbox" would pass on a screen that never
    // renders one at all.
    const worldId = await worldWithADeath(page)
    await currentStateAt(page, worldId, 'Scene 1')

    // Alive here too, so the difference is the death and not the toggle.
    await page.getByRole('button', { name: 'Alive' }).click()
    await expect(page.getByLabel('They came back in this scene')).toHaveCount(0)
    // …and the Status control it belongs to is definitely on screen.
    await expect(page.getByRole('button', { name: 'Deceased' })).toBeVisible()
  })
})
