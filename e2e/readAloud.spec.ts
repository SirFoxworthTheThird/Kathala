import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'
import { parkCursor } from './helpers/cursor'

/*
  Reading the prose aloud (issue #704): with the browser's speech replaced by a
  recorder, Read aloud speaks the book a sentence at a time, cleaned of markup,
  each sentence marked on the page as it goes; pauses, resumes on Space, steps,
  stops, and stops when Read is left. It starts from a selected sentence, keeps
  the voice and speed, offers only local voices, says why when it cannot read,
  and a reader's place follows it. docs/records/read-aloud-plan.md.
*/

type Voices = 'local' | 'online' | 'none'

/** The browser's speech, replaced before the app starts: it records what it is asked to say, and says it when told. */
async function recorder(page: Page, voices: Voices = 'local') {
  await page.addInitScript((kind: Voices) => {
    if (kind === 'none') { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); delete (window as { speechSynthesis?: unknown }).speechSynthesis; return }
    const all = [
      { name: 'Local Voice', lang: 'en-GB', localService: true, default: true, voiceURI: 'local-1' },
      { name: 'Second Local', lang: 'en-US', localService: true, default: false, voiceURI: 'local-2' },
      { name: 'Online Voice', lang: 'en-US', localService: false, default: false, voiceURI: 'online-1' },
    ].filter((v) => kind === 'local' || !v.localService)
    type U = { text: string; voice?: { voiceURI: string }; rate: number; onend?: () => void; onerror?: (e: { error: string }) => void }
    const w = window as unknown as { __said: Array<{ text: string; voice: string | null; rate: number }>; __cancels: number; __finish: () => void; __auto: number }
    w.__said = []
    w.__cancels = 0
    w.__auto = 0
    let current: U | null = null
    const waiting: U[] = []
    const next = () => {
      current = waiting.shift() ?? null
      if (current && w.__auto > 0) { const u = current; setTimeout(() => { if (current === u) w.__finish() }, w.__auto) }
    }
    w.__finish = () => { const u = current; next(); u?.onend?.() }
    class Utterance { text: string; rate = 1; voice?: { voiceURI: string }; lang = ''; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t } }
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utterance
    const synth = {
      getVoices: () => all,
      speak(u: U) { w.__said.push({ text: u.text, voice: u.voice?.voiceURI ?? null, rate: u.rate }); waiting.push(u); if (!current) next() },
      cancel() { w.__cancels++; const u = current; current = null; waiting.length = 0; u?.onerror?.({ error: 'interrupted' }) },
      pause() {}, resume() {},
      addEventListener() {}, removeEventListener() {},
      get speaking() { return !!current },
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  }, voices)
}

const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: Array<{ text: string }> }).__said.map((s) => s.text))
const lastSaid = async (page: Page) => (await said(page)).at(-1)
const finish = (page: Page) => page.evaluate(() => (window as unknown as { __finish: () => void }).__finish())
const cancels = (page: Page) => page.evaluate(() => (window as unknown as { __cancels: number }).__cancels)
/** The sentence marked on the page: the browser's highlight's text. */
const marked = (page: Page) => page.evaluate(() => {
  const h = (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get('read-aloud')
  return h ? [...h][0]?.toString() ?? null : null
})

const MANUSCRIPT = [
  '# The Long Road',
  '',
  '## Chapter 1: Departure',
  '',
  'Mira lit the _lantern_ before dawn. The road was long.[1]',
  '',
  '“We go now,” she said.',
  '',
  '* * *',
  '',
  'The gate stood open.',
  '',
  '## Chapter 2: The Gate',
  '',
  'She did not look back. Nobody followed her.',
].join('\n')

async function imported(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

async function openRead(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await expect(page.getByRole('main').getByText('Mira lit the')).toBeVisible()
}

test('a writer hears the book a sentence at a time, marked as it goes; pauses, steps, stops, and stops on leaving', async ({ page }) => {
  test.setTimeout(120_000)
  await recorder(page)
  const worldId = await imported(page)
  await openRead(page, worldId)
  const bar = page.getByRole('toolbar', { name: 'Read aloud' })
  await expect(bar).toHaveCount(0)
  expect(await said(page)).toEqual([])

  // Started by the press, at the scene on screen: its chapter announced, then its sentences, markup gone.
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click()
  await expect(bar).toBeVisible()
  await expect.poll(() => said(page)).toEqual(['Chapter 1. Departure.'])
  await expect.poll(() => marked(page)).toBe('Ch. 1 — Departure')
  // Only local voices are offered.
  await expect(bar.getByLabel('Voice').locator('option')).toHaveText(['Local Voice (en-GB)', 'Second Local (en-US)'])
  await finish(page)
  await expect.poll(() => lastSaid(page)).toBe('Mira lit the lantern before dawn.')
  await expect.poll(() => marked(page)).toBe('Mira lit the lantern before dawn.')
  await finish(page)
  // The footnote marker is on the page and not in the voice.
  await expect.poll(() => lastSaid(page)).toBe('The road was long.')
  await expect.poll(() => marked(page)).toBe('The road was long.[1]')

  // Paused: speech cancelled, nothing more said. Space resumes, from the sentence's start, and does not scroll.
  const before = await cancels(page)
  await bar.getByRole('button', { name: 'Pause' }).click()
  await expect(bar.getByRole('button', { name: 'Resume' })).toBeVisible()
  expect(await cancels(page)).toBeGreaterThan(before)
  const count = (await said(page)).length
  const scroller = page.getByRole('main').locator('.overflow-auto').filter({ has: page.locator('[data-scene-event-id]') }).first()
  const top = await scroller.evaluate((el) => el.scrollTop)
  await page.locator('body').focus()
  await page.keyboard.press('Space')
  await expect.poll(async () => (await said(page)).length).toBe(count + 1)
  expect(await lastSaid(page)).toBe('The road was long.')
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(top)
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(bar.getByRole('button', { name: 'Resume' })).toBeVisible()
  await page.keyboard.press('Space')

  // Next and previous, by sentences.
  await bar.getByRole('button', { name: 'Next sentence' }).click()
  await expect.poll(() => lastSaid(page)).toBe('“We go now,” she said.')
  await expect.poll(() => marked(page)).toBe('“We go now,” she said.')
  await bar.getByRole('button', { name: 'Previous sentence' }).click()
  await expect.poll(() => lastSaid(page)).toBe('The road was long.')
  await bar.getByRole('button', { name: 'Next sentence' }).click()
  await expect.poll(() => lastSaid(page)).toBe('“We go now,” she said.')

  // Through the scene break, a pause and on into the next scene and chapter.
  await finish(page)
  await expect.poll(() => lastSaid(page), { timeout: 5000 }).toBe('The gate stood open.')
  await finish(page)
  await expect.poll(() => lastSaid(page)).toBe('Chapter 2. The Gate.')
  await finish(page)
  await expect.poll(() => lastSaid(page)).toBe('She did not look back.')
  await expect(bar).toContainText('Sentence 7 of 8')

  // Stopped: the bar and the highlight gone, the speech cancelled, nothing said after.
  await bar.getByRole('button', { name: 'Stop' }).click()
  await expect(bar).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await marked(page)).toBeNull()
  const stopped = (await said(page)).length
  await finish(page)
  await page.waitForTimeout(300)
  expect((await said(page)).length).toBe(stopped)

  // Leaving Read stops it too.
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click()
  await expect(bar).toBeVisible()
  await expect.poll(async () => (await said(page)).length).toBe(stopped + 1)
  const atLeave = await cancels(page)
  await page.goto(`/#/worlds/${worldId}/characters`)
  await expect(page.getByRole('heading', { name: /Characters/ }).first()).toBeVisible()
  await expect.poll(() => cancels(page)).toBeGreaterThan(atLeave)
  await finish(page)
  await page.waitForTimeout(300)
  expect((await said(page)).length).toBe(stopped + 1)
})

test('it starts at a selected sentence, and keeps the voice and the speed on this device', async ({ page }) => {
  test.setTimeout(120_000)
  await recorder(page)
  const worldId = await imported(page)
  await openRead(page, worldId)
  const bar = page.getByRole('toolbar', { name: 'Read aloud' })

  // A selection in "The gate stood open." starts there.
  await page.getByRole('main').getByText('The gate stood open.').evaluate((p) => {
    const r = document.createRange()
    r.setStart(p.firstChild!, 4)
    r.setEnd(p.firstChild!, 8)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
  })
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click()
  await expect.poll(() => said(page)).toEqual(['The gate stood open.'])

  // The voice and the speed chosen apply to what is said next, and are there after a reload.
  await bar.getByLabel('Voice').selectOption('local-2')
  await bar.getByLabel('Speed').selectOption('1.5')
  await finish(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __said: Array<{ voice: string; rate: number }> }).__said.at(-1))).toMatchObject({ voice: 'local-2', rate: 1.5 })
  await page.reload({ waitUntil: 'load' })
  await expect(page.getByRole('main').getByText('Mira lit the')).toBeVisible()
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click()
  await expect(bar.getByLabel('Voice')).toHaveValue('local-2')
  await expect(bar.getByLabel('Speed')).toHaveValue('1.5')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __said: Array<{ voice: string; rate: number }> }).__said[0])).toMatchObject({ voice: 'local-2', rate: 1.5 })
})

for (const [voices, reason] of [
  ['online', 'Only online voices are offered here, and they would send the prose away to be spoken.'],
  ['none', 'This browser cannot read text aloud.'],
] as const) {
  test(`where it cannot read (${voices} voices), the control is disabled and says why`, async ({ page }) => {
    await recorder(page, voices)
    const worldId = await imported(page)
    await openRead(page, worldId)
    const button = page.getByRole('button', { name: 'Read aloud', exact: true })
    await expect(button).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: reason })).toBeVisible()
    await expect(button).toHaveAttribute('aria-describedby', 'read-aloud-reason')
  })
}

test('a reader listens, and their place follows the voice, never ahead of it', async ({ page }) => {
  test.setTimeout(180_000)
  await recorder(page)
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'Strange Case of Dr Jekyll and Mr Hyde')
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  const scenes = await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb: { chapters: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; number: number }>> } } }; events: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; chapterId: string; sortOrder: number }>> } } } } }).__pwdb
    const chapters = (await db.chapters.where('worldId').equals(id).toArray()).sort((a, b) => a.number - b.number)
    const events = await db.events.where('worldId').equals(id).toArray()
    return chapters.flatMap((c) => events.filter((e) => e.chapterId === c.id).sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.id))
  }, worldId)
  await parkCursor(page, scenes[0])
  await settle(page)
  const place = () => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)
  expect(await place()).toBe(scenes[0])

  // The reader's row offers it.
  const button = page.getByRole('button', { name: 'Read aloud', exact: true })
  await button.click()
  await expect.poll(() => said(page)).toHaveLength(1)
  // Each sentence said at once, and the place checked against the scene being spoken as it goes.
  await page.evaluate(() => { (window as unknown as { __auto: number }).__auto = 40; (window as unknown as { __finish: () => void }).__finish() })
  const spokenScene = () => page.evaluate(() => {
    const h = (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get('read-aloud')
    const r = h ? [...h][0] : null
    const el = r?.startContainer.parentElement?.closest('[data-scene-event-id]')
    return el?.getAttribute('data-scene-event-id') ?? null
  })
  let furthest = 0
  for (let i = 0; i < 60 && furthest < 2; i++) {
    await page.waitForTimeout(250)
    const at = scenes.indexOf(await place())
    const speaking = scenes.indexOf((await spokenScene()) ?? '')
    if (speaking >= 0) expect(at, 'the place is never past the scene being spoken').toBeLessThanOrEqual(speaking)
    furthest = Math.max(furthest, at)
  }
  expect(furthest, 'the place moved on with the voice').toBeGreaterThanOrEqual(2)
  await page.getByRole('toolbar', { name: 'Read aloud' }).getByRole('button', { name: 'Stop' }).click()
})
