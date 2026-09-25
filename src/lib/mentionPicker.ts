/**
 * What the "@" picker in the scene draft offers.
 *
 * It used to offer characters only, and only ones that already existed. A
 * writer naming a sword or a house mid-sentence had to leave the prose, make
 * the record, and come back — which is the thing the picker was built to avoid
 * for people.
 *
 * Kept as a pure function because the ordering is the whole substance: which
 * kind wins a tie, whether an exact name suppresses the offer to create
 * another, and what happens when a world has no map. None of that is visible in
 * a screenshot.
 */
export type MentionKind = 'character' | 'item' | 'location'

export interface MentionCandidate {
  id: string
  kind: MentionKind
  name: string
  aliases?: string[]
}

export type MentionSuggestion =
  | { type: 'existing'; kind: MentionKind; id: string; name: string }
  | { type: 'create'; kind: MentionKind; name: string }

/**
 * What the writer is asserting by typing the sigil.
 *
 * `@Marn` says the name occurs in this scene. `@@Marn` says **he is in the
 * room** — the one thing a writer most wants to state while writing, and the
 * one thing the picker could not say.
 *
 * The distinction is the whole safety of the feature. Prose narrates rather
 * than asserts: *"Vey was not there"*, *"he imagined Marn in the Ossuary"*,
 * *"she still had the key — or thought she did"*. Nothing here reads a
 * sentence and decides what it means. The doubled sigil is a deliberate
 * keystroke that says *I am telling you he is here*, which is the same
 * principle as Tab-not-Enter for creating a record: changing the world needs
 * an unambiguous gesture.
 */
export type MentionIntent = 'mention' | 'present'

/** Where an in-progress "@name" sits in the prose. It always ends at the caret. */
export interface MentionToken {
  /** Index of the first "@" — both of them, when the sigil is doubled. */
  start: number
  /** Caret position — the end of the token. */
  end: number
  /** What has been typed after the sigil, without a trailing space. */
  query: string
  /** Which sigil was typed: one "@" mentions, two assert presence. */
  intent: MentionIntent
}

/** Letters, digits, and the two marks that live *inside* names. */
const NAME_WORD = /^[\p{L}\p{N}_'’-]+$/u
/** Names are short. Prose is not. */
const MAX_WORDS = 4
const MAX_CHARS = 48

/**
 * Read the "@" token immediately before the caret, if there is one.
 *
 * This used to be `/@(\w*)$/` in the editor, which is one `\w` run and so could
 * name nothing with a space, a hyphen or an apostrophe in it. **516 of the 760
 * character names in the shipped library (68%) are not a single `\w` run** —
 * Ysolde Vane, Barrow-wight, Durin's Bane, Renée de Saint-Méran. Typing the
 * surname closed the picker and left a literal "@Ysolde Vane" in the
 * manuscript, with nothing created and nothing said. The one thing the picker
 * exists for — naming a record without leaving the sentence — was unavailable
 * for most names a writer actually has.
 *
 * The hard part is not the spaces, it is stopping. A token that grows across
 * every space swallows the rest of the sentence, and while it is open the
 * picker owns the Enter key — so a paragraph break would silently commit a
 * suggestion instead. The rule that bounds it is how names are written rather
 * than a character count: **a word after the first extends the name only if it
 * is capitalised, or if the whole run so far still spells the beginning of a
 * record that already exists.** The second clause is what carries lowercase
 * particles — "Renée de Saint-Méran" is selectable — and the first is what
 * lets a new one be invented. Prose resumes at the first lowercase word, and
 * because the token has to end at the caret, resuming closes the picker.
 */
export function findMentionToken(
  text: string,
  caret: number,
  candidates: readonly MentionCandidate[] = [],
): MentionToken | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) return null

  /*
    Walk back over the whole run of "@", because the last one is not
    necessarily the first. `lastIndexOf` on "@@Marn" lands on the second
    sigil, and splicing from there would leave a stray "@" in the manuscript —
    the bug this picker exists to prevent, in miniature.

    One sigil mentions, two assert presence, and **three or more is not a
    token at all**. A run that long is punctuation or emphasis or a typo, and
    guessing which would be the app deciding what the writer meant.
  */
  let runStart = at
  while (runStart > 0 && before[runStart - 1] === '@') runStart -= 1
  const sigils = at - runStart + 1
  if (sigils > 2) return null
  const intent: MentionIntent = sigils === 2 ? 'present' : 'mention'

  // An "@" inside a word is an address, not a mention.
  if (runStart > 0 && /[\p{L}\p{N}]/u.test(before[runStart - 1])) return null

  const raw = before.slice(at + 1)
  if (raw.length > MAX_CHARS || /[\n\r]/.test(raw)) return null

  // One trailing space is kept: it is the moment between a forename and a
  // surname, and the picker blinking out there is the bug in miniature.
  const trailing = raw.endsWith(' ')
  const body = trailing ? raw.slice(0, -1) : raw
  if (body === '') return trailing ? null : { start: runStart, end: caret, query: '', intent }
  if (body.endsWith(' ')) return null

  const words = body.split(' ')
  if (words.length > MAX_WORDS) return null
  if (!words.every((w) => NAME_WORD.test(w))) return null

  const known = candidates.flatMap((c) => [c.name, ...(c.aliases ?? [])])
  for (let i = 1; i < words.length; i++) {
    if (/^\p{Lu}/u.test(words[i])) continue
    const sofar = words.slice(0, i + 1).join(' ').toLowerCase()
    if (known.some((n) => n.toLowerCase().startsWith(sofar))) continue
    return null
  }

  return { start: runStart, end: caret, query: body, intent }
}

/** Characters first: they are what most "@" typing is for, and the picker was
 *  theirs before it was anyone else's. */
const KIND_ORDER: Record<MentionKind, number> = { character: 0, item: 1, location: 2 }

function startsWith(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().startsWith(needle)
}

/** How well a candidate answers the query: lower is better, null is no match. */
function rank(candidate: MentionCandidate, query: string): number | null {
  if (!query) return 1
  if (startsWith(candidate.name, query)) return 0
  // Any word, not just the first: the old character-only picker keyed on the
  // first token, so "@hask" found nobody called Old Hask. A surname is exactly
  // what someone types.
  if (candidate.name.split(/\s+/).some((w) => startsWith(w, query))) return 1
  if (candidate.aliases?.some((a) => startsWith(a, query))) return 2
  return null
}

export interface MentionPickerOptions {
  /**
   * A location is a pin on a map, so one cannot be conjured in a world that has
   * no map to put it on. The row is withheld rather than creating a marker at
   * coordinates nobody chose.
   */
  canCreateLocation: boolean
  limit?: number
  /**
   * Which kinds the picker may offer. `@@` restricts this to characters:
   * presence is about people, and an item or a place "being present" is what
   * the single sigil already means.
   */
  kinds?: readonly MentionKind[]
  /**
   * Whether the picker may offer to invent a record.
   *
   * `@@` sets this false. Asserting that somebody is in the room is a claim
   * about a person who exists; conjuring one from a half-typed word is how a
   * cast list grows a phantom, which Enter-on-a-create-row already did once.
   * A new character is still one `@` away.
   */
  allowCreate?: boolean
}

export function mentionSuggestions(
  query: string,
  candidates: readonly MentionCandidate[],
  { canCreateLocation, limit = 6, kinds, allowCreate = true }: MentionPickerOptions,
): MentionSuggestion[] {
  const q = query.trim().toLowerCase()
  const offerable = kinds ? candidates.filter((c) => kinds.includes(c.kind)) : candidates

  const existing = offerable
    .map((c) => ({ c, r: rank(c, q) }))
    .filter((x): x is { c: MentionCandidate; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || KIND_ORDER[a.c.kind] - KIND_ORDER[b.c.kind] || a.c.name.localeCompare(b.c.name))
    .map(({ c }): MentionSuggestion => ({ type: 'existing', kind: c.kind, id: c.id, name: c.name }))

  if (!q || !allowCreate) return existing.slice(0, limit)

  // Nothing to create until the writer has typed a name, and nothing to create
  // if that name is already taken — offering "create Marren" under an existing
  // Marren is how a cast list ends up with two of everybody.
  const taken = new Set(candidates.map((c) => c.name.trim().toLowerCase()))
  const creatable: MentionKind[] = taken.has(q)
    ? []
    : canCreateLocation
      ? ['character', 'item', 'location']
      : ['character', 'item']

  const name = query.trim()
  const creates = creatable.map((kind): MentionSuggestion => ({ type: 'create', kind, name }))

  /*
    Existing records come first — a picker offering to make a second Marren
    above the real one would be actively harmful — but the create rows keep
    their places rather than being pushed off the end by a long match list.
    Typing a name nothing answers is precisely when someone needs them, and a
    world with nine characters called Mar-something is when they vanished.
  */
  const room = Math.max(1, limit - creates.length)
  return [...existing.slice(0, room), ...creates]
}
