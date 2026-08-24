import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * CD-1 and EV-2 are the same fault from opposite ends.
 *
 * On a full world the Character States panel led with everyone who was *not*
 * there: on a scene with five named characters, its dominant content was
 * "36 characters not in any event:" and a roll-call of the absent, each marked
 * *no snapshot*. On an empty one it was a blank column with no explanation at
 * all. Neither version keyed off the scene's actual cast, which is the only
 * thing the panel is for.
 */

/** A world where one scene has a cast and the rest of the world does not. */
const PEOPLED = JSON.stringify({
  world: { name: 'Eriador' },
  characters: [
    { name: 'Frodo' }, { name: 'Strider' },
    // Everyone else exists but is nowhere near this chapter.
    { name: 'Absent Aldous' }, { name: 'Absent Beatrix' }, { name: 'Absent Cormac' },
    { name: 'Absent Dellamy' }, { name: 'Absent Elowen' },
  ],
  chapters: [
    {
      title: 'Flight to the Ford',
      events: [
        // The spec importer anchors a snapshot at a character's first
        // appearance, so the gap this test is about — a cast member a scene
        // records nothing new about — only exists from the second scene on.
        {
          id: 'e1', title: 'Leaving Weathertop',
          characters: ['Frodo', 'Strider'],
          changes: [{ who: 'Frodo', note: 'Wounded under the collarbone.' }],
        },
        {
          id: 'e2', title: 'The chase',
          characters: ['Frodo', 'Strider'],
          changes: [{ who: 'Frodo', note: 'Wounded and slipping out of the world.' }],
        },
      ],
    },
  ],
})

/** A world whose scene names nobody at all — the empty-column case. */
const EMPTY = JSON.stringify({
  world: { name: 'Nowhere' },
  characters: [{ name: 'Unattached Ulric' }],
  chapters: [{ title: 'A quiet chapter', events: [{ id: 'e1', title: 'Nothing happens yet' }] }],
})

async function openTheChapter(page: Page, spec: string) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(spec)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await page.getByRole('link', { name: /timeline/i }).click()
  await page.getByTitle('Open chapter detail').first().click()
  await expect(page.getByText('Character States')).toBeVisible({ timeout: 30_000 })
}

test.describe('Chapter detail — the Character States panel is about the scene', () => {
  test.describe.configure({ timeout: 120_000 })

  test('CD-1: it leads with the cast and folds the rest of the world away', async ({ page }) => {
    await openTheChapter(page, PEOPLED)
    const panel = page.getByText('Character States').locator('xpath=../..')

    // Presence: both people in the second scene are in the panel — the one
    // whose state it records, and the one it does not, who used to be missing
    // from the panel entirely.
    const chase = panel.getByRole('button', { name: /^The chase/ }).locator('xpath=..')
    await expect(chase.getByText('Frodo', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(chase.getByText('Wounded and slipping out of the world.')).toBeVisible()
    await expect(chase.getByText('Strider', { exact: true })).toBeVisible()
    await expect(chase.getByText('no state recorded')).toBeVisible()


    // Absence: the five who are nowhere near this chapter are not the panel's
    // content. The count is offered; the roll-call is not.
    await expect(panel.getByText('5 other characters not in this chapter')).toBeVisible()
    for (const name of ['Absent Aldous', 'Absent Beatrix', 'Absent Cormac']) {
      await expect(panel.getByText(name)).toHaveCount(0)
    }

    // And they are one click away, not hidden — the same test proves both.
    await panel.getByRole('button', { name: /other characters not in this chapter/ }).click()
    for (const name of ['Absent Aldous', 'Absent Beatrix', 'Absent Cormac']) {
      await expect(panel.getByText(name)).toBeVisible()
    }
  })

  test('EV-2: a chapter with nobody in it says so', async ({ page }) => {
    await openTheChapter(page, EMPTY)
    const panel = page.getByText('Character States').locator('xpath=../..')

    // Presence: the column explains itself instead of being blank.
    await expect(panel.getByText('No one in this chapter yet')).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByText(/Add characters to a scene's cast/)).toBeVisible()

    // Absence: and it does not answer with a roll-call of the absent either —
    // the world's one other character is folded away, same as above.
    await expect(panel.getByText('Unattached Ulric')).toHaveCount(0)
    await expect(panel.getByText('1 other character not in this chapter')).toBeVisible()
  })
})
