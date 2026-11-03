import { db } from '@/db/database'
import { planHeader, recordBeforeIn, sceneFacts, sceneFates, sceneItems, sceneNames, scenePlaceStatus, sceneRelations } from '@/lib/sceneHeader'
import { wholeRecords } from '@/lib/personState'
import type { WorldEvent } from '@/types'
import { loadStory } from './useStory'
import { loadSceneTime } from './useSceneDay'

/**
 * What header line `header` would do to scene `event`, planned against the
 * store as it is now: writes nothing. The Page reads it from the store rather
 * than its own copy, so a thing made from the note a moment ago — a place, an
 * item, a fact — is there to be named.
 *
 * Its cost is the header read Part C measures (next-plan.md): the story and a
 * dozen table reads, every time, at once. `performance` carries it as
 * `kathala:header-read`.
 */
export async function planHeaderFromStore(worldId: string, id: string, header: string, event: WorldEvent) {
  const started = performance.now()
  /*
    Every read at once, in one transaction. One after another they were a
    dozen waits on IndexedDB in a row: on Little Women about 100 ms a header,
    of which the planning itself was some 10 (Part C, `e2e/scalePerf.spec.ts`).
  */
  const read = await db.transaction('r?', [
    db.events, db.chapters, db.timelines, db.worlds, db.characterSnapshots, db.itemPlacements, db.itemSnapshots, db.itemCustody,
    db.knowledgeFacts, db.knowledgeReveals, db.relationships, db.relationshipSnapshots, db.characters, db.items, db.locationMarkers, db.mapLayers, db.locationSnapshots,
  ], async () => {
    const [story, records, placementsHere, itemStates, custodyHere, factList, revealsHere, relList, relStatesHere, people, worldItems, worldPlaces, worldMaps, placeStates, time] = await Promise.all([
      loadStory(worldId),
      db.characterSnapshots.where('worldId').equals(worldId).toArray(),
      db.itemPlacements.where('eventId').equals(id).toArray(),
      db.itemSnapshots.where('worldId').equals(worldId).toArray(),
      db.itemCustody.where('eventId').equals(id).toArray(),
      db.knowledgeFacts.where('worldId').equals(worldId).toArray(),
      db.knowledgeReveals.where('eventId').equals(id).toArray(),
      db.relationships.where('worldId').equals(worldId).toArray(),
      db.relationshipSnapshots.where('eventId').equals(id).toArray(),
      // The people from the store, not the page's copy: who is revealed as whom is what a reveal is checked against.
      db.characters.where('worldId').equals(worldId).toArray(),
      // The items from the store, as the facts are: the page's copy may not have caught up with one just made from the note.
      db.items.where('worldId').equals(worldId).toArray(),
      // And the places: one just made from the note is not in the page's copy yet.
      db.locationMarkers.where('worldId').equals(worldId).toArray(),
      db.mapLayers.where('worldId').equals(worldId).toArray(),
      db.locationSnapshots.where('worldId').equals(worldId).toArray(),
      loadSceneTime(id),
    ])
    return { story, records, placementsHere, itemStates, custodyHere, factList, revealsHere, relList, relStatesHere, people, worldItems, worldPlaces, worldMaps, placeStates, time }
  })
  // The fates the header draws now, from the store rather than the page's copy: what taking one off is measured against.
  const states = wholeRecords(read.records, read.story)
  const before = recordBeforeIn(read.story)
  const drawn = sceneFates(id, event.involvedCharacterIds, states, event.mentionedCharacterIds, before)
  const drawnItems = sceneItems(id, event.involvedItemIds ?? [], states, read.placementsHere, read.itemStates, before, read.custodyHere)
  const drawnFacts = sceneFacts(id, read.revealsHere, read.factList)
  const drawnRelations = sceneRelations(id, read.relList, read.relStatesHere)
  const plan = planHeader(header, { characters: read.people, places: read.worldPlaces, maps: read.worldMaps, items: read.worldItems, facts: read.factList, relationships: read.relList }, {
    involved: event.involvedCharacterIds, mentioned: event.mentionedCharacterIds ?? [], remote: event.remoteCharacterIds ?? [], place: event.locationMarkerId, names: sceneNames(id, read.people),
    placeStatus: scenePlaceStatus(id, event.locationMarkerId, read.placeStates, before), ...drawn, items: drawnItems, facts: drawnFacts, relations: drawnRelations,
    time: read.time,
  })
  performance.measure('kathala:header-read', { start: started, end: performance.now() })
  return plan
}

/**
 * Seam for e2e specs: plan a scene's header against the store, as the Page
 * does, and say how long it took — the header read Part C measures. Same flag
 * as `__pwdb` in `database.ts`: present in dev and in a build made with
 * `VITE_E2E=1`, absent from a released bundle.
 */
export interface E2EPerfSeam {
  headerRead: (sceneId: string, header: string) => Promise<number>
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  ;(window as unknown as { __pwperf?: E2EPerfSeam }).__pwperf = {
    async headerRead(sceneId: string, header: string) {
      const event = await db.events.get(sceneId)
      if (!event) throw new Error(`No scene ${sceneId}`)
      const started = performance.now()
      await planHeaderFromStore(event.worldId, sceneId, header, event)
      return performance.now() - started
    },
  }
}
