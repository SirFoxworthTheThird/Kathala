import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The relationship graph did not survive its own example. Forty-five characters
 * went onto a fixed four-column grid — a picture twice as tall as it was wide —
 * so fitView zoomed out until the labels were a mat, the connected characters
 * knotted in the top third, and both side thirds stayed empty. There was no
 * re-layout, no filter, and no way to draw less.
 *
 * The layout arithmetic is unit-tested in
 * src/features/relationships/__tests__/graphLayout.test.ts. This drives the
 * wiring on a cast big enough to knot.
 */
test.describe('Relationship graph at scale', () => {
  test.describe.configure({ timeout: 180_000 })

  const CAST = 45

  /** A cast of 45: one hub of 14, a chain of 10, a second hub of 8, 12 loners. */
  async function seed(page: import('@playwright/test').Page, worldId: string) {
    return page.evaluate(async ({ worldId, CAST }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        characters: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
        relationships: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
      }
      const now = Date.now()
      const ids = Array.from({ length: CAST }, (_, i) => `ch${i + 1}`)
      await db.characters.bulkAdd(ids.map((id, i) => ({
        id, worldId, name: `Person ${i + 1}`, role: '', description: '', appearance: '',
        personality: '', backstory: '', notes: '', tags: [], aliases: [],
        portraitImageId: null, colorTag: null, status: 'alive',
        createdAt: now, updatedAt: now,
      })))

      const pairs: [string, string][] = []
      for (let i = 2; i <= 15; i++) pairs.push(['ch1', `ch${i}`])          // hub
      for (let i = 16; i < 25; i++) pairs.push([`ch${i}`, `ch${i + 1}`])   // chain
      for (let i = 27; i <= 33; i++) pairs.push(['ch26', `ch${i}`])        // second hub

      await db.relationships.bulkAdd(pairs.map(([a, b], i) => ({
        id: `rel-${i}`, worldId, characterAId: a, characterBId: b,
        label: `knows ${i}`, strength: 'moderate', sentiment: 'neutral',
        description: '', isBidirectional: true, startEventId: null,
        createdAt: now, updatedAt: now,
      })))
      return { characters: ids.length, relationships: pairs.length }
    }, { worldId, CAST })
  }

  async function openGraph(page: import('@playwright/test').Page) {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Big Cast')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    const seeded = await seed(page, worldId)
    expect(seeded, 'the seeding seam should be present in an e2e build').toEqual({ characters: 45, relationships: 30 })

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await expect(page.locator('.react-flow__node')).toHaveCount(CAST, { timeout: 30_000 })
    return worldId
  }

  test('lays a large cast out wide instead of stacking it into a column', async ({ page }) => {
    await openGraph(page)

    // Measured in graph coordinates, not screen pixels, so the assertion is
    // about the layout rather than about how far fitView happened to zoom out.
    const box = await page.locator('.react-flow__node').evaluateAll((els) => {
      const rects = els.map((e) => e.getBoundingClientRect())
      return {
        width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
        height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
      }
    })
    // The four-column grid gave 880 × 1920 — 2.2 times taller than wide.
    expect(box.height / box.width).toBeLessThan(1.3)

    // And it fills the canvas rather than leaving both side thirds empty.
    const canvas = await page.locator('.react-flow').boundingBox()
    expect(box.width).toBeGreaterThan(canvas!.width * 0.5)
  })

  test('focusing one character draws only their corner of the graph', async ({ page }) => {
    await openGraph(page)

    // Person 1 is the hub of fourteen, so one hop out is fifteen cards.
    await page.getByLabel('Focus on one character').selectOption({ label: 'Person 1' })
    await expect(page.locator('.react-flow__node')).toHaveCount(15)
    await expect(page.getByText('15 of 45 shown')).toBeVisible()

    // Two hops adds nobody here — the spokes know only the hub — which is itself
    // worth seeing, and proves the depth control is wired to the same set.
    await page.getByLabel('How far from them to show').selectOption('2')
    await expect(page.locator('.react-flow__node')).toHaveCount(15)

    // Person 16 starts a chain, so its two hops reach further than its one.
    await page.getByLabel('Focus on one character').selectOption({ label: 'Person 16' })
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
    await page.getByLabel('How far from them to show').selectOption('1')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    // Back to everyone — the paired presence, so none of the above can pass
    // because the graph simply failed to render.
    await page.getByLabel('Focus on one character').selectOption('')
    await expect(page.locator('.react-flow__node')).toHaveCount(CAST)
    await expect(page.getByText(/of 45 shown/)).toHaveCount(0)
  })

  test('tidy up puts back a card that was dragged away', async ({ page }) => {
    await openGraph(page)

    const card = page.locator('.react-flow__node').first()
    const before = (await card.boundingBox())!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 260, before.y + before.height / 2 + 180, { steps: 12 })
    await page.mouse.up()

    const dragged = (await card.boundingBox())!
    expect(Math.abs(dragged.x - before.x) + Math.abs(dragged.y - before.y),
      'the drag should actually have moved the card').toBeGreaterThan(100)

    await page.getByRole('button', { name: 'Tidy up' }).click()
    await expect(async () => {
      const after = (await card.boundingBox())!
      expect(Math.abs(after.x - before.x)).toBeLessThan(12)
      expect(Math.abs(after.y - before.y)).toBeLessThan(12)
    }).toPass({ timeout: 10_000 })

    // And the hand-placed position is gone for good, not just overdrawn.
    expect(await page.evaluate(() => Object.keys(
      JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('wb-rel-pos-')) ?? '') ?? '{}')
    ).length)).toBe(0)
  })

  test('edge labels drop away when zoomed too far out to read them', async ({ page }) => {
    await openGraph(page)

    // The wheel rather than the zoom buttons: React Flow disables those at the
    // limits, and racing a button that is on its way to disabled is a flake.
    const canvas = (await page.locator('.react-flow').boundingBox())!
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
    const wheel = async (delta: number, times: number) => {
      for (let i = 0; i < times; i++) await page.mouse.wheel(0, delta)
    }

    // Zoomed in, the labels are there and nothing is telling you to zoom.
    await wheel(-120, 15)
    await expect(page.locator('[data-edge-label]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Zoom in to read the relationship labels')).toHaveCount(0)

    // Zoomed out past the point of legibility they are not, so the lines and
    // their colours are all that is left — which is the readable answer. The
    // hint says so, rather than leaving a reader to think there are no labels.
    await wheel(120, 40)
    await expect(page.locator('[data-edge-label]')).toHaveCount(0)
    await expect(page.locator('.react-flow__edge').first()).toBeVisible()
    await expect(page.getByText('Zoom in to read the relationship labels')).toBeVisible()
  })
})
