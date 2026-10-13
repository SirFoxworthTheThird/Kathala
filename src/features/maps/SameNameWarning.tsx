import { sameNameOnMap, type NamedPlace } from '@/lib/placeNames'

/**
 * Said under a place's name while it is typed, when another place on the same
 * map already has it. A warning and not a refusal: the writer may be about to
 * rename the other one. Two places of one name on one map cannot be told apart
 * in a scene header (`placeNames`); writer run 8 found a stray second
 * "The Beacon" only because a header resolved to the wrong one.
 */
export function SameNameWarning({ id, name, mapLayerId, places, except }: {
  id: string
  name: string
  mapLayerId: string | null
  places: readonly NamedPlace[]
  /** The place being renamed, which does not clash with itself. */
  except?: string
}) {
  const clash = sameNameOnMap(name, mapLayerId, places, except)
  return (
    <p id={id} role="status" className="text-xs text-amber-500 empty:hidden">
      {clash.length > 0 && `${mapLayerId ? 'Another place on this map' : 'Another place with no map'} is already called “${clash[0].name}”. A scene header naming it could not tell the two apart.`}
    </p>
  )
}
