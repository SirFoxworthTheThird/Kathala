import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  A misspelt name on the Page (issue #705): a word one letter from a name the
  world has is marked, and the correct name is not; with the caret in it the
  name is offered, and taken with the button or Ctrl+.; *Not a typo* keeps the
  word, with the world, past a reload; a word typed is marked as it is typed,
  and a name added while the Page is open is known at once.
  docs/records/spelling-plan.md.
*/

const MANUSCRIPT = [
  '# The Widow of Hesk',
  '',
  '## Chapter 1: The Gate',
  '',
  'Teodora walked to Grimward alone.',
  '',
  'At the gate Teodroa stopped, and looked back at Grimwrad.',
  '',
  'Ambroes was not there.',
].join('\n')

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; get: (k: string) => Promise<Record<string, unknown> | undefined> }>

async function openPage(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb: Db }).__pwdb
    const now = Date.now()
    const person = (pid: string, name: string) => ({ id: pid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add(person('teodora', 'Teodora Vasse'))
    await db.characters.add(person('ambrose', 'Ambrose Kettleby'))
    await db.locationMarkers.add({ id: 'grimward', worldId: id, mapLayerId: null, linkedMapLayerId: null, name: 'Grimward', description: '', x: 0, y: 0, imageId: null, iconType: 'city', tags: [], factionId: null, createdAt: now, updatedAt: now })
  }, worldId)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Teodora walked to Grimward alone.')
  return worldId
}

const marks = (page: Page) => page.locator('.cm-name-near')
const offer = (page: Page) => page.locator('.cm-name-offer')
const saved = (page: Page) => expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'saved')
const prose = (page: Page, worldId: string) => page.evaluate(async (id) => {
  const db = (window as unknown as { __pwdb: { sceneTexts: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ text: string }>> } } } } }).__pwdb
  return (await db.sceneTexts.where('worldId').equals(id).toArray()).map((t) => t.text).join('\n')
}, worldId)

/** Put the caret inside a marked word, as a click on it does. */
async function caretIn(page: Page, word: string) {
  await marks(page).filter({ hasText: word }).first().click()
}

test('a misspelt name is marked and offered, taken by button or Ctrl+., kept when it is not a typo, and marked as it is typed', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await openPage(page)

  // The near misses marked, each with its name; the names themselves not.
  await expect(marks(page)).toHaveText(['Teodroa', 'Grimwrad', 'Ambroes'])
  await expect(marks(page).nth(0)).toHaveAttribute('data-near-name', 'Teodora')
  await expect(marks(page).nth(1)).toHaveAttribute('data-near-name', 'Grimward')
  await expect(page.locator('.cm-name-near', { hasText: /^Teodora$/ })).toHaveCount(0)

  // No offer until the caret is in one.
  await expect(offer(page)).toHaveCount(0)
  await caretIn(page, 'Teodroa')
  await expect(offer(page)).toContainText('Did you mean Teodora?')
  await offer(page).getByRole('button', { name: 'Use Teodora' }).click()
  await expect(page.locator('.cm-content')).toContainText('At the gate Teodora stopped')
  await expect(marks(page)).toHaveText(['Grimwrad', 'Ambroes'])
  await expect(offer(page)).toHaveCount(0)

  // From the keyboard.
  await caretIn(page, 'Grimwrad')
  await expect(offer(page)).toContainText('Did you mean Grimward?')
  await page.keyboard.press('ControlOrMeta+Period')
  await expect(page.locator('.cm-content')).toContainText('looked back at Grimward.')
  await expect(marks(page)).toHaveText(['Ambroes'])
  await saved(page)
  await expect.poll(() => prose(page, worldId)).toContain('At the gate Teodora stopped, and looked back at Grimward.')

  // Not a typo: kept with the world, and not marked again, after a reload too.
  await caretIn(page, 'Ambroes')
  await offer(page).getByRole('button', { name: 'Not a typo' }).click()
  await expect(marks(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(async (id) => (await (window as unknown as { __pwdb: Db }).__pwdb.worlds.get(id))?.spellingAccepted, worldId)).toEqual(['ambroes'])
  await expect(page.locator('.cm-content')).toContainText('Ambroes was not there.')
  await page.reload({ waitUntil: 'load' })
  await expect(page.locator('.cm-content')).toContainText('Ambroes was not there.')
  await page.waitForTimeout(500)
  await expect(marks(page)).toHaveCount(0)

  // Typed: marked as it is written.
  await page.locator('.cm-line', { hasText: 'Ambroes was not there.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Nor was Kettelby.')
  await expect(marks(page)).toHaveText(['Kettelby'])

  // A name added while the page is open is known at once: Kessimer is nothing until there is a Kessimar.
  await page.keyboard.type(' Then came Kessimer.')
  await expect(marks(page)).toHaveText(['Kettelby'])
  await page.evaluate(async (id) => {
    const now = Date.now()
    await (window as unknown as { __pwdb: Db }).__pwdb.locationMarkers.add({ id: 'kessimar', worldId: id, mapLayerId: null, linkedMapLayerId: null, name: 'Kessimar', description: '', x: 0, y: 0, imageId: null, iconType: 'city', tags: [], factionId: null, createdAt: now, updatedAt: now })
  }, worldId)
  await expect(marks(page)).toHaveText(['Kettelby', 'Kessimer'])
})
