import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * **OP-2** — filed as "an open palette traps you… and Escape does not respect
 * the stack". Both halves measured against the app as it stands, and neither
 * reproduces: the palette closes on a backdrop click and on navigation (the
 * latter added for **OP-1**), and overlays unwind innermost-first.
 *
 * None of that was guarded, though, which is how it would quietly stop being
 * true — so this is the regression test the finding turned out to need instead
 * of a fix.
 *
 * **KN-4** — the Knowledge roster's ordering control.
 */

const SPEC = JSON.stringify({
  world: { name: 'Stacked' },
  characters: [{ name: 'Kestrel' }, { name: 'Bram' }],
  chapters: [
    { title: 'One', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] },
    { title: 'Two', events: [{ id: 'e2', title: 'The harbour', characters: ['Kestrel', 'Bram'] }] },
  ],
})

async function world(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

const palette = (page: Page) => page.getByPlaceholder(/Search/i)
const brief = (page: Page) => page.getByRole('dialog', { name: "Writer's Brief" })

test.describe('Overlays', () => {
  test.describe.configure({ timeout: 180_000 })

  test('OP-2: the palette is not a trap, and Escape unwinds one layer at a time', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settleNav(page)
    await page.waitForTimeout(800)

    // Not a trap: the backdrop closes it. The finding said Escape was the only
    // way out.
    await page.keyboard.press('Control+k')
    await expect(palette(page)).toBeVisible({ timeout: 15_000 })
    await page.mouse.click(40, 700)
    await expect(palette(page)).toHaveCount(0)

    // Paired: a click *inside* the palette does not close it, so the assertion
    // above is about the backdrop rather than about any click at all.
    await page.keyboard.press('Control+k')
    await expect(palette(page)).toBeVisible()
    await palette(page).click()
    await expect(palette(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette(page)).toHaveCount(0)

    // Two overlays, innermost last. The Brief traps focus and covers the bar,
    // so a Dialog cannot be opened over it — the palette can, because Ctrl+K is
    // a document-level shortcut.
    await page.getByRole('button', { name: "Writer's Brief" }).first().click()
    await expect(brief(page)).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Control+k')
    await expect(palette(page)).toBeVisible()

    // One Escape, one layer: the palette goes and the Brief stays. Closing both
    // is the defect this guards — the same shape as a confirm over a history
    // dialog taking the history with it.
    await page.keyboard.press('Escape')
    await expect(palette(page)).toHaveCount(0)
    await expect(brief(page), 'the layer underneath should survive').toBeVisible()

    // And the second press reaches it.
    await page.keyboard.press('Escape')
    await expect(brief(page)).toHaveCount(0)
  })

  test('KN-4: the fact roster can be ordered by when it gets out', async ({ page }) => {
    const worldId = await world(page)

    // Three facts, added in an order that none of the sorts agrees with.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        knowledgeFacts: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
        knowledgeReveals: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
        characters: { toArray: () => Promise<{ id: string }[]> }
        events: { toArray: () => Promise<{ id: string; title: string }[]> }
      }
      const now = Date.now()
      const chars = await db.characters.toArray()
      // The importer mints its own ids, so the spec's "e1"/"e2" are not the
      // rows' ids — reveals keyed on those resolve to no position at all, and
      // every order silently collapses back to the order facts were added.
      const events = await db.events.toArray()
      const idOf = (title: string) => events.find((e) => e.title === title)!.id
      await db.knowledgeFacts.bulkAdd([
        { id: 'f1', worldId: id, title: 'Zephyr is alive', description: '', tags: [], originEventId: null, createdAt: now, updatedAt: now },
        { id: 'f2', worldId: id, title: 'Marren lied', description: '', tags: [], originEventId: null, createdAt: now, updatedAt: now },
        { id: 'f3', worldId: id, title: 'Nobody knows this', description: '', tags: [], originEventId: null, createdAt: now, updatedAt: now },
      ])
      await db.knowledgeReveals.bulkAdd([
        // f1 gets out late (scene two), f2 early (scene one), f3 never.
        { id: 'r1', worldId: id, factId: 'f1', characterId: chars[0].id, eventId: idOf('The harbour'), note: '', createdAt: now, updatedAt: now },
        { id: 'r2', worldId: id, factId: 'f2', characterId: chars[0].id, eventId: idOf('The wreck'), note: '', createdAt: now, updatedAt: now },
        { id: 'r3', worldId: id, factId: 'f2', characterId: chars[1].id, eventId: idOf('The wreck'), note: '', createdAt: now, updatedAt: now },
      ])
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await settleNav(page)
    const titles = () => page.getByRole('main').locator('[data-fact-card]').allInnerTexts()
    await expect(page.getByRole('main').locator('[data-fact-card]')).toHaveCount(3, { timeout: 30_000 })

    // The order they were added in, which is all the roster ever offered.
    expect((await titles()).map((t) => t.split('\n')[0]))
      .toEqual(['Zephyr is alive', 'Marren lied', 'Nobody knows this'])

    await page.getByRole('button', { name: 'Order facts by' }).click()
    await page.getByRole('option', { name: 'When it gets out' }).click()
    await settle(page)

    // Earliest reveal first; the fact nobody knows goes last rather than first,
    // which is what treating "no reveal" as position zero would have done.
    expect((await titles()).map((t) => t.split('\n')[0]))
      .toEqual(['Marren lied', 'Zephyr is alive', 'Nobody knows this'])

    // Paired with a different question on the same data: two people know that
    // Marren lied and one knows about Zephyr, so widest-known leads.
    await page.getByRole('button', { name: 'Order facts by' }).click()
    await page.getByRole('option', { name: 'How widely known' }).click()
    await settle(page)
    expect((await titles()).map((t) => t.split('\n')[0])[0]).toBe('Marren lied')
    expect((await titles()).map((t) => t.split('\n')[0]).at(-1)).toBe('Nobody knows this')
  })
})
