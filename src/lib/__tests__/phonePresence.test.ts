import { describe, it, expect } from 'vitest'
import { formatSceneHeader, parseSceneHeader, planHeader } from '@/lib/sceneHeader'
import { computeCastBalance } from '@/lib/castBalance'
import { computeCharacterAppearances } from '@/lib/characterAppearances'
import { roomAt } from '@/lib/knowledgeInRoom'
import { sceneCast } from '@/lib/sceneCast'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { Chapter, Character, CharacterSnapshot, KnowledgeFact, KnowledgeReveal, LocationMarker, WorldEvent } from '@/types'

/**
 * In a scene from elsewhere — on the phone (`remoteCharacterIds`). Writer run 8
 * had Edmund on the phone through a scene and could say only that he was on
 * stage, which put him at a place he was not, or mentioned, after which Cast
 * Balance said he never appeared.
 */

const chapter = (id: string, number: number): Chapter => ({ id, worldId: 'w', timelineId: 't1', number, title: `Ch ${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 })
const event = (id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent => ({
  id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
  locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
  tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null,
  structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
  createdAt: 0, updatedAt: 0, ...opts,
})
const character = (id: string, name: string): Character => ({ id, worldId: 'w', name, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
const snapshot = (id: string, characterId: string, eventId: string, opts: Partial<CharacterSnapshot> = {}): CharacterSnapshot => ({
  id, worldId: 'w', characterId, eventId, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
  inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0, ...opts,
})

const nell = character('nell', 'Nell Garrity')
const edmund = character('edmund', 'Edmund Varley')

describe('on the phone, in the header', () => {
  it('reads `:phone`, and `:remote` the same, and draws it back as `:phone`', () => {
    expect(parseSceneHeader('[@@Nell Garrity @@Edmund Varley:phone]')).toEqual({ place: null, characters: ['Nell Garrity', 'Edmund Varley'], remote: ['Edmund Varley'] })
    expect(parseSceneHeader('[@@Edmund Varley:remote]').remote).toEqual(['Edmund Varley'])
    const header = { place: 'The Studio', characters: ['Nell Garrity', 'Edmund Varley'], remote: ['Edmund Varley'] }
    expect(formatSceneHeader(header)).toContain('Characters: @@Nell Garrity @@Edmund Varley:phone')
    expect(parseSceneHeader(formatSceneHeader(header))).toEqual(header)
  })

  it('puts them in the scene from elsewhere, not in the cast at its place, and off the mentioned list', () => {
    const world = { characters: [nell, edmund], places: [{ id: 'studio', name: 'The Studio' }] }
    const plan = planHeader('[#The Studio @@Nell Garrity @@Edmund Varley:phone]', world, { involved: ['nell'], mentioned: ['edmund'], place: 'studio' })
    expect(plan.update).toEqual({ involvedCharacterIds: ['nell'], mentionedCharacterIds: [], remoteCharacterIds: ['edmund'], locationMarkerId: 'studio' })
    // Said again, it changes nothing; taken off, it takes them out of the scene.
    expect(planHeader('[#The Studio @@Nell Garrity @@Edmund Varley:phone]', world, { involved: ['nell'], mentioned: [], remote: ['edmund'], place: 'studio' }).update).toBeNull()
    expect(planHeader('[#The Studio @@Nell Garrity]', world, { involved: ['nell'], mentioned: [], remote: ['edmund'], place: 'studio' }).update?.remoteCharacterIds).toEqual([])
    // From the phone into the room.
    expect(planHeader('[#The Studio @@Nell Garrity @@Edmund Varley]', world, { involved: ['nell'], mentioned: [], remote: ['edmund'], place: 'studio' }).update)
      .toEqual({ involvedCharacterIds: ['nell', 'edmund'], mentionedCharacterIds: [], remoteCharacterIds: [], locationMarkerId: 'studio' })
  })
})

describe('on the phone, counted', () => {
  const chapters = [chapter('c1', 1)]
  const events = [
    event('e1', 'c1', 0, { involvedCharacterIds: ['nell'], remoteCharacterIds: ['edmund'] }),
    event('e2', 'c1', 1, { involvedCharacterIds: ['nell'], mentionedCharacterIds: ['edmund'] }),
  ]

  it('Cast Balance: apart from on stage and from mentions', () => {
    const [n, e] = computeCastBalance({ characters: [nell, edmund], chapters, events }).members
    expect([n.sceneCount, n.remoteCount]).toEqual([2, 0])
    expect([e.sceneCount, e.remoteCount, e.mentionCount]).toEqual([0, 1, 1])
  })

  it('Appearances: its own list', () => {
    const a = computeCharacterAppearances({ characterId: 'edmund', events, chapters })
    expect([a.present.length, a.remote.map((x) => x.eventId), a.mentioned.map((x) => x.eventId)]).toEqual([0, ['e1'], ['e2']])
  })

  it('in the room for what is said; in the X-ray on the line', () => {
    expect([...roomAt(events[0], () => false)].sort()).toEqual(['edmund', 'nell'])
    expect([...roomAt(events[1], () => false)]).toEqual(['nell'])
    const cast = sceneCast({ event: events[0], characters: [nell, edmund], items: [], markers: [] })
    expect(cast.characters).toEqual([
      { id: 'nell', name: 'Nell Garrity', imageId: null, onStage: true },
      { id: 'edmund', name: 'Edmund Varley', imageId: null, onStage: false, remote: true },
    ])
  })
})

describe('on the phone, and continuity', () => {
  const input = (): ContinuityInput => ({
    worldId: 'w', world: undefined, timelines: [],
    chapters: [chapter('c1', 1), chapter('c2', 2)], allEvents: [], characters: [nell, edmund], rels: [], items: [], snapshots: [],
    knowledgeFacts: [], knowledgeReveals: [], sceneTexts: [], allRelSnaps: [],
    allItemPlacements: [], allLocationSnapshots: [], allMarkers: [], allLayers: [],
    travelModes: [], allMovements: [], artifacts: [], allMapRoutes: [],
    allMapRegions: [], allRegionSnapshots: [], allFactions: [], allMemberships: [],
    allFactionRels: [], allItemSnapshots: [], plotThreads: [],
  })
  const marker = (id: string, name: string): LocationMarker => ({ id, worldId: 'w', mapLayerId: null, name, description: '', x: 0, y: 0, iconType: 'building', linkedMapLayerId: null, imageId: null, createdAt: 0, updatedAt: 0 } as LocationMarker)

  it('a dead voice on the phone is the same contradiction as a dead one on stage', () => {
    const i = input()
    i.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0, { remoteCharacterIds: ['edmund'] })]
    i.snapshots = [snapshot('s1', 'edmund', 'e1', { isAlive: false })]
    expect(computeContinuityIssues(i).filter((x) => x.id.startsWith('dead-in-event-')).map((x) => x.eventId)).toEqual(['e2'])
  })

  it('somebody on the phone from elsewhere is not "in the scene somewhere else" — and somebody on stage is', () => {
    const i = input()
    i.allMarkers = [marker('studio', 'The Studio'), marker('refuge', 'The Far Refuge')]
    i.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0, { locationMarkerId: 'studio', remoteCharacterIds: ['edmund'], involvedCharacterIds: ['nell'] })]
    i.snapshots = [snapshot('s1', 'edmund', 'e1', { currentLocationMarkerId: 'refuge' }), snapshot('s2', 'nell', 'e1', { currentLocationMarkerId: 'refuge' })]
    const elsewhere = computeContinuityIssues(i).filter((x) => x.id.startsWith('scene-cast-elsewhere-'))
    expect(elsewhere.map((x) => x.id)).toEqual(['scene-cast-elsewhere-nell-e2'])
  })

  it('learning a fact on the phone is not learning it where you are not', () => {
    const i = input()
    i.allMarkers = [marker('studio', 'The Studio'), marker('refuge', 'The Far Refuge')]
    i.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0, { locationMarkerId: 'studio', remoteCharacterIds: ['edmund'] })]
    i.snapshots = [snapshot('s1', 'edmund', 'e1', { currentLocationMarkerId: 'refuge' }), snapshot('s2', 'nell', 'e1', { currentLocationMarkerId: 'refuge' })]
    i.knowledgeFacts = [{ id: 'f', worldId: 'w', title: 'The reel was cut', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 } as KnowledgeFact]
    const reveal = (id: string, characterId: string): KnowledgeReveal => ({ id, worldId: 'w', factId: 'f', characterId, eventId: 'e2', note: '', createdAt: 0, updatedAt: 0 } as KnowledgeReveal)
    i.knowledgeReveals = [reveal('r1', 'edmund'), reveal('r2', 'nell')]
    expect(computeContinuityIssues(i).filter((x) => x.kind === 'reveal-elsewhere').map((x) => x.id)).toEqual(['reveal-elsewhere-r2'])
  })
})
