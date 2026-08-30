import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * REL-2: the minimap was a smear of dim blue on near-black with no visible
 * viewport rectangle — in the one situation where a minimap should be earning
 * its place.
 *
 * Two measurable causes. Every node drew as `hsl(222,47%,20%)` on an
 * `hsl(222,47%,11%)` background, the same hue nine points apart, so the nodes
 * were the background; and the viewport was marked only by a 40% mask with no
 * stroke, so there was no rectangle at all.
 *
 * Read out of the rendered SVG rather than looked at, because "unreadable" as a
 * word does not fail a test and a colour distance does.
 */
test.describe('The relationship minimap', () => {
  test.describe.configure({ timeout: 180_000 })

  test('draws its nodes as the graph does, and outlines the viewport', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Minimap')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    const seeded = await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        characters: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
        relationships: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
      }
      const now = Date.now()
      const ids = Array.from({ length: 8 }, (_, i) => `ch${i + 1}`)
      await db.characters.bulkAdd(ids.map((id, i) => ({
        id, worldId, name: `Person ${i + 1}`, role: '', description: '', appearance: '',
        personality: '', backstory: '', notes: '', tags: [], aliases: [],
        portraitImageId: null, colorTag: null, status: 'alive',
        createdAt: now, updatedAt: now,
      })))
      await db.relationships.bulkAdd(ids.slice(1).map((id, i) => ({
        id: `rel-${i}`, worldId, characterAId: 'ch1', characterBId: id,
        label: `knows ${i}`, strength: 'moderate', sentiment: 'neutral',
        description: '', isBidirectional: true, startEventId: null,
        createdAt: now, updatedAt: now,
      })))
      return ids.length
    }, worldId)
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(8)

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await expect(page.locator('.react-flow__node')).toHaveCount(8, { timeout: 30_000 })
    await page.waitForTimeout(1500)

    const minimap = await page.evaluate(() => {
      const svg = document.querySelector('.react-flow__minimap')
      if (!svg) return null
      const mask = svg.querySelector('.react-flow__minimap-mask')
      const nodes = Array.from(svg.querySelectorAll('.react-flow__minimap-node'))
      const fillOf = (el: Element) =>
        (el.getAttribute('fill') || getComputedStyle(el).fill || '').trim()
      return {
        background: getComputedStyle(svg).backgroundColor,
        maskStroke: mask ? (mask.getAttribute('stroke') || getComputedStyle(mask).stroke) : null,
        maskStrokeWidth: mask ? Number(mask.getAttribute('stroke-width') || 0) : 0,
        nodeFills: nodes.map(fillOf),
      }
    })

    expect(minimap, 'the minimap should be rendered above md').not.toBeNull()
    expect(minimap!.nodeFills.length, 'every character should appear on it').toBe(8)

    // The viewport is an actual rectangle now, not an unmarked hole in a mask.
    expect(minimap!.maskStrokeWidth, 'the viewport rectangle needs an edge').toBeGreaterThan(0)
    expect(minimap!.maskStroke, 'and that edge needs a colour').toBeTruthy()
    expect(minimap!.maskStroke).not.toBe('none')

    // The nodes are the cast's own colours, so the map reads as a picture of
    // the graph rather than as one flat block. A single shared fill is what the
    // finding described.
    const distinct = new Set(minimap!.nodeFills.filter(Boolean))
    expect(
      distinct.size,
      `node fills: ${JSON.stringify(minimap!.nodeFills)}`,
    ).toBeGreaterThan(1)
  })
})
