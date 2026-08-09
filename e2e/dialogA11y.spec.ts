import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * What the shared Dialog owes a keyboard or screen-reader user.
 *
 * The component rendered a bare <div>: no role, no aria-modal, no label, no
 * focus trap, no focus restore. Measured at 390px before the fix, 7 of 10 Tabs
 * left an open Add Character dialog and put the ring on nav links behind a
 * full-screen overlay. Every dialog in the app comes from this one component.
 */
test.describe('Dialog accessibility', () => {
  test.describe.configure({ timeout: 120_000 })

  async function worldWithCharacters(page: Page) {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('A11y')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]
    await page.goto(`/#/worlds/${id}/characters`)
    return id
  }

  test('is announced as a labelled modal dialog', async ({ page }) => {
    await worldWithCharacters(page)

    // Nothing claims to be a dialog until one opens — so the assertion below
    // cannot be satisfied by some unrelated element that is always present.
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Add Character' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveCount(1)
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // The accessible name comes from the DialogTitle, resolved through
    // aria-labelledby rather than hardcoded.
    const labelledBy = await dialog.getAttribute('aria-labelledby')
    expect(labelledBy, 'the panel should point at its title').toBeTruthy()
    // Attribute selector, not `#id`: React's useId emits colons.
    await expect(page.locator(`[id="${labelledBy}"]`)).toHaveText(/add character/i)
  })

  test('keeps Tab inside the dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await worldWithCharacters(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await expect(page.getByRole('dialog')).toHaveCount(1)

    const outside: string[] = []
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const where = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"]')
        const a = document.activeElement as HTMLElement | null
        if (panel && a && panel.contains(a)) return null
        return (a?.getAttribute('aria-label') || a?.textContent || a?.tagName || '?').trim().slice(0, 30)
      })
      if (where !== null) outside.push(where)
    }
    expect(outside, `focus left the dialog and landed on: ${outside.join(', ')}`).toEqual([])
  })

  test('returns focus to whatever opened it', async ({ page }) => {
    await worldWithCharacters(page)
    const opener = page.getByRole('button', { name: 'Add Character' }).first()
    await opener.focus()
    await opener.click()
    await expect(page.getByRole('dialog')).toHaveCount(1)

    // Focus moved into the dialog...
    expect(await page.evaluate(() =>
      !!document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // ...and came back out to the control that opened it. Checked as the tag
    // *and* its own text: when focus is dropped it falls back to <body>, whose
    // textContent contains the whole page — including "Add Character" — so
    // matching on text alone passes whether or not focus was restored at all.
    const active = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      return { tag: a?.tagName ?? 'NONE', text: (a?.textContent ?? '').trim() }
    })
    expect(active.tag, 'focus fell back to the document instead of the opener').toBe('BUTTON')
    expect(active.text).toMatch(/add character/i)
  })

  test('Escape closes only the innermost of two stacked dialogs', async ({ page }) => {
    const id = await worldWithCharacters(page)

    // A scene with two saved versions, so Scene history has a Restore to confirm.
    await page.goto(`/#/worlds/${id}/timeline`)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene')
    await page.getByRole('button', { name: 'Add Event' }).last().click()
    await main.getByText('Scene', { exact: true }).click()
    const editor = main.getByPlaceholder(/Write or paste this scene/)
    await editor.fill('First version of the prose.')
    await editor.blur()
    await page.waitForTimeout(1200)
    await editor.fill('Second version of the prose, revised.')
    await editor.blur()
    await page.waitForTimeout(1500)

    await main.getByRole('button', { name: /histor/i }).first().click()
    await expect(page.getByText('Scene history')).toBeVisible()
    await page.getByRole('button', { name: 'Restore' }).first().click()
    await expect(page.getByText('Restore this version?')).toBeVisible()
    expect(await page.getByRole('dialog').count(), 'two dialogs should be stacked').toBe(2)

    // One Escape backs out of the confirm only — the history stays open.
    await page.keyboard.press('Escape')
    await expect(page.getByText('Restore this version?')).toHaveCount(0)
    await expect(page.getByText('Scene history')).toBeVisible()

    // A second Escape then closes the history, so Escape still works at all.
    await page.keyboard.press('Escape')
    await expect(page.getByText('Scene history')).toHaveCount(0)
  })
})
