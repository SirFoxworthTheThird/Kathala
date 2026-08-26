import { useState, useEffect, useRef, useMemo } from 'react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Search, Users, Map, Package, BookOpen, Network, Scroll, X, Route, Hexagon, BookMarked, Shield, KeyRound } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useAppStore } from '@/store'
import { useShowMoment } from '@/db/hooks/useShowMoment'
import { useFactionReveal } from '@/db/hooks/useFactions'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { snippet, snippetAround } from '@/lib/snippet'
import { searchMatches, searchIndex } from '@/lib/searchMatch'
import { regionRevealed, routeRevealed } from '@/lib/mapGating'
import { chapterNumberQuery } from '@/lib/chapterQuery'
import { cn } from '@/lib/utils'
import { MODAL_BACKDROP } from '@/components/ui/dialog'

type ResultType = 'character' | 'item' | 'location' | 'chapter' | 'event' | 'timeline' | 'relationship' | 'route' | 'region' | 'lore' | 'faction' | 'knowledge'

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
  event:        { icon: Scroll,   color: 'text-orange-400', group: 'Scenes' },
  timeline:     { icon: BookOpen, color: 'text-cyan-400',   group: 'Timelines' },
  relationship: { icon: Network,  color: 'text-rose-400',   group: 'Relationships' },
  route:        { icon: Route,    color: 'text-teal-400',   group: 'Routes' },
  region:       { icon: Hexagon,     color: 'text-violet-400', group: 'Regions' },
  lore:         { icon: BookMarked,  color: 'text-indigo-400', group: 'Lore' },
  faction:      { icon: Shield,      color: 'text-red-400',    group: 'Factions' },
  knowledge:    { icon: KeyRound,    color: 'text-yellow-400', group: 'Knowledge' },
}

function highlight(text: string, query: string, wholeWord: boolean) {
  if (!query) return <>{text}</>
  // The same match the result was found by — see `searchIndex`. Highlighting
  // the first *substring* hit would underline "Bell" in "Bellhouse" on a result
  // that is only here because "Bel" stands alone further along.
  const idx = searchIndex(text, query, wholeWord)
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
  const { pathname } = useLocation()
  const { searchOpen, setSearchOpen, setPendingFocusRouteId, setPendingFocusRegionId, setPendingFocusMarkerId } = useAppStore()
  const wholeWord = useAppStore((s) => s.searchWholeWord)
  const setWholeWord = useAppStore((s) => s.setSearchWholeWord)
  const showMoment = useShowMoment()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<ResultType>>(new Set())

  useFocusTrap(paletteRef, searchOpen)

  /**
   * Close on navigation.
   *
   * Choosing a result closes the palette itself, but nothing else did — so
   * arriving somewhere by any other route (the browser's Back button, a link
   * inside a panel) left a modal sitting over a screen it had nothing to do
   * with, swallowing every click until Escape. Leaving a page should leave its
   * overlays behind.
   */
  useEffect(() => {
    setSearchOpen(false)
  }, [pathname, setSearchOpen])

  /**
   * Search reads Dexie directly rather than through the entity hooks, because
   * it spans eleven tables at once. That makes it the one screen the reveal
   * gate does not reach on its own — and a search box that answers "a" with the
   * whole cast list would undo the gating everywhere else. Every result is
   * therefore put back through the gate below.
   */
  const gate = useGate()

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
  const facts         = useLiveQuery(() => worldId ? db.knowledgeFacts.where('worldId').equals(worldId).toArray() : [], [worldId], [])
  /*
    The manuscript, loaded only while the palette is open. Every other query
    here is a row per record; this one is the whole book, and the palette's
    hooks run on every render of the shell whether it is open or not.
  */
  const sceneTexts    = useLiveQuery(
    () => (searchOpen && worldId) ? db.sceneTexts.where('worldId').equals(worldId).toArray() : [],
    [worldId, searchOpen], [])

  // Which chapters the reader has reached, by their first event: a chapter's
  // synopsis waits for it even though its title does not.
  const chapterReached = useMemo(() => {
    const reached = new Set<string>()
    for (const ev of (events ?? [])) if (gate.hasReached(ev.id)) reached.add(ev.chapterId)
    return reached
  }, [events, gate])

  // Shared with the Factions roster, so the two cannot disagree about whether
  // the reader has met a faction.
  const factionRevealed = useFactionReveal(worldId ?? null, gate)

  const results: SearchResult[] = useMemo(() => {
    const q = query.trim()
    if (!q || !worldId) return []
    /*
      One matcher for every field, so the "whole words" switch cannot reach
      some of them and not others. It used to be `field.toLowerCase().includes()`
      written out at each of two dozen call sites, which is exactly the shape a
      half-applied option hides in.
    */
    const hit = (text: string | null | undefined) => searchMatches(text, q, wholeWord)

    const out: SearchResult[] = []
    const layerRevealed = new Set(gate.filter(markers ?? []).map((m) => m.mapLayerId))

    for (const c of gate.filter(characters ?? [])) {
      if (hit(c.name) || c.aliases?.some((a) => hit(a))) {
        out.push({ id: c.id, type: 'character', label: c.name, sublabel: snippet(c.description), path: `/worlds/${worldId}/characters/${c.id}` })
      }
    }
    for (const i of gate.filter(items ?? [])) {
      if (hit(i.name)) {
        out.push({ id: i.id, type: 'item', label: i.name, sublabel: snippet(i.description), path: `/worlds/${worldId}/items/${i.id}` })
      }
    }
    for (const m of gate.filter(markers ?? [])) {
      if (hit(m.name) || hit(m.description)) {
        out.push({ id: m.id, type: 'location', label: m.name, sublabel: snippet(m.description), path: `/worlds/${worldId}/maps` })
      }
    }
    /*
      A chapter is also findable by its number — `74`, `ch 74`, `chapter 74`.
      The number was printed in the result label and never searched, so in a
      117-chapter book the only way to reach one was the chapter bar, which for
      that world is 6,500px of ~50px segments in a 1,066px strip.

      The number is not gated: it is on the reader's own contents page, exactly
      as the title is.
    */
    const byNumber = chapterNumberQuery(query.trim())
    for (const ch of (chapters ?? [])) {
      // A chapter's title is printed on the reader's own contents page, so it
      // stays searchable. Its synopsis is an authored summary of what happens
      // in it, so it neither matches nor shows until the reader gets there.
      const synopsis = chapterReached.has(ch.id) ? ch.synopsis : ''
      if (ch.number === byNumber || hit(ch.title) || hit(synopsis)) {
        out.push({ id: ch.id, type: 'chapter', label: `Ch. ${ch.number} — ${ch.title}`, sublabel: snippet(synopsis), path: `/worlds/${worldId}/timeline/${ch.id}` })
      }
    }
    /*
      A scene matches on its title, its synopsis, or **the prose written in it**.
      "Where did I write that line" is the lookup a writer makes most, and the
      palette used to answer "No results" to a word that was in the manuscript
      twice — the prose was searchable only from Find & Replace, which nothing
      pointed at.

      A prose hit is still a *scene* result rather than a kind of its own,
      because what the writer wants from it is to be taken to that scene, which
      is what a scene result already does. It inherits the gate with it: prose
      belongs to a scene, and a scene the reader has not reached is not searched.
    */
    const proseByEvent = new globalThis.Map((sceneTexts ?? []).map((t): [string, string] => [t.eventId, t.text]))
    for (const ev of (events ?? []).filter((e) => gate.hasReached(e.id))) {
      const prose = proseByEvent.get(ev.id)
      const inProse = !!prose && hit(prose)
      if (hit(ev.title) || hit(ev.description) || inProse) {
        out.push({
          id: ev.id,
          type: 'event',
          label: ev.title,
          // Show the line that matched, not the opening of the scene.
          sublabel: inProse ? snippetAround(prose, q, undefined, wholeWord) : snippet(ev.description),
          path: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        })
      }
    }

    /*
      Knowledge facts, and only while writing. Every panel in `KnowledgeView` is
      behind `!gate.active` — a fact is the most spoiler-shaped record the app
      holds, and who-knows-what-when is the thing reading mode exists to protect.
      Searching them for a reader would hand back exactly that.
    */
    if (!gate.active) {
      for (const f of (facts ?? [])) {
        if (hit(f.title) || hit(f.description)) {
          out.push({
            id: f.id,
            type: 'knowledge',
            label: f.title,
            sublabel: snippetAround(f.description, q, undefined, wholeWord),
            path: `/worlds/${worldId}/knowledge`,
          })
        }
      }
    }
    for (const tl of (timelines ?? [])) {
      if (hit(tl.name)) {
        out.push({ id: tl.id, type: 'timeline', label: tl.name, sublabel: snippet(tl.description), path: `/worlds/${worldId}/timeline` })
      }
    }
    for (const r of (relationships ?? [])) {
      // A relationship names both of its characters, and its own label often
      // gives away what happens between them.
      if (!gate.linksRevealed([r.characterAId, r.characterBId]) || !gate.hasReached(r.startEventId)) continue
      if (hit(r.label) || hit(r.description)) {
        const charA = (characters ?? []).find((c) => c.id === r.characterAId)
        const charB = (characters ?? []).find((c) => c.id === r.characterBId)
        const charNames = charA && charB ? `${charA.name} → ${charB.name}` : `${r.sentiment} · ${r.strength}`
        out.push({ id: r.id, type: 'relationship', label: r.label, sublabel: charNames, path: `/worlds/${worldId}/relationships` })
      }
    }
    /*
      The same rule the map screen uses, shared rather than restated — see
      `mapGating`. This filtered on the layer alone, which reveals every route
      drawn on a layer the moment any marker on it is met.
    */
    for (const r of (routes ?? []).filter((r) => routeRevealed(gate, r, (id) => layerRevealed.has(id)))) {
      if (hit(r.name) || hit(r.notes)) {
        out.push({ id: r.id, type: 'route', label: r.name, sublabel: r.routeType.replace('_', ' '), path: `/worlds/${worldId}/maps` })
      }
    }
    for (const r of (regions ?? []).filter((r) => regionRevealed(gate, r, (id) => layerRevealed.has(id)))) {
      if (hit(r.name) || hit(r.notes)) {
        out.push({ id: r.id, type: 'region', label: r.name, sublabel: snippet(r.notes), path: `/worlds/${worldId}/maps` })
      }
    }
    for (const p of (lorePages ?? []).filter(
      (p) => gate.hasReached(p.visibleFromEventId) && gate.linksRevealed(p.linkedEntityIds),
    )) {
      if (hit(p.title) || hit(p.body) || p.tags?.some((t) => hit(t))) {
        out.push({ id: p.id, type: 'lore', label: p.title, sublabel: snippet(p.body?.replace(/[#*`_>-]/g, '')), path: `/worlds/${worldId}/lore/${p.id}` })
      }
    }
    for (const f of (factions ?? []).filter((f) => factionRevealed.has(f.id))) {
      if (hit(f.name) || hit(f.description)) {
        out.push({ id: f.id, type: 'faction', label: f.name, sublabel: snippet(f.description), path: `/worlds/${worldId}/factions` })
      }
    }

    return out
  }, [query, wholeWord, worldId, gate, chapterReached, factionRevealed, characters, items, markers, chapters, events, timelines, relationships, routes, regions, lorePages, factions, facts, sceneTexts])

  // Reset active index when results change
  useEffect(() => setActiveIdx(0), [results])

  // Focus the input when opened; reset expanded groups on close.
  //
  // Synchronously, not on a timer. The palette renders nothing until it is
  // open, so by the time this effect runs the input is mounted and the ref is
  // attached — there is nothing to wait for. A delay here is not free: whatever
  // had focus keeps it until the timer fires, so a keystroke in that window is
  // delivered to the screen behind the palette instead. Opening search from a
  // half-filled form and typing straight away put the first characters into the
  // form.
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setExpandedGroups(new Set())
      inputRef.current?.focus()
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
    // Jumping to a search hit shows it; while reading it does not move the
    // reader's place in the book.
    if (result.type === 'event') showMoment(result.id)
    if (result.type === 'route') setPendingFocusRouteId(result.id)
    if (result.type === 'region') setPendingFocusRegionId(result.id)
    if (result.type === 'location') setPendingFocusMarkerId(result.id)
    navigate(result.path)
    close()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { if (results[activeIdx]) go(results[activeIdx]) }
    // Consume the key rather than letting it bubble. Dialogs listen for Escape
    // on `document`, so an un-stopped keypress closes the palette *and*
    // whatever it was opened on top of — searching for a name from a
    // half-filled form and pressing Escape used to discard the form.
    else if (e.key === 'Escape') { e.stopPropagation(); close() }
  }

  if (!searchOpen) return null

  // Group results by type for display
  const grouped: { group: string; type: ResultType; items: (SearchResult & { globalIdx: number })[] }[] = []
  let globalIdx = 0
  const typeOrder: ResultType[] = ['character', 'faction', 'item', 'location', 'chapter', 'event', 'timeline', 'relationship', 'route', 'region', 'lore', 'knowledge']
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
      <div className={cn('absolute inset-0', MODAL_BACKDROP)} />

      {/* Palette */}
      <div
        ref={paletteRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
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
            /*
              The placeholder is this box's accessible name, so it is also what
              the app calls the thing being searched. "your world and the prose
              you wrote" is addressed to the author; a reader is searching
              somebody else's book, and only as far as they have read — which is
              worth saying, because a word from three chapters ahead genuinely
              returns nothing and the honest reason is not "no results".
            */
            placeholder={gate.active
              ? 'Search this book, as far as you have read…'
              : 'Search your world and the prose you wrote…'}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery('')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {/*
            Whole words. The palette matches inside words by default, which is
            right for "where did I write that" — but for a writer whose names
            are short and invented it means `tin` returns every casting and
            `Bel` returns every bell. Find & Replace has had the same switch all
            along and this matches its behaviour exactly, so there is one rule
            to learn rather than two.

            A real checkbox rather than a styled button: it is a two-state
            preference, screen readers announce it as one, and the label is the
            visible text beside it.
          */}
          <label className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="h-3 w-3 accent-[hsl(var(--primary))]"
            />
            Whole words
          </label>
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
              const isExpanded = expandedGroups.has(type)
              const visibleItems = isExpanded ? groupItems : groupItems.slice(0, 5)
              const hiddenCount = groupItems.length - 5
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {group}
                  </p>
                  {visibleItems.map(({ globalIdx: idx, ...result }) => (
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
                      <Icon className={cn('h-4 w-4 shrink-0', color)} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span data-search-result-label className="block truncate font-medium">
                          {highlight(result.label, query.trim(), wholeWord)}
                        </span>
                        {result.sublabel && (
                          <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">{result.sublabel}</span>
                        )}
                      </span>
                    </button>
                  ))}
                  {!isExpanded && hiddenCount > 0 && (
                    <button
                      onClick={() => setExpandedGroups((s) => { const next = new Set(s); next.add(type); return next })}
                      className="w-full px-3 py-1.5 text-left text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      Show all {groupItems.length} →
                    </button>
                  )}
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
