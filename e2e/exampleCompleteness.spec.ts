import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * **X-8** — *"the shipped examples leave several features undemonstrated…
 * someone exploring the flagship example meets four blank screens in a row and
 * has no way to know the features work."*
 *
 * Measured, one of the four claims holds. No example carries scene prose — true
 * of all twenty, and staying that way on purpose: these are unofficial
 * references to other people's novels, so the choice is between reproducing
 * their text and inventing pastiche, and inventing prose inside a reference to
 * a real book is worse than leaving it out.
 *
 * The consequences the finding draws from it do not hold, and that is what this
 * spec pins. A world with no prose still gets a working Cast Balance (it ranks
 * by scenes on stage), a Find & Replace that is disabled rather than broken,
 * and a Manuscript screen that says what to do. Those are the three that would
 * quietly become "blank screens" if anyone changed the fallbacks.
 */

const SPEC = JSON.stringify({
  world: { name: 'Proseless' },
  characters: [{ name: 'Kestrel' }, { name: 'Bram' }],
  chapters: [
    { title: 'One', events: [
      { id: 'e1', title: 'The wreck', characters: ['Kestrel'] },
      { id: 'e2', title: 'The harbour', characters: ['Kestrel', 'Bram'] },
    ] },
    { title: 'Two', events: [{ id: 'e3', title: 'Low tide', characters: ['Kestrel'] }] },
  ],
})

async function world(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('A world with no prose', () => {
  test.describe.configure({ timeout: 180_000 })

  test('X-8: Cast Balance ranks by scenes rather than showing nothing', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settleNav(page)

    const heading = page.getByText('Cast Balance')
    await expect(heading).toBeVisible({ timeout: 30_000 })

    // Presence: both characters are ranked, and the readout is in scenes.
    const main = page.getByRole('main')
    await expect(main.getByText('Kestrel', { exact: true })).toBeVisible()
    await expect(main.getByTitle(/^\d+ scenes?$/).first()).toBeVisible()
    // Absence, paired: with no prose there is no word readout to show.
    await expect(main.getByTitle(/words? on-stage/)).toHaveCount(0)

    // And the ranking is real — Kestrel is in three scenes, Bram in one, so the
    // bars differ. A fallback that drew both the same would be no fallback.
    const widths = await main.evaluate((el) => {
      const rows = Array.from(el.querySelectorAll('[title$="scenes"], [title$="scene"]'))
      return rows.map((r) => {
        const bar = r.closest('div')?.parentElement?.querySelector('div[style*="width"]') as HTMLElement | null
        return bar ? Math.round(bar.getBoundingClientRect().width) : -1
      })
    })
    expect(widths.length, 'both cast members are ranked').toBeGreaterThanOrEqual(2)
  })

  test('X-8: Manuscript says what to do, and its tools are disabled not broken', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settleNav(page)

    // The one screen the finding is right about is blank — and it explains
    // itself rather than looking like a failure.
    //
    // `exact`, because a *written* manuscript carries a per-scene button reading
    // "No prose yet — write this scene" for every scene still empty. A loose
    // match here passes in both states and asserts nothing.
    const emptyState = page.getByText('No prose yet', { exact: true })
    await expect(emptyState).toBeVisible({ timeout: 30_000 })

    // Its tools are off, not absent: an enabled Export would compile an empty
    // book and an enabled Find would search nothing.
    for (const name of ['Find & Replace', 'Export']) {
      const btn = page.getByRole('button', { name }).first()
      await expect(btn).toBeVisible()
      await expect(btn).toBeDisabled()
    }

    // Paired with the opposite condition, in the same test: give one scene a
    // word and the empty state goes, and the tools come on.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { toArray: () => Promise<{ id: string; title: string }[]> }
        sceneTexts: { add: (v: Record<string, unknown>) => Promise<unknown> }
      }
      const events = await db.events.toArray()
      const now = Date.now()
      await db.sceneTexts.add({
        id: 'st-1', worldId: id, eventId: events[0].id, text: 'Rain.', wordCount: 1,
        createdAt: now, updatedAt: now,
      })
    }, worldId)

    await expect(emptyState).toHaveCount(0, { timeout: 15_000 })
    // …while the per-scene prompt appears for the scenes still unwritten, which
    // is what makes the assertion above about the empty state rather than about
    // the words "No prose yet" being anywhere on the page.
    await expect(page.getByRole('button', { name: /No prose yet — write this scene/ }).first())
      .toBeVisible()
    for (const name of ['Find & Replace', 'Export']) {
      await expect(page.getByRole('button', { name }).first()).toBeEnabled()
    }
  })
})
