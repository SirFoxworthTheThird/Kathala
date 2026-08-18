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
}

export function mentionSuggestions(
  query: string,
  candidates: readonly MentionCandidate[],
  { canCreateLocation, limit = 6 }: MentionPickerOptions,
): MentionSuggestion[] {
  const q = query.trim().toLowerCase()

  const existing = candidates
    .map((c) => ({ c, r: rank(c, q) }))
    .filter((x): x is { c: MentionCandidate; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || KIND_ORDER[a.c.kind] - KIND_ORDER[b.c.kind] || a.c.name.localeCompare(b.c.name))
    .map(({ c }): MentionSuggestion => ({ type: 'existing', kind: c.kind, id: c.id, name: c.name }))

  if (!q) return existing.slice(0, limit)

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
