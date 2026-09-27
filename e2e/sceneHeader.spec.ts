import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * `[#The Kitchen @@Wren @@Sal'ka]` — where the scene happens and who is in it,
 * said in the act of writing.
 *
 * The header is **rendered from the scene's own records, never stored**, so a
 * change made anywhere shows up in the line by construction. These tests drive
 * both directions, because the whole design rests on there being one copy of
 * the fact: type the line and the records follow; change the records and the
 * line follows.
 */
async function sceneWithCast(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Header')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const [cid, name] of [['wren', 'Wren Halloway'], ['salka', "Sal'ka"]] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    // A place with no map — which is now an ordinary thing for a place to be.
    await db.locationMarkers.add({
      id: 'kitchen', worldId: id, mapLayerId: null, linkedMapLayerId: null,
      name: 'The Kitchen', description: '', x: 0, y: 0, imageId: null,
      iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Kettle', description: '',
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
      tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ involvedCharacterIds: string[]; locationMarkerId: string | null }> }
    sceneTexts: { toArray: () => Promise<Array<{ text: string; wordCount: number }>> }
  }
  const ev = await db.events.get('ev1')
  const texts = await db.sceneTexts.toArray()
  return { cast: ev.involvedCharacterIds, place: ev.locationMarkerId, prose: texts[0]?.text ?? '', words: texts[0]?.wordCount ?? 0 }
})

test.describe('the scene header', () => {
  test.describe.configure({ timeout: 240_000 })

  test('records the place and the cast, and keeps itself out of the prose', async ({ page }) => {
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toBeVisible({ timeout: 20_000 })

    await draft.fill("[#The Kitchen @@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()

    await expect.poll(stored.bind(null, page), { timeout: 20_000 }).toEqual({
      cast: ['wren', 'salka'],
      place: 'kitchen',
      // The header is nowhere in the stored prose, and nowhere in the count.
      prose: 'She put the kettle on.',
      words: 5,
    })
  })

  test('and comes back on screen, rendered from what it recorded', async ({ page }) => {
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren'])

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()
    // Not read back from the text — there is none. Rebuilt from the record.
    await expect(page.getByRole('textbox', { name: 'Scene prose' }))
      .toHaveValue(/^\[@@Wren Halloway\]/, { timeout: 20_000 })
  })

  test('follows a change made in the panel instead of the line', async ({ page }) => {
    /*
      The half that decides the whole design. The header is not a second copy
      kept in step by a sync routine — it is drawn from the records, so a cast
      change made anywhere else is already in it. Two copies of one fact is
      the shape that silently destroyed a writer's cast this morning.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect(draft).toHaveValue(/@@Wren Halloway/, { timeout: 20_000 })

    // Add the other character through the card's own control.
    await page.getByRole('main').getByRole('button', { name: /Add character/ }).click()
    await page.getByRole('option', { name: "Sal'ka" }).click()

    await expect(draft).toHaveValue(/@@Wren Halloway @@Sal'ka/, { timeout: 20_000 })
  })

  test('says so when the line names somebody the world does not have, and changes nothing', async ({ page }) => {
    /*
      A typo is not a declaration. This used to record "the rest of the line" —
      which meant one mistyped letter took a character out of the scene, and
      the comma a writer puts between names by habit did it too. The function
      already kept an unmatched *place* on exactly this reasoning; people were
      the case that dropped.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    // A cast to lose, recorded first, so the absence below is a real absence.
    await draft.fill("[@@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])

    // One letter wrong in the second name.
    await draft.fill("[@@Wren Halloway @@Sal'k]\n\nShe put the kettle on.")
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called/)).toBeVisible({ timeout: 20_000 })
    // Nobody left the room, and the misspelling is still on the line to fix.
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])
    await expect(draft).toHaveValue(/@@Sal'k\]/)

    // The presence half: spelled right, it applies, and the line goes back to
    // being a view of the records.
    await draft.fill("[@@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['salka'])
    await expect(page.getByText(/Nothing in this world is called/)).toBeHidden()
  })

  test('a comma between names does not empty the cast either', async ({ page }) => {
    // The one a writer hits first: the rendered line separates names with
    // spaces, and nobody typing a list from scratch knows that yet.
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill("[@@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])

    await draft.fill("[@@Wren Halloway, @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect(page.getByText(/“Wren Halloway,”/)).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])
  })

  test('a bracketed note at the top of a scene stays a note', async ({ page }) => {
    /*
      H-1, the whole of it. A writer scribbled `[check: …]` at the top of a
      draft in the only punctuation margin notes use. The note was consumed and
      never stored, the cast and setting were cleared because the note named
      nobody, and the real line — one row down by then — was saved as a
      paragraph of the book and exported as one. The box looked identical
      before and after.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill("[#The Kitchen @@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])

    // The note goes in above the line, which is where a note goes.
    await draft.fill(
      "[check: does she say it out loud?]\n[#The Kitchen @@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.",
    )
    await draft.blur()

    await expect.poll(stored.bind(null, page), { timeout: 20_000 }).toEqual({
      // Nobody left the room and the setting held.
      cast: ['wren', 'salka'],
      place: 'kitchen',
      // The note is kept, as the prose it is — and the header is not in it.
      prose: '[check: does she say it out loud?]\n\nShe put the kettle on.',
      words: 12,
    })
    const after = await stored(page)
    expect(after.prose).not.toContain('@@')
    expect(after.prose).not.toContain('#The Kitchen')
  })

  test('a header typed and left unblurred survives a reload', async ({ page }) => {
    /*
      H-2: the prose autosaved and the declaration above it did not, while the
      box said "Draft auto-saved" about the half it had kept. A writer who
      typed the header, wrote the scene under it and closed the tab kept every
      word and lost the cast and the setting — which looks exactly like a scene
      that never had a header.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.click()
    // Typed, never blurred — the caret ends up down in the prose, which is the
    // writer saying they are done with the line.
    await draft.pressSequentially('[@@Wren Halloway]\n\nShe put the kettle on.', { delay: 5 })
    await expect(page.getByText('Draft auto-saved')).toBeVisible({ timeout: 20_000 })

    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren'])

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Scene prose' }))
      .toHaveValue(/^\[@@Wren Halloway\]/, { timeout: 20_000 })
  })

  test('deleting the line clears the warning it left behind', async ({ page }) => {
    // The guide's own gesture for clearing your screen. It used to leave the
    // accusation on it, describing an edit that no longer existed.
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Nobody At All]\n\nShe put the kettle on.')
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called/)).toBeVisible({ timeout: 20_000 })

    await draft.fill('She put the kettle on.')
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called/)).toBeHidden({ timeout: 20_000 })
  })

  test('the picker inside the brackets keeps its sigil', async ({ page }) => {
    /*
      H-3. The picker does fire in there — it runs on the whole box and has no
      idea the line exists — and it is the only spell-check the line has, so it
      stays. What it did was strip the sigil it was triggered by: the plain name
      glued itself to the name before it, the line then named one person nobody
      answered, and the cast emptied. The app's own notice recommended it.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[@@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren'])

    // Type a second name inside the brackets and take the picker's row.
    // Control+Home reaches the top of the box; End then stops at the close
    // bracket of the first line, and one step back is inside it. Plain Home/End
    // work on whichever line the caret is already on, which after a click is
    // the last one.
    await draft.click()
    await draft.press('Control+Home')
    await draft.press('End')
    await draft.press('ArrowLeft')
    await draft.pressSequentially(' @@Sal', { delay: 10 })
    await page.getByRole('button', { name: /Sal'ka/ }).first().click()

    // The sigil survived, so the line still names two people rather than one
    // run-together stranger.
    await expect(draft).toHaveValue(/@@Wren Halloway @@Sal'ka/, { timeout: 20_000 })
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])
  })

  test('Focus mode says where the scene is and who is in it', async ({ page }) => {
    /*
      H-8. Focus mode is handed the prose by definition, so the surface the app
      calls its best writing surface — and promotes with the only outline button
      in the row — said nothing about the room or the people in it.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill("[#The Kitchen @@Wren Halloway @@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()
    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['wren', 'salka'])

    await page.getByRole('button', { name: 'Focus' }).click()
    /*
      Scoped through the screen-reader prefix, which only the overlay has. A bare
      `getByText` on the line matches the draft textarea too — it is still in the
      DOM behind the portal, holding the same characters — and that is a second
      match rather than a failure of the feature.
    */
    await expect(page.getByText(/Where and who: \[#The Kitchen @@Wren Halloway @@Sal'ka\]/))
      .toBeVisible({ timeout: 20_000 })
    const focusText = page.getByRole('textbox').last()
    await expect(focusText).toHaveValue('She put the kettle on.')

    // The round trip is the part that must not break: a sentence added here
    // comes back as prose, with the line still rendered from the records.
    await focusText.click()
    await focusText.press('End')
    await focusText.pressSequentially(' The water came back.', { delay: 5 })
    await page.keyboard.press('Escape')

    await expect.poll(stored.bind(null, page), { timeout: 20_000 }).toEqual({
      cast: ['wren', 'salka'],
      place: 'kitchen',
      prose: 'She put the kettle on. The water came back.',
      words: 9,
    })
  })

  test('and shows no such line for a scene that has neither', async ({ page }) => {
    // The absence half, so the presence above cannot pass on chrome that is
    // always there.
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toBeVisible({ timeout: 20_000 })
    await draft.fill('She put the kettle on.')
    await draft.blur()

    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(page.getByText('Where and who:')).toBeHidden()
    await expect(page.getByRole('textbox').last()).toHaveValue('She put the kettle on.')
  })

  test('presence asserted by the line replaces a mention', async ({ page }) => {
    /*
      H-6. `@@` in the prose strips the mention, with a comment saying why; the
      header never touched the list, so a character sat in both — two mutually
      exclusive claims in one record, which nothing reported and which travelled
      in the export.
    */
    const worldId = await sceneWithCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { update: (id: string, c: Record<string, unknown>) => Promise<unknown> }
      }
      await db.events.update('ev1', { mentionedCharacterIds: ['salka'] })
    })
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()

    const mentioned = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        events: { get: (id: string) => Promise<{ mentionedCharacterIds?: string[] }> }
      }
      return (await db.events.get('ev1')).mentionedCharacterIds ?? []
    })
    // The absence half, before the change: she really is in the mentioned list.
    expect(await mentioned()).toEqual(['salka'])

    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill("[@@Sal'ka]\n\nShe put the kettle on.")
    await draft.blur()

    await expect.poll(async () => (await stored(page)).cast, { timeout: 20_000 }).toEqual(['salka'])
    await expect.poll(mentioned, { timeout: 20_000 }).toEqual([])
  })
})
