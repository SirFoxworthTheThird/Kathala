import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useGate } from './ReadingGateContext'
import { resolveRecords } from '@/lib/characterIdentity'
import { useKnowledgeFacts } from './useKnowledge'
import { type Story } from '@/lib/stateEngine'
import { peopleAt, personAt, wholeRecords, type PersonRecord } from '@/lib/personState'
import { loadStory, useStory, STORY_TABLES } from './useStory'
import { quickStateWrite } from '@/lib/quickState'
import { keepHolding, useHoldings, useRecordsWithCustody, withHoldings } from './useCustody'

export function useSnapshot(characterId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      characterId && eventId
        ? db.characterSnapshots
            .where('[characterId+eventId]')
            .equals([characterId, eventId])
            .first()
        : undefined,
    [characterId, eventId]
  )
}

/**
 * A character's records. For a reader, their whole person's (\`gate.selves\`,
 * Part 2b): Jekyll's page reads Hyde's records too, each still saying whose it
 * is, so the History tab can show them under *As Edward Hyde*.
 */
export function useCharacterSnapshots(characterId: string | null) {
  const gate = useGate()
  const selves = characterId ? gate.selves(characterId) : []
  const key = selves.join(',')
  const all = useLiveQuery(
    () =>
      selves.length > 0
        ? db.characterSnapshots.where('characterId').anyOf(selves).toArray()
        : [],
    [key],
    []
  )
  // A character's snapshot list is their whole future — where they end up, what
  // they carry, whether they are still alive. Cut it at the cursor: resolving
  // the *current* state only ever looks backwards, so nothing else loses out.
  const reached = useMemo(() => all.filter((s) => gate.hasReached(s.eventId)), [all, gate])
  // Each record whole at its scene (Part B2), holding what custody says there, not its copy of the record before (Part B1).
  return useRecordsWithCustody(useWhole(reached))
}

/**
 * Records read whole at their own scenes (Part B2): a record says only what
 * its scene said, and the rest is read from the person's records before it.
 * `records` has to hold each person's records up to the ones wanted — every
 * one before them, for the rest to be read from.
 */
function useWhole(records: PersonRecord[]): CharacterSnapshot[] {
  const story = useStory(records[0]?.worldId ?? null)
  return useMemo(() => wholeRecords(records, story), [records, story])
}

const NO_ROWS = { here: [] as string[], all: [] as PersonRecord[] }

/**
 * The records at `eventIds`, whole (`useWhole`): with every record of the
 * people they are about, which the rest of each is read from. As stored
 * otherwise — no custody, no reader's joining of people — for a screen that
 * says what it adds.
 */
export function useWholeAt(eventIds: readonly string[]): CharacterSnapshot[] {
  const key = eventIds.join(',')
  const rows = useLiveQuery(async () => {
    if (eventIds.length === 0) return NO_ROWS
    const here = await db.characterSnapshots.where('eventId').anyOf([...eventIds]).toArray()
    if (here.length === 0) return NO_ROWS
    const all = await db.characterSnapshots.where('characterId').anyOf([...new Set(here.map((s) => s.characterId))]).toArray()
    return { here: here.map((s) => s.id), all }
  }, [key], NO_ROWS)
  const whole = useWhole(rows.all)
  return useMemo(() => {
    const wanted = new Set(rows.here)
    return whole.filter((s) => wanted.has(s.id))
  }, [whole, rows.here])
}

/*
  For a reader, the records at a scene as the people they are shown as: Hyde's
  says Jekyll, and where both were recorded the head's own is the one kept
  (\`resolveRecords\`, Part 2b). A writer's gate leaves them as they are.
*/
function useAsShown(records: CharacterSnapshot[]): Array<CharacterSnapshot & { alsoRecordedAs?: string[] }> {
  const gate = useGate()
  // Holding what custody says at each record's scene (Part B1), before a reader's view joins people up.
  const held = useRecordsWithCustody(records)
  return useMemo(() => (gate.active ? resolveRecords(held, gate.identityOf, (s) => s.eventId) : held), [gate, held])
}

export function useEventSnapshots(eventId: string | null) {
  return useAsShown(useWholeAt(eventId ? [eventId] : []))
}

/** @deprecated use useEventSnapshots */
export const useChapterSnapshots = useEventSnapshots

/** Returns all snapshots for a list of event ids (all events in a chapter). */
export function useChapterEventSnapshots(eventIds: string[]) {
  return useAsShown(useWholeAt(eventIds))
}

export function useWorldSnapshots(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () =>
      worldId
        ? db.characterSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
  const reached = useMemo(() => all.filter((s) => gate.hasReached(s.eventId)), [all, gate])
  return useAsShown(useWhole(reached))
}

/** Pure selection logic — exported for testing. A person's state stays in their era (`stateEngine`).
 *  @param timelineEventIds When provided, only snapshots whose eventId is in this set
 *  are considered: the map's playback scope, narrower than an era. */
export function selectBestCharacterSnapshots(
  all: PersonRecord[],
  activeEventId: string | null,
  story: Story,
  timelineEventIds?: Set<string>
): CharacterSnapshot[] {
  const candidates = timelineEventIds ? all.filter((s) => timelineEventIds.has(s.eventId)) : all
  // No records gives back the same empty array, so a memo downstream keeps its reference.
  if (candidates.length === 0) return candidates as CharacterSnapshot[]
  // Each part of the state from the last record that says it (Part B2).
  return peopleAt(candidates, activeEventId, story)
}

/** Pure single-character resolution — exported for testing. Each part of the state from the last record that says it (Part B2). */
export function resolveCharacterSnapshot(
  all: PersonRecord[],
  activeEventId: string | null,
  story: Story,
): CharacterSnapshot | undefined {
  return personAt(all, activeEventId, story)
}

/** A reported death can change a reader's current knowledge without putting
 * the absent person in that scene's cast or inventing a snapshot for them. */
export function applyReportedDeaths(
  snapshots: CharacterSnapshot[], facts: KnowledgeFact[], activeEventId: string | null, story: Story,
): CharacterSnapshot[] {
  if (!activeEventId || facts.length === 0) return snapshots
  const activeKey = story.position(activeEventId)
  if (activeKey === -1) return snapshots
  const deaths = new Map<string, KnowledgeFact>()
  for (const fact of facts) {
    if (!fact.readerLearnsAtEventId) continue
    const learnt = story.position(fact.readerLearnsAtEventId)
    if (learnt === -1 || learnt > activeKey) continue
    for (const tag of fact.tags) {
      if (tag.startsWith('offstage-death:')) deaths.set(tag.slice('offstage-death:'.length), fact)
    }
  }
  if (deaths.size === 0) return snapshots
  return snapshots.map(snapshot => {
    const fact = deaths.get(snapshot.characterId)
    return fact && snapshot.isAlive ? { ...snapshot, isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], statusNotes: fact.description } : snapshot
  })
}

/** Returns the best (last-known) snapshot per character for the active event.
 *  When an event is active: for each character, finds the most recent snapshot
 *  at or before that event (by sortKey ordering).
 *  When no event is active: returns the most recently updated snapshot per character.
 *  Memoized for reference stability.
 *  @param timelineEventIds Optional scope — see selectBestCharacterSnapshots. Caller must
 *  memoize this Set to avoid triggering re-renders on every call. */
export function useBestSnapshots(
  worldId: string | null,
  activeEventId: string | null,
  timelineEventIds?: Set<string>
): CharacterSnapshot[] {
  const all = useWorldSnapshots(worldId)
  const story = useStory(worldId)
  const facts = useKnowledgeFacts(worldId)
  const resolved = useMemo(() => selectBestCharacterSnapshots(all, activeEventId, story, timelineEventIds), [all, activeEventId, story, timelineEventIds])
  return useHeld(resolved, worldId, activeEventId, story, facts)
}

const NO_STATES: CharacterSnapshot[] = []

/**
 * Resolved states holding what custody says (Part B1) — at the cursor; with
 * no moment chosen, at each state's own scene, which is where it was read
 * (`peopleAt`) — and with reported deaths applied.
 */
function useHeld(resolved: CharacterSnapshot[], worldId: string | null, activeEventId: string | null, story: Story, facts: KnowledgeFact[]): CharacterSnapshot[] {
  const holdings = useHoldings(worldId, activeEventId)
  const atOwnScene = useRecordsWithCustody(activeEventId ? NO_STATES : resolved)
  return useMemo(
    () => applyReportedDeaths(activeEventId ? withHoldings(resolved, holdings) : atOwnScene, facts, activeEventId, story),
    [resolved, holdings, atOwnScene, facts, activeEventId, story],
  )
}

/** Returns the last-known snapshot for a single character at or before the active event.
 *  Uses only that character's snapshots (cheaper than loading all world snapshots). */
export function useResolvedCharacterSnapshot(
  characterId: string | null,
  worldId: string | null,
  activeEventId: string | null
): CharacterSnapshot | undefined {
  const all = useCharacterSnapshots(characterId)
  const story = useStory(worldId)
  const facts = useKnowledgeFacts(worldId)
  // Their own records only: for a reader, `useCharacterSnapshots` also brings anyone revealed to be them.
  const resolved = useMemo(
    () => (!characterId ? NO_STATES : [resolveCharacterSnapshot(all.filter((s) => s.characterId === characterId), activeEventId, story)].filter((snapshot): snapshot is CharacterSnapshot => !!snapshot)),
    [characterId, activeEventId, all, story],
  )
  return useHeld(resolved, worldId, activeEventId, story, facts)[0]
}

/** The record at this very scene, as stored: only what the scene says (Part B2). */
export async function fetchSnapshot(characterId: string, eventId: string): Promise<PersonRecord | undefined> {
  return db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .first()
}

/**
 * A person's whole state before scene `eventId`, not counting a record at it:
 * what a write here repeats, or starts from. Each part from the last record
 * that says it (Part B2), in the scene's era (`stateBefore`).
 */
async function personBefore(records: PersonRecord[], eventId: string, worldId: string): Promise<CharacterSnapshot | undefined> {
  return personAt(records.filter((r) => r.eventId !== eventId), eventId, await loadStory(worldId))
}

function charSnapContentEqual(
  a: Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: CharacterSnapshot
): boolean {
  return (
    a.isAlive === b.isAlive &&
    a.currentLocationMarkerId === b.currentLocationMarkerId &&
    a.currentMapLayerId === b.currentMapLayerId &&
    JSON.stringify([...a.inventoryItemIds].sort()) ===
      JSON.stringify([...b.inventoryItemIds].sort()) &&
    a.inventoryNotes === b.inventoryNotes &&
    a.statusNotes === b.statusNotes &&
    a.travelModeId === b.travelModeId
  )
}

/**
 * How to treat a write that says exactly what the last record already said.
 *
 * `confirmUnchanged` is what a writer pressing **Record state** means. The
 * dedupe below is right for the writes nobody asked for — an item cascade, a
 * bulk field set, an AI import — where a duplicate row is noise. It is wrong
 * for the one interaction the quick form exists for.
 *
 * A writer walked down a chapter's cast, saw *no state recorded*, opened the
 * form, found it prefilled with the room the character was already in, and
 * pressed the button. Nothing happened: no row, no toast, no error, and the
 * panel went on inviting them to record it. It fired on nine of sixty-two cast
 * rows — every scene set in the same room as the one before it — and three
 * chapters of recording appeared to work and did not land. The guide promises
 * this exact case by name: *"makes confirming that somebody hasn't moved a
 * single click."*
 *
 * The confirmation is not redundant, either. A resolved state is *last known*;
 * a record at this scene is an assertion **about this scene**, which is what
 * the writer was asked for and what `stale-snapshot` counts.
 */
export interface UpsertSnapshotOptions {
  /** Write a record even when it matches the last known state. */
  confirmUnchanged?: boolean
}

export async function upsertSnapshot(
  data: Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  options: UpsertSnapshotOptions = {},
): Promise<PersonRecord> {
  /*
    One transaction, so the look for a state here and the write that follows
    are one step. Apart, two writes for the same person at the same scene —
    making a place from the header note while the line itself was applied —
    each found none and each added one: writer run 5 found two states for one
    character at one scene (W5-4). `rw?` joins a caller's transaction where it
    covers these tables, as `handItemTo`'s does, and opens its own otherwise.
  */
  return db.transaction('rw?', [db.characterSnapshots, ...STORY_TABLES, db.operations, db.tombstones], () => upsertSnapshotNow(data, options))
}

async function upsertSnapshotNow(
  data: Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  options: UpsertSnapshotOptions,
): Promise<PersonRecord> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  // If a record already exists for this exact event, update it in-place
  const existing = await db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([data.characterId, data.eventId])
    .first()

  if (existing) {
    await journalUpdate('characterSnapshot', db.characterSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.characterSnapshots.get(existing.id))!
  }

  // No record for this event — check last-known to avoid duplicating unchanged state
  const allForChar = await db.characterSnapshots
    .where('characterId').equals(data.characterId)
    .toArray()
  const prevBest = await personBefore(allForChar, data.eventId, data.worldId)

  if (prevBest && charSnapContentEqual(data, prevBest) && !options.confirmUnchanged) {
    return prevBest // unchanged, and nobody asked for it — no new record needed
  }

  const snapshot: CharacterSnapshot = {
    ...data,
    // After the spread, not before: callers build `data` by spreading an
    // existing snapshot, and an `id` riding along would name a row that already
    // exists — so a *new* record would be created under an old primary key.
    id: generateId(),
    sortKey,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('characterSnapshot', db.characterSnapshots, snapshot)
}

/**
 * Record the fates a scene's header gives (`planHeader`): who dies there and
 * who comes back, as one undo step.
 *
 * Only `isAlive` and `revived` change. A state already recorded at this scene
 * keeps everything else it says. Otherwise a new one is made carrying the rest
 * of the last state before it — where they were, what they held — with every
 * field named and the scene given as this one: the last state is an earlier
 * scene's record, and spreading it would write there (see CLAUDE.md, "a
 * resolved snapshot is not a record at this scene").
 */
export async function recordFates(
  worldId: string,
  eventId: string,
  fates: ReadonlyArray<{ characterId: string; isAlive: boolean; revived: boolean }>,
): Promise<void> {
  if (fates.length === 0) return
  await journalGroup(async () => {
    for (const { characterId, isAlive, revived } of fates) {
      const here = await db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first()
      if (here) {
        await journalUpdate('characterSnapshot', db.characterSnapshots, here.id, { isAlive, revived, updatedAt: Date.now() })
        continue
      }
      const prev = await personBefore(await db.characterSnapshots.where('characterId').equals(characterId).toArray(), eventId, worldId)
      await upsertSnapshot({
        worldId,
        characterId,
        eventId,
        isAlive,
        revived,
        currentLocationMarkerId: prev?.currentLocationMarkerId ?? null,
        currentMapLayerId: prev?.currentMapLayerId ?? null,
        inventoryItemIds: prev?.inventoryItemIds ?? [],
        inventoryNotes: prev?.inventoryNotes ?? '',
        statusNotes: '',
        travelModeId: prev?.travelModeId ?? null,
      }, { confirmUnchanged: true })
    }
  }, { label: fates.length === 1 ? (fates[0].isAlive ? 'Alive at this scene' : 'Died at this scene') : 'Fates at this scene' })
}

/**
 * The header names where a scene happens and who is in it; this makes the
 * records say so — each person in the cast at the scene's place, at this scene.
 *
 * It is "Place all N at …" on the map, made by writing the header rather than
 * by a second visit. A third writer run recorded 95 states that way, one scene
 * at a time, after writing every one of those scenes with a header that
 * already said it.
 *
 * - A state already recorded **at this scene** is the writer's word and is
 *   left as it is — somebody in the cast but elsewhere stays elsewhere — with
 *   two exceptions, states that never said where they are here:
 *   - one at the scene's old place (`previousPlaceId`) follows the scene when
 *     its place changes, since it was only ever saying "here";
 *   - at a scene that had no place until now, one whose place is only carried
 *     from the state before it — written at this scene for something else, an
 *     item handed over or a death — is put at the scene's place: with no place
 *     to be away from, it was never saying "elsewhere". A hand-off typed with a
 *     place not yet made left its holder at the place they came from, and the
 *     checker took that for the writer's word.
 * - Somebody whose last state says they are dead is left out, as on the map.
 * - Somebody already there needs no state, and gets none.
 *
 * A new state carries the rest of the last one (`quickStateWrite`), with the
 * scene given as this one. One undo step.
 */
export async function placeCastAtScene(
  worldId: string,
  eventId: string,
  cast: readonly string[],
  placeId: string | null,
  previousPlaceId: string | null,
): Promise<void> {
  if (!placeId || cast.length === 0) return
  const story = await loadStory(worldId)
  const marker = await db.locationMarkers.get(placeId)
  if (!marker) return
  await journalGroup(async () => {
    for (const characterId of cast) {
      const own = await db.characterSnapshots.where('characterId').equals(characterId).toArray()
      const here = own.find((s) => s.eventId === eventId)
      if (here) {
        const before = resolveCharacterSnapshot(own.filter((s) => s.id !== here.id), eventId, story)
        // Carried: it says no place here (Part B2), or says the one it had already.
        const carried = here.currentLocationMarkerId === undefined || here.currentLocationMarkerId === (before?.currentLocationMarkerId ?? null)
        const atOldPlace = !!previousPlaceId && previousPlaceId !== placeId && here.currentLocationMarkerId === previousPlaceId
        if (((carried && !previousPlaceId) || atOldPlace) && here.currentLocationMarkerId !== placeId) {
          await journalUpdate('characterSnapshot', db.characterSnapshots, here.id, {
            currentLocationMarkerId: placeId, currentMapLayerId: marker.mapLayerId ?? null, updatedAt: Date.now(),
          })
        }
        continue
      }
      const prev = resolveCharacterSnapshot(own, eventId, story)
      if (prev && !prev.isAlive) continue
      /*
        Somebody already there is recorded here too. "Already there" was
        carried from an earlier scene, so the header's word about this one
        hung on that scene: writer run 11 gave an earlier scene a header
        putting Anna in the Vault, and this scene, whose own header said the
        Quay, followed her there (W-2). The header said so, and that is a
        statement about this scene.
      */
      await upsertSnapshot(quickStateWrite({
        draft: { isAlive: true, locationMarkerId: placeId, statusNotes: '' },
        prev, worldId, characterId, eventId, markers: [marker],
      }), { confirmUnchanged: true })
    }
  }, { label: 'Where the cast is' })
}

export async function deleteSnapshot(id: string) {
  await journalDelete('characterSnapshot', db.characterSnapshots, id, async () => {
    await db.characterSnapshots.delete(id)
  })
}

/**
 * Record a character at a scene's setting, keeping everything else they had.
 *
 * This is the continuity checker's "Move to <place>" fix, and it used to look
 * for the state to carry forward with `sn.eventId === eventId` — a snapshot at
 * the very scene being fixed. But that fix is only ever offered when no such
 * snapshot exists (an assertion there is the writer's word, not a gap), so the
 * lookup found nothing every time and every fallback fired: the character was
 * written alive, empty-handed, with no notes and no travel mode. Applied over
 * an ensemble from "Fix all", it emptied eight characters' hands at once and
 * revived anyone who had died, and the checker then reported the resurrection
 * it had just performed. Undo recovered it, but the label said only "Added
 * character state" — and the point of a fix-it button is that you stop looking.
 *
 * The state to carry forward is the last one at or before this scene, which is
 * what `resolveCharacterSnapshot` returns. `MapExplorerView` already did it this way.
 */
export async function moveCharacterToScene(
  args: { worldId: string; characterId: string; eventId: string; markerId: string },
  story: Story,
): Promise<void> {
  const marker = await db.locationMarkers.get(args.markerId)
  if (!marker) return

  const own = await db.characterSnapshots
    .where('characterId').equals(args.characterId)
    .toArray()
  const carried = resolveCharacterSnapshot(own, args.eventId, story)

  await upsertSnapshot({
    worldId: args.worldId,
    characterId: args.characterId,
    eventId: args.eventId,
    isAlive: carried?.isAlive ?? true,
    currentLocationMarkerId: marker.id,
    currentMapLayerId: marker.mapLayerId,
    inventoryItemIds: carried?.inventoryItemIds ?? [],
    inventoryNotes: carried?.inventoryNotes ?? '',
    statusNotes: carried?.statusNotes ?? '',
    travelModeId: carried?.travelModeId ?? null,
  })
}

/**
 * Apply one field of a state to later records that merely inherited the value
 * it replaced (**F2**).
 *
 * Offered, never automatic. A tool that silently rewrites six later scenes
 * because you edited one is worse than one that stops — so the app says where
 * the change stopped and this runs only if the writer asks for it.
 *
 * The targets are chosen by `carryForwardPlan`, which stops at the first later
 * record holding something else: that is a decision already taken, and an
 * earlier edit does not get to overwrite it.
 *
 * One `journalGroup`, so undo puts every scene back together rather than
 * leaving the run half-applied.
 */
export async function carryFieldForward<K extends keyof CharacterSnapshot>(
  targets: CharacterSnapshot[],
  field: K,
  value: CharacterSnapshot[K],
): Promise<void> {
  if (targets.length === 0) return
  await journalGroup(() => Promise.all(
    // `eventId` named although it is the record's own: a write that spreads has
    // to say which scene it lands on, so that the one dangerous case — spreading
    // a *resolved* snapshot — cannot hide among the safe ones.
    targets.map((s) => upsertSnapshot({ ...s, eventId: s.eventId, [field]: value })),
  ))
}

/**
 * Put `itemId` back in the holder's later records that lacked it — chosen by
 * `itemCarryPlan`, and only when the writer asks. One `journalGroup`, so one
 * undo puts every scene back.
 */
export async function carryItemForward(targets: CharacterSnapshot[], itemId: string): Promise<void> {
  if (targets.length === 0) return
  await journalGroup(async () => {
    await Promise.all(
      // `eventId` named although it is the record's own: see `carryFieldForward`.
      targets.map((s) => upsertSnapshot({ ...s, eventId: s.eventId, inventoryItemIds: [...new Set([...s.inventoryItemIds, itemId])] })),
    )
    // Custody (Part B1): at those scenes they let go of it only because their record stopped listing it. That is taken back, and it is theirs throughout.
    for (const s of targets) await keepHolding(itemId, s.eventId, s.characterId)
  })
}
