import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { unmetNames, benignText } from './helpers/unmet'

/**
 * The promise reading mode makes, checked as one property rather than screen by
 * screen: with the cursor at the opening moment, no name the reader has not met
 * appears anywhere in the app.
 *
 * Gating each view by hand would leave the *next* view unguarded — this is what
 * notices. It walks every world-scoped route, so a screen added later is
 * covered without anyone remembering to add it here.
 */

test.describe.configure({ timeout: 180_000 })

const ROUTES = [
  '', 'timeline', 'corkboard', 'calendar', 'characters', 'maps', 'items',
  'relationships', 'arc', 'lore', 'factions', 'knowledge',
]

test('no unmet name appears anywhere in reading mode', async ({ page }) => {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Example Library' }).click()
  await page.getByRole('button', { name: /^Download \(/ }).first().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
  await page.waitForTimeout(1500)
  const worldId = new URL(page.url()).hash.split('/')[2]

  // Step onto the opening moment, where nearly the whole book is still unread.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)

  const unmet = await unmetNames(page)
  const benign = await benignText(page)
  expect(unmet.characters.length, 'the fixture should leave plenty unmet').toBeGreaterThan(10)

  // Names long enough that a match is a real leak rather than a coincidence,
  // and not already given away by the book's own contents page.
  const needles = [
    ...unmet.characters.map((n) => ['character', n] as const),
    ...unmet.items.map((n) => ['item', n] as const),
    ...unmet.locations.map((n) => ['location', n] as const),
  ].filter(([, n]) => n && n.trim().length >= 5 && !benign.includes(n.toLowerCase()))

  const leaks: string[] = []
  for (const route of ROUTES) {
    await page.goto(`/#/worlds/${worldId}/${route}`)
    await page.waitForTimeout(1200)
    const text = (await page.evaluate(`(() => document.querySelector('main')?.innerText ?? '')()`)) as string
    for (const [kind, name] of needles) {
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (pattern.test(text)) leaks.push(`/${route || 'dashboard'} → ${kind} “${name}”`)
    }
  }

  expect(leaks, `unmet names on screen:\n${leaks.join('\n')}`).toEqual([])
})

/**
 * Search is the one screen the gate does not reach by walking routes: it is a
 * dialog, it reads eleven tables directly rather than through the entity hooks,
 * and a single letter matches most of the world. It gets its own pass.
 */
test('search does not answer with what the reader has not met', async ({ page }) => {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Example Library' }).click()
  await page.getByRole('button', { name: /^Download \(/ }).first().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1200)

  const unmet = await unmetNames(page)
  const benign = await benignText(page)
  expect(unmet.characters.length).toBeGreaterThan(10)

  // Names must be matched against result *labels*, not the whole dialog: a
  // revealed record's own description may legitimately mention another place
  // in prose, and redacting authored text is not what the gate does.
  const needles = [
    ...unmet.characters.map((n) => ['character', n] as const),
    ...unmet.items.map((n) => ['item', n] as const),
    ...unmet.locations.map((n) => ['location', n] as const),
  ].filter(([, n]) => n && n.trim().length >= 5 && !benign.includes(n.toLowerCase()))

  const leaks: string[] = []
  for (const query of ['a', 'e', 'o', 'the']) {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(400)
    await page.keyboard.insertText(query)
    await page.waitForTimeout(700)

    const labels = (await page.evaluate(
      `(() => [...document.querySelectorAll('[data-search-result-label]')].map((n) => n.textContent ?? ''))()`,
    )) as string[]
    for (const [kind, name] of needles) {
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (labels.some((l) => pattern.test(l))) leaks.push(`“${query}” → ${kind} “${name}”`)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  expect(leaks, `search returned unmet names:\n${leaks.join('\n')}`).toEqual([])
})
