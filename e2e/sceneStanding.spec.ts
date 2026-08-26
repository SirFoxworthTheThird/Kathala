import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * N7, from a blind writer run: *"Who is in this scene" is two separate ledgers
 * that never talk.* State was recorded for a character at two scenes, and the
 * character page then read **History 2 · Appearances 0** — which the reviewer
 * read as having recorded nothing.
 *
 * Both counts were right, and they stay right: a snapshot says where somebody
 * is at a moment, and the delta model needs that to work for people who are off
 * stage, so treating one as an entrance would put every character who was
 * merely *placed* into the cast of the scene they were placed during. The app
 * has already been bitten by conflating them in the other direction — see the
 * note in `StepPlace.tsx`, where writing only the snapshot made the dashboard
 * say "never appears" about the character onboarding had just placed.
 *
 * What was missing was the sentence. This drives both halves of it: the line
 * beside the state editor saying which ledger this scene has them in, and the
 * Appearances tab naming the other count instead of reading as zero work.
 */

const CHAR = 'Corvin Adze'
const SCENE = 'The ninth bell does not ring'

async function seed(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Two Ledgers')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, charName, sceneTitle]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const character = (cid: string, name: string) => ({
      id: cid, worldId: id, name, description: '', aliases: [], tags: [],
      portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.characters.add(character('corvin', charName))
    await db.characters.add(character('rell', 'Rell Vashti'))
    // Rell is in the cast; Corvin is in neither the cast nor the mentions —
    // the reviewer's case, where the only record of him will be his state.
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: sceneTitle,
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['rell'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, [worldId, CHAR, SCENE])
  return worldId
}

/** The character page at one tab, with the cursor moved onto the only scene. */
async function open(page: Page, worldId: string, tab: string) {
  await page.goto(`/#/worlds/${worldId}/characters/corvin?tab=${tab}`, { waitUntil: 'load' })
  await settle(page)
}

/**
 * Idempotent: the cursor is persisted, so a second navigation in the same test
 * arrives with it already on the only scene and "Next moment" disabled. Asserts
 * the postcondition either way rather than assuming the click did it.
 */
async function putCursorOnTheScene(page: Page) {
  const next = page.getByRole('button', { name: 'Next moment' })
  if (await next.isEnabled()) {
    await next.click()
    await page.waitForTimeout(900)
  }
  await expect(page.getByRole('banner').getByText(SCENE)).toBeVisible()
}

const NOT_IN_CAST = new RegExp(`${CHAR} is not in this scene's cast`)
const IN_CAST = new RegExp(`${CHAR} is in this scene's cast`)
const ADD_TO_CAST = "Add to this scene's cast"

test.describe('Recording state is not an entrance, and the app says so', () => {
  test.describe.configure({ timeout: 300_000 })

  test('the state editor says which ledger the scene has them in, and offers the other', async ({ page }) => {
    const worldId = await seed(page)
    await open(page, worldId, 'state')
    await putCursorOnTheScene(page)

    const main = page.getByRole('main')

    // Absence half: he is in neither ledger, and the line says which one that is.
    await expect(main.getByText(NOT_IN_CAST)).toBeVisible()
    await expect(main.getByRole('button', { name: ADD_TO_CAST })).toBeVisible()
    await expect(main.getByText(IN_CAST)).toHaveCount(0)

    // Record his state — the act the reviewer performed, which changes nothing
    // about the cast and should not pretend to.
    await main.getByPlaceholder(/Physical condition/).fill('Waiting in the cistern.')
    await main.getByRole('button', { name: 'Save State' }).click()
    await page.waitForTimeout(900)
    await expect(main.getByText(NOT_IN_CAST)).toBeVisible()

    // Presence half: take the offer, and the same line reports the other state
    // while the button that made it stops being offered.
    await main.getByRole('button', { name: ADD_TO_CAST }).click()
    await page.waitForTimeout(900)
    await expect(main.getByText(IN_CAST)).toBeVisible()
    await expect(main.getByText(NOT_IN_CAST)).toHaveCount(0)
    await expect(main.getByRole('button', { name: ADD_TO_CAST })).toHaveCount(0)
  })

  test('the Appearances tab names the other ledger rather than reading as no work done', async ({ page }) => {
    const worldId = await seed(page)
    await open(page, worldId, 'state')
    await putCursorOnTheScene(page)

    const main = page.getByRole('main')
    await main.getByPlaceholder(/Physical condition/).fill('Waiting in the cistern.')
    await main.getByRole('button', { name: 'Save State' }).click()
    await page.waitForTimeout(900)

    // The finding, on the screen it was read from: no appearances, and one
    // recorded state that the page used to say nothing about.
    await open(page, worldId, 'appearances')
    await expect(main.getByText('No appearances yet')).toBeVisible()
    await expect(main.getByText(/state recorded at 1 scene/)).toBeVisible()
    await expect(main.getByRole('button', { name: 'See recorded state' })).toBeVisible()

    // And the pair: once he is genuinely on stage, the empty state and its
    // explanation are gone and the scene is listed instead.
    await open(page, worldId, 'state')
    await putCursorOnTheScene(page)
    await main.getByRole('button', { name: ADD_TO_CAST }).click()
    await page.waitForTimeout(900)

    await open(page, worldId, 'appearances')
    await expect(main.getByText(SCENE)).toBeVisible()
    await expect(main.getByText('No appearances yet')).toHaveCount(0)
    await expect(main.getByText(/state recorded at 1 scene/)).toHaveCount(0)
  })
})
