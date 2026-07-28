import type { RouteType } from '@/types'

/**
 * How much faster (or slower) each route type is than open-country travel.
 * A road speeds you up; a trail slows you down.
 */
export const ROUTE_SPEED_MULTIPLIERS: Record<RouteType, number> = {
  road: 1.5,
  river: 1.2,
  sea_route: 1.2,
  trail: 0.6,
  border: 1.0,
  custom: 1.0,
}

/** Convert a pixel distance on a map to world units via its scale (pixels per unit). */
export function worldUnits(pixelDistance: number, scalePixelsPerUnit: number): number {
  return scalePixelsPerUnit > 0 ? pixelDistance / scalePixelsPerUnit : 0
}

/** A travel mode's daily speed after a route's terrain multiplier is applied. */
export function effectiveSpeed(baseSpeedPerDay: number, routeType?: RouteType | null): number {
  const mult = routeType ? ROUTE_SPEED_MULTIPLIERS[routeType] : 1
  return baseSpeedPerDay * mult
}

/** In-world days required to cover a distance at a speed (0 speed → Infinity). */
export function daysNeeded(distanceUnits: number, speedPerDay: number): number {
  return speedPerDay > 0 ? distanceUnits / speedPerDay : Infinity
}

export interface TravelFeasibility {
  /** Straight-line journey length in the map's world units. */
  distanceUnits: number
  /** Daily speed after the route multiplier. */
  effectiveSpeed: number
  /** In-world days the journey needs. */
  daysNeeded: number
  /** Whether it fits in the time available. */
  feasible: boolean
  /** Whole extra in-world days needed to make it possible (0 when feasible). */
  shortfallDays: number
}

/**
 * Assess whether a journey of `pixelDistance` (on a map with the given scale) is
 * possible in `daysAvailable` at `baseSpeedPerDay`, optionally sped up/slowed by
 * the route type. Returns the distance, the days it needs, and — when it doesn't
 * fit — how many whole days short it is.
 */
export function assessTravel(params: {
  pixelDistance: number
  scalePixelsPerUnit: number
  baseSpeedPerDay: number
  routeType?: RouteType | null
  daysAvailable: number
}): TravelFeasibility {
  const distanceUnits = worldUnits(params.pixelDistance, params.scalePixelsPerUnit)
  const speed = effectiveSpeed(params.baseSpeedPerDay, params.routeType)
  const need = daysNeeded(distanceUnits, speed)
  const feasible = need <= params.daysAvailable
  const shortfallDays =
    feasible || !Number.isFinite(need) ? (feasible ? 0 : Infinity) : Math.max(1, Math.ceil(need - params.daysAvailable))
  return { distanceUnits, effectiveSpeed: speed, daysNeeded: need, feasible, shortfallDays }
}
