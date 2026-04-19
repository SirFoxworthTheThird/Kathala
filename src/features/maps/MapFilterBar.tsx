import { useState, useRef, useEffect } from 'react'
import { Users, Route, MapPin, ChevronDown, Tag, History } from 'lucide-react'
import type { Character } from '@/types'
import { ICON_COLORS } from './mapUtils'

export interface MapFilters {
  showCharacters: boolean
  showTrails: boolean
  showLocations: boolean
  showSubMapLinks: boolean
  showLocationLabels: boolean
  showJourneys: boolean
  characterIds: Set<string>   // empty = all
  locationTypes: Set<string>  // empty = all
}

export const DEFAULT_MAP_FILTERS: MapFilters = {
  showCharacters: true,
  showTrails: true,
  showLocations: true,
  showSubMapLinks: true,
  showLocationLabels: true,
  showJourneys: false,
  characterIds: new Set(),
  locationTypes: new Set(),
}

const ALL_LOCATION_TYPES = ['city', 'town', 'dungeon', 'landmark', 'building', 'region', 'custom']

export function MapFilterBar({
  filters,
  characters,
  onChange,
}: {
  filters: MapFilters
  characters: Character[]
  onChange: (f: MapFilters) => void
}) {
  const [charOpen, setCharOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const charRef = useRef<HTMLDivElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (charRef.current && !charRef.current.contains(e.target as Node)) setCharOpen(false)
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleCharId(id: string) {
    const next = new Set(filters.characterIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ ...filters, characterIds: next })
  }

  function toggleLocType(type: string) {
    const next = new Set(filters.locationTypes)
    if (next.has(type)) next.delete(type); else next.add(type)
    onChange({ ...filters, locationTypes: next })
  }

  const activeBtn = 'border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] text-[hsl(var(--foreground))]'
  const inactiveBtn = 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-50'
  const chevronBtn = (open: boolean) =>
    `flex items-center border border-l-0 px-1 py-1 transition-colors rounded-r-md ${
      open ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] text-[hsl(var(--foreground))]'
           : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
    }`

  const charCount = filters.characterIds.size
  const typeCount = filters.locationTypes.size

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] px-4 py-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Show</span>

      {/* Characters */}
      <div ref={charRef} className="relative flex items-center">
        <button
          onClick={() => onChange({ ...filters, showCharacters: !filters.showCharacters })}
          className={`flex items-center gap-1 rounded-l-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showCharacters ? activeBtn : inactiveBtn}`}
        >
          <Users className="h-3 w-3" />
          Characters
          {charCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[hsl(var(--ring))] px-1 text-[9px] font-bold text-[hsl(var(--background))]">{charCount}</span>
          )}
        </button>
        {filters.showCharacters && characters.length > 0 && (
          <button
            className={chevronBtn(charOpen)}
            onClick={() => { setCharOpen(v => !v); setTypeOpen(false) }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {!filters.showCharacters && <div className="w-[1px]" />}
        {charOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter characters</span>
              {charCount > 0 && (
                <button onClick={() => onChange({ ...filters, characterIds: new Set() })} className="text-[10px] text-[hsl(var(--ring))] hover:underline">All</button>
              )}
            </div>
            {characters.map((c) => {
              const checked = charCount === 0 || filters.characterIds.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCharId(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${checked ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                  <span className="truncate text-xs">{c.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Trails */}
      <button
        onClick={() => onChange({ ...filters, showTrails: !filters.showTrails })}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showTrails ? activeBtn : inactiveBtn}`}
      >
        <Route className="h-3 w-3" />
        Trails
      </button>

      {/* Labels */}
      <button
        onClick={() => onChange({ ...filters, showLocationLabels: !filters.showLocationLabels })}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showLocationLabels ? activeBtn : inactiveBtn}`}
      >
        <Tag className="h-3 w-3" />
        Labels
      </button>

      {/* Journeys */}
      <button
        onClick={() => onChange({ ...filters, showJourneys: !filters.showJourneys })}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showJourneys ? activeBtn : inactiveBtn}`}
      >
        <History className="h-3 w-3" />
        Journeys
      </button>

      {/* Locations */}
      <div ref={typeRef} className="relative flex items-center">
        <button
          onClick={() => onChange({ ...filters, showLocations: !filters.showLocations })}
          className={`flex items-center gap-1 rounded-l-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showLocations ? activeBtn : inactiveBtn}`}
        >
          <MapPin className="h-3 w-3" />
          Locations
          {typeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[hsl(var(--ring))] px-1 text-[9px] font-bold text-[hsl(var(--background))]">{typeCount}</span>
          )}
        </button>
        {filters.showLocations && (
          <button
            className={chevronBtn(typeOpen)}
            onClick={() => { setTypeOpen(v => !v); setCharOpen(false) }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {!filters.showLocations && <div className="w-[1px]" />}
        {typeOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter types</span>
              {typeCount > 0 && (
                <button onClick={() => onChange({ ...filters, locationTypes: new Set() })} className="text-[10px] text-[hsl(var(--ring))] hover:underline">All</button>
              )}
            </div>
            {ALL_LOCATION_TYPES.map((type) => {
              const checked = typeCount === 0 || filters.locationTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleLocType(type)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${checked ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: ICON_COLORS[type] ?? '#94a3b8' }}
                  />
                  <span className="capitalize text-xs">{type}</span>
                </button>
              )
            })}
            <div className="mt-1 border-t border-[hsl(var(--border))] px-3 py-1.5">
              <button
                onClick={() => onChange({ ...filters, showSubMapLinks: !filters.showSubMapLinks })}
                className="flex w-full items-center gap-2 text-left transition-colors hover:bg-[hsl(var(--muted))]"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${filters.showSubMapLinks ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                <span className="text-xs">Sub-map indicators</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
