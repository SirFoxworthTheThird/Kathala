import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * W-3. Knowledge's three "when" pickers listed every scene in the world in
 * database order — which for Dexie is by primary key, and so has no relation to
 * the story. On the shipped *Dracula* that put chapters 1 to 3 at positions 12,
 * 23, 34, 45, 56, 67, 78 and 84 of an 84-option list.
 *
 * The screen already computed the right order two hundred lines above, for
 * "known as of the cursor" to be decidable, and handed the pickers the unsorted
 * array instead. Every other event picker in the app sorts.
 *
 * The seed below stores the scenes deliberately out of order, because a fixture
 * that happens to be created in reading order cannot tell a sorted list from an
 * unsorted one — the trap this suite keeps re-learning.
 */

// Ids ascend in *declaration* order, which is deliberately not reading order.
// Dexie returns rows by primary key, so this is what makes the stored order
// differ from the story's — ids like `ev-c1a` would have sorted themselves into
// reading order by accident and the fixture could not have told the two apart.
const SCENES = [
  { id: 'ev-1', chapter: 3, sortOrder: 1, title: 'The crypt at dawn' },
  { id: 'ev-2', chapter: 1, sortOrder: 0, title: 'A letter arrives' },
  { id: 'ev-3', chapter: 2, sortOrder: 1, title: 'The harbour at night' },
  { id: 'ev-4', chapter: 3, sortOrder: 0, title: 'Down the stone stair' },
  { id: 'ev-5', chapter: 1, sortOrder: 1, title: 'The reply is burned' },
  { id: 'ev-6', chapter: 2, sortOrder: 0, title: 'Passage booked' },
]

/** Reading order: by chapter, then by position within it. */
const EXPECTED = [...SCENES]
  .sort((a, b) => (a.chapter - b.chapter) || (a.sortOrder - b.sortOrder))
  .map((s) => `Ch.${s.chapter} — ${s.title}`)

async function worldWithAFact(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, scenes }: { id: string; scenes: typeof SCENES }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2, 3].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.add({
      id: 'rhun', worldId: id, name: 'Rhun Aldemar', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd(scenes.map((s) => ({
      id: s.id, worldId: id, chapterId: `ch${s.chapter}`, timelineId: 'tl', title: s.title,
      description: '', sortOrder: s.sortOrder, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [],
      motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })))
    await db.knowledgeFacts.add({
      id: 'fact', worldId: id, title: 'The letter was never sent', description: '',
      tags: [], originEventId: null, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, scenes: SCENES })

  await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: /The letter was never sent/ }).first().click()
  await settle(page)
  return worldId
}

/**
 * Scene titles offered by the picker that is currently open, in listed order.
 *
 * `:visible` matters: all three selects keep their option lists in the DOM, so
 * an unscoped `[role="option"]` returns 18 entries — every list at once, in an
 * order that belongs to no single picker.
 */
const options = async (page: Page) =>
  (await page.locator('[role="option"]:visible').allTextContents())
    .map((t) => t.trim())
    .filter((t) => t.startsWith('Ch.'))

test.describe("Knowledge's pickers list scenes in reading order", () => {
  test.describe.configure({ timeout: 180_000 })

  /*
    One picker, opened once. The three selects all read the same array, and that
    array's order is `eventsInReadingOrder`, which has its own unit tests — so
    what is left to check in a browser is that the screen hands the pickers the
    sorted list rather than the raw one, and a single picker settles that.

    Deliberately not a loop over all three: they render their option lists into
    portals that stay in the DOM, so opening and closing them in turn fights an
    overlay for no extra coverage.
  */
  test('the "becomes true at" picker is in story order, not database order', async ({ page }) => {
    await worldWithAFact(page)

    // The fixture is only worth anything if the stored order differs from the
    // reading order — otherwise a sorted and an unsorted list look identical.
    const stored = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { toArray: () => Promise<{ title: string }[]> } }
      return (await db.events.toArray()).map((e) => e.title)
    })
    const readingOrder = EXPECTED.map((l) => l.replace(/^Ch\.\d+ — /, ''))
    expect(stored, 'the seed must not already be in reading order').not.toEqual(readingOrder)

    // The trigger is a plain button, not a combobox, and shows this while unset.
    await page.getByRole('button', { name: 'True from the start' }).click()
    await settle(page)

    expect(await options(page)).toEqual(EXPECTED)
  })
})
