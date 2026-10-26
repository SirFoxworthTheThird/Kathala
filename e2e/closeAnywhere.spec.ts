import { test, expect, type Browser, type Page } from '@playwright/test'
import { closeDuring, invariants, settleStore, type CloseMode, type Stored } from './helpers/closeAnywhere'
import { settle } from './helpers/settle'

/**
 * Close the page part-way through each writing action, and check that nothing
 * is lost, doubled or left half-made (next-plan.md, Part A).
 *
 * Each run is a fresh browser context — its own IndexedDB and localStorage —
 * seeded with the same small book, opened on the Page, and closed at a chosen
 * delay after the action starts: by a reload, which runs the page's own
 * `pagehide` handlers, or by killing the renderer, which runs nothing. Then
 * the page is opened again, left to do what it does on opening, and read.
 *
 * In the suite each action runs at a few delays in each mode. Set
 * `CLOSE_ANYWHERE_RUNS=200` to run each action that many times per mode at
 * delays drawn at random up to `CLOSE_ANYWHERE_MAX_MS` (default 2500), more of
 * them early — the measure Part A is held to.
 */

const RUNS = Number(process.env.CLOSE_ANYWHERE_RUNS ?? 0)
const MAX_MS = Number(process.env.CLOSE_ANYWHERE_MAX_MS ?? 2500)
const SWEEP = [0, 200, 800]
// Drawn towards the start, where the writes are: half of them inside the first quarter of the range.
const delays = (): number[] => (RUNS ? Array.from({ length: RUNS }, () => Math.floor(Math.random() ** 2 * MAX_MS)) : SWEEP)
const MODES: CloseMode[] = ['reload', 'crash']
const PAGE_URL = '/#/worlds/w/manuscript'

/** The book's prose, scene by scene: two sentences each, every one distinct. */
const PROSE = {
  e1: ['The tide ran out at the shore.', 'Gulls on the posts.'],
  e2: ['Boxes to the ceiling.', 'A ledger on the sill.'],
  e3: ['Ash, still warm.', 'Nobody spoke of the tide.'],
} as const
const ALL = Object.values(PROSE).flat()

/**
 * Three scenes in one chapter. Nell holds the ledger from the first; the second
 * has them both, in the archive.
 */
async function seed(page: Page) {
  await page.waitForFunction(() => !!(window as { __pwdb?: unknown }).__pwdb)
  await page.evaluate(async (prose) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    const id = 'w'
    await db.worlds.add({ id, name: 'Slack Water', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, calendar: null, pinsSetClock: true, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const [pid, name] of [['studio', 'The Studio'], ['archive', 'The Archive']]) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, name, description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    }
    for (const [cid, name] of [['nell', 'Nell Garrity'], ['kit', 'Kit Fenwick']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.items.add({ id: 'ledger', worldId: id, name: 'The Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'Arrival', 'studio', ['nell']], ['e2', 'The archive', 'archive', ['nell', 'kit']], ['e3', 'The kiln', 'studio', ['kit']]] as const
    let i = 0
    for (const [eid, title, place, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: place, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: eid === 'e1' ? ['ledger'] : [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      const text = prose[eid].join('\n\n')
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: text.split(/\s+/).length, updatedAt: now })
    }
    await db.characterSnapshots.add({
      id: 'nell-e1', worldId: id, characterId: 'nell', eventId: 'e1', sortKey: 1.000001, isAlive: true, currentLocationMarkerId: 'studio',
      currentMapLayerId: null, inventoryItemIds: ['ledger'], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
  }, PROSE as unknown as Record<string, string[]>)
}

const editor = (page: Page) => page.getByRole('textbox', { name: 'The book, as one page' })
const line = (page: Page, text: string) => page.locator('.cm-line', { hasText: text }).first()

/** The book on the Page: the layout is remembered, so a reopened page comes back to it by itself. */
async function onPage(page: Page, headers = 3) {
  await settle(page)
  if (!(await editor(page).isVisible())) {
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  }
  await expect(editor(page)).toBeVisible({ timeout: 20_000 })
  // Drawn from the records: every scene's header, so a click on one of its lines finds it.
  if (headers) await expect(page.locator('.cm-draft-header-start')).toHaveCount(headers, { timeout: 20_000 })
  else await expect(page.locator('.cm-draft-header-start').first()).toBeVisible({ timeout: 20_000 })
}

/** Who holds the ledger at each scene, read as the app reads it: each person's last record at or before the scene. */
const holders = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  const chapters = new Map((await db.chapters.toArray()).map((c) => [c.id, c.number as number]))
  const key = (e: Record<string, unknown>) => (chapters.get(e.chapterId as string) ?? 0) + (e.sortOrder as number) / 1_000_000
  const events = await db.events.toArray()
  const snaps = await db.characterSnapshots.toArray()
  const at = new Map(events.map((e) => [e.id as string, key(e)]))
  return Object.fromEntries(events.sort((a, b) => key(a) - key(b)).map((e) => {
    const k = key(e)
    const people = new Set(snaps.map((s) => s.characterId as string))
    const who = [...people].filter((p) => {
      const last = snaps.filter((s) => s.characterId === p && (at.get(s.eventId as string) ?? Infinity) <= k)
        .sort((a, b) => (at.get(b.eventId as string) ?? 0) - (at.get(a.eventId as string) ?? 0))[0]
      return !!last && (last.inventoryItemIds as string[]).includes('ledger')
    })
    return [e.title as string, who.sort()]
  }))
})

interface Action {
  name: string
  act: (page: Page) => Promise<void>
  /** Sentences the action brings to the page: a reload keeps them, a crash may lose them. */
  brought?: ReadonlyArray<string | readonly string[]>
  /** The book's own sentences, as the action may leave them: neither close loses one. */
  book?: ReadonlyArray<string | readonly string[]>
  /** What else has to hold once the page has reopened. */
  check?: (page: Page, s: Stored, mode: CloseMode) => Promise<string[]>
  /** What the close left of the action, counted across the runs: which of its allowed ends it came to. */
  outcome?: (s: Stored) => string
}

const byTitle = (s: Stored, title: string) => s.events.find((e) => e.title === title)

const PASTED = [['Shelf one', 'archive', 'The Archive', 'Kit Fenwick'], ['Shelf two', 'studio', 'The Studio', 'Nell Garrity'], ['Shelf three', 'archive', 'The Archive', 'Nell Garrity']] as const

const ACTIONS: Action[] = [
  {
    name: 'typing',
    act: async (page) => {
      await line(page, 'Gulls on the posts.').click()
      await page.keyboard.press('End')
      await page.keyboard.type(' A bell rang twice.')
    },
    brought: ['A bell rang twice.'],
  },
  {
    name: 'a paste of scenes with headers',
    act: async (page) => {
      await line(page, 'Nobody spoke of the tide.').click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await page.locator('.cm-content').evaluate((el, t) => {
        const data = new DataTransfer()
        data.setData('text/plain', t)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
      }, PASTED.flatMap(([title, , place, who]) => [`## ${title}`, '[', `  Place: #${place}`, `  Characters: @@${who}`, ']', '', `${title} prose.`, '']).join('\n'))
    },
    brought: PASTED.map(([title]) => `${title} prose.`),
    // Every pasted scene that exists has its header written, or remembered to be — and after a reload, every one exists.
    check: async (_page, s, mode) => PASTED.flatMap(([title, place]) => {
      const e = byTitle(s, title)
      if (!e) return mode === 'reload' ? [`"${title}" not made`] : []
      return e.locationMarkerId === place || s.kept[e.id as string] ? [] : [`"${title}": its header neither written nor remembered`]
    }),
    outcome: (s) => `${PASTED.filter(([title]) => byTitle(s, title)).length} of ${PASTED.length} made`,
  },
  {
    name: 'a paste of a chapter',
    act: async (page) => {
      await line(page, 'Nobody spoke of the tide.').click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await page.locator('.cm-content').evaluate((el, t) => {
        const data = new DataTransfer()
        data.setData('text/plain', t)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
      }, ['# The Far Shore', '', '## Landing', '[', '  Place: #The Studio', ']', '', 'Landing prose.', '', '## Ashore', '', 'Ashore prose.', ''].join('\n'))
    },
    brought: ['Landing prose.', 'Ashore prose.'],
    check: async (_page, s, mode) => {
      const far = s.chapters.find((c) => c.title === 'The Far Shore')
      const out: string[] = []
      for (const title of ['Landing', 'Ashore']) {
        const e = byTitle(s, title)
        if (!e) { if (mode === 'reload') out.push(`"${title}" not made`); continue }
        // Made, its chapter is made too: the chapter's heading was owed with it.
        if (e.chapterId !== far?.id) out.push(`"${title}" in chapter ${String(s.chapters.find((c) => c.id === e.chapterId)?.title)}`)
      }
      const landing = byTitle(s, 'Landing')
      if (landing && landing.locationMarkerId !== 'studio' && !s.kept[landing.id as string]) out.push('"Landing": its header neither written nor remembered')
      if (mode === 'reload' && !far) out.push('"The Far Shore" not made')
      return out
    },
    outcome: (s) => (s.chapters.some((c) => c.title === 'The Far Shore') ? 'made' : 'not made'),
  },
  {
    name: 'a split',
    act: async (page) => {
      await line(page, 'Boxes to the ceiling.').click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.type('## The stair')
      await page.keyboard.press('Enter')
    },
    check: async (_page, s, mode) => {
      const stair = byTitle(s, 'The stair')
      // A heading typed and left is owed from then: a reload makes it, if the page did not.
      if (!stair) return mode === 'reload' ? ['"The stair" not made'] : []
      const text = s.texts.find((t) => t.eventId === stair.id)?.text
      return text === 'A ledger on the sill.' ? [] : [`"The stair" holds ${JSON.stringify(text)}`]
    },
    outcome: (s) => (byTitle(s, 'The stair') ? 'split' : 'not split'),
  },
  {
    name: 'a join',
    act: async (page) => {
      await line(page, '## The archive').click()
      await page.keyboard.press('End')
      await page.keyboard.press('Shift+Home')
      await page.keyboard.press('Backspace')
    },
    // Joined, or not: never half — a scene gone with its prose nowhere, or kept with its prose doubled.
    check: async (_page, s) => {
      const archive = byTitle(s, 'The archive')
      const arrival = s.texts.find((t) => t.eventId === 'e1')?.text ?? ''
      const joined = arrival.includes('Boxes to the ceiling.')
      if (archive && joined) return ['joined into Arrival, and still a scene']
      if (!archive && !joined) return ['gone, and not joined']
      return []
    },
    outcome: (s) => (byTitle(s, 'The archive') ? 'not joined' : 'joined'),
  },
  {
    name: 'a header edit',
    act: async (page) => {
      await line(page, 'Place: #The Archive').click()
      await page.keyboard.press('End')
      for (let i = 0; i < 'The Archive'.length; i++) await page.keyboard.press('Backspace')
      await page.keyboard.type('The Studio')
      await page.keyboard.press('Escape')
      await line(page, 'Gulls on the posts.').click()
    },
    check: async (_page, s, mode) => {
      const e2 = byTitle(s, 'The archive')
      if (e2?.locationMarkerId === 'studio') return []
      if (s.kept.e2?.line.includes('#The Studio')) return []
      // Only a page that had no chance to keep it may still say the archive.
      return mode === 'crash' && e2?.locationMarkerId === 'archive' ? [] : [`the archive scene at ${String(e2?.locationMarkerId)}, its edit not remembered`]
    },
    outcome: (s) => (byTitle(s, 'The archive')?.locationMarkerId === 'studio' ? 'written' : s.kept.e2 ? 'remembered' : 'as before'),
  },
  {
    name: 'an item hand-off',
    act: async (page) => {
      await line(page, 'Characters: @@Nell Garrity @@Kit Fenwick').click()
      await page.keyboard.press('End')
      // The caret is at the end of a name, so the picker is open: Enter would complete the name, not start a line.
      await page.keyboard.press('Escape')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Shift+Home')
      await page.keyboard.type('  Items: ^The Ledger:@Kit Fenwick')
      await page.keyboard.press('Escape')
      await line(page, 'Gulls on the posts.').click()
    },
    // One pair of hands at every scene, and the hand-off made or remembered.
    check: async (page, s, mode) => {
      const held = await holders(page)
      const out = Object.entries(held).filter(([, who]) => who.length > 1).map(([title, who]) => `the ledger held by ${who.join(' and ')} at "${title}"`)
      if (held['The archive']?.join() === 'kit') return out
      if (s.kept.e2?.line.includes('^The Ledger:@Kit Fenwick')) return out
      if (mode === 'crash' && held['The archive']?.join() === 'nell') return out
      return [...out, `the hand-off neither made nor remembered: ${JSON.stringify(held)}`]
    },
    outcome: (s) => (s.kept.e2 ? 'remembered' : 'as written'),
  },
  {
    name: 'Find & replace',
    act: async (page) => {
      await page.getByRole('button', { name: 'Find & replace' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByPlaceholder('Find…').fill('tide')
      await dialog.getByPlaceholder('Replace with…').fill('flood')
      await expect(dialog.getByText(/2 matches in 2 scenes/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Replace all' }).click()
    },
    book: ALL.map((x) => (x.includes('tide') ? [x, x.replace('tide', 'flood')] : x)),
    // One write: every match replaced, or none.
    check: async (_page, s) => {
      const all = s.texts.map((t) => t.text).join('\n')
      const tide = all.split('tide').length - 1
      const flood = all.split('flood').length - 1
      return tide === 0 || flood === 0 ? [] : [`replaced in part: ${tide} "tide", ${flood} "flood"`]
    },
    outcome: (s) => (s.texts.some((t) => t.text.includes('flood')) ? 'replaced' : 'not replaced'),
  },
]

async function once(browser: Browser, baseURL: string, action: Action, mode: CloseMode, delay: number): Promise<{ failures: string[]; outcome?: string }> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
  try {
    // The first-run guide dismissed, as `resetDB` does. Not on the blank page a new tab starts as, which has no storage.
    await context.addInitScript(() => { if (location.protocol.startsWith('http')) localStorage.setItem('kathala-tutorial', JSON.stringify({ step: 0, done: true })) })
    // Anything the app says went wrong, from either page: a write that threw is a failure even where the checks pass.
    const errors: string[] = []
    context.on('weberror', (e) => errors.push(String(e.error()).split('\n')[0]))
    context.on('console', (m) => {
      if (m.type() !== 'error') return
      // An error logged with its cause: the cause's own message, which the console's text of it leaves out.
      void Promise.all(m.args().map((a) => a.evaluate((v) => (v instanceof Error ? `${v.name}: ${v.message}` : String(v))).catch(() => '')))
        .then((parts) => errors.push((parts.join(' ') || m.text()).replace(/\s+/g, ' ').slice(0, 300)))
    })
    let page = await context.newPage()
    await page.goto('/', { waitUntil: 'load' })
    await seed(page)
    await page.goto(PAGE_URL, { waitUntil: 'load' })
    await onPage(page)
    page = await closeDuring(context, page, mode, delay, action.act, PAGE_URL)
    // As many scenes as the action left: a split, a join or a paste changes how many.
    await onPage(page, 0)
    const s = await settleStore(page)
    const failures = [
      ...invariants.prose(s, action.book ?? ALL),
      ...invariants.prose(s, action.brought ?? [], mode === 'crash'),
      ...invariants.noHeaderInProse(s),
      ...invariants.noHeadingInProse(s),
      ...invariants.journal(s),
      ...(action.check ? await action.check(page, s, mode) : []),
      ...errors.map((e) => `the app said: ${e}`),
    ].map((f) => `${mode} at ${delay}ms: ${f}`)
    return { failures, outcome: action.outcome?.(s) }
  } catch (err) {
    return { failures: [`${mode} at ${delay}ms: the run itself failed — ${String(err).split('\n')[0]}`] }
  } finally {
    await context.close()
  }
}

/*
  A reload at the moment a save is set going. The page saves a second after the
  typing stops, so a close at a delay chosen from outside lands in that second
  or after the save, and almost never on it. This reloads from inside the page,
  as the save's first write to the scene's prose is issued: the write has
  started, the page has stopped counting it as owed, and it has not landed.

  Chromium finishes it all the same. Kept in the page's stash as well until it
  landed, as A2 first did, the result was the same with and without (5 of 5
  each way), so the page does not: this holds the behaviour, not that code.
*/
test('a reload as the typing is saved keeps what was typed', async ({ browser }, testInfo) => {
  test.setTimeout(240_000)
  const baseURL = String(testInfo.project.use.baseURL)
  const lost: string[] = []
  let reloadedMidWrite = 0
  for (let run = 0; run < 5; run++) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
    try {
      await context.addInitScript(() => {
        if (!location.protocol.startsWith('http')) return
        localStorage.setItem('kathala-tutorial', JSON.stringify({ step: 0, done: true }))
        const w = window as unknown as { __closeOnWrite?: string | null }
        const close = (store: string) => {
          if (w.__closeOnWrite !== store) return
          w.__closeOnWrite = null
          sessionStorage.setItem('__pwReloadedMidWrite', '1')
          location.reload()
        }
        for (const name of ['put', 'add'] as const) {
          const original = IDBObjectStore.prototype[name]
          IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
            const request = original.apply(this, args)
            close(this.name)
            return request
          }
        }
        const update = IDBCursor.prototype.update
        IDBCursor.prototype.update = function (this: IDBCursor, value: unknown) {
          const request = update.call(this, value)
          close((this.source as IDBObjectStore).name ?? (this.source as IDBIndex).objectStore.name)
          return request
        }
      })
      const page = await context.newPage()
      await page.goto('/', { waitUntil: 'load' })
      await seed(page)
      await page.goto(PAGE_URL, { waitUntil: 'load' })
      await onPage(page)
      await line(page, 'Gulls on the posts.').click()
      await page.keyboard.press('End')
      await page.keyboard.type(` The bell rang ${run + 1} times.`)
      const reloaded = page.waitForEvent('load', { timeout: 20_000 })
      await page.evaluate(() => { (window as unknown as { __closeOnWrite?: string }).__closeOnWrite = 'sceneTexts' })
      await reloaded
      await onPage(page, 0)
      if (await page.evaluate(() => sessionStorage.getItem('__pwReloadedMidWrite'))) reloadedMidWrite++
      const s = await settleStore(page)
      lost.push(...invariants.prose(s, [...ALL, `The bell rang ${run + 1} times.`]).map((f) => `run ${run + 1}: ${f}`))
    } finally {
      await context.close()
    }
  }
  // Paired: every run was closed on the write, so the check above is about that moment.
  expect(reloadedMidWrite).toBe(5)
  expect(lost).toEqual([])
})

test.describe('closing the page during a writing action', () => {
  test.describe.configure({ mode: 'parallel', timeout: Math.max(300_000, RUNS * MODES.length * 30_000) })

  for (const action of ACTIONS) {
    test(`loses nothing: ${action.name}`, async ({ browser }, testInfo) => {
      const baseURL = String(testInfo.project.use.baseURL)
      const failures: string[] = []
      const outcomes = new Map<string, number>()
      let runs = 0
      for (const mode of MODES) {
        for (const delay of delays()) {
          const { failures: failed, outcome } = await once(browser, baseURL, action, mode, delay)
          failures.push(...failed)
          if (outcome) outcomes.set(`${mode}: ${outcome}`, (outcomes.get(`${mode}: ${outcome}`) ?? 0) + 1)
          runs++
        }
      }
      const ends = [...outcomes].sort().map(([k, n]) => `${k} ×${n}`).join('; ')
      testInfo.annotations.push({ type: 'runs', description: `${runs} closes, ${failures.length} failures${ends ? ` — ${ends}` : ''}` })
      console.log(`close-anywhere: ${action.name}: ${runs} closes, ${failures.length} failures${ends ? ` — ${ends}` : ''}`)
      expect(failures).toEqual([])
    })
  }
})
