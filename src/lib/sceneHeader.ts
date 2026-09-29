/**
 * The line at the top of a scene that says where it happens and who is there.
 *
 *     [#The Kitchen @@Wren Halloway @@Sal'ka]
 *
 * **Assertion-space, by position.** Every other way of recording this has had
 * to solve the same problem — prose narrates, it does not assert — by making
 * the keystroke carry the claim: one `@` means mentioned, two mean present.
 * That works, and it depends on the writer holding a convention in their head.
 * A bracketed line at the top of a scene solves it structurally: there,
 * writing *is* declaring, and nothing is inferred from a sentence.
 *
 * It also says the one thing no sigil could. A character can be **present and
 * never named in the text** — someone on the stairs, deliberately unmentioned
 * — and the only way to record that was to type `@@Name`, let the picker
 * insert it, and delete the fourteen characters it had just written. A writer
 * called that "a trick I discovered rather than something offered".
 *
 * ## The header is never stored
 *
 * It is **rendered from the scene's own records** every time the box is drawn,
 * and parsed back when the writer edits it. `sceneTexts.text` holds prose and
 * nothing else.
 *
 * That is not a detail. Storing the header in the prose would have meant two
 * editable copies of one fact — the header and the cast panel — and keeping
 * them in step is exactly the shape that silently destroyed a writer's cast
 * this morning, moved into the text where it is worse. Rendering means a
 * change made anywhere shows up here by construction, with no sync to drift.
 *
 * It also means the fourteen things that read scene prose — five exports, the
 * manuscript, search, find-and-replace, reading mode, the continuity checker,
 * the word count that feeds the pacing curve and the daily goal — need to know
 * nothing about it. A header cannot leak into a book it was never in.
 */

export interface SceneHeader {
  /** The place named after `#`, or null when the header names none. */
  place: string | null
  /** Names given after `@@`, in the order written, trimmed and de-duplicated. */
  characters: string[]
}

/** Renders the line. Empty string when there is nothing to say. */
export function formatSceneHeader(header: SceneHeader): string {
  const parts: string[] = []
  if (header.place?.trim()) parts.push(`#${header.place.trim()}`)
  for (const name of header.characters) if (name.trim()) parts.push(`@@${name.trim()}`)
  return parts.length ? `[${parts.join(' ')}]` : ''
}

/**
 * Split a scene's displayed text into its header line and its prose.
 *
 * Only the **first non-empty line** can be a header, and only when it is a
 * complete `[…]` that names at least one person or place. Anything else is
 * prose that happens to start with a bracket, which is a thing prose does —
 * see `namesAnything`.
 */
export function splitSceneHeader(text: string): { header: string | null; body: string } {
  const match = /^[ \t]*(\[[^\n\]]*\])[ \t]*(?:\r?\n)?/.exec(text)
  if (!match) return { header: null, body: text }
  if (!namesAnything(match[1])) return { header: null, body: text }
  return { header: match[1], body: text.slice(match[0].length).replace(/^\r?\n/, '') }
}

/**
 * Whether a bracketed line asserts anything — one person, or one place.
 *
 * The shape of a header is not enough to be one. A writer scribbling
 * `[check: does the assize sit through low water?]` at the top of a draft has
 * written a margin note in the only punctuation margin notes use, and reading
 * it as a declaration answered it by emptying the scene: the note itself was
 * consumed as a header and never stored, the cast and the setting were cleared
 * because the note named nobody, and the real header — one line further down by
 * then — was saved as a paragraph of the book and exported as one.
 *
 * So a bracket that names nobody and nowhere is prose, which is what it was.
 * The test for it is the parse, not a second pattern, because anything the
 * parser cannot find a name in is a line the header has nothing to say about.
 */
function namesAnything(header: string): boolean {
  const { place, characters } = parseSceneHeader(header)
  return place !== null || characters.length > 0
}

/**
 * Read a header line.
 *
 * A name runs until the next sigil or the closing bracket, because names have
 * spaces in them — 68% of the names in the shipped library are not one word.
 * Returns nulls rather than throwing on a malformed line: half-typed is the
 * normal state of a line somebody is typing.
 */
export function parseSceneHeader(header: string): SceneHeader {
  const inner = /^\[(.*)\]$/.exec(header.trim())?.[1] ?? ''
  const place: string[] = []
  const characters: string[] = []
  /*
    `@@` before `@`, so two sigils are one token and not an empty name followed
    by a real one — and both before `#`, so a `#` inside a name is not read as
    a new token.

    A single `@` names a character here, though the line is always *written*
    with two. Inside the brackets there is nothing else it could mean: a header
    asserts presence by being a header, so the second sigil carries no
    information there. It used to carry the whole line instead — `[#Court
    @Sella]` read Sella as part of the place name and then dropped her, which
    is a silent no-op on the one gesture the picker's own notice recommends.
  */
  for (const [, sigil, raw] of inner.matchAll(/(@@|@|#)([^@#\]]*)/g)) {
    const name = raw.trim()
    if (!name) continue
    if (sigil === '#') place.push(name)
    else if (!characters.includes(name)) characters.push(name)
  }
  return { place: place[0] ?? null, characters }
}

/**
 * Split what is *in the box* into header and prose, knowing the line that was
 * rendered into it.
 *
 * `splitSceneHeader` reads a string cold and can only look at the first line.
 * That is not enough on its own, because a writer who types a margin note above
 * the rendered line pushes it down to line two — and a header that is no longer
 * line one is, to a cold read, a paragraph of the book. It exported as one.
 *
 * The box is not a cold read: we know exactly what we put in it. So when the
 * first line is not a header, the rendered line is looked for and lifted back
 * out, whatever the writer typed above it. Their note stays, as the prose it
 * is; the line stays the line; and the two cannot be confused for each other,
 * because one of them is a string we wrote ourselves.
 *
 * Pass `''` for `rendered` when the records say nothing — then this is
 * `splitSceneHeader`, and a bracket in the box is prose.
 */
export function splitSceneDraft(
  text: string,
  rendered: string,
): { header: string | null; body: string } {
  const direct = splitSceneHeader(text)
  if (direct.header || !rendered) return direct
  const at = text.indexOf(rendered)
  if (at === -1) return direct
  const before = text.slice(0, at)
  // One newline, so lifting the line out does not leave the gap it sat in.
  const after = text.slice(at + rendered.length).replace(/^\n/, '')
  return { header: rendered, body: `${before}${after}`.replace(/^\n+/, '') }
}

/** What a header line changes, and what in it the world could not answer. */
export interface HeaderPlan {
  /** Names nothing answers, and a place nothing answers — said, and otherwise left alone. */
  unknown: { names: string[]; place: string | null }
  /** The scene's new cast, mentions and setting, or null when the line changes nothing. */
  update: { involvedCharacterIds: string[]; mentionedCharacterIds: string[]; locationMarkerId: string | null } | null
}

/**
 * Read a header line against the world and say what the scene becomes. The
 * rules of a scene card's draft and the Manuscript's Page, in one place.
 *
 * `involved` is the cast the line is read against: a card being edited passes
 * the cast it is editing, which is not always the stored one.
 *
 * No header is no change — deleting the line is how somebody clears their
 * screen, not how they empty their cast.
 */
export function planHeader(
  header: string | null,
  world: {
    characters: ReadonlyArray<{ id: string; name: string; aliases?: string[] }>
    places: ReadonlyArray<{ id: string; name: string }>
  },
  scene: { involved: string[]; mentioned: string[]; place: string | null },
): HeaderPlan {
  if (!header) return { unknown: { names: [], place: null }, update: null }
  const parsed = parseSceneHeader(header)

  const matches = (name: string, against: string, aliases?: string[]) =>
    against.toLowerCase() === name.toLowerCase()
    || !!aliases?.some((a) => a.toLowerCase() === name.toLowerCase())

  const found = parsed.characters.map((n) => ({
    name: n, record: world.characters.find((c) => matches(n, c.name, c.aliases)),
  }))
  const place = parsed.place
    ? world.places.find((m) => matches(parsed.place!, m.name))
    : undefined
  const unmatched = found.filter((f) => !f.record).map((f) => f.name)
  const unknownPlace = parsed.place && !place ? parsed.place : null

  /*
    A place the header names but the world does not have keeps the setting
    it had: the writer meant to put the scene somewhere, and clearing it
    would answer a typo by throwing away the answer.

    That sentence is true of people word for word, and people were the case
    that dropped. `@@Juno Skeling` took Juno Skelling out of the scene, and
    so did the comma a writer puts between names by habit — one mistyped
    letter, and somebody was no longer in the room. So a header naming
    anybody this world cannot answer leaves the cast alone and says so; the
    names stay on the line, where the letter can be fixed in place.
  */
  const nextCast = unmatched.length > 0
    ? scene.involved
    : found.flatMap((f) => (f.record ? [f.record.id] : []))
  const nextPlace = parsed.place ? (place?.id ?? scene.place) : null
  const castUnchanged = nextCast.length === scene.involved.length
    && nextCast.every((id, i) => scene.involved[i] === id)
  const unknown = { names: unmatched, place: unknownPlace }
  if (castUnchanged && nextPlace === scene.place) return { unknown, update: null }
  return {
    unknown,
    update: {
      involvedCharacterIds: nextCast,
      /*
        Presence replaces a mention rather than sitting beside it, which is
        what `@@` in the prose does and what the guide promises of both. The
        header used to leave a character in the cast *and* in the mentioned
        list — two mutually exclusive claims, in one record, that nothing
        reported.
      */
      mentionedCharacterIds: scene.mentioned.filter((id) => !nextCast.includes(id)),
      locationMarkerId: nextPlace,
    },
  }
}

/** Whether a plan left everything on the line answered. */
export const planIsClean = (plan: HeaderPlan) => plan.unknown.names.length === 0 && plan.unknown.place === null

/** The prose alone — what is stored, counted, compiled and exported. */
export function sceneBody(text: string): string {
  return splitSceneHeader(text).body
}
