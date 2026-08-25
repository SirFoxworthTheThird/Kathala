import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav, dismissFirstRunGuide } from './helpers/nav'

/**
 * The entry cost both blind writer runs named, and the only structural
 * objection left in either verdict: *"Recording one character's position in one
 * scene costs seven interactions from the Characters screen"*, *"six to eight
 * clicks across three screens"* — *"a six-scene chapter with four people is a
 * morning."*
 *
 * The Character States panel already listed exactly the gap, a row per cast
 * member with nothing recorded saying *"no state recorded — record it"*, and
 * answered it by sending you to that character's own page. It takes the answer
 * itself now. The write's shape is unit-tested in
 * `src/lib/__tests__/quickState.test.ts`; this is about doing it from here.
 */

const SCENE = 'The ninth bell does not ring'
const EARLIER = 'Low water'

async function chapterWithACastGap(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ninth Bell')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, scene, earlier]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.mapLayers.add({ id: 'map-a', worldId: id, name: 'The City', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk-cistern', worldId: id, mapLayerId: 'map-a', name: 'The Gullbone Cistern', description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk-tower', worldId: id, mapLayerId: 'map-a', name: 'Hollowmark Tower', description: '', x: 2, y: 2, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Adze', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })

    const ev = (eid: string, title: string, sortOrder: number, cast: string[]) => ({
      id: eid, worldId: id, chapterId: 'ch1', timelineId: 'tl', title,
      description: '', sortOrder, tags: [], locationMarkerId: null,
      involvedCharacterIds: cast, mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    /*
      The earlier scene has his state but not his cast, and the later one the
      reverse. That is deliberate on both counts: it leaves exactly one gap row
      to click, and it is the distinction the app draws anyway — recording where
      somebody is says where they are, not that they are in the scene.
    */
    await db.events.add(ev('ev0', earlier, 0, []))
    await db.events.add(ev('ev1', scene, 1, ['corvin']))

    // Recorded at the *earlier* scene only, so the later one is a gap and the
    // prefill has somewhere to come from.
    await db.characterSnapshots.add({
      id: 's0', worldId: id, characterId: 'corvin', eventId: 'ev0', isAlive: true,
      currentLocationMarkerId: 'mk-cistern', currentMapLayerId: 'map-a',
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'Waiting.',
      travelModeId: null, sortKey: 1, createdAt: now, updatedAt: now,
    })
  }, [worldId, SCENE, EARLIER])
  return worldId
}

const snapshotAt = (page: Page, eventId: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { toArray: () => Promise<Array<{ eventId: string; currentLocationMarkerId: string | null; currentMapLayerId: string | null; statusNotes: string; isAlive: boolean }>> } }
  return (await db.characterSnapshots.toArray()).find((s) => s.eventId === eid) ?? null
}, eventId)

test.describe('Recording state from the scene', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the gap row takes the answer instead of sending you away', async ({ page }) => {
    const worldId = await chapterWithACastGap(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settleNav(page)

    // The seed landed: state at the earlier scene, none at the later one. Two
    // gap rows once meant the earlier snapshot had not been written at all, and
    // without this check the prefill assertions below could pass on nothing.
    expect(await snapshotAt(page, 'ev0')).not.toBeNull()
    expect(await snapshotAt(page, 'ev1')).toBeNull()

    const gap = page.getByRole('button', { name: /Corvin Adze no state recorded/ })
    await expect(gap).toBeVisible({ timeout: 30_000 })

    await gap.click()

    // Prefilled from the earlier scene, and it says so rather than looking like
    // a record that already exists here.
    await expect(page.getByText(/Filled in from where they were last recorded/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Where.*Gullbone Cistern/ })).toBeVisible()

    // Change where he is and add the note for this moment.
    await page.getByRole('button', { name: /Where.*Gullbone Cistern/ }).click()
    await page.getByRole('option', { name: 'Hollowmark Tower' }).click()
    await page.getByRole('textbox', { name: 'Note', exact: true }).fill('At the top of the stair.')
    await page.getByRole('button', { name: 'Record state' }).click()

    // Written at *this* scene — not the one the prefill came from.
    await expect.poll(() => snapshotAt(page, 'ev1'), { timeout: 15_000 }).toMatchObject({
      eventId: 'ev1',
      currentLocationMarkerId: 'mk-tower',
      currentMapLayerId: 'map-a',
      statusNotes: 'At the top of the stair.',
      isAlive: true,
    })

    // The earlier record is untouched — the bug this app has hit four times.
    expect(await snapshotAt(page, 'ev0')).toMatchObject({
      currentLocationMarkerId: 'mk-cistern',
      statusNotes: 'Waiting.',
    })

    // And the panel now shows him as recorded rather than as a gap, without
    // ever having left the chapter.
    await expect(page).toHaveURL(/timeline\/ch1/)
    await expect(page.getByRole('button', { name: /Corvin Adze no state recorded/ })).toHaveCount(0)
  })

  test('and the full editor is still one click away', async ({ page }) => {
    const worldId = await chapterWithACastGap(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settleNav(page)

    await page.getByRole('button', { name: /Corvin Adze no state recorded/ }).click()
    await page.getByRole('button', { name: 'Full editor' }).click()

    // Everything the quick form does not ask for lives there.
    await expect(page).toHaveURL(/characters\/corvin\?tab=state/)
    await expect(page.getByRole('main').getByLabel('Inventory Notes')).toBeVisible({ timeout: 30_000 })
  })
})
