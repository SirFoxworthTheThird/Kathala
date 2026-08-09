import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The pacing curve has to be readable as data, not just suggestive as a shape.
 *
 * It drew gridlines for levels 1..5 and said what point size meant, but nothing
 * said what *height* meant — the one thing it plots — and 58 events ran in a row
 * with no way to tell which chapter a spike belonged to, which is the question
 * you bring to a pacing chart.
 */
test('the pacing curve names its scale and its chapters', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: /^Download \(/ }).first().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
  await page.waitForTimeout(2000)
  const id = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${id}/settings`)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click().catch(() => {})
  await page.waitForTimeout(1200)

  await page.goto(`/#/worlds/${id}/timeline`)
  const chart = page.getByText('Pacing — dramatic tension').locator('../..')
  await expect(chart).toBeVisible({ timeout: 30_000 })
  const text = await chart.innerText()

  // The scale: both ends named, so a height means something.
  expect(text, 'the low end of the scale should be labelled').toContain('Calm')
  expect(text, 'the high end of the scale should be labelled').toContain('Climactic')

  // Chapter attribution: a spike can be placed in the story.
  expect(text, 'chapter boundaries should be marked').toMatch(/Ch\.1\b/)
  expect(text).toMatch(/Ch\.[2-9]\b/)

  // The axis is drawn outside the scrolling plot, so it stays put while panning.
  const axisBox = await chart.locator('svg').first().boundingBox()
  const plot = chart.locator('div.overflow-x-auto').first()
  await expect(plot).toBeVisible()
  const plotBox = await plot.boundingBox()
  expect(axisBox!.x + axisBox!.width, 'the scale should sit beside the plot, not inside it')
    .toBeLessThanOrEqual(plotBox!.x + 2)
})
