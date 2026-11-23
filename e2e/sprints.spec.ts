import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Writing sprints (issue #706, sprints-plan.md), on Playwright's clock: a sprint
  started on the Page counts the words typed in it and not those typed while
  paused, ends on time with a notice of what was added and cut, and is on the
  dashboard; one from Focus mode lasts through a reload, counts the words typed
  up to its last second, and sounds when asked to; one whose page closed is
  ended at its planned end when the app opens again.
*/

const MANUSCRIPT = [
  '# The Widow of Hesk',
  '',
  '## Chapter 1: The Gate',
  '',
  'Teodora walked to the gate alone.',
].join('\n')

/** The browser's audio, stood in: each tone the page makes is kept. */
async function recordSound(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: number; AudioContext: unknown }
    w.__tones = 0
    class Ctx {
      currentTime = 0
      destination = {}
      createOscillator() { return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start: () => { w.__tones++ }, stop: () => {} } }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n } }
      close() { return Promise.resolve() }
    }
    w.AudioContext = Ctx
  })
}
const tones = (page: Page) => page.evaluate(() => (window as unknown as { __tones: number }).__tones)

async function openPage(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Teodora walked to the gate alone.')
  return worldId
}

const saved = (page: Page) => expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'saved')
const timer = (page: Page) => page.getByRole('timer')
const leftSeconds = async (page: Page) => {
  const [m, s] = ((await timer(page).textContent()) ?? '').replace(/[^\d:]/g, '').split(':').map(Number)
  return m * 60 + s
}
/** The toast that says a sprint has ended: the editor has a live region of its own. */
const toast = (page: Page) => page.getByRole('status').filter({ hasText: /sprint/i })

async function typeAtEnd(page: Page, line: string, words: string) {
  await page.locator('.cm-line', { hasText: line }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(words)
}

/**
 * Type in a sprint's last half second and let its time run out before the editor's own save, a
 * second after the last key. The clock is held half a second before the end while the words are
 * typed; then run on to a tenth of a second past the end and held there: the timers fire in one go,
 * and what they start (the saves, IndexedDB's own work) runs after, at the time the clock is held
 * at. Held later than the grace, the save would land after it, as `fastForward` makes it do: that
 * is the clock, not the app, which saves at the moment it is told.
 */
async function atTheLastSecond(page: Page, type: () => Promise<void>) {
  const end = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb: { sprints: { toArray: () => Promise<Array<{ startedAt: number; plannedMs: number; pausedMs: number; endedAt: number | null }>> } } }).__pwdb
    const s = (await db.sprints.toArray()).find((r) => r.endedAt === null)!
    return s.startedAt + s.plannedMs + s.pausedMs
  })
  await page.clock.pauseAt(end - 500)
  await type()
  await page.clock.runFor(600)
}

test('a sprint on the Page: the words typed in it, not while paused, its end said, and on the dashboard', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date(2026, 10, 23, 9, 0) })
  await recordSound(page)
  const worldId = await openPage(page)

  // Choose 15 minutes.
  await page.getByRole('button', { name: 'Sprint', exact: true }).click()
  await page.getByRole('group', { name: 'Start a sprint' }).getByRole('button', { name: '15 min' }).click()
  await expect(timer(page)).toHaveAccessibleName(/^Sprint, 1[45]:\d\d left$/)
  expect(await leftSeconds(page)).toBeGreaterThan(14 * 60)

  // Five words typed in it.
  await typeAtEnd(page, 'Teodora walked', ' It was shut, she saw.')
  await saved(page)

  // Paused: the clock stands still and what is typed is not in it.
  await page.getByRole('button', { name: 'Pause sprint' }).click()
  await expect(timer(page)).toHaveAccessibleName(/^Sprint paused, /)
  const pausedAt = await leftSeconds(page)
  await typeAtEnd(page, 'she saw.', ' Typed while paused.')
  await saved(page)
  await page.clock.fastForward('05:00')
  expect(await leftSeconds(page)).toBe(pausedAt)
  await page.getByRole('button', { name: 'Resume sprint' }).click()
  await expect(timer(page)).toHaveAccessibleName(/^Sprint, /)

  // A word rewritten, in it: one added and one cut.
  await page.locator('.cm-line', { hasText: 'Teodora walked' }).getByText('walked').dblclick()
  await page.keyboard.type('ran')
  await saved(page)

  // Its time runs out: the notice says what it was, and there is no sound unless asked for.
  await page.clock.fastForward('15:00')
  await expect(toast(page)).toContainText('Sprint done: 6 words added, 1 cut in 15 minutes.')
  await expect(timer(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sprint', exact: true })).toBeVisible()
  expect(await tones(page)).toBe(0)

  // On the dashboard: today’s sprint, the last 30 days, and the day’s words added and cut.
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  const today = page.getByRole('list', { name: 'Today’s sprints' })
  await expect(today.getByRole('listitem')).toHaveCount(1)
  await expect(today.getByRole('listitem')).toContainText('15 minutes')
  await expect(today.getByRole('listitem')).toContainText('6 added')
  await expect(today.getByRole('listitem')).toContainText('1 cut')
  await expect(page.getByTestId('sprints-30')).toHaveText('Last 30 days: 1 sprint, 15 minutes, 6 added, 1 cut')
  // Today's bar in the 14 days is drawn, and as tall as the strip: the most written of them. A day with nothing is a sliver.
  const strip = page.getByRole('img', { name: 'Words written over the last 14 days' })
  const height = (el: import('@playwright/test').Locator) => el.evaluate((n) => n.getBoundingClientRect().height)
  const stripHeight = await height(strip)
  expect(await height(strip.locator('[data-day="2026-11-23"] > div'))).toBeGreaterThan(stripHeight * 0.9)
  expect(await height(strip.locator('[data-day="2026-11-22"] > div'))).toBeLessThan(stripHeight * 0.1)
})

test('a sprint from Focus mode lasts through a reload, counts the words typed up to its end, and sounds when asked', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date(2026, 10, 23, 9, 0) })
  await recordSound(page)
  await openPage(page)
  await page.locator('.cm-line', { hasText: 'Teodora walked' }).click()
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const focus = page.locator('[data-focus-mode]').getByPlaceholder('Write…')
  await expect(focus).toHaveValue(/Teodora walked/)

  // Ten minutes, chosen, with the sound on, in Focus mode's own header: the Page's is under it.
  const focusMode = page.locator('[data-focus-mode]')
  await focusMode.getByRole('button', { name: 'Sprint', exact: true }).click()
  const chooser = page.getByRole('group', { name: 'Start a sprint' })
  await chooser.getByLabel('Minutes').fill('10')
  await chooser.getByLabel('Sound at the end').check()
  await chooser.getByRole('button', { name: 'Start' }).click()
  await expect(focusMode.getByRole('timer')).toHaveAccessibleName(/^Sprint, (10:00|9:\d\d) left$/)

  await focus.press('End')
  await focus.pressSequentially(' Three more words.')
  await page.clock.fastForward('00:02')
  await expect.poll(() => page.evaluate(async () => {
    const db = (window as unknown as { __pwdb: { sceneTexts: { toArray: () => Promise<Array<{ text: string }>> } } }).__pwdb
    return (await db.sceneTexts.toArray()).map((t) => t.text).join('\n')
  })).toContain('Three more words.')

  // A reload: the sprint goes on where it was.
  await page.clock.fastForward('03:00')
  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(timer(page)).toHaveAccessibleName(/^Sprint, 6:\d\d left$/)

  // Typed in its last second and not yet saved when the time runs out: still in it.
  await atTheLastSecond(page, () => typeAtEnd(page, 'Three more words.', ' Two more.'))
  await expect(toast(page)).toContainText('Sprint done: 5 words added, 0 cut in 10 minutes.')
  expect(await tones(page)).toBe(2)
})

test('a sprint whose page closed is ended at its planned end when the app opens again', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date(2026, 10, 23, 9, 0) })
  const worldId = await openPage(page)
  await page.getByRole('button', { name: 'Sprint', exact: true }).click()
  await page.getByRole('group', { name: 'Start a sprint' }).getByRole('button', { name: '25 min' }).click()
  await typeAtEnd(page, 'Teodora walked', ' Four words before closing.')
  await saved(page)

  await page.goto('about:blank')
  await page.clock.fastForward('01:00:00')
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  await expect(toast(page)).toContainText('A sprint ended while Kathala was closed: 4 words added, 0 cut in 25 minutes.')
  await expect(page.getByTestId('sprints-30')).toHaveText('Last 30 days: 1 sprint, 25 minutes, 4 added, 0 cut')
})

test('in Focus mode too, the words typed in a sprint’s last second are in it', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date(2026, 10, 23, 9, 0) })
  await openPage(page)
  await page.locator('.cm-line', { hasText: 'Teodora walked' }).click()
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const focusMode = page.locator('[data-focus-mode]')
  const box = focusMode.getByPlaceholder('Write…')
  await expect(box).toHaveValue(/Teodora walked/)
  await focusMode.getByRole('button', { name: 'Sprint', exact: true }).click()
  await page.getByRole('group', { name: 'Start a sprint' }).getByRole('button', { name: '15 min' }).click()
  await atTheLastSecond(page, async () => {
    await box.press('End')
    await box.pressSequentially(' At the very end.')
  })
  await expect(toast(page)).toContainText('Sprint done: 4 words added, 0 cut in 15 minutes.')
})

test('pausing or stopping a sprint saves the words typed first, and the length chosen is offered again', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date(2026, 10, 23, 9, 0) })
  await openPage(page)
  const sprintRow = async () => page.evaluate(async () => {
    const db = (window as unknown as { __pwdb: { sprints: { toArray: () => Promise<Array<{ wordsAdded: number; ended?: string; pausedAt: number | null }>> } } }).__pwdb
    return (await db.sprints.toArray())[0]
  })

  // Nothing kept yet: the default is offered. Twenty minutes, typed.
  await page.getByRole('button', { name: 'Sprint', exact: true }).click()
  const chooser = page.getByRole('group', { name: 'Start a sprint' })
  await expect(chooser.getByLabel('Minutes')).toHaveValue('25')
  await chooser.getByLabel('Minutes').fill('20')
  await chooser.getByRole('button', { name: 'Start' }).click()
  await expect(timer(page)).toHaveAccessibleName(/^Sprint, (20:00|19:\d\d) left$/)

  // The clock held, so the editor's own save, a second after the last key, never comes: only pausing or stopping
  // can save them. It is stepped a hundredth of a second at a time, for what a click starts, until it shows.
  const step = (shown: () => Promise<void>) => expect(async () => { await page.clock.runFor(10); await shown() }).toPass({ timeout: 10_000 })
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await typeAtEnd(page, 'Teodora walked', ' Two words.')
  await page.getByRole('button', { name: 'Pause sprint' }).click()
  await step(() => expect(timer(page)).toHaveAccessibleName(/^Sprint paused, /, { timeout: 100 }))
  await expect.poll(async () => (await sprintRow()).wordsAdded).toBe(2)

  // And stopping.
  await page.getByRole('button', { name: 'Resume sprint' }).click()
  await step(() => expect(timer(page)).toHaveAccessibleName(/^Sprint, /, { timeout: 100 }))
  await typeAtEnd(page, 'Two words.', ' Three words more.')
  await page.getByRole('button', { name: 'Stop sprint' }).click()
  await step(() => expect(timer(page)).toHaveCount(0, { timeout: 100 }))
  await expect.poll(async () => { const s = await sprintRow(); return [s.ended, s.wordsAdded] }).toEqual(['stopped', 5])
  await page.clock.resume()

  // The twenty minutes are offered next time, after a reload too.
  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await page.getByRole('button', { name: 'Sprint', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Start a sprint' }).getByLabel('Minutes')).toHaveValue('20')
})
