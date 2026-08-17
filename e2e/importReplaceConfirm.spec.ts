import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Importing a `.pwk` **replaces** the world it belongs to: `importWorldData`
 * deletes every record for the incoming world's id before writing the file's
 * own. That is right for restoring a backup and catastrophic for picking the
 * wrong file, and it happened with no confirm, no toast, and no undo — the day's
 * writing simply was not there any more. The Library has guarded exactly this
 * case for a long time, on the door people use to download someone else's book;
 * the door they use for their own backups did not.
 *
 * The two tests are a pair on purpose. A dialog that always appears would pass
 * the first one on its own, so the second imports a file for a world that is not
 * here and requires that nothing is asked at all.
 */

const TODAYS_WORK = 'TODAY’S WORK — do not lose me'

async function worldWithTodaysWork(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, title }: { id: string; title: string }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title,
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, title: TODAYS_WORK })
  return worldId
}

/**
 * A `.pwk` for `worldId` holding none of the local records — i.e. yesterday's
 * export, from before today's scene existed. Importing it is what deletes the
 * scene.
 */
function exportFileFor(worldId: string, name: string) {
  const now = Date.now()
  return JSON.stringify({
    version: 1,
    type: 'full',
    exportedAt: now,
    world: { id: worldId, name, description: 'Yesterday’s copy', createdAt: now, updatedAt: now },
    mapLayers: [], locationMarkers: [], characters: [], items: [],
    characterSnapshots: [], characterMovements: [], itemPlacements: [],
    locationSnapshots: [], itemSnapshots: [], relationships: [],
    relationshipSnapshots: [], timelines: [], chapters: [], events: [], blobs: [],
  })
}

/** Titles of every event in the database, whichever world they belong to. */
const eventTitles = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { events: { toArray: () => Promise<Array<{ title: string }>> } }
  return (await db.events.toArray()).map((e) => e.title)
})

/** Hand the app a file exactly as the picker would. */
async function chooseImportFile(page: Page, contents: string) {
  // Located by attribute rather than by role: the input is `class="hidden"`,
  // which is how the app keeps the picker behind the "Choose file…" step.
  await page.locator('input[aria-label="Import world file"]').setInputFiles({
    name: 'highbarrow.pwk',
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  })
}

test.describe('Importing over a world you already have asks first', () => {
  test.describe.configure({ timeout: 240_000 })

  test('it names the world, and backing out changes nothing', async ({ page }) => {
    const worldId = await worldWithTodaysWork(page)
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    expect(await eventTitles(page)).toEqual([TODAYS_WORK])

    await chooseImportFile(page, exportFileFor(worldId, 'Highbarrow'))

    // It asks, by name — "this will replace the existing world" would not tell
    // you whether the existing world is the one you spent this morning in.
    const confirm = page.getByRole('dialog')
    await expect(confirm).toBeVisible()
    await expect(confirm.getByText(/Replace your copy of .*Highbarrow/)).toBeVisible()

    // Nothing has happened yet.
    expect(await eventTitles(page)).toEqual([TODAYS_WORK])

    // Declining leaves the world alone — the half that stops "a dialog
    // appeared" from passing for a dialog that deletes regardless.
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForTimeout(1200)
    expect(await eventTitles(page)).toEqual([TODAYS_WORK])
    await expect(page.getByRole('button', { name: 'New World' })).toBeVisible()

    // And accepting still does what it always did: the file wins.
    await chooseImportFile(page, exportFileFor(worldId, 'Highbarrow'))
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
    await expect.poll(() => eventTitles(page), { timeout: 30_000 }).toEqual([])
    await expect(page).toHaveURL(new RegExp(`#/worlds/${worldId}`))
  })

  test('and a world that is not here yet imports without a question', async ({ page }) => {
    await worldWithTodaysWork(page)
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(1200)

    await chooseImportFile(page, exportFileFor('w-somewhere-else', 'The Salt Road'))

    /*
      Straight in: it lands on empty space and destroys nothing, so nothing is
      asked. The navigation is the assertion — a confirm holds the import until
      it is answered, so arriving at the world at all is only possible if no
      question was put. Checking for the absence of a dialog *after* the
      navigation would prove nothing, since it would have closed anyway.
    */
    await expect(page).toHaveURL(/#\/worlds\/w-somewhere-else/, { timeout: 30_000 })
    // Both worlds are here now, and this morning's scene is untouched.
    expect(await eventTitles(page)).toEqual([TODAYS_WORK])
  })
})
