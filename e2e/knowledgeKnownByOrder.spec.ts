import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * F-8. A fact's **Known by** list came back in Dexie's order — by primary key —
 * so a secret learned in chapters 1, 2 and 3 read *Ch.3, Ch.1, Ch.2*. It is the
 * same fault **WRUN-3** fixed for the three pickers on this very screen, in the
 * list sitting beside them, and the screen has computed the right order all
 * along for "known as of the cursor" to be decidable.
 *
 * Reading order matters here more than in a picker: this list is the answer to
 * *who knew, and when did each of them find out* — a sequence, read top to
 * bottom.
 */

/*
  Ids ascend in declaration order, which is deliberately **not** reading order,
  and the reveals are seeded the same way. A fixture created in story order
  cannot tell a sorted list from an unsorted one — the trap this suite keeps
  re-learning.
*/
const SCENES = [
  { id: 'ev-1', chapter: 3, sortOrder: 0, title: 'The crypt at dawn' },
  { id: 'ev-2', chapter: 1, sortOrder: 0, title: 'A letter arrives' },
  { id: 'ev-3', chapter: 2, sortOrder: 0, title: 'The harbour at night' },
]

const CHARACTERS = [
  { id: 'ch-a', name: 'Ilva Marrow' },
  { id: 'ch-b', name: 'Teodor Sarn' },
  { id: 'ch-c', name: 'Kel Anders' },
]

/** Who learns it where — again stored out of reading order. */
const REVEALS = [
  { id: 'rv-1', characterId: 'ch-a', eventId: 'ev-1' }, // Ch.3
  { id: 'rv-2', characterId: 'ch-b', eventId: 'ev-2' }, // Ch.1
  { id: 'rv-3', characterId: 'ch-c', eventId: 'ev-3' }, // Ch.2
]

/* What the raw table gives back, which is what the fixture has to differ from. */
const STORED_ORDER = ['Ch.3 — The crypt at dawn', 'Ch.1 — A letter arrives', 'Ch.2 — The harbour at night']

async function worldWithAKnownFact(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (seed: {
    id: string
    scenes: typeof SCENES
    characters: typeof CHARACTERS
    reveals: typeof REVEALS
  }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    const id = seed.id
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2, 3].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.bulkAdd(seed.characters.map((c) => ({
      id: c.id, worldId: id, name: c.name, aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })))
    await db.events.bulkAdd(seed.scenes.map((s) => ({
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
    await db.knowledgeReveals.bulkAdd(seed.reveals.map((r) => ({
      id: r.id, worldId: id, factId: 'fact', characterId: r.characterId,
      eventId: r.eventId, note: '', createdAt: now, updatedAt: now,
    })))
  }, { id: worldId, scenes: SCENES, characters: CHARACTERS, reveals: REVEALS })

  await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /The letter was never sent/ }).first().click()
  await page.waitForTimeout(1000)
  return worldId
}

test.describe('Known by lists in reading order', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a fact learned across three chapters reads Ch.1, Ch.2, Ch.3', async ({ page }) => {
    await worldWithAKnownFact(page)

    /*
      The fixture only proves something if the stored order differs from the
      reading order. Asserting it here rather than trusting the ids means a
      later edit that accidentally sorts the seed fails loudly instead of
      quietly making the real assertion vacuous.
    */
    const stored = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        knowledgeReveals: { toArray: () => Promise<Array<{ eventId: string }>> }
        events: { toArray: () => Promise<Array<{ id: string; title: string; chapterId: string }>> }
      }
      const events = new Map((await db.events.toArray()).map((e) => [e.id, e]))
      return (await db.knowledgeReveals.toArray()).map((r) => {
        const e = events.get(r.eventId)!
        return `Ch.${e.chapterId.replace('ch', '')} — ${e.title}`
      })
    })
    expect(stored, 'the seed must not already be in reading order').toEqual(STORED_ORDER)

    /*
      Reached through the section's own heading rather than by text anywhere on
      the page: these scene labels also fill the two "when" pickers on this same
      screen, and those keep their option lists in the DOM whether open or not.
    */
    const heading = page.locator('p').filter({ hasText: /Known by \(3\)/ })
    await expect(heading).toBeVisible()
    // Each listed knower is the div that holds a Remove button, which nothing
    // else on this screen has.
    const rows = page.locator('div:has(> button[title="Remove"])')
    await expect(rows).toHaveCount(3)

    /*
      Name and scene read off the same row, so the pair is asserted together.
      Sorting the labels while leaving the names where they were would produce a
      list that looks right and attributes every secret to the wrong person —
      and two separate assertions could not tell that from a fix.
    */
    const listed = await rows.evaluateAll((els) => els.map((el) => {
      const spans = el.querySelectorAll('span')
      return `${spans[0]?.textContent?.trim()} · ${spans[1]?.textContent?.trim()}`
    }))
    expect(listed).toEqual([
      'Teodor Sarn · Ch.1 — A letter arrives',
      'Kel Anders · Ch.2 — The harbour at night',
      'Ilva Marrow · Ch.3 — The crypt at dawn',
    ])
  })
})
