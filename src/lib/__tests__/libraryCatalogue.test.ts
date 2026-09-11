import { describe, it, expect } from 'vitest'
import { parseLibraryIndex } from '@/lib/library'
import rawIndex from '../../../public/library/index.json'

/** Every shipped `.pwk`, read through Vite so this stays browser-typed. */
const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const bundledImages = import.meta.glob('../../../public/library/**/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

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

  it('keeps the Odyssey manuscript cover readable without a cross-origin request', () => {
    const entry = index.entries.find((candidate) => candidate.id === 'the-odyssey')
    expect(entry?.cover).toBe('library/the-odyssey/art/cover.png')
    expect(Object.keys(bundledImages).some((path) => path.endsWith('/the-odyssey/art/cover.png'))).toBe(true)
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

      it('ships scene prose only with declared public-domain provenance', () => {
        // Copyrighted examples remain structural references. A public-domain
        // source may include prose when the catalogue declares that basis and
        // every draft resolves uniquely to a modeled event.
        const world = worldFor(entry.data)
        const sceneTexts = (world.sceneTexts ?? []) as Array<{ eventId: string }>
        const events = world.events as Array<{ id: string }>
        if (sceneTexts.length > 0) {
          expect(entry.notice).toMatch(/(?:original (?:scene drafts|prose)|public-domain translation)/i)
          expect(sceneTexts).toHaveLength(events.length)
          expect(new Set(sceneTexts.map((scene) => scene.eventId)).size).toBe(events.length)
        }
        expect(world.sceneRevisions ?? [], 'sceneRevisions').toEqual([])
      })

      it('advertises a cover only where the world really links one', () => {
        // The manifest is hand-maintained, so a cover could drift from the
        // world it claims to belong to, or outlive one that was swapped for an
        // uploaded image. Both would put the wrong book on the card.
        const world = worldFor(entry.data) as Record<string, unknown>
        const coverId = (world.world as Record<string, unknown> | undefined)?.coverImageId
        const blobs = (world.blobs ?? []) as Array<Record<string, unknown>>
        const linked = coverId ? blobs.find((b) => b.id === coverId)?.url : undefined

        if (entry.cover === undefined) {
          // No claim made. Fine — but not because the world had one to give
          // that we forgot to list.
          expect(linked ?? null, 'world links a cover the manifest omits').toBeNull()
        } else {
          expect(entry.cover).toBe(linked)
          /*
            Either a link out to the web, or a file this app ships. W23-7 moved
            the project's own artwork from `raw.githubusercontent.com/…` to a
            path resolved against `import.meta.env.BASE_URL`, so a cover is no
            longer necessarily absolute — but it must still be one of the two
            shapes, never a bare filename or an accidental empty string.
          */
          expect(entry.cover).toMatch(/^(https:\/\/|library\/)/)
        }
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
