import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * MT-2 and MT-7, both about a frame-narrative bar that showed two tracks and
 * said nothing about either.
 *
 * MT-2: two play buttons, one per track, and neither labelled for its track —
 * both read "Play story on the map", so nothing said which of the two a press
 * would move.
 *
 * MT-7: having paired moments with sync points, nothing on the bar said a
 * pairing existed; the only way to know was to open the relationship editor and
 * read the list.
 */
test.describe('The frame-narrative bar says what its parts are', () => {
  test.describe.configure({ timeout: 180_000 })

  test('each play button names its own track, and paired moments are marked', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Frame')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
        toArray: () => Promise<{ id: string }[]>
        add: (v: unknown) => Promise<unknown>
      }>
      if (!db) return false
      const [world] = await db.worlds.toArray()
      const worldId = world.id
      const now = Date.now()

      await db.timelines.add({ id: 'tl-outer', worldId, name: 'The Attic', description: '', color: '#f59e0b', createdAt: now })
      await db.timelines.add({ id: 'tl-inner', worldId, name: 'The Tale', description: '', color: '#60a5fa', createdAt: now })

      const build = async (timelineId: string, prefix: string, titles: string[]) => {
        for (let i = 0; i < titles.length; i++) {
          const chapterId = `${prefix}-ch-${i}`
          await db.chapters.add({
            id: chapterId, worldId, timelineId, number: i + 1, title: titles[i],
            synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
          })
          for (let j = 0; j < 2; j++) {
            await db.events.add({
              id: `${chapterId}-e${j}`, worldId, chapterId, timelineId,
              title: `${titles[i]} ${j + 1}`, description: '', locationMarkerId: null,
              involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
              tags: [], sortOrder: j, travelDays: null, inWorldTime: null, tension: null,
              structureBeat: null, threadIds: [], status: 'idea', povCharacterId: null,
              isFlashback: false, createdAt: now, updatedAt: now,
            })
          }
        }
      }
      await build('tl-outer', 'o', ['The Attic', 'Thieves'])
      await build('tl-inner', 'i', ['Sailing South', 'Landfall'])

      // Exactly one pairing, so the count of marks is a number rather than a
      // guess: the second moment of the outer story's first chapter
      // ("The Attic 2") and the first of the inner story's ("Sailing South 1").
      await db.timelineRelationships.add({
        id: 'rel-frame', worldId,
        sourceTimelineId: 'tl-outer', targetTimelineId: 'tl-inner',
        type: 'frame_narrative', anchors: [],
        syncPoints: [{ outerEventId: 'o-ch-0-e1', innerEventId: 'i-ch-0-e0', label: '' }],
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settle(page)

    const bar = page.locator('[data-chapter-bar]')
    await expect(bar).toBeVisible({ timeout: 15_000 })

    // ── MT-2 ────────────────────────────────────────────────────────────────
    // Each track's play button names its own track, so they are two different
    // controls rather than the same one twice.
    await expect(bar.getByTitle(/^Play The Attic —/)).toHaveCount(1)
    await expect(bar.getByTitle(/^Play The Tale —/)).toHaveCount(1)
    // And the label they shared is gone.
    await expect(bar.getByTitle('Play story on the map')).toHaveCount(0)

    // ── MT-7 ────────────────────────────────────────────────────────────────
    // One sync point, so exactly two moments are paired — one on each track —
    // and each says so on hover.
    const paired = bar.getByTitle(/paired with a moment on the other track$/)
    await expect(paired).toHaveCount(2)
    await expect(bar.getByTitle('The Attic 2 — paired with a moment on the other track')).toHaveCount(1)
    await expect(bar.getByTitle('Sailing South 1 — paired with a moment on the other track')).toHaveCount(1)

    // The unpaired moments are unchanged, so this is a mark on the paired ones
    // rather than a mark on everything.
    await expect(bar.getByTitle('The Attic 1', { exact: true })).toHaveCount(1)
    await expect(bar.getByTitle('Landfall 1', { exact: true })).toHaveCount(1)

    // The mark is drawn, not merely described in a tooltip.
    const dots = await bar.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('button[title*="paired with a moment"] span')].length)
    expect(dots, 'each paired tick carries a dot').toBe(2)
  })
})
