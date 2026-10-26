import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A drafted chapter pasted onto the Page (writer run 8): its `## ` scene
 * headings stayed text, and were counted as words. Pasted headings are now
 * made as typed ones are — each a scene, or with `# ` a chapter.
 */

async function book(page: Page, opts: { cast?: boolean; empty?: boolean; ledger?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, cast, empty, ledger }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    if (empty) return
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Arrival', description: '', sortOrder: 1,
      tags: [], locationMarkerId: cast ? 'studio' : null, involvedCharacterIds: cast ? ['nell'] : [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text: 'The road ran out at the shore.', wordCount: 7, updatedAt: now })
    if (!cast) return
    for (const [pid, name] of [['studio', 'The Studio'], ['archive', 'The Archive']]) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, name, description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    }
    for (const [cid, name] of [['nell', 'Nell Garrity'], ['kit', 'Kit Fenwick']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    if (!ledger) return
    // A thing to hand over, and Nell already recorded in the studio at Arrival.
    await db.items.add({ id: 'ledger', worldId: id, name: 'The Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.characterSnapshots.add({
      id: 'nell-e1', worldId: id, characterId: 'nell', eventId: 'e1', sortKey: 1.000001, isAlive: true, currentLocationMarkerId: 'studio',
      currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, cast: !!opts.cast || !!opts.ledger, empty: !!opts.empty, ledger: !!opts.ledger })
  return worldId
}

/** The book as the records hold it: each chapter's title, and its scenes' titles and prose, in order. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  const chapters = (await db.chapters.toArray()).sort((a, b) => (a.number as number) - (b.number as number))
  const events = (await db.events.toArray()).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
  const texts = await db.sceneTexts.toArray()
  return chapters.map((c) => [c.title, events.filter((e) => e.chapterId === c.id).map((e) => [e.title, texts.find((t) => t.eventId === e.id)?.text ?? ''])])
})

async function paste(page: Page, text: string) {
  await page.locator('.cm-content').evaluate((el, t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test.describe('headings pasted onto the Page', () => {
  test.describe.configure({ timeout: 150_000 })

  test('become scenes and a chapter, in order, and only lines that are headings do', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      'First light on the sands. #nofilter, and a ## in passing.',
      '',
      '## The archive',
      '',
      'Boxes to the ceiling.',
      '',
      '## The kiln',
      '',
      'Ash, still warm.',
      '',
      '# The Far Refuge',
      '',
      '## High water',
      '',
      'The tide came in.',
      '',
      'After.',
    ].join('\n'))

    await expect.poll(() => records(page), { timeout: 30_000 }).toEqual([
      ['The Causeway', [
        ['Arrival', 'The road ran out at the shore.\n\nFirst light on the sands. #nofilter, and a ## in passing.'],
        ['The archive', 'Boxes to the ceiling.'],
        ['The kiln', 'Ash, still warm.'],
      ]],
      ['The Far Refuge', [
        ['High water', 'The tide came in.\n\nAfter.'],
      ]],
    ])
    await expect(page.getByText('The pasted headings made 3 scenes and 1 chapter. Undo takes them back one at a time.')).toBeVisible()
    // On the page, as headings: one line each, and no `## ` left as text.
    await expect(page.locator('.cm-line', { hasText: /^## The kiln$/ })).toHaveCount(1)
    await expect(page.locator('.cm-line', { hasText: /^# The Far Refuge$/ })).toHaveCount(1)

    // And one Undo takes back one of them: the last made, the topmost.
    await page.locator('.cm-line', { hasText: 'Ash, still warm.' }).first().click()
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await records(page)).map(([chapter, scenes]) => [chapter, (scenes as string[][]).map(([title]) => title)]), { timeout: 20_000 })
      .toEqual([['The Causeway', ['Arrival', 'The kiln']], ['The Far Refuge', ['High water']]])
  })

  test('under a chapter with no scenes yet, every pasted scene is made, the first included (run 11)', async ({ page }) => {
    const worldId = await book(page, { empty: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    // As the writer did: the chapter's heading, the end of the page, a line to type on.
    await page.locator('.cm-line', { hasText: 'The Causeway' }).first().click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await paste(page, ['## S1', '', 'First scene prose, which matters.', '', '## S2', '', 'Second scene prose.', '', '## S3', '', 'Third scene prose.'].join('\n'))

    const scenes = [['S1', 'First scene prose, which matters.'], ['S2', 'Second scene prose.'], ['S3', 'Third scene prose.']]
    /*
      Made at once. Each new first scene used to wait out a three-second fallback
      (S2 at 3.1s, S1 at 6.2s, measured), with the paste above it held by the page
      alone; the writer reloaded at three seconds and S1 and its prose were gone.
      Reloading straight away, as they did, is the test.
    */
    await expect.poll(() => records(page), { timeout: 2_500 }).toEqual([['The Causeway', scenes]])
    await expect(page.getByText('The pasted headings made 3 scenes. Undo takes them back one at a time.')).toBeVisible()
    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.cm-line', { hasText: 'First scene prose, which matters.' })).toHaveCount(1, { timeout: 20_000 })
    await expect.poll(() => records(page)).toEqual([['The Causeway', scenes]])
  })

  test('a pasted scene takes its own header, not the cast and the room of the scene it was pasted into (run 9)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      '## The archive',
      '[#The Archive @@Kit Fenwick]',
      '',
      'Boxes to the ceiling.',
      '',
      '## The kiln',
      '',
      'Ash, still warm.',
    ].join('\n'))

    const scenes = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const texts = await db.sceneTexts.toArray()
      return (await db.events.toArray()).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
        .map((e) => [e.title, e.locationMarkerId, e.involvedCharacterIds, texts.find((t) => t.eventId === e.id)?.text ?? ''])
    })
    // The header under its heading said where and who; the scene with none says nothing; the one pasted into keeps its own.
    await expect.poll(scenes, { timeout: 30_000 }).toEqual([
      ['Arrival', 'studio', ['nell'], 'The road ran out at the shore.'],
      ['The archive', 'archive', ['kit'], 'Boxes to the ceiling.'],
      ['The kiln', null, [], 'Ash, still warm.'],
    ])
    // On the page, the header is drawn as one, not left as a line of prose.
    await expect(page.locator('.cm-draft-header', { hasText: 'Kit Fenwick' })).toHaveCount(1)
    await expect(page.locator('.cm-line', { hasText: '[#The Archive' })).toHaveCount(0)
  })

  test('pasted headers are read in the order of the page, so a hand-off ends in one pair of hands (run 11)', async ({ page }) => {
    const worldId = await book(page, { ledger: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      '## The archive',
      '[#The Studio @@Nell Garrity ^The Ledger:@Nell Garrity]',
      '',
      'She took the book down.',
      '',
      '## The kiln',
      '[#The Studio @@Nell Garrity @@Kit Fenwick ^The Ledger:@Kit Fenwick]',
      '',
      'She gave it to him.',
    ].join('\n'))

    /** Who holds the ledger at each scene: each person's last record at or before it, as the app resolves them. */
    const holders = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const events = (await db.events.toArray()).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
      const states = (await db.characterSnapshots.toArray()).sort((a, b) => (a.sortKey as number) - (b.sortKey as number))
      return events.map((e, i) => {
        const upTo = new Set(events.slice(0, i + 1).map((x) => x.id))
        const last = new Map<string, Record<string, unknown>>()
        for (const s of states) if (upTo.has(s.eventId as string)) last.set(s.characterId as string, s)
        return [e.title, [...last.values()].filter((s) => (s.inventoryItemIds as string[]).includes('ledger')).map((s) => s.characterId)]
      })
    })
    // Read bottom-up, the kiln's hand-off came first, and the archive's then gave the ledger to Nell from there on: two hands at the kiln.
    await expect.poll(holders, { timeout: 30_000 }).toEqual([['Arrival', []], ['The archive', ['nell']], ['The kiln', ['kit']]])
    // And the page still says what each header said.
    await expect(page.locator('.cm-draft-header', { hasText: 'Items: ^The Ledger:@Nell Garrity' })).toHaveCount(1)
    await expect(page.locator('.cm-draft-header', { hasText: 'Items: ^The Ledger:@Kit Fenwick' })).toHaveCount(1)
  })

  test('what a paste made is said beside what its headers name and the world has not got, with the buttons to make it (run 11)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      '## The tower',
      '[#The Tower @@Kit Fenwick]',
      '',
      'Up the stair.',
      '',
      '## The belfry',
      '[#The Belfry @@Nell Garrity]',
      '',
      'The bells.',
      '',
      '## The yard',
      '[#The Studio @@Nell Garrity]',
      '',
      'Down again.',
    ].join('\n'))

    const status = page.getByRole('status').filter({ hasText: 'The pasted headings made 3 scenes.' })
    await expect(status).toBeVisible({ timeout: 30_000 })
    // The two that wait are named; the one that was applied is not.
    await expect(status).toContainText('The headers of “The tower” and “The belfry” were not applied, and wait as typed.')
    // And the note on the last of them, with its button, without anything typed first.
    await expect(status).toContainText('Nothing in this world is called “The Belfry”')
    await status.getByRole('button', { name: 'Create “The Belfry” as a place' }).click()
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      return (await db.locationMarkers.toArray()).map((m) => m.name).sort()
    }), { timeout: 10_000 }).toEqual(['The Archive', 'The Belfry', 'The Studio'])
  })

  test('a new person on a pasted Characters line can be made from the note, and the line is then applied (run 11)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, ['## The archive', '[#The Archive @@Kit Fenwick @@Lucia Zen]', '', 'Boxes to the ceiling.'].join('\n'))

    const cast = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const people = await db.characters.toArray()
      const scene = (await db.events.toArray()).find((e) => e.title === 'The archive')
      return (scene?.involvedCharacterIds as string[] | undefined)?.map((id) => people.find((c) => c.id === id)?.name) ?? null
    })
    const status = page.getByRole('status')
    await expect(status).toContainText('Nothing in this world is called “Lucia Zen”', { timeout: 30_000 })
    // The line waits on her: Kit, who exists, is not in the cast yet.
    expect(await cast()).toEqual([])
    await status.getByRole('button', { name: 'Create “Lucia Zen” as a character' }).click()
    await expect.poll(cast, { timeout: 10_000 }).toEqual(['Kit Fenwick', 'Lucia Zen'])
    await expect(status.getByRole('button', { name: /as a character/ })).toHaveCount(0)
  })

  test('on opening, the note is planned again against the records, and names its scene (run 11)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    const open = async () => {
      await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
      await settle(page)
      await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    }
    await open()
    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await paste(page, [
      '## Across the courtyard', '[#The Molo @@Kit Fenwick]', '', 'Over the stones.', '',
      '## The bell', '[#The Belfry @@Nell Garrity]', '', 'It rang.',
    ].join('\n'))
    const status = page.getByRole('status')
    await expect(status).toContainText('The headers of “Across the courtyard” and “The bell” were not applied', { timeout: 30_000 })

    // The Molo is made elsewhere — on Maps, say — while its line waits.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.locationMarkers.add({ id: 'molo', worldId: id, mapLayerId: null, name: 'The Molo', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    }, worldId)
    await page.reload({ waitUntil: 'load' })
    await open()

    // The scene still missing something is the one spoken of, by name; the one whose place now exists is not.
    await expect(status).toContainText('In “The bell”: Nothing in this world is called “The Belfry”', { timeout: 20_000 })
    await expect(status).not.toContainText('The Molo')
    await expect(status.getByRole('button', { name: 'Create “The Belfry” as a place' })).toBeVisible()
  })

  test('pasted scenes keep their header blocks out of their prose, and a reload straight after reads them (Part 6, A1)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    const open = async () => {
      await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
      await settle(page)
      await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    }
    await open()
    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    const block = (place: string, ...people: string[]) => ['[', `  Place: #${place}`, `  Characters: ${people.map((p) => `@@${p}`).join(' ')}`, ']']
    await paste(page, [
      '## The archive', ...block('The Archive', 'Kit Fenwick'), '', 'Boxes to the ceiling.', '',
      '## The kiln', ...block('The Studio', 'Nell Garrity', 'Kit Fenwick'), '', 'Ash, still warm.', '',
      '## The yard', ...block('The Archive', 'Nell Garrity'), '', 'Down again.',
    ].join('\n'))

    const scenes = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const texts = await db.sceneTexts.toArray()
      return (await db.events.toArray()).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
        .map((e) => [e.title, e.locationMarkerId, e.involvedCharacterIds, texts.find((t) => t.eventId === e.id)?.text ?? ''])
    })
    /*
      Closed the moment the paste is made — as a writer's script that closes its
      browser next does — while its headers are still to be read, one at a time.
      They used to be read only by the page that pasted them, and written into
      their scenes' prose meanwhile: back from the reload, each block was prose
      and nothing it said was recorded.
    */
    await expect(page.getByText('The pasted headings made 3 scenes.', { exact: false })).toBeVisible({ timeout: 20_000 })
    // At that moment: no prose holds a block, and every pasted header is either remembered or already written.
    const now = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const kept = JSON.parse(localStorage.getItem('kathala-kept-headers') ?? '{}') as Record<string, unknown>
      const texts = await db.sceneTexts.toArray()
      return (await db.events.toArray()).filter((e) => e.title !== 'Arrival').map((e) => ({
        title: e.title,
        held: e.id as string in kept || !!e.locationMarkerId,
        block: /Place:|Characters:|^\[|^\]/m.test(String(texts.find((t) => t.eventId === e.id)?.text ?? '')),
      }))
    })
    expect([...now].sort((a, b) => String(a.title).localeCompare(String(b.title))))
      .toEqual(['The archive', 'The kiln', 'The yard'].map((title) => ({ title, held: true, block: false })))
    await page.reload({ waitUntil: 'load' })
    await open()
    // The headers are read when the page comes back, and no block is left in any prose.
    await expect.poll(scenes, { timeout: 30_000 }).toEqual([
      ['Arrival', 'studio', ['nell'], 'The road ran out at the shore.'],
      ['The archive', 'archive', ['kit'], 'Boxes to the ceiling.'],
      ['The kiln', 'studio', ['nell', 'kit'], 'Ash, still warm.'],
      ['The yard', 'archive', ['nell'], 'Down again.'],
    ])
    await expect(page.locator('.cm-draft-header', { hasText: 'Kit Fenwick' })).toHaveCount(2)
  })

  test('a pasted scene\'s header is remembered until what it says is written, never neither (Part 6, A1)', async ({ page }) => {
    const worldId = await book(page, { cast: true })
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    /*
      Watched from before the paste until its headers are read: at every moment
      each pasted scene either has its line remembered, or its place written.
      The line is read first and the record after, so a line forgotten only
      once its record is written can never be caught without either. Forgotten
      before the writes, a page closed in that gap lost both.
    */
    await page.evaluate(() => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const w = window as unknown as { gaps: string[]; watching: boolean }
      w.gaps = []
      w.watching = true
      const titles = new Set(['Shelf one', 'Shelf two', 'Shelf three', 'Shelf four'])
      void (async () => {
        while (w.watching) {
          const kept = JSON.parse(localStorage.getItem('kathala-kept-headers') ?? '{}') as Record<string, unknown>
          for (const e of await db.events.toArray()) {
            if (titles.has(e.title as string) && !(e.id as string in kept) && !e.locationMarkerId) w.gaps.push(e.title as string)
          }
          await new Promise((r) => setTimeout(r, 1))
        }
      })()
    })
    await paste(page, ['Shelf one', 'Shelf two', 'Shelf three', 'Shelf four'].flatMap((t) => [
      `## ${t}`, '[', '  Place: #The Archive', '  Characters: @@Kit Fenwick', ']', '', `${t} prose.`, '',
    ]).join('\n'))
    const placed = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      return (await db.events.toArray()).filter((e) => (e.title as string).startsWith('Shelf') && e.locationMarkerId === 'archive').length
    })
    // Paired: the headers are all read, so the watch saw each go from remembered to written.
    await expect.poll(placed, { timeout: 30_000 }).toBe(4)
    const gaps = await page.evaluate(() => { const w = window as unknown as { gaps: string[]; watching: boolean }; w.watching = false; return w.gaps })
    expect(gaps).toEqual([])
  })

  test('pasted into a scene card they stay text, and the card says where they would become scenes', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Arrival', exact: true }).click()
    const prose = page.getByRole('textbox', { name: 'Scene prose' }).first()
    await expect(prose).toBeVisible({ timeout: 20_000 })
    const hint = page.getByText(/lines stay text in a scene/)

    // Plain prose: nothing to say.
    await prose.click()
    await page.keyboard.press('Control+End')
    await page.evaluate((t) => navigator.clipboard.writeText(t), '\n\nFirst light. #nofilter')
    await page.keyboard.press('Control+v')
    await expect(prose).toHaveValue(/First light\. #nofilter$/)
    await expect(hint).toHaveCount(0)

    // A scene heading: kept as typed, and said.
    await page.evaluate((t) => navigator.clipboard.writeText(t), '\n\n## The archive\n\nBoxes.')
    await page.keyboard.press('Control+v')
    await expect(prose).toHaveValue(/## The archive\n\nBoxes\.$/)
    await expect(hint).toBeVisible()
  })
})
