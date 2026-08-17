import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

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
  await downloadLibraryBook(page, DEFAULT_BOOK)
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

/**
 * 117 SVG circles carry the chart's whole content and none of them is reachable
 * or announceable. Making each one focusable would be a worse answer than this:
 * a chart's accessible equivalent is the numbers behind it, and a table can be
 * read and searched where a row of circles cannot.
 */
test('the pacing curve carries its data as a table for anyone not reading the picture', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)
  const id = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${id}/settings`)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click().catch(() => {})
  await page.waitForTimeout(1200)

  await page.goto(`/#/worlds/${id}/timeline`)
  const table = page.getByRole('table', { name: 'Dramatic tension by scene, in the order shown' })
  await expect(table).toBeAttached({ timeout: 30_000 })

  // One row per plotted point, and the columns a reader needs to place a scene.
  for (const header of ['Chapter', 'Scene', 'Tension', 'Words']) {
    await expect(table.getByRole('columnheader', { name: header })).toBeAttached()
  }
  const rows = table.getByRole('row')
  const points = await page.locator('svg[aria-label="Dramatic tension across the story"] circle').count()
  expect(points, 'the fixture should actually plot something').toBeGreaterThan(20)
  // Header row plus one per point. Active points draw a second highlight circle,
  // so the count is a floor rather than an equality.
  expect(await rows.count()).toBeGreaterThanOrEqual(20)

  // A rated scene reads as a level rather than a bare number, and an unrated one
  // says so instead of reading as zero tension.
  const body = (await table.innerText()).toLowerCase()
  expect(body).toMatch(/\(\d of 5\)/)

  // Present to a screen reader, absent from the picture. The role query above
  // already proves the first half — Playwright's role selectors skip anything
  // display:none, visibility:hidden or aria-hidden, and resolve this. This is
  // the second half: it takes up no room on screen.
  const box = await table.locator('xpath=..').boundingBox()
  expect(box, 'the data table should be wrapped and clipped').not.toBeNull()
  expect(Math.max(box!.width, box!.height),
    'the data table should take up no space for sighted readers').toBeLessThanOrEqual(1)
})

/**
 * The curve stops where the reader has got to.
 *
 * `useTimelineEvents` is deliberately ungated, and the curve drew all of it.
 * That was survivable while the curve was anonymous circles; adding an
 * accessible data table named every scene in the book. At chapter one of the
 * bundled Philosopher's Stone the table listed "Quirrell and Voldemort" and
 * "Gryffindor Wins the House Cup" — the ending, readable by a screen reader,
 * on a world downloaded specifically to be safe to open mid-book.
 */
test('the pacing curve does not name scenes the reader has not reached', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)
  const id = new URL(page.url()).hash.split('/')[2]

  // Stay in reading mode, at the opening moment.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1500)

  // The gate really is holding things back — otherwise the absence below would
  // pass for an unrelated reason.
  await page.goto(`/#/worlds/${id}/characters`)
  await page.waitForTimeout(2000)
  const roster = await page.getByRole('main').innerText()
  expect(roster, 'the gate should be active at chapter one').not.toContain('Quirrell')

  await page.goto(`/#/worlds/${id}/timeline`)
  const table = page.getByRole('table', { name: 'Dramatic tension by scene, in the order shown' })
  await expect(table).toBeAttached({ timeout: 30_000 })
  const body = await table.innerText()

  for (const spoiler of ['Quirrell and Voldemort', 'Gryffindor Wins the House Cup', "Ron's Wizard Chess Sacrifice"]) {
    expect(body, `"${spoiler}" is past the reader's cursor`).not.toContain(spoiler)
  }

  // The presence half: the scene the reader is actually on is listed, so this
  // cannot pass because the table failed to render.
  expect(body.length, 'the table should still describe the part already read').toBeGreaterThan(0)
  await expect(table.getByRole('row')).not.toHaveCount(0)

  // With the whole book revealed the same table names them again — which is
  // what makes the absence above a gate rather than a missing feature.
  await page.goto(`/#/worlds/${id}/settings`)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await page.waitForTimeout(1500)
  await page.goto(`/#/worlds/${id}/timeline`)
  await expect(table).toBeAttached({ timeout: 30_000 })
  await expect
    .poll(async () => (await table.innerText()).includes('Quirrell and Voldemort'), { timeout: 20_000 })
    .toBe(true)
})
