import type { Character } from '@/types'
import type { SortKeyOf } from './characterNames'

/**
 * Two characters who turn out to be one person.
 *
 * The book presents Hyde and Jekyll as two men until its reveal, and the app
 * keeps them as two records — each with their own whereabouts, relationships
 * and history — joined by one link on the character revealed: *Hyde is revealed
 * to be Jekyll, at Hyde Becomes Jekyll*. Jekyll is the pair's **head**.
 *
 * A group is one head and the characters revealed as them. So a character
 * cannot be revealed as themself, nor as someone who is already revealed as
 * someone else, and a head cannot be revealed in turn — no chains.
 */

type Identity = Pick<Character, 'id' | 'revealedAs'>
type Revealing = Partial<Pick<Character, 'revealedAs'>>

/** Who `id` may be revealed as: anyone but themself and anyone revealed as someone; nobody, if they are a head. */
export function revealTargets<T extends Identity>(characters: readonly T[], id: string): T[] {
  if (characters.some((c) => c.revealedAs?.characterId === id)) return []
  return characters.filter((c) => c.id !== id && !c.revealedAs)
}

/** Whether the reveal has been reached at the cursor. A reveal at a scene that cannot be placed has not. */
export function revealReached(character: Revealing, cursor: number | null, sortKeyOf: SortKeyOf): boolean {
  if (!character.revealedAs) return false
  const at = sortKeyOf(character.revealedAs.eventId)
  if (at === undefined) return false
  return cursor === null || at <= cursor
}

/**
 * The other people a character is, in a roster: who they are revealed to be,
 * and who is revealed to be them. Read from the roster handed in — for a reader
 * that is the gated one, whose links not yet reached are already gone and
 * whose unmet characters are not there to be found.
 */
export function identityLinks<T extends Identity>(roster: readonly T[], id: string): { revealedAs: T | null; alsoAs: T[] } {
  const self = roster.find((c) => c.id === id)
  const head = self?.revealedAs ? roster.find((c) => c.id === self.revealedAs!.characterId) ?? null : null
  return { revealedAs: head, alsoAs: roster.filter((c) => c.revealedAs?.characterId === id) }
}

/** One of the people a grouped character also is, for a reader: *also Edward Hyde (revealed at …)*. */
export interface AlsoAs {
  id: string
  name: string
  eventId: string
}

/**
 * Who each revealed character is shown as, for a reader at the cursor: their
 * head's id, keyed by theirs (**Part 2b**). From the reveal on, a reader is
 * shown one person — so Hyde, revealed to be Jekyll, is Jekyll on every screen
 * that resolves a character by id: a scene's cast, a state, a map token, a
 * holder, a member, a knower.
 *
 * `reached` says whether a reveal has been reached and its head met; a reveal
 * that has not is no link at all, and Hyde is nobody but Hyde.
 */
export function revealedHeads(
  characters: ReadonlyArray<Pick<Character, 'id' | 'revealedAs'>>,
  reached: (c: Pick<Character, 'id' | 'revealedAs'>) => boolean,
): Map<string, string> {
  const heads = new Map<string, string>()
  for (const c of characters) if (c.revealedAs && reached(c)) heads.set(c.id, c.revealedAs.characterId)
  return heads
}

/**
 * A roster as a reader is shown it after a reveal: the revealed character
 * leaves, and the head stays carrying their names — so either name finds them —
 * and who they also are, for their page to say. Anyone whose head is not in
 * the roster stays as they are: a grouping that removed them with nowhere to
 * go would make them vanish.
 */
export function presentRoster<T extends Pick<Character, 'id' | 'name' | 'aliases' | 'revealedAs'>>(
  roster: readonly T[],
  heads: ReadonlyMap<string, string>,
): Array<T & { alsoAs?: AlsoAs[] }> {
  const ids = new Set(roster.map((c) => c.id))
  const grouped = roster.filter((c) => heads.has(c.id) && ids.has(heads.get(c.id)!))
  if (grouped.length === 0) return [...roster]
  const leaving = new Set(grouped.map((c) => c.id))
  return roster.filter((c) => !leaving.has(c.id)).map((c) => {
    const members = grouped.filter((g) => heads.get(g.id) === c.id)
    if (members.length === 0) return c
    const names = members.flatMap((m) => [m.name, ...m.aliases])
    return {
      ...c,
      aliases: [...new Set([...c.aliases, ...names])].filter((n) => n !== c.name),
      alsoAs: members.map((m) => ({ id: m.id, name: m.name, eventId: m.revealedAs!.eventId })),
    }
  })
}

/*
  Resolving the records a reader is handed (**Part 2b**).

  Every screen a reader reaches looks characters up by id — a scene's cast, a
  state, a map token, a holder, a member, a knower, a lore page's links. Once
  Hyde has left the roster, an id that still says Hyde would make him vanish
  from his own scenes. So the hooks that hand those records to a reader pass
  them through these first, and Hyde's id arrives as Jekyll's.
*/

type IdentityOf = (characterId: string) => string

/** A scene's cast, POV and mentions, each id resolved; one entry for a pair even where both were cast. */
export function resolveCast<E extends { involvedCharacterIds: string[]; mentionedCharacterIds?: string[]; povCharacterId?: string | null }>(
  event: E,
  identityOf: IdentityOf,
): E {
  const involved = [...new Set(event.involvedCharacterIds.map(identityOf))]
  const changed = involved.length !== event.involvedCharacterIds.length || involved.some((id, i) => id !== event.involvedCharacterIds[i])
  const mentioned = event.mentionedCharacterIds
    ? [...new Set(event.mentionedCharacterIds.map(identityOf))].filter((id) => !involved.includes(id))
    : undefined
  const pov = event.povCharacterId ? identityOf(event.povCharacterId) : event.povCharacterId
  const mentionChanged = !!mentioned && (mentioned.length !== event.mentionedCharacterIds!.length || mentioned.some((id, i) => id !== event.mentionedCharacterIds![i]))
  if (!changed && !mentionChanged && pov === event.povCharacterId) return event
  return { ...event, involvedCharacterIds: involved, ...(mentioned ? { mentionedCharacterIds: mentioned } : {}), povCharacterId: pov }
}

/**
 * Records keyed by `characterId`, resolved: each says the head. Where two of a
 * group land in the same `slot` — both recorded at one scene, both members of
 * one faction — the head's own record is kept, since it is the one about the
 * person the reader is being shown. With no `slot`, every record is kept.
 */
export function resolveRecords<T extends { characterId: string }>(
  records: readonly T[],
  identityOf: IdentityOf,
  slot?: (record: T) => string,
): Array<T & { alsoRecordedAs?: string[] }> {
  if (!records.some((r) => identityOf(r.characterId) !== r.characterId)) return [...records]
  const resolved = records.map((r) => {
    const id = identityOf(r.characterId)
    return { record: id === r.characterId ? r : { ...r, characterId: id }, own: id === r.characterId, from: r.characterId }
  })
  if (!slot) return resolved.map((x) => x.record)
  const bySlot = new Map<string, (typeof resolved)[number] & { also: string[] }>()
  for (const x of resolved) {
    const key = `${x.record.characterId}\u0000${slot(x.record)}`
    const was = bySlot.get(key)
    if (!was) bySlot.set(key, { ...x, also: [] })
    else if (x.own && !was.own) bySlot.set(key, { ...x, also: [...was.also, was.from] })
    else was.also.push(x.from)
  }
  // The record kept for a slot says whose were set aside there: the Arc grid marks a scene where both were recorded.
  return [...bySlot.values()].map((x) => (x.also.length ? { ...x.record, alsoRecordedAs: x.also } : x.record))
}

/** Records between two characters — relationships — resolved; one between two of the same group is not drawn. */
export function resolvePairs<T extends { characterAId: string; characterBId: string }>(records: readonly T[], identityOf: IdentityOf): T[] {
  return records.flatMap((r) => {
    const a = identityOf(r.characterAId)
    const b = identityOf(r.characterBId)
    if (a === b) return []
    return a === r.characterAId && b === r.characterBId ? [r] : [{ ...r, characterAId: a, characterBId: b }]
  })
}

/** A list of entity ids — a lore page's links — resolved, each once. Ids that are not characters resolve to themselves. */
export function resolveIds(ids: readonly string[], identityOf: IdentityOf): string[] {
  return [...new Set(ids.map(identityOf))]
}

/**
 * Who learns each fact, once each, at the earliest they learn it — for a reader
 * past a reveal, Jekyll knows from the moment Hyde learned it, and is counted
 * once among those who know. `pos` places an event in reading order; one it
 * cannot place sorts last.
 */
export function firstLearned<R extends { factId: string; characterId: string; eventId: string }>(
  reveals: readonly R[],
  pos: ReadonlyMap<string, number>,
): R[] {
  const at = (r: R) => pos.get(r.eventId) ?? Infinity
  const first = new Map<string, R>()
  for (const r of reveals) {
    const key = `${r.factId}\u0000${r.characterId}`
    const was = first.get(key)
    if (!was || at(r) < at(was)) first.set(key, r)
  }
  return reveals.filter((r) => first.get(`${r.factId}\u0000${r.characterId}`) === r)
}
