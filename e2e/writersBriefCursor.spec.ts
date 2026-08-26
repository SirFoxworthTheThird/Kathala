import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * WB-1 and WB-2 — the two things wrong with the Writer's Brief before a cursor
 * is set.
 *
 * WB-1: the panel spent its full height on one sentence, *"Select an event from
 * the timeline bar to see the brief"* — copy that named a control without being
 * one, on the tool the app promotes hardest. Picking a scene is something that
 * can be done from here, so the panel now does it (X-4 rule 1) and falls back to
 * routing at the Timeline (rule 2) only when there is no scene to pick.
 *
 * WB-2 was filed as "the panel has no backdrop". It had one — `bg-black/30`,
 * since the file was written — but at half the shared `Dialog`'s dim and with no
 * blur, which is why the timeline behind stayed legible enough to read as sliced
 * off at the panel edge rather than as being behind it.
 */

const WITH_SCENES = JSON.stringify({
  world: { name: 'Aethelgard' },
  chapters: [
    { title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }, { id: 'e2', title: 'The harbour' }] },
    { title: 'Ashfall', events: [{ id: 'e3', title: 'The long road' }] },
  ],
})

async function worldFromSpec(page: Page, spec: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(spec)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
}

/** The background actually painted over the page corner, whatever draws it. */
async function backdropAt(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px as number, py as number)
    if (!el) return null
    const s = getComputedStyle(el)
    return { background: s.backgroundColor, filter: s.backdropFilter }
  }, [x, y])
}

/** Alpha out of a computed colour, whichever space the browser reports it in —
 *  Tailwind 4 hands back `oklab(0 0 0 / 0.6)` where older builds said `rgba`. */
function alphaOf(css?: string | null): number {
  if (!css || css === 'transparent') return 0
  const slash = css.match(/\/\s*([0-9.]+)(%?)\s*\)/)
  if (slash) return slash[2] === '%' ? Number(slash[1]) / 100 : Number(slash[1])
  const parts = css.match(/\(([^)]*)\)/)?.[1].split(',').map((s) => s.trim()) ?? []
  return parts.length === 4 ? Number(parts[3]) : parts.length ? 1 : 0
}

test.describe("The Writer's Brief with no scene selected", () => {
  test.describe.configure({ timeout: 120_000 })

  test('WB-1: with scenes to pick, the panel offers them and filling the cursor fills the brief', async ({ page }) => {
    await worldFromSpec(page, WITH_SCENES)
    await page.getByTitle("Writer's Brief").click()

    const panel = page.getByRole('dialog', { name: "Writer's Brief" })
    await expect(panel).toBeVisible()

    // Presence: every scene in the world, grouped under its chapter, in the
    // bottom bar's own reading order.
    await expect(panel.getByText('Chapter 1 · Landfall')).toBeVisible({ timeout: 30_000 })
    await expect(panel.getByText('Chapter 2 · Ashfall')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'The wreck' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'The long road' })).toBeVisible()

    // The opposite condition for the routing branch: there are scenes, so the
    // panel does not fall back to sending the writer elsewhere.
    await expect(panel.getByText('No scenes yet')).toHaveCount(0)

    // The act itself: picking a scene sets the cursor and the brief fills in.
    await panel.getByRole('button', { name: 'The long road' }).click()
    await expect(panel.getByText('Chapter 2', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByText('Active scene')).toBeVisible()

    // Absence, in the same test: the picker is gone once it has been used.
    await expect(panel.getByRole('button', { name: 'The wreck' })).toHaveCount(0)
  })

  test('WB-1: with no scene in the world, the panel routes at the screen that makes one', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Unwritten')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByTitle("Writer's Brief").click()
    const panel = page.getByRole('dialog', { name: "Writer's Brief" })
    await expect(panel.getByText('No scenes yet')).toBeVisible({ timeout: 30_000 })

    // Named *and* reachable — copy that names a screen without going there is
    // the LP-3 shape of the same mistake, and is what the old sentence did.
    const toTimeline = panel.getByRole('button', { name: 'Open Timeline' })
    await expect(toTimeline).toBeVisible()
    await toTimeline.click()
    await expect(page).toHaveURL(/\/timeline$/)
  })

  test('WB-2: the brief dims the page exactly as the shared dialog does', async ({ page }) => {
    await worldFromSpec(page, WITH_SCENES)

    // Absence first: with the panel closed nothing is laid over the corner at
    // all, so the measurements below are reading the brief's own backdrop and
    // not some pre-existing overlay that would satisfy them either way.
    expect((await backdropAt(page, 5, 5))?.filter).toBe('none')

    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByRole('dialog', { name: "Writer's Brief" })).toBeVisible()
    const brief = await backdropAt(page, 5, 5)
    await page.keyboard.press('Escape')

    // The comparison is the point rather than the number: the finding is that
    // each hand-rolled overlay picked its own dim, so the brief is measured
    // against the shared `Dialog` every create/edit form already uses.
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await expect(page.getByPlaceholder('Character name')).toBeVisible({ timeout: 15_000 })
    const dialog = await backdropAt(page, 5, 5)

    expect(alphaOf(dialog?.background)).toBeGreaterThanOrEqual(0.6)
    expect(alphaOf(brief?.background)).toBe(alphaOf(dialog?.background))
    expect(brief?.filter).toBe(dialog?.filter)
    expect(brief?.filter).toMatch(/blur/)
  })
})
