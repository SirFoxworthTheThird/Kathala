export interface TravelMode {
  id: string
  worldId: string
  name: string
  speedPerDay: number   // distance per day, in the map layer's scaleUnit
  createdAt: number
  updatedAt: number
}
