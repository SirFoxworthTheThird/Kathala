import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Two findings from the 19 Aug writer run, both about a warning that knew more
 * than it said.
 *
 * **W19-6** — a scene whose `povCharacterId` names a character that is not
 * there was reported as *"POV \"?\" is not in the cast"*: the wrong fault, over
 * a remedy — *add them to Characters* — that cannot be carried out, because
 * "them" does not exist. On *The Name of the Wind* that was **128 of 161
 * warnings**, one unactionable row repeated, burying the 33 real ones.
 *
 * **W19-7** — *"X is named in the prose but not in the cast"* carried the
 * character and the scene and offered no fix, while the scene editor has had
 * the one-click chip for it all along.
 *
 * The issues and their fix payloads are unit-tested in
 * `src/lib/__tests__/computeIssues.test.ts`. What is driven here is that the
 * buttons write to the store and the panel notices.
 */

async function checkerFor(page: Page, seed: { pov: string | null; prose: string }) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt Gate')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ id, seed }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl1', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl1', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({
      id: 'maren', worldId: id, name: 'Maren Vale', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd([{
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl1',
      title: 'A letter under the door', description: '', sortOrder: 0, tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft',
      // The reported shape: an id left pointing at a character who is gone.
      povCharacterId: seed.pov, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    }])
    await db.sceneTexts.add({
      id: 'st1', worldId: id, eventId: 'ev1', text: seed.prose,
      wordCount: seed.prose.split(/\s+/).length, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, seed })

  await page.goto(`/#/worlds/${worldId}`)
  await settle(page)
  await page.getByTitle('Continuity Checker').click()
  await expect(page.getByText('Continuity Checker')).toBeVisible()
  return worldId
}

/** The stored scene, read from the store rather than inferred off the screen. */
const storedEvent = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ povCharacterId: string | null; involvedCharacterIds: string[]; mentionedCharacterIds: string[] }> }
  }
  return db.events.get('ev1')
})

test.describe('The continuity warnings that knew their own fix', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a POV naming nobody says so, and clears in one click', async ({ page }) => {
    await checkerFor(page, { pov: 'deleted-character', prose: 'The bell rang two hours early.' })

    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByText(/names no character/)).toBeVisible()
    // The old wording, and the remedy nobody could carry out.
    await expect(dialog.getByText(/is not in the cast/)).toHaveCount(0)
    await expect(dialog.getByText(/add them to Characters/)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Clear the POV' }).first().click()

    await expect.poll(async () => (await storedEvent(page)).povCharacterId, { timeout: 15_000 }).toBeNull()
    await expect(dialog.getByText(/names no character/)).toHaveCount(0)
  })

  /**
   * The presence half of the test above, and the one that keeps it honest: a
   * POV that names a real character who is simply missing from the cast is
   * still reported, and still as *that* fault.
   */
  test('while a real POV missing from the cast is still reported as that', async ({ page }) => {
    await checkerFor(page, { pov: 'maren', prose: 'The bell rang two hours early.' })

    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByText(/is not in the cast/)).toBeVisible()
    await expect(dialog.getByText(/names no character/)).toHaveCount(0)
  })

  /*
    N3: this used to add the character to the *cast*, which is a claim the
    warning never made — it observed a name in the prose. Recording a mention
    clears the warning and cannot put somebody in a room they are not in.
  */
  test('a character named in the prose can be recorded as mentioned from the panel', async ({ page }) => {
    await checkerFor(page, { pov: null, prose: 'Maren Vale found the letter and did not open it.' })

    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByText(/named in the prose but not in the cast/)).toBeVisible()

    await dialog.getByRole('button', { name: 'Record as mentioned' }).first().click()

    await expect.poll(async () => (await storedEvent(page)).mentionedCharacterIds, { timeout: 15_000 })
      .toEqual(['maren'])
    // …and the scene's cast is untouched, which is the whole of the finding.
    expect((await storedEvent(page)).involvedCharacterIds).toEqual([])
    await expect(dialog.getByText(/named in the prose but not in the cast/)).toHaveCount(0)
  })
})
