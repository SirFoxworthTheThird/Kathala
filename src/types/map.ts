export interface MapLayer {
  id: string
  worldId: string
  parentMapId: string | null
  name: string
  description: string
  imageId: string
  imageWidth: number
  imageHeight: number
  /** Pixels per real-world unit. Null means no scale has been set. */
  scalePixelsPerUnit: number | null
  /** Label for the unit, e.g. "km", "miles", "leagues". */
  scaleUnit: string | null
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
  createdAt: number
  updatedAt: number
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
  notes?: string
  updatedAt: number
}
