import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The world selector and the dashboard header.
 *
 * **SEL-3a** — filed as "an imported world gets no cover image". Measured, that
 * is not so: every shipped `.pwk` carries a `coverImageId`, and a library world
 * downloaded *without* its image bundle still draws one, because those covers
 * are stored as links. What produces the placeholder the finding saw is an id
 * whose bytes live in the bundle nobody downloaded — so the placeholder says
 * which of the two it is.
 *
 * **DASH-4** — seven tiles in rows of four, with a hole where the eye expects a
 * fourth. Not fixable by counting: reading mode drops one and makes it six.
 *
 * **DASH-5** — the world drawn as a person when its cover will not load.
 */

const COVER_HOSTS = /upload\.wikimedia\.org|commons\.wikimedia\.org|static\.posters\.cz/

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
  <rect width="400" height="600" fill="#6d5f8f"/>
</svg>`

const SPEC = JSON.stringify({
  world: { name: 'Tiled' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] }],
})

async function specWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('The shelf and the dashboard', () => {
  test.describe.configure({ timeout: 180_000 })

  test('SEL-3a: a book downloaded without images still shows its cover', async ({ page }) => {
    // The covers are real remote URLs, so the bytes are stubbed exactly as
    // libraryCovers.spec.ts does — this is about our own plumbing, not somebody
    // else's uptime.
    await page.route(COVER_HOSTS, (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER }))

    await resetDB(page)
    await page.getByRole('button', { name: 'Library', exact: true }).click()
    const dracula = page.locator('li', { hasText: 'Dracula' }).first()
    await expect(dracula.getByRole('img', { name: /Dracula cover/ })).toBeVisible({ timeout: 30_000 })

    // Deliberately the data-only download — the cheap one, and the one the
    // finding's globe would have come from if the cover needed the bundle.
    await dracula.getByRole('button', { name: /^Download \(/ }).click()
    await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.waitForTimeout(1500)

    // The world carries a cover, and its blob is a *link* — which is why the
    // 15MB image bundle is not needed for it to draw.
    const cover = await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { get: (i: string) => Promise<{ coverImageId?: string | null } | undefined> }
        blobs: { get: (i: string) => Promise<{ url?: string; data?: unknown } | undefined> }
      }
      const world = await db.worlds.get(id)
      const blob = world?.coverImageId ? await db.blobs.get(world.coverImageId) : undefined
      return { id: world?.coverImageId ?? null, hasUrl: !!blob?.url, hasBytes: !!blob?.data }
    }, worldId)
    expect(cover.id, 'a downloaded world carries a cover id').not.toBeNull()
    expect(cover.hasUrl, 'stored as a link, so no bundle is needed').toBe(true)
    expect(cover.hasBytes).toBe(false)

    // And it draws, on the shelf where the finding saw a globe. The card's
    // cover is `alt=""` — the heading beside it already names the world — so it
    // is found as an element rather than by an accessible name.
    await page.goto('/', { waitUntil: 'load' })
    const card = page.locator('div').filter({ hasText: /^Dracula/ }).first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(card.locator('img').first(), 'the shelf card draws the cover').toBeVisible()
  })

  test('SEL-3a: a cover whose bytes never arrived says so', async ({ page }) => {
    const worldId = await specWorld(page)

    // The case that actually produces a placeholder: an id with nothing behind
    // it, which is what a binary cover looks like when the .pwb bundle was not
    // downloaded. Nothing in the app said which of "no picture" and "picture
    // missing" you were looking at.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { update: (i: string, c: Record<string, unknown>) => Promise<unknown> }
      }
      await db.worlds.update(id, { coverImageId: 'never-downloaded' })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Tiled', level: 1 })).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(800)
    await expect(page.locator('[title^="Image not available"]').first()).toBeVisible()

    // Paired: with no cover id at all the slot is not rendered, so nothing
    // claims a missing picture where there was never one to miss.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { update: (i: string, c: Record<string, unknown>) => Promise<unknown> }
      }
      await db.worlds.update(id, { coverImageId: null })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Tiled', level: 1 })).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(800)
    await expect(page.locator('[title^="Image not available"]')).toHaveCount(0)
  })

  test('DASH-4: the last row of tiles fills instead of leaving a hole', async ({ page }) => {
    const worldId = await specWorld(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await expect(page.locator('[data-dash-tiles]')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(800)

    const rows = await page.locator('[data-dash-tiles]').evaluate((el) => {
      const kids = Array.from(el.children) as HTMLElement[]
      const byTop = new Map<number, number[]>()
      for (const k of kids) {
        const r = k.getBoundingClientRect()
        const top = Math.round(r.top)
        byTop.set(top, [...(byTop.get(top) ?? []), Math.round(r.width)])
      }
      const container = Math.round(el.getBoundingClientRect().width)
      return {
        container,
        tiles: kids.length,
        rows: [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, widths]) => widths),
      }
    })

    expect(rows.tiles, 'a writing world shows seven tiles').toBe(7)
    expect(rows.rows.length, 'which is more than one row at this width').toBeGreaterThan(1)

    // Every row spans the container, gaps included — a short row is wide rather
    // than leaving a hole. 12px of gap between each pair.
    for (const widths of rows.rows) {
      const spanned = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 12
      expect(
        Math.abs(spanned - rows.container),
        `row of ${widths.length} spanned ${spanned}px of ${rows.container}px`,
      ).toBeLessThanOrEqual(2)
    }

    // Paired: the tiles did not simply become one enormous row — the wrapping
    // points are unchanged, so a row still holds four at this width.
    expect(rows.rows[0].length).toBe(4)
  })

  test('DASH-5: a world whose cover will not load is not drawn as a person', async ({ page }) => {
    const worldId = await specWorld(page)

    // A linked cover pointing at nothing: the case the placeholder is for.
    // A world with no cover at all renders no slot, so this is the only way
    // the fallback is reachable.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        blobs: { add: (v: Record<string, unknown>) => Promise<unknown> }
        worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<unknown> }
      }
      await db.blobs.add({
        id: 'dead-cover', worldId: id, mimeType: 'image/png',
        url: 'https://example.invalid/gone.png', createdAt: Date.now(),
      })
      await db.worlds.update(id, { coverImageId: 'dead-cover' })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Tiled', level: 1 })).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)

    const glyph = await page.evaluate(() => {
      const heading = document.querySelector('main h1')
      const header = heading?.closest('div')?.parentElement
      const svg = header?.querySelector('svg')
      return svg?.classList.contains('lucide-globe') ? 'globe'
        : svg?.classList.contains('lucide-user') ? 'user'
        : (svg?.getAttribute('class') ?? 'none')
    })
    // The world card next door falls back to a globe; the same world in two
    // places should fall back to the same thing.
    expect(glyph, 'the world should not be drawn as a stranger').not.toBe('user')
    expect(glyph).toBe('globe')
  })
})
