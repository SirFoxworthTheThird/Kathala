import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * TL-2, TL-3, EV-5, CH-4 and the correction to LORE-1 — where a destructive
 * action lives, and what the row around it says.
 *
 * Delete used to be drawn exactly like the things it sat beside: a trash icon
 * on every chapter row next to open-detail, another in every scene card beside
 * the reorder arrows, another alone in the character header. The review
 * proposed copying the Lore roster's hover-reveal; measured, that pattern is
 * worse than what it would replace, and the last test here is the measurement
 * that says so.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{
    title: 'Landfall',
    events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }],
  }],
  lore: [{ title: 'The Salt Accord', body: 'A treaty nobody honours.' }],
})

async function worldFromSpec(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
}

test.describe('A destructive action does not sit in the routine row', () => {
  test.describe.configure({ timeout: 120_000 })

  test('TL-3: the chapter row has no delete on it, and the menu beside it does', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await expect(page.getByRole('button', { name: 'Open chapter detail' })).toBeVisible({ timeout: 30_000 })

    // Absence: nothing on the row itself deletes anything.
    await expect(page.getByRole('main').getByRole('button', { name: /^Delete chapter/ })).toHaveCount(0)

    // Presence, in the same test — the act is still reachable, one step in.
    const menu = page.getByRole('button', { name: 'More actions for chapter 1' })
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menuitem', { name: 'Delete chapter' })).toBeVisible()

    // And it does what it says: the confirm names the chapter.
    await page.getByRole('menuitem', { name: 'Delete chapter' }).click()
    await expect(page.getByText('Delete chapter "Landfall"?')).toBeVisible()
  })

  test('TL-2: the row says where pressing it takes you, and what it says changes with the cursor', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()

    // "Set Active" named a state rather than the act; "moment" is the app's own
    // word for where the cursor sits.
    const setCursor = page.getByRole('button', { name: 'View from here' })
    await expect(setCursor).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('main').getByRole('button', { name: 'Set Active' })).toHaveCount(0)

    // The opposite condition: with the cursor in this chapter the label flips,
    // so neither half of this can be satisfied by a button that never changes.
    await setCursor.click()
    await expect(page.getByRole('button', { name: 'Viewing' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'View from here' })).toHaveCount(0)
  })

  test('EV-5: the scene card keeps its routine controls and loses its delete', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await page.getByRole('button', { name: 'Open chapter detail' }).first().click()
    await expect(page.getByRole('button', { name: /^Expand/ }).first()).toBeVisible({ timeout: 30_000 })

    // Presence: the routine controls are exactly where they were.
    await expect(page.getByRole('button', { name: 'Move “The wreck” later' })).toBeVisible()
    // Absence: delete is no longer one of them.
    await expect(page.getByRole('button', { name: 'Delete “The wreck”' })).toHaveCount(0)

    await page.getByRole('button', { name: 'More actions for “The wreck”' }).click()
    await expect(page.getByRole('menuitem', { name: 'Delete scene' })).toBeVisible()
  })

  test('the menu works from the keyboard, and Escape gives focus back', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    const menu = page.getByRole('button', { name: 'More actions for chapter 1' })
    await expect(menu).toBeVisible({ timeout: 30_000 })

    // A menu that only opens on click is unreachable for a keyboard user, which
    // is the defect the hover pattern below has in its touch form.
    await menu.focus()
    await page.keyboard.press('ArrowDown')

    /*
      Focus lands on the **first** item, whichever it is — asserted by position
      rather than by name. This read `getByRole('menuitem', { name: 'Delete
      chapter' })` while Delete was the menu's only item, so adding *Rename
      chapter* above it (W23-2) broke a test that was never about Delete: its
      subject is that the menu is reachable from the keyboard and gives focus
      back. Naming the item made it a test of the menu's contents as well.

      What this file *is* about is still asserted, and more directly than
      before: the destructive item is in the menu, and it is not the one the
      first keystroke lands on.
    */
    const items = page.getByRole('menuitem')
    await expect(items.first()).toBeFocused()
    await expect(page.getByRole('menuitem', { name: 'Delete chapter' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete chapter' })).not.toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menuitem', { name: 'Delete chapter' })).toHaveCount(0)
    await expect(menu).toBeFocused()
  })

  test('LORE-1 corrected: no control is invisible while still taking the click', async ({ page }) => {
    await worldFromSpec(page)
    await page.getByRole('link', { name: /lore/i }).first().click()
    await expect(page.getByText('The Salt Accord')).toBeVisible({ timeout: 30_000 })

    // The measurement that corrected the finding. The lore card's delete was
    // `opacity: 0` at rest with pointer events still live and hit-testing to
    // itself — on a phone, where the resting state is the only state, a tap on
    // apparently blank card deleted the page. It also had no name at all.
    const ghosts = await page.getByRole('main').getByRole('button').evaluateAll((els) =>
      els
        .filter((el) => {
          const s = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          if (r.width === 0 || Number(s.opacity) > 0.05) return false
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    )
    expect(ghosts, `invisible but clickable:\n${ghosts.join('\n')}`).toEqual([])

    // Presence: the act is still on the card, named, and visible at rest.
    const menu = page.getByRole('button', { name: 'More actions for The Salt Accord' })
    await expect(menu).toBeVisible()
    await menu.click()
    await expect(page.getByRole('menuitem', { name: 'Delete page' })).toBeVisible()
  })
})
