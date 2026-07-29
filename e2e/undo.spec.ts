import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Undo's browser-dependent surfaces: the delete toast, the keyboard shortcut
// and its suppression inside text fields, the toolbar button's disabled state,
// and the mobile route through the nav drawer. The journal mechanics — what
// gets coalesced, grouped, inverted and restored — are covered by
// src/db/hooks/__tests__/undo.test.ts and src/lib/__tests__/undoLogic.test.ts.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/** The top bar's undo button. Scoped, since the toast and panel have one too. */
const topBarUndo = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true })
const topBarRedo = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Redo', exact: true })

async function setupWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Undo World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
}

async function addCharacter(page: Page, name: string) {
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill(name)
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText(name).first()).toBeVisible()
}

test('deleting offers an undo that brings the character back', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Aldric')

  await page.getByText('Aldric').first().click()
  await page.getByRole('button', { name: /delete character/i }).first().click()
  await page.getByRole('button', { name: /^delete$/i }).last().click()

  // The toast names what went, and carries the way back.
  const toast = page.getByRole('status')
  await expect(toast).toContainText('Deleted character “Aldric”')

  await toast.getByRole('button', { name: 'Undo' }).click()

  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await expect(page.getByText('Aldric').first()).toBeVisible()
})

test('the toolbar button is disabled until there is something to undo', async ({ page }) => {
  await setupWorld(page)

  // A brand-new world has no journalled edits, so undo must not look available.
  const undoButton = page.getByRole('banner').getByRole('button', { name: 'Nothing to undo' })
  await expect(undoButton).toBeDisabled()

  await addCharacter(page, 'Vela')

  await expect(topBarUndo(page)).toBeEnabled()
})

test('Ctrl+Z undoes, but leaves text fields to the browser', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Vela')

  // Inside a textarea the browser's own undo is the one the user means — ours
  // works at whole-edit granularity and would swallow the keystroke.
  await page.getByText('Vela').first().click()
  await page.getByRole('button', { name: /^edit$/i }).first().click()
  const description = page.locator('textarea').first()
  await description.fill('a scout of the northern march')
  await description.press('Control+z')
  // The character is still there: our undo never ran.
  await expect(topBarUndo(page)).toBeEnabled()

  // Outside one, it reaches the app: the character creation is taken back.
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await page.locator('body').press('Control+z')

  await expect(page.getByRole('status')).toContainText('Undid: Added character “Vela”')
  // Scoped to the list — the toast names the character too.
  await expect(page.getByRole('main').getByText('Vela')).toHaveCount(0)
})

test('recent changes lists edits newest first and undoes the top one', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Vela')
  await addCharacter(page, 'Bree')

  await page.getByRole('button', { name: 'Recent changes' }).first().click()
  const panel = page.getByRole('dialog', { name: 'Recent changes' })
  await expect(panel).toBeVisible()

  const rows = panel.getByRole('listitem')
  await expect(rows.first()).toContainText('Added character “Bree”')
  await expect(rows.nth(1)).toContainText('Added character “Vela”')

  // Only the newest is undoable — taking one from the middle would leave the
  // later operations resting on a state that never existed.
  await expect(rows.first().getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(rows.nth(1).getByRole('button', { name: 'Undo' })).toHaveCount(0)

  await rows.first().getByRole('button', { name: 'Undo' }).click()
  await expect(panel.getByRole('listitem').first()).toContainText('Added character “Vela”')
})

test('undo is reachable on a phone, where there is no keyboard', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Vela')
  // Narrow only once there is history, so the assertions are about reaching
  // undo on a phone rather than about creating a character on one.
  await page.setViewportSize({ width: 390, height: 844 })

  // The toolbar button survives the narrow layout.
  await expect(topBarUndo(page)).toBeVisible()

  // And the history list is in the nav drawer, since the desktop icon is hidden.
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('button', { name: 'Recent changes' }).click()
  await expect(page.getByRole('dialog', { name: 'Recent changes' })).toBeVisible()
})

test('redo puts back what undo took away', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Vela')

  // Nothing has been undone, so there is nothing to put back.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Nothing to redo' })).toBeDisabled()

  await topBarUndo(page).click()
  await expect(page.getByRole('main').getByText('Vela')).toHaveCount(0)

  await topBarRedo(page).click()
  await expect(page.getByRole('main').getByText('Vela').first()).toBeVisible()
})

test('Ctrl+Shift+Z redoes, and a new edit clears the redo', async ({ page }) => {
  await setupWorld(page)
  await addCharacter(page, 'Vela')

  await page.locator('body').press('Control+z')
  await expect(page.getByRole('main').getByText('Vela')).toHaveCount(0)

  await page.locator('body').press('Control+Shift+z')
  await expect(page.getByRole('main').getByText('Vela').first()).toBeVisible()

  // Undo again, then do something new — the redo must not survive it.
  await page.locator('body').press('Control+z')
  await addCharacter(page, 'Bree')
  await expect(page.getByRole('banner').getByRole('button', { name: 'Nothing to redo' })).toBeDisabled()
})
