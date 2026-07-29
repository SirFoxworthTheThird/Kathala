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
  mapLayerId: string
  linkedMapLayerId: string | null
  name: string
  description: string
  x: number
  y: number
  iconType: LocationIconType
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

export type MapRegionStatus = 'active' | 'occupied' | 'contested' | 'abandoned' | 'destroyed' | 'unknown'

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
