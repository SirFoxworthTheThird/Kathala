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
 * So the snapshot at the cursor decides it, and the character's own flag is the
 * fallback for anyone with no snapshot yet — which is what a cast list shows
 * before any state has been recorded, and the only sensible answer for someone
 * the story has not placed anywhere.
 *
 * `bestSnapshots` is expected to hold at most one entry per character: the last
 * one at or before the cursor, as `selectBestCharacterSnapshots` returns.
 */
export function castAliveSplit(
  characters: readonly CountableCharacter[],
  bestSnapshots: readonly CountableSnapshot[],
): { alive: number; dead: number } {
  const aliveById = new Map<string, boolean>()
  for (const s of bestSnapshots) aliveById.set(s.characterId, s.isAlive)

  let alive = 0
  for (const c of characters) {
    if (aliveById.get(c.id) ?? c.isAlive) alive++
  }
  return { alive, dead: characters.length - alive }
}
