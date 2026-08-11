import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Drives the focus-mode overlay end to end (open, live session count, autosave,
// Esc to exit). The session-count maths is unit-tested in
// src/lib/__tests__/focusSession.test.ts.

test.describe('Focus mode', () => {
  test('opens full-screen, tracks the session, saves and exits', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Focus World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Timeline → chapter → event.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('The gate')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Expand the card and seed some prose, then enter focus mode.
    const main = page.getByRole('main')
    await main.getByText('The gate', { exact: true }).click()
    const editor = main.getByPlaceholder(/Write or paste this scene/)
    await editor.fill('Two words')
    await editor.blur()
    await main.getByRole('button', { name: 'Focus' }).click()

    // The full-screen writer is up, seeded with the scene's prose.
    const focusArea = page.getByPlaceholder('Write…')
    await expect(focusArea).toBeVisible()
    await expect(focusArea).toHaveValue('Two words')

    /*
      WR-3 said the watermark bleeds through onto the one screen whose whole
      purpose is to remove everything but the prose. The watermark itself went
      with X-1, so there is nothing left to bleed — but the *mechanism* is worth
      a guard, because the app's own body is deliberately translucent over the
      theme backdrop (measured: rgba(15,23,41,0.43)) and the difference between
      focus mode and everything else is that its surface is not.
    */
    const layers = await page.evaluate(() => {
      const surface = document.querySelector('[placeholder="Write…"]')!
        .closest('div[class*="fixed"]') as HTMLElement
      const alpha = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/)
        return m ? Number(m[1].split(',')[3] ?? 1) : 1
      }
      return {
        focusAlpha: alpha(getComputedStyle(surface).backgroundColor),
        focusImage: getComputedStyle(surface).backgroundImage,
        bodyAlpha: alpha(getComputedStyle(document.body).backgroundColor),
      }
    })
    expect(layers.focusAlpha, 'the writing surface has to be opaque').toBe(1)
    expect(layers.focusImage, 'and carry no image of its own').toBe('none')
    // Paired: the rest of the app really is see-through, so the assertion above
    // is about focus mode rather than about every surface in the product.
    expect(layers.bodyAlpha, 'the app body is translucent by design').toBeLessThan(1)

    // Add three words → the session count reflects +3.
    await focusArea.click()
    await page.keyboard.press('End')
    await focusArea.pressSequentially(' and three more')
    await expect(page.getByText('(+3 this session)')).toBeVisible()

    // Esc exits and the prose is saved back to the scene.
    await page.keyboard.press('Escape')
    await expect(focusArea).toHaveCount(0)
    await expect(editor).toHaveValue('Two words and three more')
  })
})
