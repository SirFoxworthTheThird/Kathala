import { describe, expect, it } from 'vitest'
import { parseLibraryIndex } from '@/lib/library'
import rawIndex from '../../../public/library/index.json'

const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

type Ref = { id: string }
type Timeline = Ref
type Chapter = Ref & { timelineId: string }
type Event = Ref & {
  chapterId: string
  involvedCharacterIds: string[]
  tension: number | null
  travelDays: number
}
type Location = Ref & {
  mapLayerId: string
  linkedMapLayerId?: string | null
  name: string
  description: string
  x?: number
  y?: number
}
type MapLayer = Ref & { parentMapId: string | null; imageId: string | null }
type Character = Ref & { portraitImageId?: string | null; imageId?: unknown; description?: string }
type CharacterSnapshot = {
  id: string
  eventId: string
  characterId: string
  currentLocationMarkerId: string | null
  statusNotes: string
}
type ExampleWorld = {
  world: { id: string; description: string }
  timelines: Timeline[]
  chapters: Chapter[]
  events: Event[]
  characters: Character[]
  characterSnapshots: CharacterSnapshot[]
  locationMarkers: Location[]
  mapLayers: MapLayer[]
}

const index = parseLibraryIndex(rawIndex)

function sourceFor(data: string): string {
  const key = Object.keys(worldFiles).find((path) => path.endsWith(`/${data}`))
  if (!key) throw new Error(`No shipped file for ${data}`)
  return worldFiles[key]
}

function pair(eventId: string, characterId: string): string {
  return `${eventId}\u0000${characterId}`
}

const genericLocationText = [
  /location relevant to .* (?:journey|histories|story|volume)/i,
  /\bportal to\b/i,
  /\bgateway to (?:the )?.*(?:submap|map|plan|schematic|floor maps?)/i,
  /\bopen the\b.*\bsubmap\b/i,
  /represented (?:at|on|in).*\bmap\b/i,
  /\bmap containing the novel/i,
]

const genericStatusText = [
  /state carried through/i,
  /ongoing context/i,
  /not yet directly involved/i,
  /not yet (?:present|involved|introduced)/i,
  /current state (?:of|during)/i,
  /present for this event/i,
  // The Wise Man's Fear shipped 512 notes reading "…Current state: alive at The
  // Eolian; directly involved in 'The Eolian'." The colon form slipped past the
  // two patterns above, so the rule held while the data did not.
  /current state:/i,
  /directly involved in/i,
]

describe('published examples meet the authoring quality rules', () => {
  it('recognizes known placeholders without rejecting specific prose', () => {
    const badLocation = 'Moria, a location relevant to the journey or histories recounted in this volume.'
    const goodLocation = 'The ancient Dwarven realm beneath the Misty Mountains.'
    const badStatus = 'State carried through this chapter; not yet directly involved. Ongoing context.'
    const goodStatus = 'Keeps watch at the western door while the others search the chamber.'

    expect(genericLocationText.some((pattern) => pattern.test(badLocation))).toBe(true)
    expect(genericLocationText.some((pattern) => pattern.test(goodLocation))).toBe(false)
    expect(genericStatusText.some((pattern) => pattern.test(badStatus))).toBe(true)
    expect(genericStatusText.some((pattern) => pattern.test(goodStatus))).toBe(false)
  })

  for (const entry of index.entries) {
    const source = sourceFor(entry.data)
    const world = JSON.parse(source) as ExampleWorld

    describe(entry.title, () => {
      it('keeps catalogue identity, counts, and byte size synchronized', () => {
        expect(world.world.id).toBe(entry.worldId)
        // Git and the production host serve LF line endings even when a
        // Windows checkout uses CRLF in its working tree.
        const shippedBytes = new TextEncoder().encode(source.replace(/\r\n/g, '\n')).byteLength
        expect(shippedBytes).toBe(entry.dataBytes)
        expect(world.characters).toHaveLength(entry.counts?.characters ?? world.characters.length)
        expect(world.chapters).toHaveLength(entry.counts?.chapters ?? world.chapters.length)
        expect(world.events).toHaveLength(entry.counts?.events ?? world.events.length)
        expect(world.locationMarkers).toHaveLength(entry.counts?.locations ?? world.locationMarkers.length)
      })

      it('describes the book rather than the example-building process', () => {
        expect(world.world.description.trim().length).toBeGreaterThan(0)
        expect(world.world.description).not.toMatch(/\b(?:this|the) example\b|\bcreated for (?:the )?(?:app|library)\b|\bdata ?set\b/i)
      })

      it('uses the character portrait field rather than the item image field', () => {
        for (const character of world.characters) {
          expect(character, `${character.id} uses imageId instead of portraitImageId`).not.toHaveProperty('imageId')
        }
      })

      it('has valid timelines, chapters, pacing, and elapsed time', () => {
        const timelineIds = new Set(world.timelines.map(({ id }) => id))
        const chapterIds = new Set(world.chapters.map(({ id }) => id))
        const chaptersWithEvents = new Set(world.events.map(({ chapterId }) => chapterId))

        for (const chapter of world.chapters) {
          expect(timelineIds.has(chapter.timelineId), `${chapter.id} timeline`).toBe(true)
          expect(chaptersWithEvents.has(chapter.id), `${chapter.id} has no events`).toBe(true)
        }
        for (const event of world.events) {
          expect(chapterIds.has(event.chapterId), `${event.id} chapter`).toBe(true)
          expect(Number.isInteger(event.tension), `${event.id} tension`).toBe(true)
          expect(event.tension, `${event.id} tension`).toBeGreaterThanOrEqual(1)
          expect(event.tension, `${event.id} tension`).toBeLessThanOrEqual(5)
          expect(Number.isFinite(event.travelDays), `${event.id} elapsed time`).toBe(true)
          expect(event.travelDays, `${event.id} elapsed time`).toBeGreaterThanOrEqual(0)
        }
      })

      it('stores one specific snapshot for every present character and no one else', () => {
        const characterIds = new Set(world.characters.map(({ id }) => id))
        const characterById = new Map(world.characters.map((c) => [c.id, c]))
        const locationIds = new Set(world.locationMarkers.map(({ id }) => id))
        const eventById = new Map(world.events.map((event) => [event.id, event]))
        const expected = world.events.flatMap((event) =>
          event.involvedCharacterIds.map((characterId) => pair(event.id, characterId)),
        )
        const actual = world.characterSnapshots.map((snapshot) => pair(snapshot.eventId, snapshot.characterId))

        expect(new Set(actual).size, 'duplicate character snapshots').toBe(actual.length)
        expect([...actual].sort()).toEqual([...expected].sort())

        const notesByEvent = new Map<string, Set<string>>()
        for (const snapshot of world.characterSnapshots) {
          const event = eventById.get(snapshot.eventId)
          expect(event, `${snapshot.id} event`).toBeDefined()
          expect(characterIds.has(snapshot.characterId), `${snapshot.id} character`).toBe(true)
          expect(event?.involvedCharacterIds.includes(snapshot.characterId), `${snapshot.id} absent character`).toBe(true)
          expect(snapshot.currentLocationMarkerId, `${snapshot.id} location`).not.toBeNull()
          expect(locationIds.has(snapshot.currentLocationMarkerId ?? ''), `${snapshot.id} location`).toBe(true)

          const notes = snapshot.statusNotes.trim()
          expect(notes.length, `${snapshot.id} status`).toBeGreaterThan(0)
          for (const pattern of genericStatusText) expect(notes, `${snapshot.id} generic status`).not.toMatch(pattern)

          // A per-event note says what this character is doing now. Opening it
          // with their biography — which the character page already carries —
          // makes every chapter of their history read the same.
          const bio = (characterById.get(snapshot.characterId)?.description ?? '').trim()
          if (bio.length > 0) {
            expect(notes.startsWith(bio), `${snapshot.id} repeats the character's description`).toBe(false)
          }

          const normalized = notes.toLocaleLowerCase()
          const seen = notesByEvent.get(snapshot.eventId) ?? new Set<string>()
          expect(seen.has(normalized), `${snapshot.eventId} repeats a status across characters`).toBe(false)
          seen.add(normalized)
          notesByEvent.set(snapshot.eventId, seen)
        }
      })

      it('uses descriptive locations and structurally valid maps', () => {
        const mapIds = new Set(world.mapLayers.map(({ id }) => id))
        for (const layer of world.mapLayers) {
          expect(typeof layer.imageId, `${layer.id} has no image`).toBe('string')
          expect(layer.imageId?.trim().length, `${layer.id} has no image`).toBeGreaterThan(0)
          if (layer.parentMapId !== null) expect(mapIds.has(layer.parentMapId), `${layer.id} parent`).toBe(true)
        }

        for (const location of world.locationMarkers) {
          expect(mapIds.has(location.mapLayerId), `${location.id} map`).toBe(true)
          if (typeof location.linkedMapLayerId === 'string') {
            expect(mapIds.has(location.linkedMapLayerId), `${location.id} linked map`).toBe(true)
          }
          const hasX = location.x !== undefined && location.x !== null
          const hasY = location.y !== undefined && location.y !== null
          expect(hasX, `${location.id} has only one coordinate`).toBe(hasY)
          if (hasX && hasY) {
            expect(Number.isFinite(location.x), `${location.id} x coordinate`).toBe(true)
            expect(Number.isFinite(location.y), `${location.id} y coordinate`).toBe(true)
            expect(location.x, `${location.id} x coordinate`).toBeGreaterThanOrEqual(0)
            expect(location.y, `${location.id} y coordinate`).toBeGreaterThanOrEqual(0)
          }

          const description = location.description.trim()
          expect(description.length, `${location.id} description`).toBeGreaterThan(0)
          for (const pattern of genericLocationText) {
            expect(description, `${location.name} has placeholder navigation text`).not.toMatch(pattern)
          }
        }
      })
    })
  }
})
