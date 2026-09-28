import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The round trip: a book exported as Markdown and imported again comes back as
 * the same chapters and scenes. The export writes each scene under its `##`
 * title; the import reads `##` under `#` chapters as a titled scene. The rules
 * are unit-tested (`manuscriptCompile`, `manuscriptImport`); here is the file
 * the dialog really downloads, and the world the import dialog really makes.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat.\n\nThe water fell.'],
      ['e2', 'c1', 'Teodora at the table', 'She counted.'],
      ['e3', 'c2', 'The tide-table', 'And the heron flew east at dawn.'],
    ] as const
    let i = 0
    for (const [eid, cid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** "Chapter: scene (prose), …" for every chapter of the world named `name`. */
const outline = (page: Page, name: string) => page.evaluate(async (worldName) => {
  type Row = Record<string, unknown> & { id: string }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Row[]> }>
  const world = (await db.worlds.toArray()).find((w) => w.name === worldName)
  if (!world) return []
  const texts = new Map((await db.sceneTexts.toArray()).map((t) => [t.eventId as string, t.text as string]))
  const events = (await db.events.toArray()).filter((e) => e.worldId === world.id)
  return (await db.chapters.toArray())
    .filter((c) => c.worldId === world.id)
    .sort((a, b) => (a.number as number) - (b.number as number))
    .map((c) => `${c.title as string}: ${events
      .filter((e) => e.chapterId === c.id)
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
      .map((e) => `${e.title as string} (${texts.get(e.id) ?? ''})`)
      .join(', ')}`)
}, name)

const TITLES = 'Scene titles as ## headings, so an import gets the same scenes back'

test.describe('the Markdown round trip', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a book exported as Markdown and imported again has the same chapters and scenes', async ({ page }) => {
    const worldId = await book(page)
    const original = await outline(page, 'The Salt Assize')
    expect(original).toEqual([
      'Low Water: The assize rises (The court sat.\n\nThe water fell.), Teodora at the table (She counted.)',
      'High Water: The tide-table (And the heron flew east at dawn.)',
    ])

    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel(TITLES)).toBeChecked({ timeout: 20_000 })
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: /Download/ }).click()
    const markdown = await readFile(await (await download).path(), 'utf8')
    expect(markdown).toContain('# Ch. 1 — Low Water\n\n## The assize rises\n\nThe court sat.\n\nThe water fell.\n\n## Teodora at the table\n\nShe counted.')

    await page.goto('/#/', { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await page.getByLabel('Manuscript text').fill(markdown)
    await page.getByLabel('World name').fill('The Salt Assize, again')
    await page.getByRole('button', { name: /^Import/ }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await expect.poll(() => outline(page, 'The Salt Assize, again'), { timeout: 10_000 }).toEqual(original)
  })

  test('the option is Markdown’s, and without it the scenes are parted by a break', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel(TITLES)).toBeVisible({ timeout: 20_000 })
    // Not offered for the formats made for readers.
    await dialog.getByRole('button', { name: 'Word', exact: true }).click()
    await expect(dialog.getByLabel(TITLES)).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Markdown', exact: true }).click()

    await dialog.getByLabel(TITLES).uncheck()
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: /Download/ }).click()
    const markdown = await readFile(await (await download).path(), 'utf8')
    expect(markdown).toContain('The water fell.\n\n* * *\n\nShe counted.')
    expect(markdown).not.toContain('## The assize rises')
  })
})
