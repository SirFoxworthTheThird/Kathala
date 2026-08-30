import type { ReadingGate } from '@/db/hooks/useReading'

/**
 * Whether a reader has met a route or a region.
 *
 * These existed twice and disagreed. The map hooks gated a route on its
 * waypoints and a region on the standard entity reveal; the search palette,
 * which reads the tables directly rather than through the hooks, gated both on
 * *the map layer they sit on*. A layer is revealed as soon as any marker on it
 * is, so on the shipped Dracula the Europe layer opens in chapter 1 and every
 * route drawn on it became searchable — a blind reader run typed `Hunters` on
 * the first page of the book and was handed "The Hunters to Varna", which is
 * the pursuit of chapters 24 to 26. The map screen, at the same cursor, showed
 * `ROUTES 0`.
 *
 * So the rule lives in one place and both callers use it. The layer check stays
 * as well: it is a real constraint — a route on a layer the reader has never
 * seen is hidden whatever its waypoints say — it was simply never sufficient
 * on its own.
 */

/** A route is drawn between markers, so it waits for them: "the road to X"
 *  names X as surely as the marker does. Bare coordinate waypoints have nothing
 *  to reveal and nothing to wait for. */
export function routeRevealed(
  gate: ReadingGate,
  route: { mapLayerId: string; waypoints: Array<string | { x: number; y: number }> },
  layerRevealed: (layerId: string) => boolean,
): boolean {
  if (!layerRevealed(route.mapLayerId)) return false
  return gate.linksRevealed(route.waypoints.filter((w): w is string => typeof w === 'string'))
}

/** A region is an entity in its own right, so it uses the ordinary reveal. */
export function regionRevealed(
  gate: ReadingGate,
  region: { id: string; mapLayerId: string },
  layerRevealed: (layerId: string) => boolean,
): boolean {
  if (!layerRevealed(region.mapLayerId)) return false
  return gate.filter([region]).length > 0
}
