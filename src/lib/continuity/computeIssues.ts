import type { IssueKind } from './issueKinds'
import { pixelDist } from '@/lib/mapScale'
import { assessTravel, ROUTE_SPEED_MULTIPLIERS } from '@/lib/travelTime'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { ageInYears, formatInWorldDate } from '@/lib/calendar'
import { GONE_STATUSES, REBUILT_STATUS } from '@/lib/locationStatus'
import { TERMINAL_CONDITIONS, RESTORED_CONDITION } from '@/lib/itemCondition'
import { computeKnowledgeAnachronisms } from '@/lib/knowledgeAnachronisms'
import { computeDeadKnowerIssues } from '@/lib/knowledgeRevealContinuity'
import { computeProseMentionIssues, computeKnowledgeLeaks } from '@/lib/proseContinuity'
import { computeItemHandoffIssues } from '@/lib/itemHandoff'
import { computeThreadIssues } from '@/lib/threadContinuity'
import type {
  Chapter, Character, CharacterMovement, CharacterSnapshot, CrossTimelineArtifact,
  Faction, FactionMembership, FactionRelationship, Item, ItemPlacement, ItemSnapshot,
  KnowledgeFact, KnowledgeReveal, LocationMarker, LocationSnapshot, MapLayer, PlotThread,
  MapRegion, MapRegionSnapshot, MapRoute, Relationship, RelationshipSnapshot,
  SceneText, TravelMode, World, WorldEvent,
} from '@/types'

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Point-in-polygon test using ray casting */
function pointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/** Check if line segment (ax,ay)→(bx,by) intersects segment (cx,cy)→(dx,dy) */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const d1x = bx - ax, d1y = by - ay
  const d2x = dx - cx, d2y = dy - cy
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false // parallel
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/** Check if segment AB crosses or touches polygon (path traversal test) */
function pathCrossesPolygon(
  ax: number, ay: number, bx: number, by: number,
  polygon: Array<{ x: number; y: number }>
): boolean {
  if (polygon.length < 3) return false
  if (pointInPolygon(ax, ay, polygon) || pointInPolygon(bx, by, polygon)) return true
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentsIntersect(ax, ay, bx, by, polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y)) return true
  }
  return false
}

// ── types ─────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  id: string
  severity: IssueSeverity
  category: 'character' | 'item' | 'relationship' | 'faction' | 'pov' | 'prose' | 'thread' | 'world'
  /** What sort of fault this is, within its category — see `issueKinds.ts`. */
  kind: IssueKind
  message: string
  detail?: string
  navigatePath?: string
  eventId?: string
  /**
   * An optional one-click fix, applied by the checker without leaving it.
   *
   * This was shaped for a single check — `{ label, eventId, setTravelDays }` —
   * so the panel could offer a fix for exactly one of twenty-eight kinds. The
   * Highbarrow review's strongest finding was that the snapshot warnings send
   * you to the chapter and no further, so the shape is a union now and the
   * checker dispatches on `kind`.
   */
  fix?:
    | { kind: 'travelDays'; label: string; eventId: string; setTravelDays: number }
    | { kind: 'initialSnapshot'; label: string; eventId: string; characterId: string }
    | { kind: 'clearPov'; label: string; eventId: string }
    | { kind: 'addToCast'; label: string; eventId: string; characterId: string }
    | { kind: 'moveHere'; label: string; eventId: string; characterId: string; markerId: string }
}

/** Everything the checks read — the ContinuityChecker gathers these via hooks
 *  and passes them through unchanged. Plain data in, issues out. */
export interface ContinuityInput {
  worldId: string | undefined
  world: World | undefined
  chapters: Chapter[]
  allEvents: WorldEvent[]
  characters: Character[]
  rels: Relationship[]
  items: Item[]
  snapshots: CharacterSnapshot[]
  knowledgeFacts: KnowledgeFact[]
  knowledgeReveals: KnowledgeReveal[]
  sceneTexts: SceneText[]
  allRelSnaps: RelationshipSnapshot[]
  allItemPlacements: ItemPlacement[]
  allLocationSnapshots: LocationSnapshot[]
  allMarkers: LocationMarker[]
  allLayers: MapLayer[]
  travelModes: TravelMode[]
  allMovements: CharacterMovement[]
  artifacts: CrossTimelineArtifact[]
  allMapRoutes: MapRoute[]
  allMapRegions: MapRegion[]
  allRegionSnapshots: MapRegionSnapshot[]
  allFactions: Faction[]
  allMemberships: FactionMembership[]
  allFactionRels: FactionRelationship[]
  allItemSnapshots: ItemSnapshot[]
  plotThreads: PlotThread[]
}

/**
 * Runs every continuity check over a world's data and returns the found
 * issues. Extracted verbatim from the ContinuityChecker component so the
 * checks are pure and unit-testable; the component owns only data-fetching,
 * suppression state, and rendering.
 */
export function computeContinuityIssues(input: ContinuityInput): Issue[] {
  const {
    worldId, world, chapters, allEvents, characters, rels, items, snapshots,
    knowledgeFacts, knowledgeReveals, sceneTexts, allRelSnaps, allItemPlacements,
    allLocationSnapshots, allMarkers, allLayers, travelModes, allMovements,
    artifacts, allMapRoutes, allMapRegions, allRegionSnapshots, allFactions,
    allMemberships, allFactionRels, allItemSnapshots, plotThreads,
  } = input

    const out: Issue[] = []

    const chapById  = new Map(chapters.map((c) => [c.id, c]))
    const charById  = new Map(characters.map((c) => [c.id, c]))
    const itemById  = new Map(items.map((i) => [i.id, i]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))
    // Absolute in-world day per event, so travel checks can use the elapsed
    // time between two points (which spans every event in between, and honors
    // explicit inWorldTime pins) rather than a single event's travelDays.
    const inWorldDay = computeInWorldDays(allEvents, chapters)

    // Global event order: chapter.number * 10_000 + event.sortOrder
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    function eventOrder(eventId: string): number {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapNumById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
    }

    // ── Shared lookup maps ──────────────────────────────────────────────────

    const markerById = new Map(allMarkers.map((m) => [m.id, m]))
    const layerById  = new Map(allLayers.map((l) => [l.id, l]))

    // Best region snapshot per region at a given event order
    const regionSnapHistory = new Map<string, Array<{ order: number; status: string }>>()
    for (const rs of allRegionSnapshots ?? []) {
      if (!regionSnapHistory.has(rs.regionId)) regionSnapHistory.set(rs.regionId, [])
      regionSnapHistory.get(rs.regionId)!.push({ order: eventOrder(rs.eventId), status: rs.status })
    }
    for (const hist of regionSnapHistory.values()) hist.sort((a, b) => a.order - b.order)

    function bestRegionStatus(regionId: string, atOrder: number): string | null {
      const hist = regionSnapHistory.get(regionId)
      if (!hist || hist.length === 0) return null
      let best: string | null = null
      for (const entry of hist) {
        if (entry.order <= atOrder) best = entry.status
        else break
      }
      return best
    }

    const regionsByLayer = new Map<string, MapRegion[]>()
    for (const region of allMapRegions ?? []) {
      if (!regionsByLayer.has(region.mapLayerId)) regionsByLayer.set(region.mapLayerId, [])
      regionsByLayer.get(region.mapLayerId)!.push(region)
    }

    const staleThreshold = world?.continuityStaleThreshold ?? 5

    // ── Character checks ────────────────────────────────────────────────────

    // Group snapshots by character
    const snapsByChar = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByChar.has(snap.characterId)) snapsByChar.set(snap.characterId, [])
      snapsByChar.get(snap.characterId)!.push(snap)
    }

    // Sorted alive-history per character (for dead-in-cast / before-intro checks)
    const snapsByCharSorted = new Map<string, Array<{ order: number; isAlive: boolean; eventId: string }>>()
    for (const snap of snapshots) {
      if (!snapsByCharSorted.has(snap.characterId)) snapsByCharSorted.set(snap.characterId, [])
      snapsByCharSorted.get(snap.characterId)!.push({ order: eventOrder(snap.eventId), isAlive: snap.isAlive, eventId: snap.eventId })
    }
    for (const arr of snapsByCharSorted.values()) arr.sort((a, b) => a.order - b.order)

    /**
     * Was this character already dead when the scene at `order` began?
     *
     * Strictly earlier, and that is the whole rule: both callers ask "is a dead
     * character in this scene's cast", and the snapshot *at* the scene is the
     * writer recording what happens in it. Including it made the record that
     * says "she dies here" mean "she was dead walking in", so every death scene
     * reported itself as a continuity error — with nothing the writer could do
     * about it, since the offered remedy is to mark the scene a flashback.
     *
     * Measured over the 21 shipped library worlds: 69 of the 96 dead-in-scene
     * warnings were the death scene itself, including *Count Dracula in
     * "Dracula Destroyed"*.
     */
    function isDeadAtOrder(charId: string, order: number): boolean {
      const hist = snapsByCharSorted.get(charId)
      if (!hist) return false
      let lastAlive: boolean | null = null
      for (const entry of hist) {
        if (entry.order >= order) break
        lastAlive = entry.isAlive
      }
      return lastAlive === false
    }

    /**
     * Where this character was last recorded at or before `order`.
     *
     * The delta model, read the way every screen reads it: the most recent
     * snapshot wins. `null` means nothing is recorded — either no snapshot yet,
     * or one that leaves the location blank — and a check that cannot tell
     * where somebody is has nothing to say about it.
     */
    function bestLocationAtOrder(charId: string, order: number): string | null {
      const snaps = snapsByChar.get(charId)
      if (!snaps) return null
      let best: { order: number; markerId: string | null } | null = null
      for (const sn of snaps) {
        const o = eventOrder(sn.eventId)
        if (o > order) continue
        if (!best || o >= best.order) best = { order: o, markerId: sn.currentLocationMarkerId }
      }
      return best?.markerId ?? null
    }

    /*
      ── A scene set here, with somebody recorded there ──────────────────────

      The scene carries a place of its own and every character carries theirs,
      and until now nothing compared the two — so a scene set in The Ledger Room
      with a cast member recorded at The Flats drew no comment at all. That is
      the app's headline question ("where was she when he found the letter?")
      going unasked about its own data.

      **It asks about an *inferred* location, never an asserted one.** That is
      the distinction the first version missed, and it cost 32 warnings on the
      shipped *Neuromancer* (W23-1). Every one of that book's 118 (character ×
      scene) pairs carries its own snapshot with an explicit location, because
      the book is about people who are present without being in the room: Case
      rides Molly's simstim from a tug at Marcus Garvey Dock, Wintermute is an
      AI whose body is a mainframe in Berne, Dixie Flatline is a ROM construct,
      Linda Lee is dead and on Neuromancer's beach. A snapshot *at this scene*
      is the writer stating where somebody is; reporting it is telling them they
      are wrong about their own book — and the batch fix then rewrote all 32.

      A location carried forward from an earlier scene is a different thing: the
      app inferred it, nobody asserted it, and a disagreement with the scene's
      own place is an omission worth naming. That is the case this was built for
      (W19-4) and it still fires. It also makes the fix **additive** — it writes
      a record where there was none, rather than overwriting an authored one.

      Three more things keep it from crying wolf:

      - **A movement at this scene is an answer, not a contradiction.** People
        walk into rooms; that is what `CharacterMovement` records, and one
        naming this scene's place means they arrived.
      - **Silence is not disagreement.** No location recorded means no finding.
      - **Flashbacks are out.** Their place in the linear order is not where
        they sit in the story, so a look-back reads the wrong state for them.
    */
    /** Did the writer record this character's state at this very scene? */
    function hasOwnSnapshot(charId: string, eventId: string): boolean {
      return (snapsByChar.get(charId) ?? []).some((sn) => sn.eventId === eventId)
    }

    for (const ev of allEvents) {
      if (!ev.locationMarkerId || ev.isFlashback) continue
      const sceneMarker = markerById.get(ev.locationMarkerId)
      if (!sceneMarker) continue
      const evOrder = eventOrder(ev.id)
      const ch = chapById.get(ev.chapterId)

      for (const charId of ev.involvedCharacterIds) {
        const char = charById.get(charId)
        if (!char) continue
        // An assertion at this scene is the writer's word on it, not a gap.
        if (hasOwnSnapshot(charId, ev.id)) continue
        const whereRecorded = bestLocationAtOrder(charId, evOrder)
        if (!whereRecorded || whereRecorded === ev.locationMarkerId) continue

        const arrived = (allMovements ?? []).some(
          (m) => m.characterId === charId && m.eventId === ev.id && m.waypoints.includes(ev.locationMarkerId!))
        if (arrived) continue

        const at = markerById.get(whereRecorded)
        out.push({
          id: `scene-cast-elsewhere-${charId}-${ev.id}`,
          kind: 'scene-cast-elsewhere',
          severity: 'warning',
          category: 'character',
          message: `${char.name} is in "${ev.title || 'untitled'}" but recorded at "${at?.name ?? 'somewhere else'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — the scene's setting is "${sceneMarker.name}", and nothing records where they are in it. Move them there, record the journey, or record where they really are.`,
          navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
          eventId: ev.id,
          fix: { kind: 'moveHere', label: `Move to ${sceneMarker.name}`, eventId: ev.id, characterId: charId, markerId: ev.locationMarkerId },
        })
      }
    }

    /*
      ── In a scene before they were born ────────────────────────────────────

      `birthDate` and the world calendar have been feeding the Writer's Brief's
      age readout for a while and no check ever read them. `ageInYears` returns
      null for a day before the birth date, which is exactly the finding.

      Both halves have to be set for this to say anything, so it is silent in
      every world that does not date its characters. A flashback only counts
      when it carries an explicit `inWorldTime` — otherwise its day is borrowed
      from the scene beside it, and a borrowed date is not evidence.
    */
    const calendar = world?.calendar
    if (calendar) {
      for (const ev of allEvents) {
        if (ev.isFlashback && ev.inWorldTime == null) continue
        const day = inWorldDay.get(ev.id)
        if (day == null) continue
        const ch = chapById.get(ev.chapterId)
        for (const charId of ev.involvedCharacterIds) {
          const char = charById.get(charId)
          if (!char?.birthDate) continue
          if (ageInYears(calendar, char.birthDate, day) !== null) continue
          out.push({
            id: `age-unborn-${charId}-${ev.id}`,
            kind: 'age-unborn',
            severity: 'warning',
            category: 'character',
            message: `${char.name} is in "${ev.title || 'untitled'}" before they were born`,
            detail: `Ch. ${ch?.number ?? '?'} — ${formatInWorldDate(calendar, day)} is earlier than their birth date. Check the date, the birth date, or mark the scene a flashback.`,
            navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
            eventId: ev.id,
          })
        }
      }
    }

    // Event IDs where each character has a snapshot (for stale-snapshot check)
    const snapEventIdsByChar = new Map<string, Set<string>>()
    for (const snap of snapshots) {
      if (!snapEventIdsByChar.has(snap.characterId)) snapEventIdsByChar.set(snap.characterId, new Set())
      snapEventIdsByChar.get(snap.characterId)!.add(snap.eventId)
    }

    for (const [charId, charSnaps] of snapsByChar) {
      const char = charById.get(charId)
      if (!char) continue

      /*
        Alive again after dying — reported once, where it happens.

        This was the only check in the file that read the *earliest* state
        rather than the last one before the moment, and it flagged **every**
        alive snapshot after that death. Measured on an eight-chapter book:
        Gandalf dying in Ch.2 and returning in Ch.4 produced **five errors** —
        Ch.4, 5, 6, 7, 8 — and recording the return is what created them. The
        check could not be satisfied. Everything else here reads last-before,
        the way `isDeadAtOrder` and `bestLocationAtOrder` do, and so does this
        now: the return is the news, and after it the new state is just state.

        It is a **warning**, not an error. An error should be something that
        cannot be true — an item in two places at once. A resurrection is a
        genre.

        And it is silent when the snapshot carries `revived`, because then the
        writer has said what happened. That is the point of the flag: a
        suppression is keyed on a derived issue id, so moving the scene orphans
        it and the warning returns, and it says nothing to any other screen.
      */
      const lifeHistory = charSnaps
        .map((sn) => ({ sn, order: eventOrder(sn.eventId) }))
        .sort((a, b) => a.order - b.order)

      let wasDead: { order: number; eventId: string } | null = null
      for (const { sn, order } of lifeHistory) {
        if (!sn.isAlive) { wasDead = { order, eventId: sn.eventId }; continue }
        if (!wasDead) continue
        if (sn.revived) { wasDead = null; continue }

        const ev = eventById.get(sn.eventId)
        const ch = ev ? chapById.get(ev.chapterId) : undefined
        const deathCh = chapById.get(eventById.get(wasDead.eventId)?.chapterId ?? '')
        out.push({
          id: `dead-then-alive-${charId}-${sn.eventId}`,
          kind: 'dead-then-alive',
          severity: 'warning',
          category: 'character',
          message: `${char.name} is alive again in Ch. ${ch?.number ?? '?'} after dying in Ch. ${deathCh?.number ?? '?'}`,
          detail: `Death recorded in Ch. ${deathCh?.number ?? '?'} — ${deathCh?.title ?? ''}. Tick "They came back in this scene" if they were revived, or correct one of the two records.`,
          navigatePath: `/worlds/${worldId}/timeline/${ev?.chapterId ?? sn.eventId}`,
          eventId: sn.eventId,
        })
        // The return is the news. After it, being alive is simply being alive.
        wasDead = null
      }

      // Snapshot referencing a deleted event
      for (const snap of charSnaps) {
        if (!eventById.has(snap.eventId)) {
          out.push({
            id: `orphan-snap-${snap.id}`,
            kind: 'orphan-snap',
            severity: 'warning',
            category: 'character',
            message: `${char.name} has a snapshot for a deleted scene`,
            detail: `Snapshot ID ${snap.id} — scene no longer exists`,
          })
        }
      }
    }

    // ── Dead character in non-flashback event cast ──────────────────────────────
    for (const ev of allEvents) {
      if (ev.isFlashback) continue
      const evOrder = eventOrder(ev.id)
      const ch = chapById.get(ev.chapterId)
      const checkedDead = new Set<string>()
      const castIds = [
        ...ev.involvedCharacterIds,
        ...(ev.povCharacterId ? [ev.povCharacterId] : []),
      ]
      for (const charId of castIds) {
        if (checkedDead.has(charId)) continue
        checkedDead.add(charId)
        if (!isDeadAtOrder(charId, evOrder)) continue
        const char = charById.get(charId)
        const isPov = ev.povCharacterId === charId
        out.push({
          id: `dead-in-event-${charId}-${ev.id}`,
          kind: 'dead-in-event',
          severity: 'warning',
          category: 'character',
          message: `Dead character ${char?.name ?? '?'} in "${ev.title || 'untitled'}"`,
          detail: `${char?.name ?? '?'} is dead at this point${isPov ? ' and is the POV' : ''} — Ch. ${ch?.number ?? '?'}. Mark as Flashback if intentional.`,
          navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    // ── Character referenced before first snapshot ───────────────────────────
    // For each character, find their first event appearance and first snapshot order.
    // If first appearance precedes first snapshot (or no snapshot at all), raise one warning.
    const charFirstAppearance = new Map<string, { evOrder: number; ev: (typeof allEvents)[0] }>()
    const sortedEventsAsc = [...allEvents].sort((a, b) => eventOrder(a.id) - eventOrder(b.id))
    for (const ev of sortedEventsAsc) {
      if (ev.isFlashback) continue
      const castIds = [
        ...ev.involvedCharacterIds,
        ...(ev.povCharacterId ? [ev.povCharacterId] : []),
      ]
      for (const charId of castIds) {
        if (!charFirstAppearance.has(charId)) {
          charFirstAppearance.set(charId, { evOrder: eventOrder(ev.id), ev })
        }
      }
    }
    for (const [charId, { evOrder, ev }] of charFirstAppearance) {
      if (!charById.has(charId)) continue
      const charHist = snapsByCharSorted.get(charId)
      const firstSnapOrder = charHist && charHist.length > 0 ? charHist[0].order : undefined
      if (firstSnapOrder !== undefined && firstSnapOrder <= evOrder) continue
      const char = charById.get(charId)
      const ch = chapById.get(ev.chapterId)
      out.push({
        id: `char-before-intro-${charId}`,
        kind: 'char-before-intro',
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} appears before any snapshot record`,
        detail: firstSnapOrder === undefined
          ? `First appears in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) but has no snapshots at all`
          : `First appears in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) but first snapshot is later in the timeline`,
        navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        eventId: ev.id,
        /*
          The warning knew the character and the scene all along and still made
          the writer leave the panel, move the time cursor, open the character,
          find Current State and save — once per character, for an ensemble
          scene. There is nothing to ask them: an initial record is alive,
          nowhere in particular, carrying nothing, which is what "they exist
          from here" means. Anything more specific is an edit made afterwards,
          on a record that now exists.
        */
        fix: { kind: 'initialSnapshot', label: 'Record initial state here', eventId: ev.id, characterId: charId },
      })
    }

    // ── Stale snapshot warning ────────────────────────────────────────────────
    // Warn when a character is involved in staleThreshold+ consecutive events without a snapshot update.
    const involvedEventsByChar = new Map<string, Array<(typeof allEvents)[0]>>()
    for (const ev of sortedEventsAsc) {
      for (const charId of ev.involvedCharacterIds) {
        if (!involvedEventsByChar.has(charId)) involvedEventsByChar.set(charId, [])
        involvedEventsByChar.get(charId)!.push(ev)
      }
    }
    for (const [charId, charEvents] of involvedEventsByChar) {
      const char = charById.get(charId)
      if (!char) continue
      const snapEventSet = snapEventIdsByChar.get(charId) ?? new Set<string>()
      let streakStart: (typeof allEvents)[0] | null = null
      let streakCount = 0
      for (const ev of charEvents) {
        if (snapEventSet.has(ev.id)) {
          streakStart = null
          streakCount = 0
        } else {
          streakCount++
          if (!streakStart) streakStart = ev
          if (streakCount === staleThreshold) {
            const startCh = chapById.get(streakStart.chapterId)
            const endCh = chapById.get(ev.chapterId)
            out.push({
              id: `stale-snapshot-${charId}-${streakStart.id}`,
              kind: 'stale-snapshot',
              severity: 'warning',
              category: 'character',
              message: `${char.name}'s state may be stale (${streakCount}+ scenes without update)`,
              detail: `Involved from Ch. ${startCh?.number ?? '?'} to Ch. ${endCh?.number ?? '?'} with no snapshot update`,
              navigatePath: `/worlds/${worldId}/timeline/${streakStart.chapterId}`,
              eventId: streakStart.id,
            })
          }
        }
      }
    }

    // ── Location destroyed check ─────────────────────────────────────────────

    // Group location snapshots by locationMarkerId
    const locSnapsByMarker = new Map<string, { order: number; status: string }[]>()
    for (const ls of allLocationSnapshots ?? []) {
      if (!locSnapsByMarker.has(ls.locationMarkerId)) locSnapsByMarker.set(ls.locationMarkerId, [])
      locSnapsByMarker.get(ls.locationMarkerId)!.push({ order: eventOrder(ls.eventId), status: ls.status })
    }
    // Sorted, because `loc-resurrected` reads this as a history and not as a
    // set. The destroyed-location check below only asks whether *any* earlier
    // snapshot was destroyed, so the order was never load-bearing until now.
    for (const hist of locSnapsByMarker.values()) hist.sort((a, b) => a.order - b.order)

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId) continue
      const snapOrder = eventOrder(snap.eventId)
      const locHistory = locSnapsByMarker.get(snap.currentLocationMarkerId)
      if (!locHistory) continue

      // Any destroyed/ruined snapshot at or before this event
      const wasDestroyed = locHistory.some(
        (ls) => ls.order <= snapOrder && (ls.status === 'destroyed' || ls.status === 'ruined')
      )
      if (!wasDestroyed) continue

      const char = charById.get(snap.characterId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      const marker = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)
      out.push({
        id: `loc-destroyed-${snap.characterId}-${snap.eventId}`,
        kind: 'loc-destroyed',
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} is at a destroyed location in Ch. ${ch?.number ?? '?'}`,
        detail: `"${marker?.name ?? snap.currentLocationMarkerId}" was destroyed at or before this scene`,
        navigatePath: `/worlds/${worldId}/timeline/${ev?.chapterId ?? snap.eventId}`,
        eventId: snap.eventId,
      })
    }

    // ── Character inside destroyed/occupied region ───────────────────────────

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId || !snap.currentMapLayerId) continue
      const marker = markerById.get(snap.currentLocationMarkerId)
      if (!marker) continue

      const snapOrder = eventOrder(snap.eventId)
      const char = charById.get(snap.characterId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined

      const layerRegions = regionsByLayer.get(snap.currentMapLayerId) ?? []
      for (const region of layerRegions) {
        if (region.vertices.length < 3) continue
        const status = bestRegionStatus(region.id, snapOrder)
        if (status !== 'destroyed' && status !== 'occupied') continue
        if (!pointInPolygon(marker.x, marker.y, region.vertices)) continue

        out.push({
          id: `char-in-region-${snap.characterId}-${snap.eventId}-${region.id}`,
          kind: 'char-in-region',
          severity: 'warning',
          category: 'character',
          message: `${char?.name ?? '?'} is inside a ${status} region in Ch. ${ch?.number ?? '?'}`,
          detail: `"${marker.name}" is inside "${region.name}" which is ${status} at this scene`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    // ── Item checks ─────────────────────────────────────────────────────────

    // Group item placements by eventId
    const placementsByEvent = new Map<string, ItemPlacement[]>()
    for (const p of (allItemPlacements ?? [])) {
      if (!placementsByEvent.has(p.eventId)) placementsByEvent.set(p.eventId, [])
      placementsByEvent.get(p.eventId)!.push(p)
    }

    // Group snapshots by eventId to check inventory duplication
    const snapsByEvent = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByEvent.has(snap.eventId)) snapsByEvent.set(snap.eventId, [])
      snapsByEvent.get(snap.eventId)!.push(snap)
    }

    for (const [evId, evSnaps] of snapsByEvent) {
      const ev = eventById.get(evId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      if (!ch) continue

      // Build a count of each item across all inventories in this event
      const itemOwnerCount = new Map<string, string[]>()
      for (const snap of evSnaps) {
        for (const itemId of snap.inventoryItemIds) {
          if (!itemOwnerCount.has(itemId)) itemOwnerCount.set(itemId, [])
          itemOwnerCount.get(itemId)!.push(snap.characterId)
        }
      }

      // Also count items placed at locations
      const evPlacements = placementsByEvent.get(evId) ?? []
      for (const p of evPlacements) {
        if (!itemOwnerCount.has(p.itemId)) itemOwnerCount.set(p.itemId, [])
        itemOwnerCount.get(p.itemId)!.push(`location:${p.locationMarkerId}`)
      }

      for (const [itemId, owners] of itemOwnerCount) {
        // A kind of thing rather than one object — several people carrying a
        // cloak each is not a contradiction, it is what a cloak is.
        if (itemById.get(itemId)?.isCollective) continue
        if (owners.length > 1) {
          const item = itemById.get(itemId)
          const ownerNames = owners.map((o) => {
            if (o.startsWith('location:')) return 'a location'
            return charById.get(o)?.name ?? 'unknown'
          })
          out.push({
            id: `dup-item-${itemId}-${evId}`,
            kind: 'dup-item',
            severity: 'error',
            category: 'item',
            message: `"${item?.name ?? itemId}" appears in multiple places in Ch. ${ch.number}`,
            detail: `Held by: ${ownerNames.join(', ')}`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: evId,
          })
        }
      }
    }

    // ── Item used before acquired check ─────────────────────────────────────

    // Find the earliest event order where each item first appears in any inventory
    const itemFirstAcquiredOrder = new Map<string, number>()
    for (const snap of snapshots) {
      const order = eventOrder(snap.eventId)
      for (const itemId of snap.inventoryItemIds) {
        const current = itemFirstAcquiredOrder.get(itemId) ?? Infinity
        if (order < current) itemFirstAcquiredOrder.set(itemId, order)
      }
    }

    for (const ev of allEvents) {
      if (!ev.involvedItemIds || ev.involvedItemIds.length === 0) continue
      const ch = chapById.get(ev.chapterId)
      if (!ch) continue
      const evOrder = eventOrder(ev.id)

      for (const itemId of ev.involvedItemIds) {
        const firstOrder = itemFirstAcquiredOrder.get(itemId)
        if (firstOrder !== undefined && evOrder < firstOrder) {
          const item = itemById.get(itemId)
          out.push({
            id: `item-before-acquired-${itemId}-${ev.id}`,
            kind: 'item-before-acquired',
            severity: 'warning',
            category: 'item',
            message: `"${item?.name ?? itemId}" used before acquired in Ch. ${ch.number}`,
            detail: `Appears in scene "${ev.title}" but isn't in any inventory until later`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: ev.id,
          })
        }
      }
    }

    // ── Item used after destroyed ─────────────────────────────────────────────
    // An item's condition is tracked via ItemSnapshot. If the last condition at or before
    // a reference point is 'destroyed', flag it. A later non-destroyed snapshot acts as restoration.
    const itemSnapHistory = new Map<string, Array<{ order: number; condition: string }>>()
    for (const is of allItemSnapshots ?? []) {
      if (!itemSnapHistory.has(is.itemId)) itemSnapHistory.set(is.itemId, [])
      itemSnapHistory.get(is.itemId)!.push({ order: eventOrder(is.eventId), condition: is.condition })
    }
    for (const hist of itemSnapHistory.values()) hist.sort((a, b) => a.order - b.order)

    function isItemDestroyedAtOrder(itemId: string, order: number): boolean {
      const hist = itemSnapHistory.get(itemId)
      if (!hist) return false
      let lastCondition: string | null = null
      for (const entry of hist) {
        if (entry.order > order) break
        lastCondition = entry.condition
      }
      return lastCondition != null && TERMINAL_CONDITIONS.includes(lastCondition)
    }

    for (const ev of allEvents) {
      if (!ev.involvedItemIds?.length) continue
      const evOrder = eventOrder(ev.id)
      const ch = chapById.get(ev.chapterId)
      for (const itemId of ev.involvedItemIds) {
        if (!isItemDestroyedAtOrder(itemId, evOrder)) continue
        const item = itemById.get(itemId)
        out.push({
          id: `item-after-destroyed-ev-${itemId}-${ev.id}`,
          kind: 'item-after-destroyed-ev',
          severity: 'warning',
          category: 'item',
          message: `"${item?.name ?? itemId}" used after being destroyed`,
          detail: `Referenced in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) — condition is "destroyed". Update the item snapshot to restore it if intentional.`,
          navigatePath: `/worlds/${worldId}/timeline/${ch?.id ?? ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    for (const snap of snapshots) {
      if (!snap.inventoryItemIds?.length) continue
      const snapOrder = eventOrder(snap.eventId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      for (const itemId of snap.inventoryItemIds) {
        if (!isItemDestroyedAtOrder(itemId, snapOrder)) continue
        const item = itemById.get(itemId)
        const char = charById.get(snap.characterId)
        out.push({
          id: `item-after-destroyed-inv-${itemId}-${snap.eventId}-${snap.characterId}`,
          kind: 'item-after-destroyed-inv',
          severity: 'warning',
          category: 'item',
          message: `Destroyed item "${item?.name ?? itemId}" in ${char?.name ?? '?'}'s inventory`,
          detail: `Held in Ch. ${ch?.number ?? '?'} — condition is "destroyed". Update the item snapshot to restore it if intentional.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    /*
      An item whole again after being destroyed.

      The counterpart of a character coming back and a place standing again, and
      the reason all three now agree. Until the vocabulary gained `repaired`,
      this had no way to be *stated*: `isItemDestroyedAtOrder` reads the last
      condition, so any later non-destroyed snapshot silently cancelled the
      destruction and nothing was ever said about the flip.

      Silent when the writer names it, one line when they do not — because a
      bare `intact` after `destroyed` is still an unexplained return.

      **`damaged → intact` and `lost → found` stay silent**, and that is the
      distinction worth keeping: repair is ordinary, and `lost`/`found` shipped
      as a designed pair. Only a *terminal* condition returning is news.
    */
    for (const [itemId, hist] of itemSnapHistory) {
      const item = itemById.get(itemId)
      if (!item) continue
      let goneAt: number | null = null
      for (const entry of hist) {
        if (TERMINAL_CONDITIONS.includes(entry.condition)) { if (goneAt == null) goneAt = entry.order; continue }
        if (goneAt == null || entry.condition === 'unknown') continue
        if (entry.condition === RESTORED_CONDITION) { goneAt = null; continue }

        const backEv = allEvents.find((e) => eventOrder(e.id) === entry.order)
        const goneEv = allEvents.find((e) => eventOrder(e.id) === goneAt)
        const backCh = backEv ? chapById.get(backEv.chapterId) : undefined
        const goneCh = goneEv ? chapById.get(goneEv.chapterId) : undefined
        out.push({
          id: `item-restored-${itemId}-${backEv?.id ?? entry.order}`,
          kind: 'item-restored',
          severity: 'warning',
          category: 'item',
          message: `"${item.name}" is "${entry.condition}" again after being destroyed`,
          detail: `Destroyed in Ch. ${goneCh?.number ?? '?'}, ${entry.condition} again in Ch. ${backCh?.number ?? '?'}. Set the condition to "repaired" if it was mended, or correct one of the two.`,
          navigatePath: backEv ? `/worlds/${worldId}/timeline/${backEv.chapterId}` : undefined,
          eventId: backEv?.id,
        })
        break // one return is the finding; breaking it again is a history.
      }
    }

    // ── Item hand-off "teleport" check ───────────────────────────────────────
    // An item that passes directly between two characters who were never in the
    // same place around the hand-off has no way to physically change hands.
    for (const h of computeItemHandoffIssues({ events: allEvents, chapters, snapshots, placements: allItemPlacements ?? [] })) {
      const item = itemById.get(h.itemId)
      // Two people holding their own cloak is not one cloak crossing the map.
      if (item?.isCollective) continue
      const from = charById.get(h.fromCharacterId)
      const to   = charById.get(h.toCharacterId)
      const fromMarker = markerById.get(h.fromMarkerId)
      const toMarker   = markerById.get(h.toMarkerId)
      const ev = eventById.get(h.handoffEventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      out.push({
        id: `item-handoff-${h.itemId}-${h.fromCharacterId}-${h.toCharacterId}-${h.handoffEventId}`,
        kind: 'item-handoff',
        severity: 'warning',
        category: 'item',
        message: `"${item?.name ?? h.itemId}" changes hands between characters in different places`,
        detail: `${from?.name ?? '?'} last held it at "${fromMarker?.name ?? h.fromMarkerId}", but ${to?.name ?? '?'} has it at "${toMarker?.name ?? h.toMarkerId}" in Ch. ${ch?.number ?? '?'} — they never share a location. Add a scene where they meet, route it through a location, or suppress if intentional.`,
        navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
        eventId: h.handoffEventId,
      })
    }

    // ── Relationship checks ──────────────────────────────────────────────────

    for (const rel of rels) {
      if (!rel.startEventId) continue
      const startOrder = eventOrder(rel.startEventId)
      const startChapNum = chapNumById.get(eventById.get(rel.startEventId)?.chapterId ?? '') ?? 0

      /*
        A relationship marked over, and then live again.

        `rel-before-start` has always caught the other end of this. The flag
        that says a relationship has ended — `RelationshipSnapshot.isActive` —
        was read by no check at all, so a friendship recorded as over in Ch.4
        could go on having states recorded in Ch.9 in silence.

        Only the *last* ending matters. Relationships in fiction break and mend,
        and a writer who records the mend has said what happened; what this is
        for is the ending nobody came back to.
      */
      const relSnapsSorted = (allRelSnaps ?? [])
        .filter((rs) => rs.relationshipId === rel.id)
        .map((rs) => ({ rs, order: eventOrder(rs.eventId) }))
        .sort((a, b) => a.order - b.order)

      let endedAt: { rs: (typeof relSnapsSorted)[number]['rs']; order: number } | null = null
      for (const entry of relSnapsSorted) {
        if (entry.rs.isActive === false) endedAt = { rs: entry.rs, order: entry.order }
      }
      if (endedAt) {
        const endEv = eventById.get(endedAt.rs.eventId)
        const endCh = endEv ? chapById.get(endEv.chapterId) : undefined
        for (const entry of relSnapsSorted) {
          if (entry.order <= endedAt.order || entry.rs.isActive !== true) continue
          const laterEv = eventById.get(entry.rs.eventId)
          const laterCh = laterEv ? chapById.get(laterEv.chapterId) : undefined
          const a = charById.get(rel.characterAId)
          const b = charById.get(rel.characterBId)
          out.push({
            id: `rel-after-end-${entry.rs.id}`,
            kind: 'rel-after-end',
            severity: 'warning',
            category: 'relationship',
            message: `${a?.name ?? '?'} and ${b?.name ?? '?'} have a state after their relationship ended`,
            detail: `Ended in Ch. ${endCh?.number ?? '?'} ("${endEv?.title || 'untitled'}"), active again in Ch. ${laterCh?.number ?? '?'}. Record the mend, or clear the later state.`,
            navigatePath: laterEv ? `/worlds/${worldId}/timeline/${laterEv.chapterId}` : undefined,
            eventId: entry.rs.eventId,
          })
        }
      }

      // Any snapshot for an event BEFORE the relationship started
      const earlySnaps = (allRelSnaps ?? []).filter((rs) => {
        if (rs.relationshipId !== rel.id) return false
        return eventOrder(rs.eventId) < startOrder
      })

      for (const rs of earlySnaps) {
        const rsEv = eventById.get(rs.eventId)
        const rsCh = rsEv ? chapById.get(rsEv.chapterId) : undefined
        const charA = charById.get(rel.characterAId)
        const charB = charById.get(rel.characterBId)
        out.push({
          id: `rel-before-start-${rs.id}`,
          kind: 'rel-before-start',
          severity: 'warning',
          category: 'relationship',
          message: `Relationship snapshot exists before it started`,
          detail: `${charA?.name ?? '?'} ↔ ${charB?.name ?? '?'} — snapshot in Ch. ${rsCh?.number ?? '?'} but relationship starts in Ch. ${startChapNum}`,
          navigatePath: `/worlds/${worldId}/timeline/${rsEv?.chapterId ?? rs.eventId}`,
          eventId: rs.eventId,
        })
      }
    }

    // ── Dead character in relationship snapshot ──────────────────────────────

    // Map: characterId → eventId → isAlive
    const charAliveAtEvent = new Map<string, Map<string, boolean>>()
    for (const snap of snapshots) {
      if (!charAliveAtEvent.has(snap.characterId)) charAliveAtEvent.set(snap.characterId, new Map())
      charAliveAtEvent.get(snap.characterId)!.set(snap.eventId, snap.isAlive)
    }

    for (const rs of allRelSnaps ?? []) {
      const rel = rels.find((r) => r.id === rs.relationshipId)
      if (!rel) continue

      const charAAlive = charAliveAtEvent.get(rel.characterAId)?.get(rs.eventId)
      const charBAlive = charAliveAtEvent.get(rel.characterBId)?.get(rs.eventId)

      if (charAAlive === false || charBAlive === false) {
        const deadCharId = charAAlive === false ? rel.characterAId : rel.characterBId
        const deadChar = charById.get(deadCharId)
        const charA = charById.get(rel.characterAId)
        const charB = charById.get(rel.characterBId)
        const rsEv = eventById.get(rs.eventId)
        const rsCh = rsEv ? chapById.get(rsEv.chapterId) : undefined
        out.push({
          id: `dead-char-in-rel-snap-${rs.id}`,
          kind: 'dead-char-in-rel-snap',
          severity: 'warning',
          category: 'relationship',
          message: `Relationship snapshot references deceased ${deadChar?.name ?? '?'}`,
          detail: `${charA?.name ?? '?'} ↔ ${charB?.name ?? '?'} in Ch. ${rsCh?.number ?? '?'}`,
          navigatePath: `/worlds/${worldId}/timeline/${rsEv?.chapterId ?? rs.eventId}`,
          eventId: rs.eventId,
        })
      }
    }

    // ── Travel distance checks (with route speed multipliers) ───────────────

    const travelModeById = new Map(travelModes.map((t) => [t.id, t]))
    const movementKey = (charId: string, eventId: string) => `${charId}:${eventId}`
    const movementByKey = new Map(allMovements.map((m) => [movementKey(m.characterId, m.eventId), m]))

    // Group routes by mapLayerId for fast lookup
    const routesByLayer = new Map<string, MapRoute[]>()
    for (const route of allMapRoutes ?? []) {
      if (!routesByLayer.has(route.mapLayerId)) routesByLayer.set(route.mapLayerId, [])
      routesByLayer.get(route.mapLayerId)!.push(route)
    }

    for (const [charId, charSnaps] of snapsByChar) {
      const char = charById.get(charId)
      if (!char) continue

      const snapsWithLocation = charSnaps
        .filter((s) => s.currentLocationMarkerId && s.currentMapLayerId)
        .sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))

      for (let i = 1; i < snapsWithLocation.length; i++) {
        const prev = snapsWithLocation[i - 1]
        const curr = snapsWithLocation[i]

        if (prev.currentLocationMarkerId === curr.currentLocationMarkerId &&
            prev.currentMapLayerId === curr.currentMapLayerId) continue

        const fromMarker = prev.currentLocationMarkerId ? markerById.get(prev.currentLocationMarkerId) : undefined
        const toMarker   = curr.currentLocationMarkerId ? markerById.get(curr.currentLocationMarkerId) : undefined
        if (!fromMarker || !toMarker || fromMarker.mapLayerId !== toMarker.mapLayerId) continue

        const currEvent = eventById.get(curr.eventId)
        const currOrder = eventOrder(curr.eventId)

        // ── Region traversal: warn if path crosses a destroyed/abandoned region ──
        const layerRegions = regionsByLayer.get(fromMarker.mapLayerId) ?? []
        for (const region of layerRegions) {
          const status = bestRegionStatus(region.id, currOrder)
          if (status !== 'destroyed' && status !== 'abandoned') continue
          if (!pathCrossesPolygon(fromMarker.x, fromMarker.y, toMarker.x, toMarker.y, region.vertices)) continue

          out.push({
            id: `region-traversal-${charId}-${curr.eventId}-${region.id}`,
            kind: 'region-traversal',
            severity: 'warning',
            category: 'character',
            message: `${char.name} travels through a ${status} region`,
            detail: `"${region.name}" is ${status} when ${char.name} moves from ${fromMarker.name} → ${toMarker.name}${currEvent ? ` (Ch. ${chapById.get(currEvent.chapterId)?.number ?? '?'})` : ''}`,
            navigatePath: currEvent ? `/worlds/${worldId}/timeline/${currEvent.chapterId}` : undefined,
            eventId: curr.eventId,
          })
        }

        // ── Travel time check ─────────────────────────────────────────────────
        // Days available = elapsed in-world time between the two snapshots. This
        // spans every event in between (not just this one's travelDays) and
        // respects explicit inWorldTime. <= 0 means no tracked time (or a
        // flashback jump), so there's nothing to check.
        const daysAvailable = (inWorldDay.get(curr.eventId) ?? 0) - (inWorldDay.get(prev.eventId) ?? 0)
        if (!currEvent || daysAvailable <= 0) continue

        const mov = movementByKey.get(movementKey(charId, curr.eventId))
        const travelModeId = mov?.travelModeId ?? curr.travelModeId
        const travelMode = travelModeId ? travelModeById.get(travelModeId) : undefined
        if (!travelMode) continue

        const layer = layerById.get(fromMarker.mapLayerId)
        if (!layer?.scalePixelsPerUnit || !layer.scaleUnit) continue

        // Find a route connecting the two markers (on the same layer)
        const layerRoutes = routesByLayer.get(fromMarker.mapLayerId) ?? []
        const connectingRoute = layerRoutes.find((r) => {
          const wps = r.waypoints
          return wps.some((wp) => wp === prev.currentLocationMarkerId) &&
                 wps.some((wp) => wp === curr.currentLocationMarkerId)
        })

        const routeMultiplier = connectingRoute ? ROUTE_SPEED_MULTIPLIERS[connectingRoute.routeType] : 1.0
        const assessment = assessTravel({
          pixelDistance: pixelDist(fromMarker.x, fromMarker.y, toMarker.x, toMarker.y),
          scalePixelsPerUnit: layer.scalePixelsPerUnit,
          baseSpeedPerDay: travelMode.speedPerDay,
          routeType: connectingRoute?.routeType ?? null,
          daysAvailable,
        })

        if (!assessment.feasible && Number.isFinite(assessment.shortfallDays)) {
          const currCh = chapById.get(currEvent.chapterId)
          const dist = assessment.distanceUnits < 10 ? assessment.distanceUnits.toFixed(1) : Math.round(assessment.distanceUnits).toString()
          const routeNote = connectingRoute
            ? ` via ${connectingRoute.routeType.replace('_', ' ')} (×${routeMultiplier} speed)`
            : ''
          // Adding the shortfall to this event's own travelDays lengthens the
          // elapsed time before it, making the journey possible.
          const newTravelDays = (currEvent.travelDays ?? 0) + assessment.shortfallDays
          out.push({
            id: `travel-dist-${charId}-${curr.eventId}`,
            kind: 'travel-dist',
            severity: 'warning',
            category: 'character',
            message: `${char.name} can't reach ${toMarker.name} in time`,
            detail: `${fromMarker.name} → ${toMarker.name} is ~${dist} ${layer.scaleUnit} · ${travelMode.name} at ${assessment.effectiveSpeed.toFixed(1)} ${layer.scaleUnit}/day${routeNote} — needs ${assessment.daysNeeded.toFixed(1)} days but only ${daysAvailable} in-world day${daysAvailable === 1 ? '' : 's'} available (Ch. ${currCh?.number ?? '?'})`,
            navigatePath: `/worlds/${worldId}/timeline/${currEvent.chapterId}`,
            eventId: curr.eventId,
            fix: { kind: 'travelDays', label: `Allow ${assessment.shortfallDays} more day${assessment.shortfallDays === 1 ? '' : 's'}`, eventId: curr.eventId, setTravelDays: newTravelDays },
          })
        }
      }
    }

    // ── Cross-timeline artifact anachronism check ────────────────────────────

    // Build a map: timelineId → Set<chapterId>
    const chaptersByTimeline = new Map<string, Set<string>>()
    for (const ch of chapters) {
      if (!chaptersByTimeline.has(ch.timelineId)) chaptersByTimeline.set(ch.timelineId, new Set())
      chaptersByTimeline.get(ch.timelineId)!.add(ch.id)
    }

    for (const artifact of artifacts) {
      const item = itemById.get(artifact.itemId)
      if (!item) continue

      const allowedTimelines = new Set([artifact.originTimelineId, artifact.encounterTimelineId])

      // Find snapshots where this item is in inventory
      for (const snap of snapshots) {
        if (!snap.inventoryItemIds.includes(artifact.itemId)) continue
        const ev = eventById.get(snap.eventId)
        if (!ev) continue
        const ch = chapById.get(ev.chapterId)
        if (!ch) continue

        // If the snapshot's chapter belongs to a timeline outside the two declared timelines, flag it
        if (!allowedTimelines.has(ch.timelineId)) {
          const char = charById.get(snap.characterId)
          out.push({
            id: `artifact-wrong-timeline-${artifact.id}-${snap.id}`,
            kind: 'artifact-wrong-timeline',
            severity: 'warning',
            category: 'item',
            message: `"${item.name}" appears outside its declared timelines`,
            detail: `${char?.name ?? '?'} holds it in Ch. ${ch.number} — not in origin or encounter timeline`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: snap.eventId,
          })
        }
      }
    }

    // ── Faction membership gap check ────────────────────────────────────────
    const factionById = new Map(allFactions.map((f) => [f.id, f]))
    const membershipsByChar = new Map<string, typeof allMemberships>()
    for (const m of allMemberships) {
      if (!membershipsByChar.has(m.characterId)) membershipsByChar.set(m.characterId, [])
      membershipsByChar.get(m.characterId)!.push(m)
    }

    for (const [charId, memberships] of membershipsByChar) {
      const char = charById.get(charId)
      if (!char) continue
      for (const m of memberships) {
        if (!m.endEventId) continue
        const endOrder = eventOrder(m.endEventId)
        const endEvent = eventById.get(m.endEventId)
        const faction  = factionById.get(m.factionId)
        const hasOtherActive = memberships.some((other) => {
          if (other.id === m.id) return false
          const otherStart = other.startEventId ? eventOrder(other.startEventId) : 0
          const otherEnd   = other.endEventId   ? eventOrder(other.endEventId)   : Infinity
          return otherStart <= endOrder + 1 && otherEnd > endOrder
        })
        if (!hasOtherActive) {
          const endCh = endEvent ? chapById.get(endEvent.chapterId) : undefined
          out.push({
            id: `faction-gap-${charId}-${m.id}`,
            kind: 'faction-gap',
            severity: 'warning',
            category: 'faction',
            message: `${char.name} leaves "${faction?.name ?? '?'}" with no replacement faction`,
            detail: `Membership ends at "${endEvent?.title ?? '?'}" (Ch. ${endCh?.number ?? '?'}) — no other faction active from this point.`,
            navigatePath: endEvent ? `/worlds/${worldId}/timeline/${endEvent.chapterId}` : undefined,
            eventId: m.endEventId,
          })
        }
      }
    }

    // ── Hostile faction location check ──────────────────────────────────────
    // `areHostile` and `membershipsByChar` are defined here and read again by
    // the two-allegiances check further down, which is why that one follows.
    // Warn when a character is at a location controlled by a faction that is
    // hostile to one of the character's own active factions.

    const hostileRels = allFactionRels.filter((r) => r.stance === 'hostile')

    function areHostile(fA: string, fB: string): boolean {
      return hostileRels.some(
        (r) => (r.factionAId === fA && r.factionBId === fB) ||
               (r.factionAId === fB && r.factionBId === fA)
      )
    }

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId) continue
      const marker = markerById.get(snap.currentLocationMarkerId)
      if (!marker?.factionId) continue

      const snapOrder = eventOrder(snap.eventId)
      const charMemberships = membershipsByChar.get(snap.characterId) ?? []
      const activeCharFactionIds = charMemberships
        .filter((m) => {
          const start = m.startEventId ? eventOrder(m.startEventId) : 0
          const end   = m.endEventId   ? eventOrder(m.endEventId)   : Infinity
          return start <= snapOrder && snapOrder < end
        })
        .map((m) => m.factionId)

      for (const charFactionId of activeCharFactionIds) {
        if (!areHostile(charFactionId, marker.factionId)) continue

        const char       = charById.get(snap.characterId)
        const ev         = eventById.get(snap.eventId)
        const ch         = ev ? chapById.get(ev.chapterId) : undefined
        const charFaction = factionById.get(charFactionId)
        const locFaction  = factionById.get(marker.factionId)
        out.push({
          id: `hostile-loc-${snap.characterId}-${snap.eventId}-${charFactionId}`,
          kind: 'hostile-loc',
          severity: 'warning',
          category: 'faction',
          message: `${char?.name ?? '?'} is at hostile territory in Ch. ${ch?.number ?? '?'}`,
          detail: `"${marker.name}" is controlled by "${locFaction?.name ?? '?'}" — hostile to "${charFaction?.name ?? '?'}"`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    // ── POV checks ──────────────────────────────────────────────────────────────

    /*
      Check 0: the POV points at no character at all.

      W19-6: this was reported as *"POV \"?\" is not in the cast"* by the check
      below, which is the wrong fault twice over — the id names nobody, so there
      is no cast to be missing from, and the remedy it offered ("add them to
      Characters") cannot be carried out, because "them" does not exist. On one
      shipped book that was **128 of 161 warnings**, one unactionable row
      repeated, burying the 33 real ones.

      It goes first so the two checks after it can skip these events rather than
      each describe the same broken id in its own wrong words. The fix is the
      one thing that is actually true: the POV is not a character, so clear it.
    */
    const povIsUnknown = (ev: (typeof allEvents)[number]) =>
      !!ev.povCharacterId && !charById.has(ev.povCharacterId)

    for (const ev of allEvents) {
      if (!povIsUnknown(ev)) continue
      const ch = chapById.get(ev.chapterId)
      out.push({
        id: `pov-unknown-${ev.id}`,
        kind: 'pov-unknown',
        severity: 'warning',
        category: 'pov',
        message: `The POV of "${ev.title || 'untitled'}" names no character`,
        detail: `Ch. ${ch?.number ?? '?'} — the character it pointed at is gone. Clear the POV, or set it to someone who exists.`,
        navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        eventId: ev.id,
        fix: { kind: 'clearPov', label: 'Clear the POV', eventId: ev.id },
      })
    }

    // Check 3: POV character not listed in involvedCharacterIds
    for (const ev of allEvents) {
      if (!ev.povCharacterId || povIsUnknown(ev)) continue
      if (!ev.involvedCharacterIds.includes(ev.povCharacterId)) {
        const char = charById.get(ev.povCharacterId)
        const ch = chapById.get(ev.chapterId)
        out.push({
          id: `pov-not-involved-${ev.id}`,
          kind: 'pov-not-involved',
          severity: 'warning',
          category: 'pov',
          message: `POV "${char?.name ?? '?'}" is not in the cast of "${ev.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — add them to Characters or clear the POV`,
          navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    // Check 2: POV character dead at that event (non-flashback only)
    for (const ev of allEvents) {
      if (!ev.povCharacterId || ev.isFlashback || povIsUnknown(ev)) continue
      const evOrder = eventOrder(ev.id)
      if (!isDeadAtOrder(ev.povCharacterId, evOrder)) continue
      const char = charById.get(ev.povCharacterId)
      const ch = chapById.get(ev.chapterId)
      out.push({
        id: `dead-pov-${ev.povCharacterId}-${ev.id}`,
        kind: 'dead-pov',
        severity: 'warning',
        category: 'pov',
        message: `POV "${char?.name ?? '?'}" is dead at "${ev.title || 'untitled'}"`,
        detail: `Ch. ${ch?.number ?? '?'} — mark the scene as a flashback if intentional`,
        navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        eventId: ev.id,
      })
    }

    /*
      ── A long run in one head, measured against this book's own rhythm ──────

      W23-9: this was a hard `runLen >= 3` with the advice *"consider
      alternating perspectives"*, which fires on **every single-POV novel** —
      the most common form the novel takes. Measured on the shipped books:
      *Alice* 51 consecutive (1 of its 4 total warnings), *The Secret Garden*
      50, *Neuromancer* 29, *The Invisible Man* three separate runs. None of
      those is a continuity fault; they are close third with one viewpoint.

      `pov-missing`, added next door, carries the argument against it in its own
      docblock: *"it asks what this book's own habit is, and only speaks when a
      scene departs from it."* This asked nothing.

      **A run is now notable when it is more than twice the book's median run.**
      That yardstick handles the single-POV case without a special rule for it:
      one run means the median *is* that run, so it can never exceed twice
      itself and the check stays quiet. In a book that alternates every three or
      four scenes, a run of fifteen clears it and is worth saying.
    */
    const povEvents = allEvents
      .filter((ev) => !!ev.povCharacterId)
      .sort((a, b) => eventOrder(a.id) - eventOrder(b.id))

    /** Every unbroken run of one POV, in story order. */
    const povRuns: Array<{ charId: string; start: number; len: number }> = []
    for (let i = 0; i < povEvents.length;) {
      const charId = povEvents[i].povCharacterId!
      let j = i + 1
      while (j < povEvents.length && povEvents[j].povCharacterId === charId) j++
      povRuns.push({ charId, start: i, len: j - i })
      i = j
    }
    const lengths = povRuns.map((r) => r.len).sort((a, b) => a - b)
    const median = lengths.length === 0
      ? 0
      : lengths.length % 2
        ? lengths[(lengths.length - 1) / 2]
        : (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2

    for (const run of povRuns) {
      const runStart = run.start
      const runEnd = run.start + run.len
      const charId = run.charId
      const runLen = run.len
      if (runLen >= 3 && runLen > median * 2) {
        const char = charById.get(charId)
        const firstEv = povEvents[runStart]
        const lastEv  = povEvents[runEnd - 1]
        const firstCh = chapById.get(firstEv.chapterId)
        const lastCh  = chapById.get(lastEv.chapterId)
        out.push({
          id: `pov-consecutive-${charId}-${firstEv.id}`,
          kind: 'pov-consecutive',
          severity: 'warning',
          category: 'pov',
          message: `${char?.name ?? '?'} is the point of view for ${runLen} scenes running`,
          detail: `Ch. ${firstCh?.number ?? '?'} → Ch. ${lastCh?.number ?? '?'} — longer than this book's usual ${median === Math.round(median) ? median : median.toFixed(1)}. Fine if it is deliberate.`,
          navigatePath: `/worlds/${worldId}/timeline/${firstEv.chapterId}`,
          eventId: firstEv.id,
        })
      }
    }

    // ── Anachronistic knowledge: knowing a fact before it becomes true ────────
    for (const a of computeKnowledgeAnachronisms({ facts: knowledgeFacts, reveals: knowledgeReveals, events: allEvents, chapters })) {
      const knownCh  = chapById.get(eventById.get(a.knownAtEventId)?.chapterId ?? '')
      const originCh = chapById.get(eventById.get(a.originEventId)?.chapterId ?? '')
      /*
        W23-12: the detail line read `${who.toLowerCase()}` so that *"The
        reader"* would read as *"the reader"* mid-sentence — and lowercased
        every character's name with it. On *The Secret Garden*: *"…but **mary
        lennox** knows it in Ch. 7."* A writer's proper nouns are theirs, and
        the app does not get to re-case them. Two forms instead of one
        transform: the reader has a sentence-start form and a mid-sentence one,
        and a name is a name in both.
      */
      const named = a.characterId ? (charById.get(a.characterId)?.name ?? 'A character') : null
      const who = named ?? 'The reader'
      const whoMidSentence = named ?? 'the reader'
      out.push({
        id: `knowledge-anachronism-${a.fact.id}-${a.characterId ?? 'reader'}-${a.knownAtEventId}`,
        kind: 'knowledge-anachronism',
        severity: 'warning',
        category: 'character',
        message: `${who} knows "${a.fact.title}" before it happens`,
        detail: `"${a.fact.title}" isn't true until Ch. ${originCh?.number ?? '?'}, but ${whoMidSentence} knows it in Ch. ${knownCh?.number ?? '?'}.`,
        navigatePath: `/worlds/${worldId}/timeline/${eventById.get(a.knownAtEventId)?.chapterId ?? ''}`,
        eventId: a.knownAtEventId,
      })
    }

    // ── Dead character learns a fact after dying ─────────────────────────────
    for (const d of computeDeadKnowerIssues({ facts: knowledgeFacts, reveals: knowledgeReveals, snapshots, events: allEvents, chapters })) {
      const char = charById.get(d.characterId)
      const ev = eventById.get(d.revealEventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      out.push({
        id: `dead-knower-${d.fact.id}-${d.characterId}-${d.revealEventId}`,
        kind: 'dead-knower',
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} learns "${d.fact.title}" after dying`,
        detail: `A reveal places this knowledge with ${char?.name ?? '?'} in Ch. ${ch?.number ?? '?'}, but they're already dead by then. Move the reveal earlier, or mark the scene a flashback if intentional.`,
        navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
        eventId: d.revealEventId,
      })
    }

    // ── Prose ↔ metadata drift (scene text vs. the event's cast) ─────────────
    const sceneTextByEvent = new Map(sceneTexts.map((s) => [s.eventId, s.text]))

    for (const p of computeProseMentionIssues({ events: allEvents, chapters, characters, snapshots, sceneTextByEvent })) {
      const ev = eventById.get(p.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      if (p.kind === 'dead') {
        out.push({
          id: `prose-dead-${p.characterId}-${p.eventId}`,
          kind: 'prose-dead',
          severity: 'warning',
          category: 'prose',
          message: `Dead character ${p.characterName} is named in the prose of "${ev?.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — ${p.characterName} is dead at this point. Mark the scene as a flashback or update their status if intentional.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: p.eventId,
        })
      } else {
        out.push({
          id: `prose-untagged-${p.characterId}-${p.eventId}`,
          kind: 'prose-untagged',
          severity: 'warning',
          category: 'prose',
          message: `${p.characterName} is named in the prose but not in the cast of "${ev?.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — appears ${p.count}× in the scene text. Add them to the scene or check the reference.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: p.eventId,
          /*
            W19-7: the warning already knew the character and the scene, and
            still sent the writer to the chapter with every scene collapsed —
            four clicks to do what the scene editor's own chip does in one. It
            is the check a drafting writer meets most often: 143 words of prose
            produced five of them. The chip and the row now agree.
          */
          fix: ev ? { kind: 'addToCast', label: 'Add to this scene', eventId: p.eventId, characterId: p.characterId } : undefined,
        })
      }
    }

    // ── Reader knowledge leaks (fact referenced in prose before its reveal) ──
    for (const leak of computeKnowledgeLeaks({ facts: knowledgeFacts, events: allEvents, chapters, sceneTextByEvent })) {
      const leakEv = eventById.get(leak.leakEventId)
      const leakCh = leakEv ? chapById.get(leakEv.chapterId) : undefined
      const revealCh = chapById.get(eventById.get(leak.revealEventId)?.chapterId ?? '')
      out.push({
        id: `prose-leak-${leak.fact.id}-${leak.leakEventId}`,
        kind: 'prose-leak',
        severity: 'warning',
        category: 'prose',
        message: `Possible early reveal: "${leak.fact.title}"`,
        detail: `The reader is set to learn this in Ch. ${revealCh?.number ?? '?'}, but "${leakEv?.title || 'untitled'}" (Ch. ${leakCh?.number ?? '?'}) already references it (matched "${leak.matchedTerm}").`,
        navigatePath: leakEv ? `/worlds/${worldId}/timeline/${leakEv.chapterId}` : undefined,
        eventId: leak.leakEventId,
      })
    }

    // ── World checks: places and the clock ──────────────────────────────────

    /*
      A place destroyed, and then standing again.

      The character version of this — `dead-then-alive` — has been here from the
      start; the place version never existed, though `LocationSnapshot.status`
      records exactly the same shape of history. A town razed in Ch.7 could be
      "active" again in Ch.12 with nothing said.

      Towns *are* rebuilt, so this is a warning rather than an error, and it
      reports the first return only: a place that comes back and is razed again
      is a place with a history, not a place with a bug.

      Deliberately unlike the item check beside it, which treats a later
      non-destroyed condition as restoration and says nothing. A mended sword is
      ordinary. A city un-burning is worth one line.
    */
    for (const [markerId, hist] of locSnapsByMarker) {
      const marker = markerById.get(markerId)
      if (!marker) continue
      let goneAt: number | null = null
      for (const entry of hist) {
        if (GONE_STATUSES.includes(entry.status)) { if (goneAt == null) goneAt = entry.order; continue }
        if (goneAt == null || entry.status === 'unknown') continue
        // "Rebuilt" is the writer saying so, which is the whole point of the
        // status existing — the same deal as `repaired` and `revived`.
        if (entry.status === REBUILT_STATUS) { goneAt = null; continue }
        const backEv = allEvents.find((e) => eventOrder(e.id) === entry.order)
        const goneEv = allEvents.find((e) => eventOrder(e.id) === goneAt)
        const backCh = backEv ? chapById.get(backEv.chapterId) : undefined
        const goneCh = goneEv ? chapById.get(goneEv.chapterId) : undefined
        out.push({
          id: `loc-resurrected-${markerId}-${backEv?.id ?? entry.order}`,
          kind: 'loc-resurrected',
          severity: 'warning',
          category: 'world',
          message: `"${marker.name}" is "${entry.status}" again after being destroyed`,
          detail: `Destroyed in Ch. ${goneCh?.number ?? '?'}, ${entry.status} again in Ch. ${backCh?.number ?? '?'}. Record the rebuilding, or correct one of the two.`,
          navigatePath: backEv ? `/worlds/${worldId}/timeline/${backEv.chapterId}` : undefined,
          eventId: backEv?.id,
        })
        break // one return is the finding; a second razing is a history.
      }
    }

    /*
      The story going backwards.

      `computeInWorldDays` takes an explicit `inWorldTime` as gospel and says so
      in its own comment — it "does not disturb the running derived clock". So a
      scene can be pinned to a day earlier than the scene before it and the
      calendar will draw it, the Brief will state it, and nothing will mention
      that the book has just travelled back in time.

      Flashbacks are the legitimate form of this and are the reason the pin
      exists, so they are excluded — and only *pinned* scenes are compared,
      because a derived day can only ever move forward and comparing those would
      be checking the arithmetic rather than the writing.
    */
    const byTimelineOrdered = new Map<string, typeof allEvents>()
    for (const ev of allEvents) {
      const list = byTimelineOrdered.get(ev.timelineId)
      if (list) list.push(ev); else byTimelineOrdered.set(ev.timelineId, [ev])
    }
    for (const list of byTimelineOrdered.values()) {
      const ordered = [...list].sort((a, b) => eventOrder(a.id) - eventOrder(b.id))
      let prev: { ev: (typeof ordered)[number]; day: number } | null = null
      for (const ev of ordered) {
        if (ev.isFlashback) continue
        const day = inWorldDay.get(ev.id)
        if (day == null) continue
        if (prev && ev.inWorldTime != null && day < prev.day) {
          const ch = chapById.get(ev.chapterId)
          const prevCh = chapById.get(prev.ev.chapterId)
          out.push({
            id: `time-backwards-${ev.id}`,
            kind: 'time-backwards',
            severity: 'warning',
            category: 'world',
            message: `"${ev.title || 'untitled'}" happens before the scene in front of it`,
            detail: `Ch. ${ch?.number ?? '?'} is set on day ${day}, and Ch. ${prevCh?.number ?? '?'} ("${prev.ev.title || 'untitled'}") on day ${prev.day}. Mark it a flashback, or correct the in-world time.`,
            navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
            eventId: ev.id,
          })
        }
        prev = { ev, day }
      }
    }

    /*
      ── Two hostile allegiances at once ─────────────────────────────────────

      `hostile-loc` already reads the faction-stance graph to ask whether a
      character is standing in enemy territory. It never asked the simpler
      question beside it: whether the character belongs to **both** sides at the
      same moment. Memberships carry a start and an end, so "at the same moment"
      is an interval overlap and not a guess.

      Reported once per pair rather than once per scene — it is one fact about
      two records, and the scene it happens to be noticed at is arbitrary. A
      double agent is a real thing, which is why it is a warning.
    */
    {
      const overlapKey = new Set<string>()
      for (const [charId, memberships] of membershipsByChar) {
        const spans = memberships.map((m) => ({
          factionId: m.factionId,
          start: m.startEventId ? eventOrder(m.startEventId) : 0,
          end: m.endEventId ? eventOrder(m.endEventId) : Infinity,
          startEventId: m.startEventId,
        }))
        for (let i = 0; i < spans.length; i++) {
          for (let j = i + 1; j < spans.length; j++) {
            const a = spans[i], b = spans[j]
            if (a.factionId === b.factionId) continue
            if (a.start >= b.end || b.start >= a.end) continue
            if (!areHostile(a.factionId, b.factionId)) continue
            const pair = [a.factionId, b.factionId].sort().join('|')
            const key = `${charId}|${pair}`
            if (overlapKey.has(key)) continue
            overlapKey.add(key)

            const char = charById.get(charId)
            const later = a.start >= b.start ? a : b
            const ev = later.startEventId ? eventById.get(later.startEventId) : undefined
            const ch = ev ? chapById.get(ev.chapterId) : undefined
            out.push({
              id: `faction-conflict-${charId}-${pair}`,
              kind: 'faction-conflict',
              severity: 'warning',
              category: 'faction',
              message: `${char?.name ?? '?'} belongs to "${factionById.get(a.factionId)?.name ?? '?'}" and "${factionById.get(b.factionId)?.name ?? '?'}" at once, and they are hostile`,
              detail: ch
                ? `Both memberships are open across Ch. ${ch.number}. End one, or say so if they are playing both sides.`
                : 'Both memberships are open at the same time. End one, or say so if they are playing both sides.',
              navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
              eventId: ev?.id,
            })
          }
        }
      }
    }

    /*
      ── A fact the reader never learns ──────────────────────────────────────

      `thread-dangling` for knowledge. A `KnowledgeFact` with no explicit reader
      reveal is meant to reach the reader through POV — the writer's own comment
      on `readerLearnsAtEventId` says so: *"null = derive it from POV (the
      reader learns it when a POV character who knows it holds the POV)"*. When
      neither happens, the fact is planted and never fires: it shapes nothing a
      reader can feel, and the knowledge screen shows it as though it did.

      Withholding on purpose is ordinary in a mystery, so this is a warning, and
      it stays silent in a world with no POV recorded anywhere — there, POV
      derivation cannot resolve for *any* fact and the finding would be about
      the field being unused rather than about this fact.
    */
    if (knowledgeFacts.length > 0 && allEvents.some((e) => e.povCharacterId)) {
      const knowersByFact = new Map<string, Set<string>>()
      for (const r of knowledgeReveals) {
        if (!knowersByFact.has(r.factId)) knowersByFact.set(r.factId, new Set())
        knowersByFact.get(r.factId)!.add(r.characterId)
      }
      for (const fact of knowledgeFacts) {
        if (fact.readerLearnsAtEventId) continue
        const knowers = knowersByFact.get(fact.id)
        // A POV scene held by somebody who knows it, at or after they learn it.
        const reaches = !!knowers && allEvents.some((ev) => {
          if (!ev.povCharacterId || !knowers.has(ev.povCharacterId)) return false
          const learn = knowledgeReveals.find((r) => r.factId === fact.id && r.characterId === ev.povCharacterId)
          return !!learn && eventOrder(learn.eventId) <= eventOrder(ev.id)
        })
        if (reaches) continue
        out.push({
          id: `knowledge-unrevealed-${fact.id}`,
          kind: 'knowledge-unrevealed',
          severity: 'warning',
          category: 'prose',
          message: `The reader never learns "${fact.title}"`,
          detail: knowers?.size
            ? `${knowers.size} character${knowers.size === 1 ? '' : 's'} know it, but no POV scene carries it and no reader reveal is set. Set one, or leave it withheld on purpose.`
            : 'Nobody learns it and no reader reveal is set, so it never reaches the page.',
          navigatePath: `/worlds/${worldId}/knowledge`,
        })
      }
    }

    /*
      ── A chapter with no scenes ────────────────────────────────────────────

      The structural counterpart of `thread-unstarted`, which has always said
      this about subplots. An empty chapter is a heading with nothing under it:
      the manuscript skips it, the pacing curve has no point for it, and the
      time cursor steps straight past.
    */
    {
      const eventCountByChapter = new Map<string, number>()
      for (const ev of allEvents) eventCountByChapter.set(ev.chapterId, (eventCountByChapter.get(ev.chapterId) ?? 0) + 1)
      for (const ch of chapters) {
        if (eventCountByChapter.get(ch.id)) continue
        out.push({
          id: `chapter-empty-${ch.id}`,
          kind: 'chapter-empty',
          severity: 'warning',
          category: 'world',
          message: `Ch. ${ch.number} "${ch.title || 'untitled'}" has no scenes`,
          detail: 'Nothing in it reaches the manuscript, the pacing curve or the time cursor. Add a scene, or delete the chapter.',
          navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
        })
      }
    }

    /*
      ── An item carried by somebody who is dead ─────────────────────────────

      `item-after-destroyed-inv` asks whether the *item* is gone; this asks
      whether the *holder* is. Reads the same `isDeadAtOrder` as the cast
      checks, so the scene where a death is recorded is not itself a finding —
      dying with your sword in your hand is not a continuity error.
    */
    for (const snap of snapshots) {
      if (!snap.inventoryItemIds?.length) continue
      const order = eventOrder(snap.eventId)
      if (!isDeadAtOrder(snap.characterId, order)) continue
      const char = charById.get(snap.characterId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      for (const itemId of snap.inventoryItemIds) {
        const item = itemById.get(itemId)
        out.push({
          id: `item-dead-holder-${itemId}-${snap.eventId}-${snap.characterId}`,
          kind: 'item-dead-holder',
          severity: 'warning',
          category: 'item',
          message: `"${item?.name ?? itemId}" is carried by ${char?.name ?? '?'}, who is dead`,
          detail: `Ch. ${ch?.number ?? '?'} — move it to whoever takes it, or to the place it was left.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    /*
      ── A scene with no point of view, in a book that has one ───────────────

      **The gate is the whole design.** Most writers never touch the POV field,
      and a check that simply flagged every empty one would put a row on every
      scene of every world that does not use it — the shape of fault that made
      the checker look broken on a flagship example (W19-6). So it asks what
      this book's own habit is, and only speaks when a scene departs from it.

      "Has a habit" is deliberately strict: enough scenes to be a pattern rather
      than a coincidence, and few enough gaps that the gaps read as omissions.
      Below that the field is simply unused, which is not a fault.
    */
    {
      const MIN_POV_SCENES = 5
      const MAX_GAP_SHARE = 0.2
      const scenes = allEvents.filter((e) => !e.isFlashback)
      const withPov = scenes.filter((e) => e.povCharacterId && charById.has(e.povCharacterId))
      const without = scenes.filter((e) => !e.povCharacterId)
      const hasHabit =
        withPov.length >= MIN_POV_SCENES &&
        scenes.length > 0 &&
        without.length / scenes.length <= MAX_GAP_SHARE
      if (hasHabit) {
        for (const ev of without) {
          const ch = chapById.get(ev.chapterId)
          out.push({
            id: `pov-missing-${ev.id}`,
            kind: 'pov-missing',
            severity: 'warning',
            category: 'pov',
            message: `"${ev.title || 'untitled'}" has no point of view`,
            detail: `Ch. ${ch?.number ?? '?'} — ${withPov.length} of this book's ${scenes.length} scenes name one. Set it, or leave it if the scene is deliberately unanchored.`,
            navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
            eventId: ev.id,
          })
        }
      }
    }

    // ── Plot-thread cadence: dangling / dormant / unstarted subplots ─────────
    const chaptersByNumber = [...chapters].sort((a, b) => a.number - b.number)
    for (const ti of computeThreadIssues({ threads: plotThreads, events: allEvents, chapters })) {
      // Send the writer to the chapter where the thread was last (or first) seen.
      const targetChapter = ti.chapterNumber !== null
        ? chaptersByNumber.find((c) => c.number === ti.chapterNumber)
        : undefined
      const firstEvent = targetChapter
        ? allEvents.filter((e) => e.chapterId === targetChapter.id).sort((a, b) => a.sortOrder - b.sortOrder)[0]
        : undefined
      out.push({
        id: `thread-${ti.kind}-${ti.threadId}`,
        kind: `thread-${ti.kind}` as IssueKind,
        severity: 'warning',
        category: 'thread',
        message: ti.message,
        detail: ti.detail,
        navigatePath: targetChapter ? `/worlds/${worldId}/timeline/${targetChapter.id}` : undefined,
        eventId: firstEvent?.id,
      })
    }

    return out
}
