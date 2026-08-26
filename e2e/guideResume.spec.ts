import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * N14, from a blind writer run: the four-step first-run guide kept its progress
 * in component state, and the condition that summons it is *"this world has no
 * timeline"* — which **step 1 makes false**. Reloading between step 1 and step 2
 * dropped the writer on the dashboard with steps 2 to 4 simply skipped, and no
 * way back in. The guide is the app's own answer to "what do I do first", and a
 * refresh ended it.
 *
 * The storage shape and the show/hide decision are unit-tested in
 * `src/lib/__tests__/guideProgress.test.ts`. These are about the reload.
 */

/*
  The step the guide is *on*, not merely one it lists.

  The indicator renders all four labels at once — "Step 1 of 4: Begin your
  story", "Step 2 of 4: Add a character", and so on — and only the current one
  is suffixed "(current)". Matching without that suffix matches from the moment
  the wizard appears, so the wait before the reload returned instantly at step 1
  and the assertion after it would have passed on a guide that had restarted
  from the beginning. It was vacuous in both directions at once.
*/
const ON_STEP_2 = /Step 2 of 4:.*\(current\)/

async function newWorld(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('First Light')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

/** Step 1: name the strand and its opening scene, and continue. */
async function completeStepOne(page: Page) {
  await expect(page.getByRole('button', { name: 'Create and continue' })).toBeVisible({ timeout: 20_000 })
  await page.getByPlaceholder('The Age of Embers, The Long Road, Act One…').fill('The Drowning Year')
  await page.getByPlaceholder('The wreck, A letter arrives, The gate opens…').fill('The ninth bell does not ring')
  await page.getByRole('button', { name: 'Create and continue' }).click()
  await expect(page.getByLabel(ON_STEP_2)).toBeVisible({ timeout: 20_000 })
}

test.describe('The first-run guide survives a reload', () => {
  test.describe.configure({ timeout: 180_000 })

  test('comes back at the step it was on, not at the dashboard', async ({ page }) => {
    await newWorld(page)
    await completeStepOne(page)

    await page.reload({ waitUntil: 'load' })

    // The finding: this used to be the dashboard, with steps 2 to 4 skipped.
    await expect(page.getByLabel(ON_STEP_2)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('navigation', { name: 'Wizard progress' })).toBeVisible()
  })

  test('and stays gone once skipped, on a world that would otherwise summon it', async ({ page }) => {
    await newWorld(page)
    const skip = page.getByRole('button', { name: /Skip and explore on my own/ })
    await expect(skip).toBeVisible({ timeout: 20_000 })
    await skip.click()

    // The dashboard, not the guide.
    await expect(page.getByRole('navigation', { name: 'Wizard progress' })).toHaveCount(0)

    /*
      The pair to the test above, and the reason it is here: this world still
      has no timeline, which is the condition that summons the guide. Skipping
      was component state too, so a reload used to bring it straight back to
      someone who had just said no.
    */
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('navigation', { name: 'Wizard progress' })).toHaveCount(0)
  })
})
