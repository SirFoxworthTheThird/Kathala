import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { parkCursor } from './helpers/cursor'

/*
  Research (issue #700): a picture and a link attached to a scene from the
  Page, both opened from there; the picture on the scene's mood board; both
  found on the Research screen and in search; the picture's bytes through a
  backup and back, and left out of one when asked; and none of it in reading
  mode, where the Research address leads away.
*/

const MANUSCRIPT = [
  '# The Salt Road',
  '',
  '## Chapter 1: The Ford',
  '',
  'Mira waded in before dawn.',
  '',
  'The water was colder than the stories said.',
].join('\n')

/** A real PNG, 1×1: bytes the store must hand back exactly. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

type Db = Record<string, { toArray: () => Promise<Array<Record<string, unknown>>>; get: (id: string) => Promise<Record<string, unknown> | undefined> }>

async function openPage(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('The water was colder')
  return worldId
}

/** What the page holds of a research file's blob, as bytes. */
const storedBytes = (page: Page, title: string) => page.evaluate(async (t) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
  const item = (await db.researchItems.toArray()).find((i) => i.title === t)
  const blob = item ? await db.blobs.get(item.blobId as string) : undefined
  if (!blob?.data) return null
  return Array.from(new Uint8Array(await (blob.data as Blob).arrayBuffer()))
}, title)

test.describe('research', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a picture and a link attached to a scene from the Page, opened from there, found, and backed up with and without the file', async ({ page }) => {
    const worldId = await openPage(page)
    // What a link opens, kept rather than followed: the app fetches nothing from it.
    await page.evaluate(() => {
      const w = window as unknown as { opened: unknown[][]; open: (...a: unknown[]) => null }
      w.opened = []
      w.open = (...a: unknown[]) => { w.opened.push(a); return null }
    })

    await page.locator('.cm-line', { hasText: 'The water was colder' }).click()
    const toggle = page.getByRole('button', { name: 'Research', exact: true })
    await toggle.click()
    const panel = page.getByRole('complementary', { name: 'Scene research' })
    await expect(panel.getByText('Ch. 1 — ', { exact: false }).first()).toBeVisible()
    await expect(panel.getByText(/^No research on Ch\. 1/)).toBeVisible()

    // A file over the limit is refused, saying why.
    await panel.getByRole('button', { name: 'Add research' }).click()
    let dialog = page.getByRole('dialog', { name: 'Add research' })
    await expect(dialog.getByText(/^It goes on Ch\. 1/)).toBeVisible()
    await dialog.getByLabel('Image or PDF, up to 20 MB').setInputFiles({ name: 'too-big.png', mimeType: 'image/png', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) })
    await dialog.getByRole('button', { name: 'Add research' }).click()
    await expect(dialog.getByRole('alert')).toContainText('A research file can be at most 20 MB')

    // The picture.
    await dialog.getByLabel('Image or PDF, up to 20 MB').setInputFiles({ name: 'the-ford.png', mimeType: 'image/png', buffer: PNG })
    await dialog.getByLabel('Research note (optional)').fill('The ford at low water, from the county survey.')
    await dialog.getByRole('button', { name: 'Add research' }).click()
    await expect(dialog).toBeHidden()
    const board = panel.getByRole('list', { name: 'Mood board' })
    await expect(board.getByRole('button', { name: 'Open the-ford' })).toBeVisible()
    expect(await storedBytes(page, 'the-ford')).toEqual(Array.from(PNG))

    // The link.
    await panel.getByRole('button', { name: 'Add research' }).click()
    dialog = page.getByRole('dialog', { name: 'Add research' })
    await dialog.getByRole('button', { name: 'Link' }).click()
    await dialog.getByLabel('Address').fill('https://example.org/tides')
    await dialog.getByLabel('Title (optional)').fill('Tide tables')
    await dialog.getByLabel('Research note (optional)').fill('When the ford is passable.')
    await dialog.getByRole('button', { name: 'Add research' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.getByRole('article', { name: 'Research: Tide tables' })).toBeVisible()
    // A link is not a picture: the board has the one tile.
    await expect(board.getByRole('listitem')).toHaveCount(1)

    // Opened from the Page: the picture full size, with its own bytes; the link in a new tab, without the app's address.
    await board.getByRole('button', { name: 'Open the-ford' }).click()
    const lightbox = page.getByRole('dialog', { name: 'the-ford' })
    await expect(lightbox).toBeVisible()
    const shown = await lightbox.locator('img').evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())))
    expect(shown).toEqual(Array.from(PNG))
    await lightbox.getByRole('button', { name: 'Close image' }).click()
    await panel.getByRole('article', { name: 'Research: Tide tables' }).getByRole('button', { name: 'Open Tide tables' }).click()
    expect(await page.evaluate(() => (window as unknown as { opened: unknown[][] }).opened)).toEqual([['https://example.org/tides', '_blank', 'noopener,noreferrer']])

    // The Research screen has both, and its filters tell them apart.
    await page.goto(`/#/worlds/${worldId}/research`)
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByRole('article', { name: 'Research: the-ford' })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('article', { name: 'Research: Tide tables' })).toBeVisible()
    await main.getByRole('button', { name: 'Kind: Every kind' }).click()
    await page.getByRole('option', { name: 'Links' }).click()
    await expect(main.getByRole('article', { name: 'Research: Tide tables' })).toBeVisible()
    await expect(main.getByRole('article', { name: 'Research: the-ford' })).toHaveCount(0)
    await main.getByRole('button', { name: 'Kind: Links' }).click()
    await page.getByRole('option', { name: 'Every kind' }).click()
    await main.getByLabel('Search research').fill('county survey')
    await expect(main.getByRole('article', { name: 'Research: the-ford' })).toBeVisible()
    await expect(main.getByRole('article', { name: 'Research: Tide tables' })).toHaveCount(0)

    // Search finds it by its note.
    await page.keyboard.press('Control+k')
    const palette = page.getByPlaceholder(/^Search your world/)
    await palette.fill('passable')
    await expect(page.getByRole('dialog', { name: 'Search' }).getByText('Tide tables')).toBeVisible()
    await page.keyboard.press('Escape')

    // A backup with the file: its bytes are in it.
    await page.goto(`/#/worlds/${worldId}/settings`)
    await settle(page)
    const include = main.getByLabel(/^Include research files \(/)
    await expect(include).toBeChecked({ timeout: 20_000 })
    let pending = page.waitForEvent('download')
    await main.getByRole('button', { name: /Export a .pwk copy/ }).click()
    const withFiles = JSON.parse(await readFile(await (await pending).path(), 'utf8')) as { researchItems: Array<{ title: string; blobId?: string }>; blobs: Array<{ id: string; dataBase64?: string }> }
    const ford = withFiles.researchItems.find((r) => r.title === 'the-ford')!
    expect(Buffer.from(withFiles.blobs.find((b) => b.id === ford.blobId)!.dataBase64!, 'base64').equals(PNG)).toBe(true)

    // Without: the research goes, its file does not.
    await include.uncheck()
    pending = page.waitForEvent('download')
    await main.getByRole('button', { name: /Export a .pwk copy/ }).click()
    const without = await readFile(await (await pending).path(), 'utf8')
    const lean = JSON.parse(without) as typeof withFiles
    expect(lean.researchItems.map((r) => r.title).sort()).toEqual(['Tide tables', 'the-ford'])
    expect(lean.blobs.some((b) => b.id === ford.blobId)).toBe(false)

    // The full copy brought into an empty library gives back the same bytes.
    await resetDB(page)
    await page.getByRole('button', { name: /Import/ }).first().click()
    await page.getByRole('button', { name: 'Choose file…' }).click()
    await page.locator('input[aria-label="Import world file"]').setInputFiles({ name: 'salt-road.pwk', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(withFiles), 'utf8') })
    await expect.poll(() => storedBytes(page, 'the-ford'), { timeout: 20_000 }).toEqual(Array.from(PNG))
  })

  test('reading mode has no research: not in the rail, not on a character, and its address leads away', async ({ page }) => {
    const worldId = await openPage(page)
    // Mira, in the scene: a reader at it has met her, so her page is theirs to see.
    const sceneId = await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: object) => Promise<unknown>; update: (k: string, v: object) => Promise<unknown>; toArray: () => Promise<Array<{ id: string }>> }>
      const now = Date.now()
      await db.characters.add({ id: 'mira', worldId: id, name: 'Mira', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      const [scene] = await db.events.toArray()
      await db.events.update(scene.id, { involvedCharacterIds: ['mira'] })
      return scene.id
    }, worldId)
    // Writing: each is there, so its absence below is about reading mode.
    await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible()
    await page.goto(`/#/worlds/${worldId}/characters/mira`)
    await settle(page)
    await expect(page.getByRole('region', { name: 'Research' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Research', exact: true }).first()).toBeVisible()
    await page.goto(`/#/worlds/${worldId}/research`)
    await settle(page)
    await expect(page.getByRole('main').getByRole('heading', { name: 'Research' })).toBeVisible({ timeout: 20_000 })

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)
    await parkCursor(page, sceneId)
    await page.goto(`/#/worlds/${worldId}/characters/mira`)
    await settle(page)
    await expect(page.getByRole('main').getByRole('heading', { name: 'Mira' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('region', { name: 'Research' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Research', exact: true })).toHaveCount(0)
    await page.goto(`/#/worlds/${worldId}/research`)
    await settle(page)
    await expect(page).toHaveURL(new RegExp(`#/worlds/${worldId}/?$`), { timeout: 20_000 })
    await expect(page.getByRole('main').getByRole('heading', { name: 'Research' })).toHaveCount(0)
  })
})
