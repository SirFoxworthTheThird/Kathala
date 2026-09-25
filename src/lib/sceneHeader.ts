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
 * complete `[…]`. Anything else is prose that happens to start with a bracket,
 * which is a thing prose does.
 */
export function splitSceneHeader(text: string): { header: string | null; body: string } {
  const match = /^[ \t]*(\[[^\n\]]*\])[ \t]*(?:\r?\n)?/.exec(text)
  if (!match) return { header: null, body: text }
  return { header: match[1], body: text.slice(match[0].length).replace(/^\r?\n/, '') }
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
  // `@@` before `#`, so a `#` inside a name is not read as a new token.
  for (const [, sigil, raw] of inner.matchAll(/(@@|#)([^@#\]]*)/g)) {
    const name = raw.trim()
    if (!name) continue
    if (sigil === '#') place.push(name)
    else if (!characters.includes(name)) characters.push(name)
  }
  return { place: place[0] ?? null, characters }
}

/** The prose alone — what is stored, counted, compiled and exported. */
export function sceneBody(text: string): string {
  return splitSceneHeader(text).body
}
