import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

test('reading state follows a death report, its correction, and rewind without adding an absent person to the cast', async ({ page }, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('A mistaken report')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb: Record<string, {
      add: (record: unknown) => Promise<unknown>
      bulkAdd: (records: unknown[]) => Promise<unknown>
    }> }).__pwdb
    const stamp = { worldId: id, createdAt: Date.now(), updatedAt: Date.now() }
    await db.timelines.add({ ...stamp, id: 'reading', name: 'Reading order', description: '', color: '#795b37', dayOffset: 0 })
    await db.chapters.add({ ...stamp, id: 'chapter', timelineId: 'reading', number: 1, title: 'The report and return', synopsis: '', notes: '', wordGoal: null })
    await db.characters.add({ ...stamp, id: 'athelstane', name: 'Athelstane', aliases: [], description: 'The lord of Coningsburgh.', portraitImageId: null, tags: [], isAlive: true, color: null })
    await db.events.bulkAdd(['Before the report', 'The household mourns', 'The door opens', 'After the return'].map((title, sortOrder) => ({
      ...stamp, id: `event-${sortOrder}`, chapterId: 'chapter', timelineId: 'reading', title,
      description: '', sortOrder, tags: [], locationMarkerId: null,
      involvedCharacterIds: sortOrder === 0 || sortOrder === 2 ? ['athelstane'] : [],
      mentionedCharacterIds: sortOrder === 1 ? ['athelstane'] : [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: 0, inWorldTime: sortOrder, structureBeat: null, status: 'draft', povCharacterId: null, tension: 1, isFlashback: false,
    })))
    await db.characterSnapshots.bulkAdd([0, 2].map(n => ({
      ...stamp, id: `snapshot-${n}`, characterId: 'athelstane', eventId: `event-${n}`, sortKey: 1 + n / 1_000_000,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', travelModeId: null,
      statusNotes: n === 0 ? 'Struck down during the escape.' : 'Appears alive and explains his imprisonment.',
    })))
    await db.knowledgeFacts.add({ ...stamp, id: 'mistaken-report', title: 'Athelstane is reported dead',
      description: 'The household mourns Athelstane as dead.', tags: ['offstage-death:athelstane'], readerLearnsAtEventId: 'event-1', originEventId: 'event-1' })
  }, worldId)

  // Choose the first cursor through the app before switching this fixture to reading.
  await page.goto(`/#/worlds/${worldId}/manuscript`)
  await settle(page)
  await page.getByTitle('Before the report', { exact: true }).first().click()
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb: { worlds: { update: (id: string, change: unknown) => Promise<unknown> } } }).__pwdb
    await db.worlds.update(id, { readingMode: true })
  }, worldId)
  await page.goto(`/#/worlds/${worldId}/characters/athelstane`)
  await page.getByRole('tab', { name: 'Current State' }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText('Alive', { exact: true })).toBeVisible()
  await expect(panel).toContainText('Struck down during the escape.')
  await page.getByRole('button', { name: 'Next moment', exact: true }).click()
  await expect(panel.getByText('Deceased', { exact: true })).toBeVisible()
  await expect(panel).toContainText('The household mourns Athelstane as dead.')
  await page.screenshot({ path: testInfo.outputPath('reported-dead.png') })
  await page.getByRole('button', { name: 'Next moment', exact: true }).click()
  await expect(panel.getByText('Alive', { exact: true })).toBeVisible()
  await expect(panel).toContainText('Appears alive and explains his imprisonment.')
  await page.screenshot({ path: testInfo.outputPath('corrected-alive.png') })
  await page.getByRole('button', { name: 'Next moment', exact: true }).click()
  await expect(panel.getByText('Alive', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous moment', exact: true }).click()
  await page.getByRole('button', { name: 'Previous moment', exact: true }).click()
  await expect(panel.getByText('Deceased', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous moment', exact: true }).click()
  await expect(panel.getByText('Alive', { exact: true })).toBeVisible()
  const stored = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb: {
      characterSnapshots: { toArray: () => Promise<Array<{ eventId: string }>> }
      events: { get: (id: string) => Promise<{ involvedCharacterIds: string[]; mentionedCharacterIds: string[] }> }
    } }).__pwdb
    return { snapshots: await db.characterSnapshots.toArray(), report: await db.events.get('event-1') }
  })
  expect(stored.snapshots.map(s => s.eventId).sort()).toEqual(['event-0', 'event-2'])
  expect(stored.report.involvedCharacterIds).toEqual([])
  expect(stored.report.mentionedCharacterIds).toEqual(['athelstane'])
  expect(pageErrors).toEqual([])
})
