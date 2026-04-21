import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Users, Map, Package, BookOpen, Network, Scroll, X, Route, Hexagon, BookMarked, Shield } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

type ResultType = 'character' | 'item' | 'location' | 'chapter' | 'event' | 'timeline' | 'relationship' | 'route' | 'region' | 'lore' | 'faction'

interface SearchResult {
  id: string
  type: ResultType
  label: string
  sublabel?: string
  path: string
}

const TYPE_META: Record<ResultType, { icon: React.ElementType; color: string; group: string }> = {
  character:    { icon: Users,    color: 'text-blue-400',   group: 'Characters' },
  item:         { icon: Package,  color: 'text-amber-400',  group: 'Items' },
  location:     { icon: Map,      color: 'text-green-400',  group: 'Locations' },
  chapter:      { icon: BookOpen, color: 'text-purple-400', group: 'Chapters' },
  event:        { icon: Scroll,   color: 'text-orange-400', group: 'Events' },
  timeline:     { icon: BookOpen, color: 'text-cyan-400',   group: 'Timelines' },
  relationship: { icon: Network,  color: 'text-rose-400',   group: 'Relationships' },
  route:        { icon: Route,    color: 'text-teal-400',   group: 'Routes' },
  region:       { icon: Hexagon,     color: 'text-violet-400', group: 'Regions' },
  lore:         { icon: BookMarked,  color: 'text-indigo-400', group: 'Lore' },
  faction:      { icon: Shield,      color: 'text-red-400',    group: 'Factions' },
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchPalette() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { searchOpen, setSearchOpen, setActiveEventId, setPendingFocusRouteId, setPendingFocusRegionId } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load all searchable data for the world
  const characters    = useLiveQuery(() => worldId ? db.characters.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const items         = useLiveQuery(() => worldId ? db.items.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const markers       = useLiveQuery(() => worldId ? db.locationMarkers.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const chapters      = useLiveQuery(() => worldId ? db.chapters.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const events        = useLiveQuery(() => worldId ? db.events.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const timelines     = useLiveQuery(() => worldId ? db.timelines.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const relationships = useLiveQuery(() => worldId ? db.relationships.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const routes        = useLiveQuery(() => worldId ? db.mapRoutes.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const regions       = useLiveQuery(() => worldId ? db.mapRegions.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const lorePages     = useLiveQuery(() => worldId ? db.lorePages.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  const factions      = useLiveQuery(() => worldId ? db.factions.where('worldId').equals(worldId).toArray() : [], [worldId], [])

  const results: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !worldId) return []

    const out: SearchResult[] = []

    for (const c of (characters ?? [])) {
      if (c.name?.toLowerCase().includes(q) || c.aliases?.some((a) => a.toLowerCase().includes(q))) {
        out.push({ id: c.id, type: 'character', label: c.name, sublabel: c.description ? c.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/characters/${c.id}` })
      }
    }
    for (const i of (items ?? [])) {
      if (i.name?.toLowerCase().includes(q)) {
        out.push({ id: i.id, type: 'item', label: i.name, sublabel: i.description ? i.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/items/${i.id}` })
      }
    }
    for (const m of (markers ?? [])) {
      if (m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) {
        out.push({ id: m.id, type: 'location', label: m.name, sublabel: m.description ? m.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/maps` })
      }
    }
    for (const ch of (chapters ?? [])) {
      if (ch.title?.toLowerCase().includes(q) || ch.synopsis?.toLowerCase().includes(q)) {
        out.push({ id: ch.id, type: 'chapter', label: `Ch. ${ch.number} — ${ch.title}`, sublabel: ch.synopsis ? ch.synopsis.slice(0, 60) : undefined, path: `/worlds/${worldId}/timeline/${ch.id}` })
      }
    }
    for (const ev of (events ?? [])) {
      if (ev.title?.toLowerCase().includes(q) || ev.description?.toLowerCase().includes(q)) {
        out.push({ id: ev.id, type: 'event', label: ev.title, sublabel: ev.description ? ev.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/timeline/${ev.chapterId}` })
      }
    }
    for (const tl of (timelines ?? [])) {
      if (tl.name?.toLowerCase().includes(q)) {
        out.push({ id: tl.id, type: 'timeline', label: tl.name, sublabel: tl.description ? tl.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/timeline` })
      }
    }
    for (const r of (relationships ?? [])) {
      if (r.label?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)) {
        out.push({ id: r.id, type: 'relationship', label: r.label, sublabel: `${r.sentiment} · ${r.strength}`, path: `/worlds/${worldId}/relationships` })
      }
    }
    for (const r of (routes ?? [])) {
      if (r.name?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q)) {
        out.push({ id: r.id, type: 'route', label: r.name, sublabel: r.routeType.replace('_', ' '), path: `/worlds/${worldId}/maps` })
      }
    }
    for (const r of (regions ?? [])) {
      if (r.name?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q)) {
        out.push({ id: r.id, type: 'region', label: r.name, sublabel: r.notes ? r.notes.slice(0, 60) : undefined, path: `/worlds/${worldId}/maps` })
      }
    }
    for (const p of (lorePages ?? [])) {
      if (p.title?.toLowerCase().includes(q) || p.body?.toLowerCase().includes(q) || p.tags?.some((t) => t.toLowerCase().includes(q))) {
        out.push({ id: p.id, type: 'lore', label: p.title, sublabel: p.body ? p.body.slice(0, 60).replace(/[#*`_>\-]/g, '').trim() : undefined, path: `/worlds/${worldId}/lore/${p.id}` })
      }
    }
    for (const f of (factions ?? [])) {
      if (f.name?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q)) {
        out.push({ id: f.id, type: 'faction', label: f.name, sublabel: f.description ? f.description.slice(0, 60) : undefined, path: `/worlds/${worldId}/factions` })
      }
    }

    return out
  }, [query, worldId, characters, items, markers, chapters, events, timelines, relationships, routes, regions, lorePages, factions])

  // Reset active index when results change
  useEffect(() => setActiveIdx(0), [results])

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  function close() {
    setSearchOpen(false)
    setQuery('')
  }

  function go(result: SearchResult) {
    if (result.type === 'event') setActiveEventId(result.id)
    if (result.type === 'route') setPendingFocusRouteId(result.id)
    if (result.type === 'region') setPendingFocusRegionId(result.id)
    navigate(result.path)
    close()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { if (results[activeIdx]) go(results[activeIdx]) }
    else if (e.key === 'Escape') close()
  }

  if (!searchOpen) return null

  // Group results by type for display
  const grouped: { group: string; type: ResultType; items: (SearchResult & { globalIdx: number })[] }[] = []
  let globalIdx = 0
  const typeOrder: ResultType[] = ['character', 'faction', 'item', 'location', 'chapter', 'event', 'timeline', 'relationship', 'route', 'region', 'lore']
  for (const type of typeOrder) {
    const typeResults = results.filter((r) => r.type === type)
    if (typeResults.length === 0) continue
    grouped.push({
      group: TYPE_META[type].group,
      type,
      items: typeResults.map((r) => ({ ...r, globalIdx: globalIdx++ })),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[15vh]"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative z-10 w-full max-w-xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search characters, locations, chapters…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-auto p-1">
          {query.trim() === '' ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Start typing to search your world…
            </p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No results for <span className="font-medium text-[hsl(var(--foreground))]">"{query}"</span>
            </p>
          ) : (
            grouped.map(({ group, type, items: groupItems }) => {
              const { icon: Icon, color } = TYPE_META[type]
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {group}
                  </p>
                  {groupItems.map(({ globalIdx: idx, ...result }) => (
                    <button
                      key={result.id}
                      data-idx={idx}
                      onClick={() => go(result)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        activeIdx === idx
                          ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                          : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.5)]'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', color)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{highlight(result.label, query.trim())}</span>
                        {result.sublabel && (
                          <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">{result.sublabel}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] px-4 py-2">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">↑↓ navigate</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">↵ open</span>
            <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
