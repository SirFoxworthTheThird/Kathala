import type { MutableRefObject } from 'react'
import type { PlaybackSpeed } from '@/store'
import type { CharacterSnapshot, LocationMarker, CharacterMovement } from '@/types'
import type { CharacterPin, PinAnimation } from './LeafletMapCanvas'

/** How long character pins animate across the map per playback speed (ms) */
export const PIN_TRAVEL_MS: Record<PlaybackSpeed, number> = { slow: 6500, normal: 4000, fast: 2200 }

/** One stop in the ordered playback map-navigation queue */
export interface PlaybackStep {
  mapLayerId: string
  pinAnimation: PinAnimation
}

/** Position data returned by resolveCharacterPin — character is filled in by the caller. */
export type ResolvedPinPosition = Pick<CharacterPin, 'x' | 'y' | 'inSubMap'>

/** Colour palette for movement / travel lines */
export const MOVEMENT_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#f472b6', '#22d3ee', '#a3e635', '#e879f9',
]

export function characterColor(characterId: string): string {
  let hash = 0
  for (let i = 0; i < characterId.length; i++) hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0
  return MOVEMENT_COLORS[hash % MOVEMENT_COLORS.length]
}

/** Colour per location icon type — shared by the sidebar and the filter bar. */
export const ICON_COLORS: Record<string, string> = {
  city: '#60a5fa', town: '#34d399', dungeon: '#f87171',
  landmark: '#fbbf24', building: '#a78bfa', region: '#fb923c', custom: '#94a3b8',
}

export function resolveCharacterPin(
  snap: CharacterSnapshot,
  currentLayerId: string,
  allLayers: { id: string; parentMapId: string | null }[],
  allMarkers: LocationMarker[],
): ResolvedPinPosition | null {
  if (!snap.currentLocationMarkerId || !snap.currentMapLayerId) return null
  if (snap.currentMapLayerId === currentLayerId) {
    const m = allMarkers.find((x) => x.id === snap.currentLocationMarkerId)
    if (!m) return null
    return { x: m.x, y: m.y, inSubMap: false }
  }
  let childLayerId = snap.currentMapLayerId
  for (let depth = 0; depth < 20; depth++) {
    const childLayer = allLayers.find((l) => l.id === childLayerId)
    if (!childLayer?.parentMapId) return null
    const parentLayerId = childLayer.parentMapId
    const linkMarker = allMarkers.find(
      (m) => m.mapLayerId === parentLayerId && m.linkedMapLayerId === childLayerId
    )
    if (!linkMarker) return null
    if (parentLayerId === currentLayerId) {
      return { x: linkMarker.x, y: linkMarker.y, inSubMap: true }
    }
    childLayerId = parentLayerId
  }
  return null
}

/**
 * Build a sequential per-character animation queue.
 * Characters are sorted alphabetically by ID for a deterministic order.
 * Each character contributes one step (same-layer move) or two steps (cross-layer:
 * departure layer first, then arrival layer). Each step animates only that one character;
 * others appear at their current snapshot positions immediately.
 */
export function buildSequentialQueue(
  prevSnaps: CharacterSnapshot[],
  currSnaps: CharacterSnapshot[],
  allMarkers: LocationMarker[],
  movements: CharacterMovement[],
  duration: number,
  keyRef: MutableRefObject<number>,
): PlaybackStep[] {
  const steps: PlaybackStep[] = []
  const markerById = new Map(allMarkers.map((m) => [m.id, m]))
  const prevByCharId = new Map(prevSnaps.map((s) => [s.characterId, s]))
  const currByCharId = new Map(currSnaps.map((s) => [s.characterId, s]))

  /** Returns true when the marker has finite, usable coordinates. */
  function validCoords(m: LocationMarker | undefined): m is LocationMarker {
    return !!m && Number.isFinite(m.x) && Number.isFinite(m.y)
  }

  /** Collect per-character trail waypoints on a specific layer. */
  function trailPts(charId: string, layerId: string): Array<{ x: number; y: number }> | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov || mov.waypoints.length < 2) return null
    const pts = mov.waypoints
      .map((id) => markerById.get(id))
      .filter((m): m is LocationMarker => !!m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y))
      .map((m) => ({ x: m.x, y: m.y }))
    return pts.length >= 2 ? pts : null
  }

  /**
   * First waypoint on `layerId` in the character's movement — used as the
   * entry point when entering a sub-map (no reverse portal marker exists).
   */
  function firstWaypointOnLayer(charId: string, layerId: string): { x: number; y: number } | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov) return null
    for (const wId of mov.waypoints) {
      const m = markerById.get(wId)
      if (m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        return { x: m.x, y: m.y }
      }
    }
    return null
  }

  /**
   * Last waypoint on `layerId` in the character's movement — used as the
   * exit point when leaving a sub-map (no reverse portal marker exists).
   */
  function lastWaypointOnLayer(charId: string, layerId: string): { x: number; y: number } | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov) return null
    let last: { x: number; y: number } | null = null
    for (const wId of mov.waypoints) {
      const m = markerById.get(wId)
      if (m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        last = { x: m.x, y: m.y }
      }
    }
    return last
  }

  // ── Step 1: collect every character move that actually changed position ──────
  interface CharMove {
    charId: string
    prevLayerId: string | null
    currLayerId: string
    prevMarkerId: string | null
    currMarkerId: string
  }
  const allMoves: CharMove[] = []
  const sortedCharIds = [...new Set([...prevByCharId.keys(), ...currByCharId.keys()])].sort()

  for (const charId of sortedCharIds) {
    const currSnap = currByCharId.get(charId)
    const prevSnap = prevByCharId.get(charId)
    if (!currSnap?.currentLocationMarkerId || !currSnap.currentMapLayerId) continue
    const prevMarkerId = prevSnap?.currentLocationMarkerId ?? null
    if (prevMarkerId === currSnap.currentLocationMarkerId && prevSnap?.currentMapLayerId === currSnap.currentMapLayerId) continue
    allMoves.push({
      charId,
      prevLayerId: prevSnap?.currentMapLayerId ?? null,
      currLayerId: currSnap.currentMapLayerId,
      prevMarkerId,
      currMarkerId: currSnap.currentLocationMarkerId,
    })
  }

  // ── Step 2: group by identical (prevLayerId, prevMarkerId, currLayerId, currMarkerId) ──
  const groups = new Map<string, CharMove[]>()
  for (const move of allMoves) {
    const key = `${move.prevLayerId ?? ''}|${move.prevMarkerId ?? ''}|${move.currLayerId}|${move.currMarkerId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(move)
  }

  // ── Step 3: build one PlaybackStep per group ──────────────────────────────
  for (const [, group] of groups) {
    const { prevLayerId, currLayerId, prevMarkerId, currMarkerId } = group[0]
    const currMarker = markerById.get(currMarkerId)
    if (!validCoords(currMarker)) continue

    if (!prevLayerId || prevLayerId === currLayerId) {
      // ── Same-layer move (or first appearance) ──────────────────────────────
      const prevMarker = prevMarkerId ? markerById.get(prevMarkerId) : undefined
      const from: Record<string, { x: number; y: number }> = {}
      const to: Record<string, { x: number; y: number }> = {}
      const waypoints: Record<string, Array<{ x: number; y: number }>> = {}
      const fadeIn: string[] = []

      for (const { charId } of group) {
        to[charId] = { x: currMarker.x, y: currMarker.y }
        if (validCoords(prevMarker)) {
          from[charId] = { x: prevMarker.x, y: prevMarker.y }
          const pts = trailPts(charId, currLayerId)
          if (pts) waypoints[charId] = pts
        } else {
          fadeIn.push(charId)
        }
      }

      keyRef.current += 1
      steps.push({
        mapLayerId: currLayerId,
        pinAnimation: {
          key: keyRef.current,
          from,
          to,
          waypoints: Object.keys(waypoints).length > 0 ? waypoints : undefined,
          duration,
          fadeIn,
          cameraFollow: true,
        },
      })
    } else {
      // ── Cross-layer move: departure step then arrival step ─────────────────
      const prevMarker = prevMarkerId ? markerById.get(prevMarkerId) : undefined
      const portalOnPrev = allMarkers.find(
        (m) => m.mapLayerId === prevLayerId && m.linkedMapLayerId === currLayerId,
      )
      const portalOnCurr = allMarkers.find(
        (m) => m.mapLayerId === currLayerId && m.linkedMapLayerId === prevLayerId,
      )

      // ── Departure step ────────────────────────────────────────────────────
      const departureTo: Record<string, { x: number; y: number }> = {}
      const departureFrom: Record<string, { x: number; y: number }> = {}
      const departureWp: Record<string, Array<{ x: number; y: number }>> = {}
      let hasDeparture = false

      if (validCoords(prevMarker)) {
        for (const { charId } of group) {
          let exitPt: { x: number; y: number } | null = null
          if (validCoords(portalOnPrev)) {
            exitPt = { x: portalOnPrev.x, y: portalOnPrev.y }
          } else {
            exitPt = lastWaypointOnLayer(charId, prevLayerId)
          }
          if (exitPt) {
            departureFrom[charId] = { x: prevMarker.x, y: prevMarker.y }
            departureTo[charId] = exitPt
            const pts = trailPts(charId, prevLayerId)
            if (pts) departureWp[charId] = pts
            hasDeparture = true
          }
        }
      }

      if (hasDeparture) {
        keyRef.current += 1
        steps.push({
          mapLayerId: prevLayerId,
          pinAnimation: {
            key: keyRef.current,
            from: departureFrom,
            to: departureTo,
            waypoints: Object.keys(departureWp).length > 0 ? departureWp : undefined,
            duration: duration * 0.5,
            cameraFollow: true,
          },
        })
      }

      // ── Arrival step ──────────────────────────────────────────────────────
      const from2: Record<string, { x: number; y: number }> = {}
      const to2: Record<string, { x: number; y: number }> = {}
      const waypoints2: Record<string, Array<{ x: number; y: number }>> = {}
      const fadeIn2: string[] = []

      for (const { charId } of group) {
        to2[charId] = { x: currMarker.x, y: currMarker.y }
        let entryPt: { x: number; y: number } | null = null
        if (validCoords(portalOnCurr)) {
          entryPt = { x: portalOnCurr.x, y: portalOnCurr.y }
        } else {
          entryPt = firstWaypointOnLayer(charId, currLayerId)
        }
        if (entryPt) {
          from2[charId] = entryPt
          const pts = trailPts(charId, currLayerId)
          if (pts) waypoints2[charId] = pts
        } else {
          fadeIn2.push(charId)
        }
      }

      keyRef.current += 1
      steps.push({
        mapLayerId: currLayerId,
        pinAnimation: {
          key: keyRef.current,
          from: from2,
          to: to2,
          waypoints: Object.keys(waypoints2).length > 0 ? waypoints2 : undefined,
          duration: duration * 0.5,
          fadeIn: fadeIn2,
          cameraFollow: true,
        },
      })
    }
  }

  return steps
}
