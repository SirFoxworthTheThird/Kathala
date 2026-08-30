import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * WB-3. The populated Writer's Brief states a faction under each character in
 * the scene, and then again in **Factions in scene** with its members listed.
 * In a three-person scene where all three are one household, that is the same
 * fact four times — measured on the shipped *Philosopher's Stone* at Ch.1.
 *
 * The section groups the cast into sides. With one side and everyone on it,
 * there is no grouping left to do, so it stands down. It comes back the moment
 * a second faction appears, or one faction covers only some of the people
 * present — which is when its membership list is news rather than an echo.
 *
 * Each test pairs the absence with the presence: the per-character badges stay
 * throughout, so "the section is gone" can never be satisfied by a brief that
 * has stopped mentioning factions at all.
 */

interface Seed {
  /** characterId → factionId, for the three characters in the scene. */
  members: Record<string, string>
  factions: { id: string; name: string }[]
  /** Characters in the scene; defaults to all three. */
  cast?: string[]
}

async function briefFor(page: Page, seed: Seed) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ id, seed }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'Privet Drive', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })

    const cast = seed.cast ?? ['vernon', 'petunia', 'dudley']
    await db.characters.bulkAdd(['vernon', 'petunia', 'dudley'].map((cid) => ({
      id: cid, worldId: id, name: cid[0].toUpperCase() + cid.slice(1), aliases: [],
      description: '', portraitImageId: null, tags: [], isAlive: true, color: null,
      createdAt: now, updatedAt: now,
    })))
    await db.factions.bulkAdd(seed.factions.map((f, i) => ({
      id: f.id, worldId: id, name: f.name, description: '',
      color: ['#22c55e', '#f59e0b'][i] ?? '#94a3b8', createdAt: now, updatedAt: now,
    })))
    await db.factionMemberships.bulkAdd(Object.entries(seed.members).map(([cid, fid], i) => ({
      id: `fm${i}`, worldId: id, factionId: fid, characterId: cid,
      role: '', startEventId: null, endEventId: null, createdAt: now, updatedAt: now,
    })))
    // The Brief lists characters from their *snapshots* at the moment, not from
    // the scene's cast list — the delta model, same as everywhere else. Without
    // these it says "No character states recorded for this event".
    await db.characterSnapshots.bulkAdd(cast.map((cid, i) => ({
      id: `cs${i}`, worldId: id, characterId: cid, eventId: 'ev1', sortKey: 10_000,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'At home.',
      travelModeId: null, createdAt: now, updatedAt: now,
    })))
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl',
      title: 'A Peculiar Day', description: '', sortOrder: 0, tags: [],
      locationMarkerId: null, involvedCharacterIds: cast, mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, seed })

  await page.goto(`/#/worlds/${worldId}/timeline/ch1`)
  await settle(page)
  await page.getByTitle("Writer's Brief").click()

  // With no cursor the panel lists every scene and fills the brief in around
  // whichever you pick — the act WB-1 put here instead of a nudge. Using it is
  // both the documented flow and the reliable way to get a briefed moment.
  const dialog = page.getByRole('dialog', { name: "Writer's Brief" })
  await expect(dialog).toBeVisible()
  const pick = dialog.getByRole('button', { name: 'A Peculiar Day' })
  if (await pick.count()) await pick.first().click()
  await expect(dialog.getByText('A Peculiar Day').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(800)
  return worldId
}

const brief = (page: Page) => page.getByRole('dialog', { name: "Writer's Brief" })
const sectionHeading = (page: Page) => brief(page).getByText('Factions in scene')

test.describe("The Brief's faction section groups, or stands down", () => {
  test.describe.configure({ timeout: 180_000 })

  test('one faction covering everyone present: no section, badges kept', async ({ page }) => {
    await briefFor(page, {
      factions: [{ id: 'f1', name: 'The Dursley Household' }],
      members: { vernon: 'f1', petunia: 'f1', dudley: 'f1' },
    })

    // The characters are here and each still says which side they are on…
    await expect(brief(page).getByText('Vernon').first()).toBeVisible()
    await expect(brief(page).getByText('The Dursley Household').first()).toBeVisible()

    // …and the section that would say it a fourth time is gone.
    await expect(sectionHeading(page)).toHaveCount(0)
  })

  test('two factions: the section comes back, because now it groups', async ({ page }) => {
    await briefFor(page, {
      factions: [{ id: 'f1', name: 'The Dursley Household' }, { id: 'f2', name: 'The Order' }],
      members: { vernon: 'f1', petunia: 'f1', dudley: 'f2' },
    })

    await expect(sectionHeading(page)).toBeVisible()
    await expect(brief(page).getByText('The Order').first()).toBeVisible()
  })

  test('one faction covering only some of them: the section comes back', async ({ page }) => {
    // Dudley is in the scene and in no faction, so "who is in the Household"
    // is news rather than a restatement of the cast.
    await briefFor(page, {
      factions: [{ id: 'f1', name: 'The Dursley Household' }],
      members: { vernon: 'f1', petunia: 'f1' },
    })

    await expect(sectionHeading(page)).toBeVisible()
    await expect(brief(page).getByText('Vernon, Petunia')).toBeVisible()
  })
})
