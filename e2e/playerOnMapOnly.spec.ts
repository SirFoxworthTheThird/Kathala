import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The story player lives on the map, because the map is what it plays.
 *
 * Playback walks the time cursor from scene to scene so the cast moves across
 * the picture. The bottom bar renders on every world screen, so its transport
 * controls did too — a play button and a speed cycler on the Timeline, on a
 * character page, on the Read screen, driving something not on screen. Pressing
 * it navigated you to the map to find out what it had done.
 *
 * A blind reader run filed it as a reading fault, which it also was: the one
 * thing play offered someone reading was a way out of the book, on a timer.
 * But it is the wrong control in the wrong place for whoever is looking at it,
 * so the rule is about the route and not about the gate.
 */

const play = (page: Page) => page.getByRole('button', { name: /^Play .*on the map$/ })
const speed = (page: Page) => page.getByRole('button', { name: /^Playback speed/ })

async function stopReadingMode(page: Page, worldId: string) {
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
}

async function go(page: Page, worldId: string, screen: string) {
  await page.goto(`/#/worlds/${worldId}/${screen}`, { waitUntil: 'load' })
  await settle(page)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

for (const mode of ['reading', 'writing'] as const) {
  test(`the player is on the map and nowhere else, ${mode}`, async ({ page }) => {
    const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
    await settle(page)
    if (mode === 'writing') await stopReadingMode(page, worldId)

    /*
      The presence first. If the bar failed to render at all, every absence
      below would pass for the wrong reason — and the bar is hidden outright on
      the dashboard and settings, so "not found" is cheap here.
    */
    await go(page, worldId, 'maps')
    await expect(play(page), 'the map has the player').toBeVisible()
    await expect(speed(page), 'and the speed control').toBeVisible()

    for (const screen of ['timeline', 'manuscript', 'characters']) {
      await go(page, worldId, screen)
      await expect(page.locator('[data-chapter-bar]'), `the bar is on ${screen}`).toBeVisible()
      await expect(play(page), `no player on ${screen}`).toHaveCount(0)
      await expect(speed(page), `no speed control on ${screen}`).toHaveCount(0)
    }
  })
}

test('stopping playback does not throw away a reader\'s place', async ({ page }) => {
  /*
    Stop was `setActiveEventId(null)` unconditionally — for a reader, the
    full-reveal state from a nine-pixel square with no confirmation. It is the
    writer's reset to "all chapters" and stays that way for them; a reader keeps
    the place playback carried them to, which is the truthful answer since they
    watched those scenes go by.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await go(page, worldId, 'maps')

  const cursor = () => page.evaluate(() => {
    const raw = localStorage.getItem('plotweave-ui')
    return raw ? (JSON.parse(raw).state?.activeEventId ?? null) : null
  })

  await play(page).click()
  const stop = page.getByRole('button', { name: 'Stop' })
  await expect(stop, 'Stop appears once playing').toBeVisible()
  await stop.click()

  expect(await cursor(), 'the reader still has a place in the book').not.toBeNull()

  // The other half: a writer pressing the same button still gets the reset.
  await stopReadingMode(page, worldId)
  await go(page, worldId, 'maps')
  await play(page).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect.poll(cursor, { timeout: 10_000 }).toBeNull()
})
