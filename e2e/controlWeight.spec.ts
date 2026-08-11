import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * Four controls that did not look like what they were.
 *
 * **EV-6** — Focus mode announced by 10px of muted text, in a row of 10px muted
 * text where the other two items are readouts rather than actions.
 *
 * **CH-5** — the portrait's upload and link, two 12px icons two pixels apart on
 * the bottom edge of a 48px avatar.
 *
 * **SET-3** — the world's name and description edited through 12px pencil
 * glyphs that carried no accessible name at all.
 *
 * **ST-3** — the Structure board's pickers, the app's only native selects on a
 * screen otherwise built from its own components.
 */

const SPEC = JSON.stringify({
  world: { name: 'Weighted' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] }],
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

/** The rendered size of a control, as a reader of the screen meets it. */
const boxOf = (page: Page, name: string) =>
  page.getByRole('button', { name }).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })

test.describe('Controls carry the weight of what they do', () => {
  test.describe.configure({ timeout: 180_000 })

  test('EV-6: Focus is a button, not a third readout', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByTitle('Open chapter detail').first().click()
    // The card's own expander: the chapter-states panel on the right carries
    // the scene title too, and so does the time-cursor pill.
    await page.getByRole('button', { name: 'Expand “The wreck”' }).click()
    await expect(page.getByRole('button', { name: 'Focus' })).toBeVisible({ timeout: 20_000 })

    const focus = await boxOf(page, 'Focus')
    // It was a bare 10px text run with an icon — about 12px tall. A real
    // control is taller than the text beside it and has a box of its own.
    expect(focus.h, `Focus rendered ${focus.w}×${focus.h}`).toBeGreaterThanOrEqual(20)
    const bordered = await page.getByRole('button', { name: 'Focus' }).evaluate((el) => {
      const cs = getComputedStyle(el)
      return { border: parseFloat(cs.borderTopWidth), font: parseFloat(cs.fontSize) }
    })
    expect(bordered.border, 'it should have an edge').toBeGreaterThan(0)

    // Paired with the readout beside it, which is deliberately still quiet —
    // so this is "Focus is louder than the numbers", not "everything grew".
    const words = await page.getByRole('main').getByText(/^\d+ words?$/).first().evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize))
    expect(bordered.font, `button ${bordered.font}px vs readout ${words}px`).toBeGreaterThan(words)

    // And it still opens focus mode, so this is not a relabelled no-op.
    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(page.getByPlaceholder('Write…')).toBeVisible({ timeout: 15_000 })
  })

  test('CH-5: the portrait has one named control, not two crowded glyphs', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByText('Kestrel').first().click()
    await expect(page).toHaveURL(/\/characters\/./, { timeout: 20_000 })

    const trigger = page.getByRole('button', { name: 'Portrait for Kestrel' })
    await expect(trigger).toBeVisible()
    const box = await boxOf(page, 'Portrait for Kestrel')
    // The two it replaces were 12×12 each, two pixels apart.
    expect(box.w, `trigger ${box.w}×${box.h}`).toBeGreaterThanOrEqual(24)
    expect(box.h).toBeGreaterThanOrEqual(24)

    // Both actions survive, named, one step inside.
    await trigger.click()
    await expect(page.getByRole('menuitem', { name: 'Upload an image' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Link by URL' })).toBeVisible()

    // And the link item really opens the URL field — the menu is the way in,
    // not a decoration over a control that no longer works.
    await page.getByRole('menuitem', { name: 'Link by URL' }).click()
    await expect(page.getByPlaceholder('https://…/image.png')).toBeVisible()
  })

  test('SET-3: name and description are edited by clicking what they say', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settleNav(page)

    // The read view is the control (EV-3's pattern), and it has a name — the
    // pencils had none at all, which is the same defect as X-12 and LORE-1.
    const nameControl = page.getByRole('button', { name: /^Edit world name/ })
    await expect(nameControl).toBeVisible({ timeout: 20_000 })
    const nameBox = await nameControl.evaluate((el) => Math.round(el.getBoundingClientRect().width))
    // A 12px glyph could not be this wide; the whole row is the target now.
    expect(nameBox, `name control ${nameBox}px wide`).toBeGreaterThan(200)

    await nameControl.click()
    const field = page.getByRole('textbox').first()
    await expect(field).toHaveValue('Weighted')
    await field.fill('Reweighted')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Edit world name/ })).toContainText('Reweighted')

    // The description half, which the finding called the worse of the two —
    // the pencil floated beside a paragraph with nothing anchoring it.
    const descControl = page.getByRole('button', { name: /world description$/ })
    await expect(descControl).toBeVisible()
    await descControl.click()
    await expect(page.getByPlaceholder('Describe your world…')).toBeVisible()
  })

  test('ST-3: the Structure pickers are the app\'s own Select', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await settleNav(page)
    await expect(page.getByRole('button', { name: 'Structure template' })).toBeVisible({ timeout: 20_000 })

    // Absence: no native select survives on this screen. A native one cannot
    // be opened into a listbox, which is what the presence half checks.
    await expect(page.getByRole('main').locator('select')).toHaveCount(0)

    // Presence: the trigger opens a listbox of options, as the app's Select
    // does everywhere else, and choosing one does the thing.
    await page.getByRole('button', { name: 'Structure template' }).click()
    await expect(page.getByRole('option', { name: 'Save the Cat' })).toBeVisible()
    await page.getByRole('option', { name: 'Save the Cat' }).click()
    await expect(page.getByText('0 / 15 beats placed')).toBeVisible({ timeout: 15_000 })
  })
})
