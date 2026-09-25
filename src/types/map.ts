export interface MapLayer {
  id: string
  worldId: string
  parentMapId: string | null
  name: string
  description: string
  /** Null while an image-ready placeholder map is awaiting its first upload. */
  imageId: string | null
  imageWidth: number
  imageHeight: number
  /** Pixels per real-world unit. Null means no scale has been set. */
  scalePixelsPerUnit: number | null
  /** Label for the unit, e.g. "km", "miles", "leagues". */
  scaleUnit: string | null
  /**
   * Floors/levels: layers sharing a non-null `levelGroupId` are the levels of one
   * place (e.g. floors of a castle) and are switched between rather than nested.
   * Null means a standalone map. `levelIndex` orders them (higher = higher floor;
   * negatives for basements); `levelLabel` is the floor's display name.
   */
  levelGroupId: string | null
  levelIndex: number
  levelLabel: string
  createdAt: number
  updatedAt: number
}

export type LocationIconType =
  | 'city'
  | 'town'
  | 'dungeon'
  | 'landmark'
  | 'building'
  | 'region'
  | 'custom'

export interface LocationMarker {
  id: string
  worldId: string
  /**
   * The map this place is pinned to, or **null when it is not on one yet**.
   *
   * A place used to be a pin, which meant a world with no map could hold no
   * places at all: a scene had no Setting to offer, a character's Current
   * Location had nothing in it, and the `@` picker would not make one. A
   * novel set in a kitchen, an office and her mother's house could record
   * none of it — and forty screens outside Maps consume places, most of them
   * needing only which place it is.
   *
   * So a place may exist in the story before it exists on a map, and be put
   * on one (or on a sub-map) whenever the writer draws it.
   *
   * **`x` and `y` mean nothing while this is null.** They are kept as plain
   * numbers rather than made nullable because the three things that read them
   * — travel distance, region traversal, inside-a-region — reach them only
   * through a layer, and each already gives up quietly when a layer has no
   * scale. Making the coordinates nullable would have put a guard in every
   * caller to say what this one field already says.
   */
  mapLayerId: string | null
  linkedMapLayerId: string | null
  name: string
  description: string
  x: number
  y: number
  /**
   * A picture *of* the place, as distinct from the two visuals a marker already
   * has: `iconType` is what the pin looks like, and `linkedMapLayerId` is a map
   * *of* the place you drill into. A city can want all three — a pin that reads
   * as a city, a street plan, and a skyline. Null on records predating v53.
   */
  imageId: string | null
  iconType: LocationIconType
  /**
   * The writer's own word for the kind of place, when `iconType` is `custom`.
   *
   * The seven types are a fantasy vocabulary and `custom` was a member of it
   * rather than an escape hatch: a station map read *Marn's Office · Custom*,
   * with the word printed on the pin as though it were a kind of place. This
   * is the label; `iconType` still decides what the pin looks like. Absent on
   * records predating v55, and on every marker that is not custom.
   */
  customType?: string
  tags: string[]
  factionId: string | null
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export type RouteType = 'road' | 'river' | 'trail' | 'sea_route' | 'border' | 'custom'

export interface MapRoute {
  id: string
  worldId: string
  mapLayerId: string
  name: string
  routeType: RouteType
  /** Ordered points — either a locationMarkerId (string) or a raw pixel coordinate */
  waypoints: Array<string | { x: number; y: number }>
  color?: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface MapRegion {
  id: string
  worldId: string
  mapLayerId: string
  name: string
  /** Polygon vertices in pixel coordinates */
  vertices: Array<{ x: number; y: number }>
  fillColor: string
  opacity: number
  notes?: string
  /** If set, the region badge drills down into this sub-map layer */
  linkedMapLayerId: string | null
  /** Owning faction, used for map colouring */
  factionId: string | null
  createdAt: number
  updatedAt: number
}

export type MapRegionStatus = 'active' | 'occupied' | 'contested' | 'abandoned' | 'destroyed' | 'rebuilt' | 'unknown'

export interface MapRegionSnapshot {
  id: string
  worldId: string
  regionId: string
  eventId: string
  status: MapRegionStatus
  sortKey?: number
  notes?: string
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface MapAnnotation {
  id: string
  worldId: string
  mapLayerId: string
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  createdAt: number
  updatedAt: number
}
