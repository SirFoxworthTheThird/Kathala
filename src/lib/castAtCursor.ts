/** The parts of a character the cast split needs. */
interface CountableCharacter {
  id: string
  isAlive: boolean
}

/** The parts of a snapshot the cast split needs. */
interface CountableSnapshot {
  characterId: string
  isAlive: boolean
}

/**
 * How many of the cast are alive and dead **at the moment being viewed**.
 *
 * The dashboard used to count `character.isAlive`, which is the record's own
 * end-of-book flag and has nothing to say about the cursor. On the shipped
 * *Dracula* that read *14 alive, 11 dead* at chapter one — where Lucy, Renfield,
 * Quincey, Mrs Westenra, Mr Swales and the Count are all still alive — and the
 * identical figure at chapter twenty-seven. It sat directly beside a time cursor
 * and disagreed with it (**WRUN-4**).
 *
 * Worse in the other direction: **Current State → Deceased** writes the snapshot
 * and not the entity flag, so the one number a writer would check after killing
 * someone never moved at all.
 *
 * So the snapshot at the cursor decides it. Before a character's first record,
 * their first record does (UX-1-1, D-1): the flag is the end of the book, so
 * falling back to it counted *Dracula*'s eleven eventual dead as dead at chapter
 * one — WRUN-4 again, for everyone the story had not reached yet. A character
 * first recorded dead (dead before the story finds them) counts as dead from
 * the start; anyone else as alive. The flag is left for a character with no
 * record anywhere, which is most of a new world.
 *
 * `bestSnapshots` is expected to hold at most one entry per character: the last
 * one at or before the cursor, as `selectBestCharacterSnapshots` returns.
 * `firstRecords` likewise: each character's earliest record in the book, as
 * `firstRecordOf` returns.
 */
export function castAliveSplit(
  characters: readonly CountableCharacter[],
  bestSnapshots: readonly CountableSnapshot[],
  firstRecords: readonly CountableSnapshot[] = [],
): { alive: number; dead: number } {
  const aliveById = new Map<string, boolean>()
  for (const s of bestSnapshots) aliveById.set(s.characterId, s.isAlive)
  const firstById = new Map<string, boolean>()
  for (const s of firstRecords) firstById.set(s.characterId, s.isAlive)

  let alive = 0
  for (const c of characters) {
    if (aliveById.get(c.id) ?? firstById.get(c.id) ?? c.isAlive) alive++
  }
  return { alive, dead: characters.length - alive }
}

/**
 * Each character's earliest record in reading order, whole (`wholeRecords`),
 * so its `isAlive` is said rather than absent. `position` is the story's.
 */
export function firstRecordOf<T extends CountableSnapshot & { eventId: string }>(
  records: readonly T[],
  position: (eventId: string) => number,
): T[] {
  const first = new Map<string, T>()
  for (const r of records) {
    const had = first.get(r.characterId)
    if (!had || position(r.eventId) < position(had.eventId)) first.set(r.characterId, r)
  }
  return [...first.values()]
}
