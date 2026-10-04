import type { Character, CharacterAliasFrom, CharacterNameChange } from '@/types'

/**
 * What a character is called, at a point in the book.
 *
 * A name can change from a scene — Gandalf the Grey, then the White; Strider,
 * then Aragorn — and an alias can be learned at one — Elessar, in Lothlórien.
 * Which name the book uses is part of the story, so a reader is shown the one
 * in effect at their place, and the ones still to come are kept back. A writer
 * sees the character's own `name`.
 *
 * Positions are sort keys in reading order (`sortKeysByEvent`), and the
 * cursor is the reader's place: `null` is the whole book, as it is for the
 * reading gate. A change whose scene cannot be placed is treated as not
 * reached — the opposite of the gate's choice for an unplaceable event, on
 * purpose: held back, it costs the reader one name; let through, it costs them
 * the reveal.
 */

export type Named = Pick<Character, 'name' | 'aliases' | 'nameChanges' | 'aliasesFrom'>
export type SortKeyOf = (eventId: string) => number | undefined

function reached(eventId: string, cursor: number | null, sortKeyOf: SortKeyOf): boolean {
  const at = sortKeyOf(eventId)
  if (at === undefined) return false
  return cursor === null || at <= cursor
}

/** The changes reached by the cursor, in reading order. */
function changesReached(character: Named, cursor: number | null, sortKeyOf: SortKeyOf): CharacterNameChange[] {
  return (character.nameChanges ?? [])
    .filter((c) => c.name.trim() && reached(c.eventId, cursor, sortKeyOf))
    .map((c, i) => ({ c, i, at: sortKeyOf(c.eventId)! }))
    // Stable on ties: two changes at one scene take the later-written.
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(({ c }) => c)
}

const key = (s: string) => s.trim().toLowerCase()

/** The name in effect at the cursor: the last change reached, else the character's own. */
export function nameAt(character: Named, cursor: number | null, sortKeyOf: SortKeyOf): string {
  const changes = changesReached(character, cursor, sortKeyOf)
  return changes.length > 0 ? changes[changes.length - 1].name.trim() : character.name
}

/**
 * The other names known at the cursor: the aliases learned by then, and the
 * names already passed — once a reader has met Strider and then Aragorn, both
 * are things he has been called. Never the name in effect, and each once.
 */
export function aliasesAt(character: Named, cursor: number | null, sortKeyOf: SortKeyOf): string[] {
  const from = new Map((character.aliasesFrom ?? []).map((a) => [key(a.alias), a.eventId]))
  const known = character.aliases.filter((a) => {
    const at = from.get(key(a))
    return at === undefined || reached(at, cursor, sortKeyOf)
  })
  const changes = changesReached(character, cursor, sortKeyOf)
  /*
    Not the character's own name, even once a change is passed. It is the
    writer's name for them, and for Aragorn — first called Strider, at Bree —
    it is the reveal itself. Where it really was used before the first change,
    it is in the aliases already.
  */
  const passed = changes.slice(0, -1).map((c) => c.name.trim())
  const current = key(nameAt(character, cursor, sortKeyOf))
  const out: string[] = []
  const seen = new Set([current])
  for (const a of [...known, ...passed]) {
    const k = key(a)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(a.trim())
  }
  return out
}

/**
 * Every name the character goes by anywhere in the book — their own, the
 * aliases, and each changed name — for recognising them in the prose, where
 * all of them are the same person.
 */
export function allNames(character: Named): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of [character.name, ...character.aliases, ...(character.nameChanges ?? []).map((c) => c.name)]) {
    const k = key(n)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(n.trim())
  }
  return out
}

/**
 * The character's aliases for recognising them in the prose: every name but
 * their own. Where a consumer reads `aliases`, this is what to hand it.
 */
export function proseAliases(character: Named): string[] {
  return allNames(character).filter((n) => key(n) !== key(character.name))
}

/** The fields a scene's removal or a join changes, or null if neither points at it. */
export type NameScenePatch = Pick<Character, 'nameChanges' | 'aliasesFrom'>

/**
 * Point every change and alias at `from` at `to` instead — a join, where the
 * scene that goes is folded into the one that stays. With `to` null they are
 * dropped: there is nowhere left for them.
 *
 * A change landing on a scene that already has one of its own for the same
 * character is dropped: the scene's own is the more particular statement.
 */
export function moveNameScenes(character: Named, from: string, to: string | null): NameScenePatch | null {
  const changes = character.nameChanges ?? []
  const aliases = character.aliasesFrom ?? []
  if (!changes.some((c) => c.eventId === from) && !aliases.some((a) => a.eventId === from)) return null
  const already = to !== null && changes.some((c) => c.eventId === to)
  const nameChanges: CharacterNameChange[] = changes.flatMap((c) => {
    if (c.eventId !== from) return [c]
    return to === null || already ? [] : [{ ...c, eventId: to }]
  })
  const aliasesFrom: CharacterAliasFrom[] = aliases.flatMap((a) => {
    if (a.eventId !== from) return [a]
    return to === null ? [] : [{ ...a, eventId: to }]
  })
  return { nameChanges, aliasesFrom }
}

/**
 * Where a removed scene's changes go: the next scene in reading order that is
 * not being removed, else the previous one, else nowhere. Moved rather than
 * cleared because a change with no scene would hold from the start — the
 * spoiler — and one dropped would lose the reveal.
 */
export function sceneAfterRemoval(
  removed: string,
  removing: ReadonlySet<string>,
  sortKeys: ReadonlyMap<string, number>,
): string | null {
  const at = sortKeys.get(removed)
  if (at === undefined) return null
  let next: [string, number] | null = null
  let previous: [string, number] | null = null
  for (const [id, k] of sortKeys) {
    if (removing.has(id)) continue
    if (k > at || (k === at && id > removed)) {
      if (!next || k < next[1]) next = [id, k]
    } else if (!previous || k > previous[1]) {
      previous = [id, k]
    }
  }
  return (next ?? previous)?.[0] ?? null
}

/**
 * Every name the character goes by, put through `rename` — Find & replace's
 * *rename characters*. The changes and the aliases' *known from* entries go
 * with the aliases they name, or a renamed alias would lose the scene it is
 * learned at and be known from the start.
 */
export function renameNames(character: Named, rename: (name: string) => string): Required<Pick<Named, 'aliases' | 'nameChanges' | 'aliasesFrom'>> {
  return {
    aliases: character.aliases.map(rename),
    nameChanges: (character.nameChanges ?? []).map((c) => ({ ...c, name: rename(c.name) })),
    aliasesFrom: (character.aliasesFrom ?? []).map((a) => ({ ...a, alias: rename(a.alias) })),
  }
}

/** A change being edited: the scene may not be chosen yet. */
export interface DraftNameChange {
  key: string
  eventId: string | null
  name: string
}

/** The changes to store: those with a scene and a name. A row left half-filled is not a change. */
export function storedChanges(changes: readonly DraftNameChange[]): CharacterNameChange[] {
  return changes
    .filter((c) => c.eventId && c.name.trim())
    .map((c) => ({ eventId: c.eventId!, name: c.name.trim() }))
}

/** The *known from* entries to store: only for aliases the character still has. */
export function storedAliasesFrom(aliases: readonly string[], from: Readonly<Record<string, string>>): CharacterAliasFrom[] {
  return aliases.filter((a) => from[a]).map((alias) => ({ alias, eventId: from[alias] }))
}
