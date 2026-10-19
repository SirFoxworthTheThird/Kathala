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
