import { describe, it, expect } from 'vitest'
import { SHARED } from '@/db/database'

/**
 * **A book reads its bible through `bibleOf`, and its own records of a shared
 * entity through `inBook`** (issue #698, part 1).
 *
 * A book of a series keeps no cast of its own: its characters, items, places
 * and maps, factions and lore are its series' rows, under the series' id. A read
 * of one of those tables by the book's own id finds nothing, and looks exactly
 * like a book with no cast: no error, an empty list. 159 reads were changed to
 * go through `bibleOf`; this keeps the 160th from being written without it.
 *
 * The other half: a shared character has records in every book of the series,
 * so a read of a per-scene table *by the character* (`where('characterId')`)
 * finds every book's. What is true in a book is read from that book's own, by
 * `inBook`. A delete by the entity is right as it is: deleting a shared
 * character takes its states from every book.
 *
 * **What this does not catch:** a read that names its id through a variable
 * built elsewhere (`const key = book.id; …equals(key)`) passes, and so does an
 * `inBook` given the wrong world. It finds the reads that forgot, not the ones
 * that are wrong on purpose.
 */

const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**'], {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** A table read through `where(...)`, with what follows it to the end of its statement's line. */
function reads(src: string, tables: readonly string[], key: RegExp): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = []
  // A chain split over lines (\`db.mapLayers\` / \`.where('worldId')\` / \`.equals(id)\`) read as one: the first scan missed one, and a book of a series showed no maps.
  const lines = src.replace(/\n\s*\./g, '.').split('\n')
  const re = new RegExp(`db\\.(?:${tables.join('|')})\\.where\\(${key.source}\\)`)
  lines.forEach((text, k) => { if (re.test(text)) out.push({ line: k + 1, text }) })
  return out
}

/** Deleting a whole world, or a file's rows before it comes in, goes by the world's own id: a book's delete must not take its series' bible. */
const OWN_ID_DELETES = ['/hooks/useWorlds.ts', '/exportImport.ts']

describe('a book reads its bible through bibleOf', () => {
  it('every read of a shared table by world names bibleOf', () => {
    const missing: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      for (const { line, text } of reads(src, SHARED, /'worldId'/)) {
        if (text.includes('bibleOf(')) continue
        if (text.includes('.delete()') && OWN_ID_DELETES.some((f) => path.endsWith(f))) continue
        missing.push(`${path}:${line}: ${text.trim()}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('a book’s delete goes by its own id, never its bible’s', () => {
    const wrong: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      if (!OWN_ID_DELETES.some((f) => path.endsWith(f))) continue
      for (const { line, text } of reads(src, SHARED, /'worldId'/)) {
        if (text.includes('.delete()') && text.includes('bibleOf(')) wrong.push(`${path}:${line}: ${text.trim()}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('every read of a book’s records by a shared entity keeps to the book (inBook)', () => {
    const perScene = ['characterSnapshots', 'characterMovements', 'itemPlacements', 'locationSnapshots', 'itemSnapshots', 'itemCustody', 'relationshipSnapshots', 'mapRegionSnapshots', 'characterGoals']
    const missing: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      for (const { line, text } of reads(src, perScene, /'(?:characterId|itemId|locationMarkerId|relationshipId|regionId|holderId)'/)) {
        // A read narrowed to one of the book's scenes (`.filter((p) => p.eventId === …)`) is the book's already.
        if (text.includes('inBook(') || text.includes('.delete()') || /\.filter\(\(\w+\) => \w+\.eventId === /.test(text)) continue
        missing.push(`${path}:${line}: ${text.trim()}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('a screen does not take a shared entity’s world for the book open: a shared character’s is its series’', () => {
    // CurrentStateTab read the book's scenes and wrote its states by \`character.worldId\`: in a series, the series' id.
    const wrong: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      if (!path.includes('/features/')) continue
      src.split('\n').forEach((text, k) => {
        if (/\b(?:character|item|marker|layer|mapLayer|faction|region|route|relationship|category)\.worldId\b/.test(text)) wrong.push(`${path}:${k + 1}: ${text.trim()}`)
      })
    }
    expect(wrong).toEqual([])
  })

  it('finds what it is looking for: the scan sees both kinds of read', () => {
    const all = Object.values(sources).join('\n')
    expect(reads(all, SHARED, /'worldId'/).length).toBeGreaterThan(150)
    expect(reads(all, ['characterSnapshots'], /'characterId'/).length).toBeGreaterThan(3)
  })
})
