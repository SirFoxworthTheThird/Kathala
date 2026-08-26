import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * X-4: empty states were three different things at once. Some were excellent —
 * a heading, a sentence saying what the screen is for, and a control routing to
 * whatever has to exist first. Some were an italic grey sentence sitting where
 * a control should be. Some were simply blank.
 *
 * The rule (see `src/components/EmptyState.tsx`): offer the act, or route to
 * the prerequisite, or — when the control that fills the section is already
 * next to it — say nothing.
 *
 * Each test below pairs a rule with its opposite condition, because rule 3 is
 * the dangerous one: "say nothing" is one careless step from the blank panels
 * the finding is partly about.
 */

/** A world with no characters at all — the state where no picker can render. */
const NO_CAST = JSON.stringify({
  world: { name: 'Unpeopled' },
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] }],
})

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }, { name: 'Bram' }],
  chapters: [{
    title: 'Landfall',
    events: [
      { id: 'e1', title: 'The wreck', characters: ['Kestrel'] },
      // A scene with no cast at all — rule 3's actual subject. Asserting the
      // sentence is absent on a scene that *has* a cast proves nothing, which
      // is how the first version of this test passed its own mutation.
      { id: 'e2', title: 'The harbour' },
    ],
  }],
})

async function worldFromSpec(page: Page, spec: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(spec)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
}

test.describe('An empty section offers the act, routes to it, or says nothing', () => {
  test.describe.configure({ timeout: 120_000 })

  test('rule 2: a birth date with no calendar names the screen that makes one, and goes there', async ({ page }) => {
    await worldFromSpec(page, SPEC)
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.getByRole('link', { name: /Kestrel/ }).first().click()
    // Birth date lives in the edit form, not the read view.
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await expect(page.getByText('Birth date', { exact: true })).toBeVisible({ timeout: 30_000 })

    // Presence: the prerequisite is named *and* reachable — not named and left
    // for the reader to find, which is the LP-3 shape of the same mistake.
    const toSettings = page.getByRole('link', { name: 'Open World settings' })
    await expect(toSettings).toBeVisible()
    await expect(page.getByText(/needs an in-world calendar/i)).toBeVisible()
    await toSettings.click()
    await expect(page).toHaveURL(/\/settings$/)
  })

  test('rule 3: the cast section stays quiet beside its picker, and speaks when there is none', async ({ page }) => {
    await worldFromSpec(page, SPEC)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.waitForTimeout(1500)

    // "The harbour" has no cast, and the world has characters to offer — the
    // one state where rule 3 applies. The card is collapsed by default, so an
    // absence asserted before opening it would pass on a card that is simply
    // not showing the section.
    await page.getByRole('button', { name: 'Expand “The harbour”' }).click()
    // An empty section is offered as a chip rather than shown outright (EV-1).
    await page.getByRole('button', { name: '+ Characters', exact: true }).click()

    // Presence: the section is open and its picker is the thing on screen.
    await expect(page.getByRole('button', { name: '+ Add character…' }).first())
      .toBeVisible({ timeout: 15_000 })

    // Absence: nothing announces the emptiness a second time beside it.
    await expect(page.getByText('No characters assigned.')).toHaveCount(0)
    await expect(page.getByText('No items assigned.')).toHaveCount(0)
  })

  test('rule 3: with no picker possible, the section says why instead of going blank', async ({ page }) => {
    // The opposite condition, and the one that makes rule 3 safe: a world with
    // no characters at all cannot render a cast picker, so "say nothing" would
    // leave exactly the blank panel X-4 is partly about.
    await worldFromSpec(page, NO_CAST)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: /^Expand/ }).first().click()
    // The chip reads "+ Characters" — the section is offered, not present.
    await page.getByRole('button', { name: '+ Characters', exact: true }).click()
    await expect(page.getByText('No characters in this world yet.').first())
      .toBeVisible({ timeout: 15_000 })
  })

  test('rule 2: a character in no scenes is pointed at the screen that puts them in one', async ({ page }) => {
    await worldFromSpec(page, SPEC)
    await page.getByRole('link', { name: /characters/i }).first().click()

    // Bram is in no scene at all, so the whole tab is the empty state — a
    // heading and an explanation, which is where it used to stop.
    await page.getByRole('link', { name: /Bram/ }).first().click()
    await page.getByRole('tab', { name: /Appearances/i }).click()
    await expect(page.getByText('No appearances yet')).toBeVisible({ timeout: 30_000 })

    // Presence: the control that goes where the act happens. A character joins
    // a scene from the scene, not from here.
    const toTimeline = page.getByRole('button', { name: 'Open Timeline' })
    await expect(toTimeline).toBeVisible()
    await toTimeline.click()
    await expect(page).toHaveURL(/\/timeline$/)

    // The opposite condition: Kestrel *is* in a scene, so she gets the list and
    // none of the empty state at all.
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.getByRole('link', { name: /Kestrel/ }).first().click()
    await page.getByRole('tab', { name: /Appearances/i }).click()
    await expect(page.getByText('The wreck').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('No appearances yet')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open Timeline' })).toHaveCount(0)
  })
})
