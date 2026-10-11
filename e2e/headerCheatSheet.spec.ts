import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { HEADER_SYNTAX } from '../src/lib/headerSyntax'

/**
 * The header cheat sheet: every line and token the scene header takes, a click
 * from where it is typed — beside the Page and under a scene card's draft.
 * That what it says is true is `headerSyntax.test.ts`; here, that it is there.
 */

async function book(page: Page, opts: { thread?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, thread]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The assize rises', 'The court sat.'], ['e2', 'Teodora at the table', 'She counted.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    if (thread) await db.plotThreads.add({ id: 'debt', worldId: id, name: 'The debt', description: '', color: '#f59e0b', createdAt: now, updatedAt: now })
  }, [worldId, !!opts.thread] as const)
  return worldId
}


const examples = HEADER_SYNTAX.flatMap((l) => l.rows.map((r) => r.example))

test.describe('the header cheat sheet', () => {
  test.describe.configure({ timeout: 120_000 })

  test('beside the Page: opens on every line and token the header takes, and closes back to the writing', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })

    const sheet = page.getByRole('dialog', { name: 'The scene header' })
    await expect(sheet).toHaveCount(0)
    await page.getByRole('button', { name: 'Header cheat sheet', exact: true }).click()
    await expect(sheet).toBeVisible()
    for (const label of HEADER_SYNTAX.map((l) => l.label)) await expect(sheet.getByRole('heading', { name: label, exact: true })).toBeVisible()
    for (const example of examples) await expect(sheet.getByText(example, { exact: true })).toBeVisible()
    await expect(sheet).toContainText('Items: intact, damaged, destroyed, repaired, lost, found, unknown')

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })

  test('on a scene card: there too', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Scene prose' })).toBeVisible({ timeout: 20_000 })
    const sheet = page.getByRole('dialog', { name: 'The scene header' })
    await expect(sheet).toHaveCount(0)
    await page.getByRole('main').getByRole('button', { name: 'Header cheat sheet', exact: true }).click()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('@@Edward Hyde:is Dr Henry Jekyll', { exact: true })).toBeVisible()
  })
})
