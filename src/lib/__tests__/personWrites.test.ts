import { describe, it, expect } from 'vitest'

/**
 * A person's state has one write path (next-plan.md, Part B3): `sayPerson`,
 * with the scene as its own argument and only what the scene says as what is
 * said. A source rule, in the manner of `snapshotWriteScenes.test.ts`, because
 * the mistakes it rules out have been made in exactly these shapes:
 *
 * - **A whole state spread into a write.** `upsertSnapshot` takes one — a
 *   caller's copy of the state before, which is how a resolved record from an
 *   earlier scene carried its scene into the write four times, and how every
 *   field nobody touched was copied into the next record (W-2, F2). It is
 *   kept for tests and bulk writers holding a whole state; app code says what
 *   it says through `sayPerson`.
 * - **A record written past the write path**, which skips what it decides:
 *   whether anything changed, what the scene already said, the journal. Only
 *   the write path itself, the migration, the import, the bulk writers that
 *   go past the journal on purpose and reset it, and the cascades of a delete
 *   write the table directly. The migrations write through `tx.table(…)`,
 *   which this does not read: a migration is a step of its own, reviewed as one.
 */

const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**', '!../../test/**'], {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const name = (path: string) => path.replace(/^.*\//, '')

/**
 * Each statement that reaches the table — `db.characterSnapshots` and the
 * calls chained onto it on the lines after — and whether it writes.
 */
export function tableWrites(src: string): string[] {
  const out: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].indexOf('db.characterSnapshots')
    if (at === -1) continue
    let chunk = lines[i].slice(at)
    for (let j = i + 1; j < lines.length && /^\s*\./.test(lines[j]); j++) chunk += lines[j].trim()
    if (/\.(add|put|bulkPut|bulkAdd|update|modify)\(/.test(chunk)) out.push(chunk.replace(/\s+/g, ' ').slice(0, 120))
  }
  return out
}

/** Files that may write the table directly, and why. */
const MAY_WRITE: Record<string, string> = {
  'useSnapshots.ts': 'the write path itself, deletes, and making bulk-written records sparse (`sparseAt`)',
  'exportImport.ts': 'the import',
  'ChapterAIDialog.tsx': 'the chapter AI import, past the journal, which it resets',
  'useSequel.ts': "the sequel's opening states, into a new world",
  'useLocationMarkers.ts': 'a deleted place, said of nobody any more',
  'useMapLayers.ts': "a deleted map's places, said of nobody any more",
  'useTravelModes.ts': 'a deleted travel mode, said of nobody any more',
  'useItems.ts': 'a deleted item, out of any inventory a record still lists',
  'sortKey.ts': "a scene's stored position, moved with it",
}

describe('a person’s state has one write path', () => {
  it('has sources to read, and finds the writes in them', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200)
    expect(Object.values(sources).flatMap(tableWrites).length).toBeGreaterThan(5)
    // Paired with the rule below: the glob reaches app code, and leaves tests out.
    expect(Object.keys(sources).some((p) => p.endsWith('useSnapshots.ts'))).toBe(true)
    expect(Object.keys(sources).some((p) => p.includes('__tests__'))).toBe(false)
  })

  it('is said through sayPerson: no app code writes a whole state', () => {
    const offenders = Object.entries(sources)
      .filter(([path, src]) => name(path) !== 'useSnapshots.ts' && /\bupsertSnapshot\(/.test(src))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('writes the table directly only where it has to', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !(name(path) in MAY_WRITE))
      .flatMap(([path, src]) => tableWrites(src).map((w) => `${path}: ${w}`))
    expect(offenders).toEqual([])
    // Each file allowed to is one that does: an entry nobody needs is a door left open.
    const writers = new Set(Object.entries(sources).filter(([, src]) => tableWrites(src).length > 0).map(([path]) => name(path)))
    expect(Object.keys(MAY_WRITE).filter((f) => !writers.has(f))).toEqual([])
  })

  it('reads the writes it claims to read, so the scan is not vacuous', () => {
    expect(tableWrites('await db.characterSnapshots.put(record)')).toHaveLength(1)
    // A chain over several lines is one statement.
    expect(tableWrites('await db.characterSnapshots\n  .filter((s) => s.x)\n  .modify({ x: null })')).toHaveLength(1)
    // And a read is not a write.
    expect(tableWrites('const own = await db.characterSnapshots.where("characterId").equals(id).toArray()')).toEqual([])
    expect(tableWrites('await db.characterSnapshots\n  .where("eventId")\n  .equals(id)\n  .first()')).toEqual([])
  })
})
