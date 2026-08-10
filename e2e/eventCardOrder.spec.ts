import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * EV-3 and EV-4 — what an expanded scene card leads with.
 *
 * EV-4 is measured rather than fixed: it says Characters has no visible add
 * control, "just the sentence 'No characters assigned.'". Both halves went with
 * EV-1 and X-4 — the sentence is gone and the section is offered as a named
 * chip. The last test holds that, so it cannot come back.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] }],
})

async function expandedCard(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Open chapter detail' }).first().click()
  await page.getByRole('button', { name: /^Expand/ }).first().click()
  await expect(page.getByPlaceholder(/Write or paste this scene/)).toBeVisible({ timeout: 30_000 })
}

test.describe('An expanded scene card', () => {
  test.describe.configure({ timeout: 120_000 })

  test('EV-3: the prose comes before the summary of it', async ({ page }) => {
    await expandedCard(page)

    const geom = await page.evaluate(() => {
      const prose = document.querySelector<HTMLElement>('main textarea[placeholder^="Write or paste"]')!
      const label = Array.from(document.querySelectorAll('main span'))
        .find((s) => s.textContent?.trim() === 'Description')!
      return {
        proseTop: Math.round(prose.getBoundingClientRect().top),
        descriptionTop: Math.round((label as HTMLElement).getBoundingClientRect().top),
      }
    })
    expect(geom.proseTop, 'the scene draft should lead the card')
      .toBeLessThan(geom.descriptionTop)
  })

  test('EV-3: the empty description is the control that fills it', async ({ page }) => {
    await expandedCard(page)

    // It used to be a grey italic line — a note, not a field. Now it says what
    // it is and opens the editor.
    const empty = page.getByRole('button', { name: 'Add a description' })
    await expect(empty).toBeVisible()
    await expect(page.getByText('No description — click to add one.')).toBeVisible()
    await empty.click()

    // Presence of the opposite condition: the textarea it opens is real, and
    // typing into it sticks.
    const box = page.getByPlaceholder('What happened...')
    await expect(box).toBeVisible({ timeout: 15_000 })
    await box.fill('A wreck on the shingle.')
    await page.getByRole('button', { name: /^Save/ }).first().click()
    await expect(page.getByText('A wreck on the shingle.')).toBeVisible({ timeout: 15_000 })

    // And with a description set, the control is the text itself rather than
    // the prompt — so neither half passes on a card stuck in one state.
    await expect(page.getByRole('button', { name: 'Edit the description' })).toBeVisible()
    await expect(page.getByText('No description — click to add one.')).toHaveCount(0)
  })

  test('EV-4: the cast section is offered by name, with no sentence in its place', async ({ page }) => {
    await expandedCard(page)

    // The sentence the finding names is gone (X-4), and the control it says is
    // missing is a named chip (EV-1).
    await expect(page.getByText('No characters assigned.')).toHaveCount(0)
    const chip = page.getByRole('button', { name: '+ Characters', exact: true })
    await expect(chip).toBeVisible()

    // And it opens the picker, so the chip is the add control rather than a
    // label that looks like one.
    await chip.click()
    await expect(page.getByRole('button', { name: '+ Add character…' }).first())
      .toBeVisible({ timeout: 15_000 })
  })
})
