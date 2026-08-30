import type { Character } from '@/types'

/**
 * Which characters the Arc grid draws a row for, and in what order (ARC-1,
 * ARC-3).
 *
 * The grid is 45 characters by 22 chapters, and a dozen of those rows were
 * entirely blank — a cave-troll with no recorded state took the same vertical
 * space as the protagonist. Alphabetical made it worse: Barrow-wight and Bill
 * the Pony sorted above Frodo, so the top of a screen-tall grid was reliably
 * the least interesting part of it.
 */
export type ArcOrder = 'name' | 'appearances'

export interface ArcRosterInput {
  characters: readonly Character[]
  /** Scenes each character appears in — POV, involved, or named in the prose. */
  appearances: ReadonlyMap<string, number>
  /** Snapshots authored for each character. Inherited state does not count. */
  recorded: ReadonlyMap<string, number>
  query: string
  order: ArcOrder
  hideUnrecorded: boolean
}

export interface ArcRoster {
  rows: Character[]
  /**
   * How many rows `hideUnrecorded` removed, so the control can say what it is
   * keeping back. Counted after the text filter, because a row the search
   * already excluded was not hidden by this.
   */
  hidden: number
}

export function arcRoster(input: ArcRosterInput): ArcRoster {
  const { characters, appearances, recorded, query, order, hideUnrecorded } = input

  const q = query.trim().toLowerCase()
  const matching = q
    ? characters.filter((c) => c.name.toLowerCase().includes(q))
    : [...characters]

  const kept = hideUnrecorded
    ? matching.filter((c) => (recorded.get(c.id) ?? 0) > 0)
    : matching

  const byName = (a: Character, b: Character) => a.name.localeCompare(b.name)
  const rows = [...kept].sort(
    order === 'appearances'
      // Ties fall back to the name rather than to input order, so the grid does
      // not reshuffle when an unrelated character gains a scene.
      ? (a, b) => ((appearances.get(b.id) ?? 0) - (appearances.get(a.id) ?? 0)) || byName(a, b)
      : byName,
  )

  return { rows, hidden: matching.length - kept.length }
}

/**
 * How many scenes each character appears in, counting a scene once however many
 * ways they are attached to it — being the POV *and* involved *and* mentioned
 * is one appearance, not three.
 */
export function countAppearances(
  events: readonly {
    povCharacterId?: string | null
    involvedCharacterIds?: string[]
    mentionedCharacterIds?: string[]
  }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const e of events) {
    const inScene = new Set<string>()
    if (e.povCharacterId) inScene.add(e.povCharacterId)
    for (const id of e.involvedCharacterIds ?? []) inScene.add(id)
    for (const id of e.mentionedCharacterIds ?? []) inScene.add(id)
    for (const id of inScene) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** How many snapshots were authored per character, keyed by character id. */
export function countRecorded(
  snapshots: readonly { characterId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of snapshots) counts.set(s.characterId, (counts.get(s.characterId) ?? 0) + 1)
  return counts
}
