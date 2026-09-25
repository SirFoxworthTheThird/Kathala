import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Exercises the browser-only parts of the "@"-mention feature that unit and
// fake-indexeddb integration tests can't reach: the autocomplete dropdown, name
// insertion into the prose, and the caret/blur interplay in SceneDraftEditor.

test.describe('@-mentions in the scene draft', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Mentions World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // A character to mention.
    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Kael')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Kael')).toBeVisible()
  })

  // Creates a chapter + event, opens the chapter detail, and expands the event
  // card. Returns the scene-draft textarea (scoped to <main> so the card title
  // isn't confused with the timeline-bar marker of the same name).
  async function openSceneDraft(page: Page) {
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Act One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/timeline\/.+/)

    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('The Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()

    // Expand the event card via its title button (inside <main>).
    // Exact: the card's icon controls are named after the scene they act on,
    // so a substring match on the title finds five buttons.
    await main.getByRole('button', { name: 'The Departure', exact: true }).click()
    const draft = page.getByPlaceholder(/Write or paste this scene/)
    await expect(draft).toBeVisible()
    return draft
  }

  test('typing @ inserts the plain name and records the mention', async ({ page }) => {
    const draft = await openSceneDraft(page)

    // fill() dispatches a single change with the caret at the end, opening the
    // autocomplete on the trailing "@Kae" token.
    await draft.fill('Mira spoke of @Kae')

    // Pick Kael from the dropdown. Clicking runs the item's onMouseDown → select,
    // which is independent of textarea focus (unlike an Enter keypress).
    await page.getByRole('button', { name: 'Kael' }).click()

    // The prose gets the plain name — no "@" token left behind.
    await expect(draft).toHaveValue('Mira spoke of Kael ')
    // The mention is recorded immediately (on select, not on blur).
    await expect(page.getByRole('button', { name: 'Remove mention of Kael' })).toBeVisible()

    // Removing the mention chip clears it again.
    await page.getByRole('button', { name: 'Remove mention of Kael' }).click()
    await expect(page.getByRole('button', { name: 'Remove mention of Kael' })).toHaveCount(0)
  })

  /**
   * **W-2.** The chip under the draft used to put the character *in the scene*.
   *
   * It makes one observation — this name is in your text — and the cast is a
   * larger claim: the map places those people, the Brief lists them, and the
   * Character States panel asks what state each of them is in. The Continuity
   * Checker answers the identical observation with a mention, after its own
   * cast button gave a two-hander a cast of four including a dead man; a
   * writer's run then found the two disagreeing about the same prose.
   *
   * Driven here rather than in a unit test because the chip only exists once
   * the draft has been typed into and the scene card has re-read it.
   */
  test('a name found in the prose is recorded as mentioned, not added to the cast', async ({ page }) => {
    const draft = await openSceneDraft(page)
    await draft.fill('Kael was not here. Nobody had seen Kael for a week.')
    await draft.blur()

    const chip = page.getByRole('button', { name: 'Kael' })
      .filter({ has: page.locator('svg') }).last()
    await expect(page.getByText(/Named in the text/)).toBeVisible({ timeout: 15_000 })
    await chip.click()

    // Recorded as a mention…
    await expect(page.getByRole('button', { name: 'Remove mention of Kael' })).toBeVisible()

    /*
      …and the cast is untouched, which is the whole of the finding. The cast
      picker offers everyone not already in the scene, so Kael still being on
      offer there is the readable form of "not in the cast".
    */
    const stored = await page.evaluate(async () => {
      const db = (window as unknown as { __pwdb?: { events: { toArray: () => Promise<Array<{ involvedCharacterIds: string[] }>> } } }).__pwdb
      const events = await db!.events.toArray()
      return events[0]?.involvedCharacterIds ?? null
    })
    expect(stored).toEqual([])
  })

  /**
   * `@@Kael` says he is in the room.
   *
   * The one thing a writer most wants to state mid-sentence was the one thing
   * the picker could not say: `@` always recorded a *mention*. Two sigils
   * assert presence, and nothing reads the prose to infer it — fiction is full
   * of *"Vey was not there"* and *"he imagined Marn in the Ossuary"*, so the
   * keystroke is the assertion.
   */
  test('typing @@ puts the character in the scene instead', async ({ page }) => {
    const draft = await openSceneDraft(page)

    await draft.fill('The door opened. @@Kae')
    await page.getByRole('button', { name: 'Kael' }).click()

    // Both sigils go — `lastIndexOf('@')` lands on the second, and splicing
    // from there would leave a stray "@" in the manuscript.
    await expect(draft).toHaveValue('The door opened. Kael ')

    /*
      Wait for the record to reach the screen before reading the store: the
      prose lands before `updateEvent` resolves, so asserting on the text is
      not evidence the write has happened.
    */
    await expect(page.getByRole('main').getByRole('button', { name: 'Remove Kael from this scene' })).toBeVisible()

    const stored = await page.evaluate(async () => {
      const db = (window as unknown as { __pwdb?: { events: { toArray: () => Promise<Array<{ involvedCharacterIds: string[]; mentionedCharacterIds: string[] }>> } } }).__pwdb
      const events = await db!.events.toArray()
      return { cast: events[0]?.involvedCharacterIds ?? [], mentioned: events[0]?.mentionedCharacterIds ?? [] }
    })
    expect(stored.cast).toHaveLength(1)
    /*
      And *not* also mentioned. The two lists are separate claims and a
      character in both is the record contradicting itself; present is the
      stronger one, so it replaces rather than joins.
    */
    expect(stored.mentioned).toEqual([])
  })

  test('and will not invent somebody to say is present', async ({ page }) => {
    /*
      The pair for the rule above, and the guard that matters: `@` offers to
      create a record for a name nothing answers — which is how a cast list
      grew a phantom once already. Asserting that a person is in the room is a
      claim about a person who exists.
    */
    const draft = await openSceneDraft(page)

    // Named exactly: a single "@" offers a create row per kind, so a loose
    // /Wenmere/ matches character, item and place at once.
    await draft.fill('Somebody spoke. @Wenmere')
    await expect(page.getByRole('button', { name: 'Wenmere new character' })).toBeVisible()

    await draft.fill('Somebody spoke. @@Wenmere')
    await expect(page.getByRole('button', { name: /Wenmere/ })).toHaveCount(0)
  })

  /**
   * **The card must read the event, not a copy of it.**
   *
   * `EventCard` held the cast in `useState` seeded from the prop and re-synced
   * only when the edit form opened or closed. That was safe while the card was
   * the only writer — and stopped being safe the moment `@@` began writing
   * presence through `updateEvent`. The card went on showing the cast it had
   * mounted with, and its own **+ Add character** wrote that stale array back,
   * destroying every assertion typed since the card opened.
   *
   * A writer lost two characters this way in four scenes and could only tell
   * by reading IndexedDB: on screen, nothing happened but a name appearing.
   */
  test('a name typed with @@ survives the card adding another', async ({ page }) => {
    const draft = await openSceneDraft(page)

    // A second character, so the card has somebody to add afterwards.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.characters.add({
        id: 'mira', worldId: (location.hash.split('/worlds/')[1] ?? '').split('/')[0],
        name: 'Mira', description: '', aliases: [], tags: [], portraitImageId: null,
        isAlive: true, color: null, createdAt: now, updatedAt: now,
      })
    })

    await draft.fill('The door opened. @@Kae')
    await page.getByRole('button', { name: 'Kael' }).click()

    // The card shows it without a reload — the display half of the same fault.
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Remove Kael from this scene' })).toBeVisible()

    // Now add the other character through the card's own control.
    await main.getByRole('button', { name: /Add character/ }).click()
    await page.getByRole('option', { name: 'Mira' }).click()

    /*
      Wait for the write to reach the screen before reading the store. Reading
      straight after the click raced `updateEvent` and reported a cast of one —
      which looked exactly like the bug this test is about, and was not.
    */
    await expect(main.getByRole('button', { name: 'Remove Mira from this scene' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Remove Kael from this scene' })).toBeVisible()

    const cast = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { toArray: () => Promise<Array<{ involvedCharacterIds: string[] }>> }>
      return (await db.events.toArray())[0]?.involvedCharacterIds ?? []
    })
    // Two, not one. Before the fix the card wrote back its stale [] plus Mira.
    expect(cast).toHaveLength(2)
  })

  test('and cannot then also be recorded as merely mentioned', async ({ page }) => {
    /*
      The guide says a character "cannot be both" present and mentioned. That
      was only true while nothing had gone stale: `addMention`'s guard reads
      the cast, and against a copy it let one friendly click on the "Named in
      the text" chip put a `@@` character into both lists at once.
    */
    const draft = await openSceneDraft(page)
    await draft.fill('The door opened. @@Kae')
    await page.getByRole('button', { name: 'Kael' }).click()

    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Remove Kael from this scene' })).toBeVisible()

    // The nudge offers names found in the prose that are not accounted for.
    // Kael is accounted for — as present — so he must not be on offer.
    await expect(main.getByRole('button', { name: /record.*mention.*Kael|Kael.*mention/i })).toHaveCount(0)

    const stored = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { toArray: () => Promise<Array<{ mentionedCharacterIds: string[] }>> }>
      return (await db.events.toArray())[0]?.mentionedCharacterIds ?? []
    })
    expect(stored).toEqual([])
  })

  /**
   * `@@` on somebody who does not exist says so.
   *
   * It deliberately offers people only and will not invent one, so an unknown
   * name produces no rows — and the picker used to render nothing at all. That
   * is the single moment a writer most wants `@@`: the first time somebody
   * walks into the book. A run measured five operations to recover, with no
   * way to tell "nothing to offer" from "the app stopped listening".
   */
  test('says why @@ found nobody, and points at the sigil that would', async ({ page }) => {
    const draft = await openSceneDraft(page)

    await draft.fill('The door opened. @@Bell-Anselm')
    await expect(page.getByText(/Nobody called .Bell-Anselm. yet/)).toBeVisible()

    /*
      The pair: a single `@` on the same unknown name *does* have something to
      offer, so the notice must not appear there. Without this half, a notice
      rendered unconditionally would pass.
    */
    await draft.fill('The door opened. @Bell-Anselm')
    await expect(page.getByText(/Nobody called/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Bell-Anselm new character' })).toBeVisible()
  })

  /**
   * The prose gets the name the writer uses, not the record's filing name.
   */
  test('inserts the alias that was being typed', async ({ page }) => {
    const draft = await openSceneDraft(page)

    // Kael exists; give him an alias the book actually uses.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { toArray: () => Promise<Array<{ id: string; name: string }>>; update: (id: string, v: unknown) => Promise<unknown> }>
      const all = await db.characters.toArray()
      const kael = all.find((c) => c.name === 'Kael')!
      await db.characters.update(kael.id, { name: 'Kael Ardeth', aliases: ['Kael'] })
    })

    await draft.fill('The door opened. @@Kael')
    // Named exactly: the nudge chip under the draft carries the same name, and
    // the picker row is the one with its kind appended.
    await page.getByRole('button', { name: 'Kael Ardeth character' }).click()

    // "Kael ", not "Kael Ardeth " — the surname the book never says.
    await expect(draft).toHaveValue('The door opened. Kael ')
  })
})
