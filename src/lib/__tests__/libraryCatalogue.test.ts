import { describe, it, expect } from 'vitest'
import { parseLibraryIndex } from '@/lib/library'
import rawIndex from '../../../public/library/index.json'

/** Every shipped `.pwk`, read through Vite so this stays browser-typed. */
const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function worldFor(data: string): Record<string, unknown> {
  const key = Object.keys(worldFiles).find((k) => k.endsWith(`/${data}`))
  if (!key) throw new Error(`No shipped file for ${data}`)
  return JSON.parse(worldFiles[key]) as Record<string, unknown>
}

/**
 * Guards on the catalogue that actually ships, rather than on the code that
 * reads it. A broken manifest or a stray file would only show up as an empty
 * dialog in production.
 */

const index = parseLibraryIndex(rawIndex)

describe('the published library catalogue', () => {
  it('is valid and not empty', () => {
    expect(index.entries.length).toBeGreaterThan(0)
  })

  it('uses unique slugs and unique world ids', () => {
    // Two entries sharing a world id would silently overwrite each other on
    // download, since import reuses the id in the file.
    const ids = index.entries.map((e) => e.id)
    const worldIds = index.entries.map((e) => e.worldId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(worldIds).size).toBe(worldIds.length)
  })

  for (const entry of index.entries) {
    describe(entry.title, () => {
      it('ships the file the manifest points at', () => {
        expect(() => worldFor(entry.data)).not.toThrow()
      })

      it('names the author and carries an attribution notice', () => {
        expect(entry.author.trim()).not.toBe('')
        expect(entry.notice).toMatch(/unofficial/i)
      })

      it('contains no prose from the book', () => {
        // The catalogue is structural reference only — characters, chapters,
        // events, places. Shipping scene text would be republishing the novel,
        // so this is asserted on the file rather than left to a convention.
        const world = worldFor(entry.data)
        expect(world.sceneTexts ?? [], 'sceneTexts').toEqual([])
        expect(world.sceneRevisions ?? [], 'sceneRevisions').toEqual([])
      })

      it('declares counts that match what is in the file', () => {
        if (!entry.counts) return
        const world = worldFor(entry.data) as Record<string, unknown[]>
        if (entry.counts.characters !== undefined) {
          expect(world.characters.length).toBe(entry.counts.characters)
        }
        if (entry.counts.chapters !== undefined) {
          expect(world.chapters.length).toBe(entry.counts.chapters)
        }
        if (entry.counts.events !== undefined) {
          expect(world.events.length).toBe(entry.counts.events)
        }
        if (entry.counts.locations !== undefined) {
          expect(world.locationMarkers.length).toBe(entry.counts.locations)
        }
      })

      it('arrives in reading mode', () => {
        // A library world is a reference to someone else's book. It should be
        // spoiler-gated the moment it lands, not after the reader finds a
        // setting they had no reason to look for.
        const world = worldFor(entry.data) as { world: { readingMode?: boolean } }
        expect(world.world.readingMode).toBe(true)
      })

      it('states the world id the file actually carries', () => {
        const world = worldFor(entry.data) as { world: { id: string } }
        expect(world.world.id).toBe(entry.worldId)
      })
    })
  }
})
