import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'
import { parkCursor } from './helpers/cursor'

/**
 * Custom fields (issue #699): a writer defines their own fields in World
 * settings — from a template or by hand — and fills them in on the entity's
 * page, a fixed value once and a value over time at the scene under the
 * cursor. A reader sees only what the book has shown them (D-7).
 */

/** A book of three chapters, a scene each; Anna in all three, Bo only in the last; the Gull in the first. */
async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Saltmouth')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    const person = (pid: string, name: string) => ({ id: pid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add(person('anna', 'Anna Vell'))
    await db.characters.add(person('bo', 'Bo Marren'))
    await db.items.add({ id: 'gull', worldId: id, name: 'The Gull', description: '', iconType: 'other', imageId: null, tags: [] })
    await db.factions.add({ id: 'guild', worldId: id, name: 'The Ferry Guild', description: '', color: '#888888', coverImageId: null, tags: [], createdAt: now, updatedAt: now })
    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null, mentionedCharacterIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    }
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        ...base, id: `ev${n}`, chapterId: `ch${n}`, title: ['The Ford', 'The Crossing', 'The Far Bank'][n - 1], sortOrder: 0,
        involvedCharacterIds: n === 3 ? ['anna', 'bo'] : ['anna'], involvedItemIds: n === 1 ? ['gull'] : [],
      })
    }
  }, worldId)
  return worldId
}

async function openSettings(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/settings`)
  await settle(page)
  const section = page.locator('#settings-custom-fields')
  await expect(section.getByRole('heading', { name: 'Custom fields' })).toBeVisible({ timeout: 20_000 })
  return section
}

async function openPage(page: Page, worldId: string, path: string, scene?: string) {
  if (scene) await parkCursor(page, scene)
  await page.goto(`/#/worlds/${worldId}/${path}`)
  await settle(page)
  const panel = page.getByRole('region', { name: 'Custom fields' })
  await expect(panel).toBeVisible({ timeout: 20_000 })
  return panel
}

test.describe('custom fields', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a writer adds fields from a template and by hand, fills them in, and deletes one with its values', async ({ page }) => {
    const worldId = await book(page)
    const section = await openSettings(page, worldId)

    await section.getByRole('button', { name: 'Add the Fantasy characters fields' }).click()
    await expect(section.getByRole('status')).toHaveText('Added Race, Magic, Allegiance to characters.')
    // A second time adds nothing: the names are there.
    await section.getByRole('button', { name: 'Add the Fantasy characters fields' }).click()
    await expect(section.getByRole('status')).toHaveText('The Fantasy characters fields are here already.')

    // One by hand, over time.
    await section.getByRole('button', { name: 'Add a field to characters' }).click()
    const form = section.getByRole('group', { name: 'New field for characters' })
    await form.getByLabel('Field name').fill('Rank')
    await form.getByRole('checkbox', { name: /Changes over time/ }).check()
    await form.getByRole('button', { name: 'Add field' }).click()
    await expect(form).toHaveCount(0)
    await expect(section.getByText('Rank', { exact: true })).toBeVisible()

    // A fixed value, on the character's page.
    let panel = await openPage(page, worldId, 'characters/anna', 'ev1')
    await panel.getByRole('button', { name: /^Race/ }).click()
    await page.getByRole('option', { name: 'Elf' }).click()
    await panel.getByLabel('Magic').fill('Tidewright')
    await panel.getByLabel('Magic').press('Enter')

    // A value over time, said at the scene under the cursor.
    await expect(panel.getByText(/Over time, at Ch\. 1 — The Ford/)).toBeVisible()
    const rank = panel.getByRole('group', { name: 'Rank at this scene' }).getByRole('textbox')
    await rank.fill('Mate')
    await rank.press('Enter')
    await expect(panel.getByText('said here')).toBeVisible()
    await panel.getByRole('group', { name: 'Allegiance at this scene' }).getByRole('button').click()
    await page.getByRole('option', { name: 'The Ferry Guild' }).click()

    // At the next scene it holds, from where it was said; a new word there changes only from there.
    panel = await openPage(page, worldId, 'characters/anna', 'ev2')
    const rank2 = panel.getByRole('group', { name: 'Rank at this scene' }).getByRole('textbox')
    await expect(rank2).toHaveValue('Mate')
    await expect(panel.getByText('since Ch. 1 — The Ford').first()).toBeVisible()
    await rank2.fill('Bosun')
    await rank2.press('Enter')
    await expect(panel.getByText('said here')).toBeVisible()

    // Back at the first scene, after a reload: what was said there, and the fixed values, are kept.
    panel = await openPage(page, worldId, 'characters/anna', 'ev1')
    await expect(panel.getByRole('group', { name: 'Rank at this scene' }).getByRole('textbox')).toHaveValue('Mate')
    await expect(panel.getByRole('button', { name: /^Race Elf$/ })).toBeVisible()
    await expect(panel.getByLabel('Magic')).toHaveValue('Tidewright')

    // Deleted, with what goes with it said first.
    const settings = await openSettings(page, worldId)
    await settings.getByRole('button', { name: 'Delete field Magic' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Its 1 value goes with it: 1 on characters and 0 said at scenes. Undo brings them back.')
    await dialog.getByRole('button', { name: 'Delete field' }).click()
    await expect(settings.getByRole('button', { name: 'Delete field Magic' })).toHaveCount(0)
    panel = await openPage(page, worldId, 'characters/anna', 'ev1')
    await expect(panel.getByRole('button', { name: /^Race Elf$/ })).toBeVisible()
    await expect(panel.getByLabel('Magic')).toHaveCount(0)

    // A field that holds values keeps its type; one that is empty may change it.
    const again = await openSettings(page, worldId)
    await again.getByRole('button', { name: 'Edit field Race' }).click()
    const edit = again.getByRole('group', { name: 'Edit Race' })
    await expect(edit.getByText(/It holds values, so its type/)).toBeVisible()
    await expect(edit.getByRole('checkbox', { name: /Changes over time/ })).toBeDisabled()
    await edit.getByRole('button', { name: 'Cancel' }).click()
    await again.getByRole('button', { name: 'Add a field to items' }).click()
    const ship = again.getByRole('group', { name: 'New field for items' })
    await ship.getByLabel('Field name').fill('Cargo')
    await ship.getByRole('button', { name: 'Add field' }).click()
    await again.getByRole('button', { name: 'Edit field Cargo' }).click()
    const cargo = again.getByRole('group', { name: 'Edit Cargo' })
    await expect(cargo.getByRole('checkbox', { name: /Changes over time/ })).toBeEnabled()
    await expect(cargo.getByText(/It holds values/)).toHaveCount(0)
  })

  test('a reader sees a value over time at their place in the book, and a link to someone not met yet as not met yet', async ({ page }) => {
    const worldId = await book(page)
    const section = await openSettings(page, worldId)
    await section.getByRole('button', { name: 'Add the Ships fields' }).click()
    await expect(section.getByRole('status')).toHaveText('Added Class, Crew, Captain to items.')

    // The writer: Bo captains the Gull from the first scene, and Anna from the last.
    let panel = await openPage(page, worldId, 'items/gull', 'ev1')
    await panel.getByRole('group', { name: 'Captain at this scene' }).getByRole('button').click()
    await page.getByRole('option', { name: 'Bo Marren' }).click()
    await expect(panel.getByText('said here')).toBeVisible()
    await panel.getByLabel('Crew (souls)').fill('40')
    await panel.getByLabel('Crew (souls)').press('Enter')
    // Written on leaving the box: wait for it to land before the page goes.
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { items: { get: (id: string) => Promise<{ customValues?: Record<string, unknown> }> } }
      return Object.values((await db.items.get('gull'))?.customValues ?? {})
    })).toEqual([40])
    panel = await openPage(page, worldId, 'items/gull', 'ev3')
    await panel.getByRole('group', { name: 'Captain at this scene' }).getByRole('button').click()
    await page.getByRole('option', { name: 'Anna Vell' }).click()
    await expect(panel.getByText('said here')).toBeVisible()

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    // A reader at the second scene: Bo is the captain, whom they have not met; the third scene's word is not theirs yet.
    panel = await openPage(page, worldId, 'items/gull', 'ev2')
    await expect(panel.getByText('Captain', { exact: true })).toBeVisible()
    await expect(panel.getByText('not met yet')).toBeVisible()
    await expect(panel.getByText('Anna Vell')).toHaveCount(0)
    await expect(panel.getByText('40 souls')).toBeVisible()
    // Nothing to edit, and nothing of the settings.
    await expect(panel.getByRole('textbox')).toHaveCount(0)
    await expect(panel.getByRole('link', { name: 'Edit the fields in World settings' })).toHaveCount(0)

    // At the last scene, Anna.
    panel = await openPage(page, worldId, 'items/gull', 'ev3')
    await expect(panel.getByText('Anna Vell')).toBeVisible()
    await expect(panel.getByText('not met yet')).toHaveCount(0)
  })

  test('values are found by Search, filter a roster, have rows in the Arc grid, and are in the Writer’s Brief', async ({ page }) => {
    const worldId = await book(page)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.customFieldDefs.add({ id: 'race', worldId: id, kind: 'character', name: 'Race', type: 'choice', overTime: false, order: 0, options: [{ id: 'elf', label: 'Elf' }, { id: 'dwarf', label: 'Dwarf' }], createdAt: now, updatedAt: now })
      await db.customFieldDefs.add({ id: 'rank', worldId: id, kind: 'character', name: 'Rank', type: 'text', overTime: true, order: 1, createdAt: now, updatedAt: now })
      await db.characters.update('anna', { customValues: { race: 'elf' } })
      await db.characters.update('bo', { customValues: { race: 'dwarf' } })
      for (const [ev, value, key] of [['ev1', 'Mate', 1], ['ev2', 'Bosun', 2]] as const) {
        await db.fieldValues.add({ id: `fv:rank:anna:${ev}`, worldId: id, defId: 'rank', entityId: 'anna', eventId: ev, sortKey: key, value, createdAt: now, updatedAt: now })
      }
    }, worldId)

    // The roster, by a choice field.
    await parkCursor(page, 'ev2')
    await page.goto(`/#/worlds/${worldId}/characters`)
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByText('Anna Vell')).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('Bo Marren')).toBeVisible()
    await main.getByRole('button', { name: 'Filter by a field: all' }).click()
    await page.getByRole('option', { name: 'Race: Elf' }).click()
    await expect(main.getByText('Anna Vell')).toBeVisible()
    await expect(main.getByText('Bo Marren')).toHaveCount(0)

    // Search: a choice by its label, and a value over time as it holds at the cursor.
    const palette = page.getByPlaceholder(/^Search your world/)
    await page.keyboard.press('Control+k')
    await palette.fill('Dwarf')
    const results = page.getByRole('dialog', { name: 'Search' })
    await expect(results.getByText('Race: Dwarf')).toBeVisible()
    await expect(results.getByText('Bo Marren')).toBeVisible()
    await palette.fill('Bosun')
    await expect(results.getByText('Rank: Bosun')).toBeVisible()
    await page.keyboard.press('Escape')
    // At the first scene she is a mate, not a bosun yet.
    await parkCursor(page, 'ev1')
    await page.goto(`/#/worlds/${worldId}/characters`)
    await settle(page)
    await page.keyboard.press('Control+k')
    await palette.fill('Bosun')
    await expect(results.getByText(/No results|Nothing/i).first()).toBeVisible()
    await expect(results.getByText('Rank: Bosun')).toHaveCount(0)
    await palette.fill('Mate')
    await expect(results.getByText('Rank: Mate')).toBeVisible()
    await page.keyboard.press('Escape')

    // The Arc grid: a row for the field over time, said where it is said and carried after.
    await page.goto(`/#/worlds/${worldId}/arc`)
    await settle(page)
    await page.getByRole('button', { name: 'Fields', exact: true }).click()
    const cell = (k: number) => page.locator(`[data-field-cell="Rank|Anna Vell|${k}"]`)
    await expect(cell(0)).toHaveText('Mate')
    await expect(cell(0)).toHaveAttribute('title', 'Rank, said here')
    await expect(cell(1)).toHaveText('Bosun')
    await expect(cell(2)).toHaveText('Bosun')
    await expect(cell(2)).toHaveAttribute('title', 'Rank, carried')
    // Bo has no value for it, so no row.
    await expect(page.locator('[data-field-cell^="Rank|Bo Marren|"]')).toHaveCount(0)

    // The Writer's Brief at the second scene: what changes there, said so; at the third, carried.
    const briefAt = async (scene: string) => {
      await parkCursor(page, scene)
      // Not a chapter's page, which puts the cursor on that chapter.
      await page.goto(`/#/worlds/${worldId}/characters`)
      await settle(page)
      await page.getByTitle("Writer's Brief").click()
      const dialog = page.getByRole('dialog', { name: "Writer's Brief" })
      await expect(dialog).toBeVisible()
      return dialog
    }
    let brief = await briefAt('ev2')
    await expect(brief.getByText('Fields at this scene')).toBeVisible()
    await expect(brief.getByText('Bosun')).toBeVisible()
    await expect(brief.getByText('CHANGES HERE')).toBeVisible()
    brief = await briefAt('ev3')
    await expect(brief.getByText('Bosun')).toBeVisible()
    await expect(brief.getByText('CHANGES HERE')).toHaveCount(0)
  })
})
