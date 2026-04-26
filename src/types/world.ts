export interface World {
  id: string
  name: string
  description: string
  coverImageId: string | null
  /** Per-world theme class name. null = inherit the global app theme. */
  theme: string | null
  /** Consecutive involved-events without a snapshot update before a stale-state warning fires. Default 5. */
  continuityStaleThreshold: number
  createdAt: number
  updatedAt: number
}

export interface AppPreferences {
  id: 1
  activeWorldId: string | null
  theme: 'dark' | 'light'
  sidebarWidth: number
  defaultTimelineId: string | null
}
