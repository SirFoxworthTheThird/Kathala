import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Users, Map as MapIcon, MapPin, Package, Layers,
  ChevronRight, ChevronDown, Trash2, Undo2, X, Search,
  Route, Hexagon, Plus, Link, Crosshair,
} from 'lucide-react'
import { useAppStore, useMapLayerHistory } from '@/store'
import { useMapLayers, deleteMapLayer, updateMapLayer } from '@/db/hooks/useMapLayers'
import { canReparentLayer } from '@/lib/mapTree'
import { isTreeVisible } from '@/lib/mapLevels'
import { useEventMovements, clearMovement, removeLastWaypoint } from '@/db/hooks/useMovements'
import { useItems } from '@/db/hooks/useItems'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useItemSnapshot, upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { useCrossTimelineArtifacts } from '@/db/hooks/useTimelineRelationships'
import { useMapRoutes, deleteMapRoute } from '@/db/hooks/useMapRoutes'
import { useMapRegions, deleteMapRegion, useBestRegionSnapshots } from '@/db/hooks/useMapRegions'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useGate } from '@/db/hooks/ReadingGateContext'
import type { Character, CharacterSnapshot, Item, LocationMarker, MapLayer, RouteType, MapRegionStatus } from '@/types'
import { pathPixelLength, formatDistance } from '@/lib/mapScale'
import { characterColor, ICON_COLORS } from './mapUtils'
import { splitMapCast } from '@/lib/mapCast'
import { resolveItemWhereabouts } from '@/lib/itemWhereabouts'
import { ITEM_CONDITIONS, CONDITION_COLORS } from '@/lib/itemCondition'

// ─── SidebarSection ──────────────────────────────────────────────────────────

export function SidebarSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  count,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  /*
    SB-1: the six sections used to sit in one unbounded scroll, so expanding
    Items (18 rows) pushed Map Layers, Characters and Locations off the top, and
    opening two sections made the third unreachable without hunting.

    The column is a panel stack instead — headers and bodies are siblings in the
    sidebar's own flex column rather than each pair being wrapped in a box. The
    wrapper was the problem: a flex item's automatic minimum height is its
    min-content height, and a wrapper's min-content includes the whole body, so
    nothing could shrink. Flat, the headers are `shrink-0` and always on screen,
    and only the bodies give way.

    `flex-1` shares the leftover height between the open bodies, and `max-h-fit`
    stops a body growing past its own content — a one-row section keeps its one
    row and hands the surplus back to whichever section actually needs it, which
    is how flexbox resolves an item clamped by its max size.
  */
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors select-none"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            {count}
          </span>
        )}
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
      </button>
      {/* A block, not a flex column: the children keep their natural heights and
          this box scrolls, rather than the children being squashed. */}
      {open && (
        <div
          data-sidebar-section-body={title}
          className="min-h-0 max-h-fit flex-1 overflow-y-auto border-b border-[hsl(var(--border))]"
        >
          {children}
        </div>
      )}
    </>
  )
}

// ─── SidebarSearch ───────────────────────────────────────────────────────────

function SidebarSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mx-2 mb-1.5 mt-0.5">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1 pl-6 pr-6 text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--ring))] transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── Map Layers tree ─────────────────────────────────────────────────────────

function LayerTreeNode({
  layer,
  allLayers,
  activeLayerId,
  depth,
  onDeleted,
  draggingId,
  hoverId,
  onBeginDrag,
}: {
  layer: MapLayer
  allLayers: MapLayer[]
  activeLayerId: string | null
  depth: number
  onDeleted: (id: string) => void
  draggingId: string | null
  hoverId: string | null
  onBeginDrag: (id: string, e: React.PointerEvent) => void
}) {
  const children = allLayers.filter((l) => l.parentMapId === layer.id && isTreeVisible(allLayers, l))
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState(false)
  const gate = useGate()
  // The activator button owns the click, so the row needs the same action the
  // pointer-gesture handler in the section above uses.
  const resetMapHistory = useAppStore((st) => st.resetMapHistory)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = layer.id === activeLayerId
  const childCount = children.length
  const isDropTarget =
    hoverId === layer.id && !!draggingId && canReparentLayer(allLayers, draggingId, layer.id)
  const isDragged = draggingId === layer.id

  async function handleDelete() {
    await deleteMapLayer(layer.id)
    onDeleted(layer.id)
  }

  return (
    <div>
      <div
        data-layer-drop={layer.id}
        onPointerDown={(e) => {
          // Ignore right/middle mouse and presses that start on a control button.
          //
          // SB-6: the row's *own* activator is a button now, and it is the
          // widest thing in the row — so skipping every button would mean a
          // drag could only be started from the padding. It is excluded by
          // name; the chevron and the delete still stop a drag from starting.
          if (e.pointerType === 'mouse' && e.button !== 0) return
          if ((e.target as HTMLElement).closest('button:not([data-layer-activate])')) return
          onBeginDrag(layer.id, e)
        }}
        className={`group flex items-center gap-1 cursor-pointer select-none transition-colors rounded-sm mx-1 ${
          isDropTarget
            ? 'ring-1 ring-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
            : isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
        } ${isDragged ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Drag onto another map to nest it inside (on touch, press and hold first)"
      >
        {children.length > 0 ? (
          <button
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <MapPin className="h-3 w-3 shrink-0 opacity-40" />
        )}
        {depth === 0 && <MapIcon className="h-3 w-3 shrink-0 opacity-70" />}
        {/*
          SB-6: this row was a `div` whose entire activation was a pointer
          gesture — `pointerup` without movement selects the layer, with
          movement re-parents it — so there was no way to open a map from the
          keyboard at all. The chevron and the delete beside it were already
          buttons, which is what made the row look fine.

          The name is the activator, as a real button: `Enter` and `Space` come
          free, and a screen reader gets a control rather than a span. Drag
          stays on the row around it, because the drag source has to be the
          whole row for the crosshair and chevron to be draggable too.
        */}
        <button
          type="button"
          data-layer-activate
          data-map-layer
          aria-current={isActive ? 'true' : undefined}
          onClick={() => resetMapHistory(layer.id)}
          className="flex-1 truncate text-left text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
          title={layer.name}
        >
          {layer.name}
        </button>
        {hovered && !gate.active && (
          <button
            className="shrink-0 rounded p-0.5 hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
            title="Delete map"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={childCount > 0 ? `Delete "${layer.name}" and its ${childCount} sub-map(s)?` : `Delete "${layer.name}"?`}
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
      {open && children.map((child) => (
        <LayerTreeNode
          key={child.id}
          layer={child}
          allLayers={allLayers}
          activeLayerId={activeLayerId}
          depth={depth + 1}
          onDeleted={onDeleted}
          draggingId={draggingId}
          hoverId={hoverId}
          onBeginDrag={onBeginDrag}
        />
      ))}
    </div>
  )
}

export function LayersSection({ worldId }: { worldId: string }) {
  const allLayers = useMapLayers(worldId)
  const history = useMapLayerHistory()
  const { resetMapHistory, setActiveMapLayerId } = useAppStore()
  const activeLayerId = history[history.length - 1] ?? null
  const roots = allLayers.filter((l) => l.parentMapId === null && isTreeVisible(allLayers, l))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Refs let the global pointer listeners read live state without re-subscribing.
  const allLayersRef = useRef(allLayers)
  useEffect(() => { allLayersRef.current = allLayers }, [allLayers])
  // The active press: `armed` flips true once it's an actual drag (a mouse move
  // past the threshold, or a completed long-press on touch), at which point a
  // release re-parents instead of selecting.
  const pressRef = useRef<{ id: string; x: number; y: number; touch: boolean; armed: boolean } | null>(null)
  const hoverRef = useRef<string | null>(null)
  const longPressTimer = useRef<number | null>(null)

  function handleDeleted(deletedId: string) {
    if (history.includes(deletedId)) {
      const remaining = allLayers.filter((l) => l.id !== deletedId && l.parentMapId === null)
      if (remaining.length > 0) resetMapHistory(remaining[0].id)
      else setActiveMapLayerId('')
    }
  }

  // Native HTML5 drag-and-drop is unreliable across nesting/trackpads/browsers
  // (only the root row would reliably drag), so re-parenting uses a pointer-drag
  // that works for mouse, touch, and pen alike:
  //   • mouse/pen — press a row, and a small move past a threshold begins the
  //     drag; a release without moving selects the layer as the active map.
  //   • touch — press and hold (long-press) to pick a row up, so a normal swipe
  //     still scrolls the sidebar; a quick tap just selects.
  // A release over another map re-parents; a release over the "top level" zone
  // un-nests to a root.
  function clearLongPress() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleBeginDrag(id: string, e: React.PointerEvent) {
    const touch = e.pointerType === 'touch'
    pressRef.current = { id, x: e.clientX, y: e.clientY, touch, armed: false }
    clearLongPress()
    if (touch) {
      longPressTimer.current = window.setTimeout(() => {
        const p = pressRef.current
        if (p && p.id === id) {
          p.armed = true
          setDraggingId(id)
        }
      }, 250)
    }
  }

  useEffect(() => {
    const MOUSE_THRESHOLD = 4
    const TOUCH_SCROLL_TOLERANCE = 10

    function targetAt(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y)
      const drop = el?.closest('[data-layer-drop]') as HTMLElement | null
      return drop?.dataset.layerDrop ?? null
    }

    function updateHover(id: string, x: number, y: number) {
      const raw = targetAt(x, y)
      // Treat the dedicated zone as "make this a root".
      const target = raw === '__root__' ? null : raw
      const valid = raw !== null && canReparentLayer(allLayersRef.current, id, target)
      const next = valid ? raw : null
      if (next !== hoverRef.current) {
        hoverRef.current = next
        setHoverId(next)
      }
    }

    function reset() {
      clearLongPress()
      pressRef.current = null
      hoverRef.current = null
      setDraggingId(null)
      setHoverId(null)
    }

    function onMove(e: PointerEvent) {
      const p = pressRef.current
      if (!p) return
      const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y)
      if (!p.armed) {
        if (p.touch) {
          // Moved before the long-press fired → it's a scroll, not a drag.
          if (moved > TOUCH_SCROLL_TOLERANCE) reset()
          return
        }
        if (moved < MOUSE_THRESHOLD) return
        p.armed = true
        setDraggingId(p.id)
      }
      updateHover(p.id, e.clientX, e.clientY)
    }

    function onUp(e: PointerEvent) {
      const p = pressRef.current
      if (!p) { reset(); return }
      if (!p.armed) {
        /*
          A quick tap / click without dragging selects the layer — unless it
          landed on the row's own activator button, whose `onClick` does it.
          The button has to own the click, because that is what makes Enter and
          Space work; without this check the two paths would both fire on a
          mouse click. Selecting twice is harmless — the action is idempotent —
          so this is tidiness rather than a fix, and there is deliberately no
          test claiming otherwise.
        */
        const onActivator = (e.target as HTMLElement | null)?.closest?.('[data-layer-activate]')
        if (!onActivator) resetMapHistory(p.id)
      } else {
        const raw = targetAt(e.clientX, e.clientY)
        const target = raw === '__root__' ? null : raw
        if (raw !== null && canReparentLayer(allLayersRef.current, p.id, target)) {
          // Re-parent the whole level group together, not just the visible floor.
          const dragged = allLayersRef.current.find((l) => l.id === p.id)
          const ids = dragged?.levelGroupId
            ? allLayersRef.current.filter((l) => l.levelGroupId === dragged.levelGroupId).map((l) => l.id)
            : [p.id]
          for (const id of ids) updateMapLayer(id, { parentMapId: target })
        }
      }
      reset()
    }

    // Interrupted (e.g. the browser took over for a scroll) — never select or
    // re-parent; just drop the gesture.
    function onCancel() { reset() }

    // Once a touch drag is armed, stop the page from scrolling under the finger.
    // Pointer events can't cancel scrolling, so this must be a non-passive
    // touchmove listener.
    function onTouchMove(e: TouchEvent) {
      const p = pressRef.current
      if (p && p.touch && p.armed) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [resetMapHistory])

  // A drop target for un-nesting to the top level, shown only while dragging a
  // non-root layer.
  const canDropToRoot = !!draggingId && canReparentLayer(allLayers, draggingId, null)

  return (
    <SidebarSection title="Map Layers" icon={Layers} count={roots.length}>
      <div className="py-1">
        {roots.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No maps yet.</p>
        ) : (
          <>
            {roots.map((root) => (
              <LayerTreeNode
                key={root.id}
                layer={root}
                allLayers={allLayers}
                activeLayerId={activeLayerId}
                depth={0}
                onDeleted={handleDeleted}
                draggingId={draggingId}
                hoverId={hoverId}
                onBeginDrag={handleBeginDrag}
              />
            ))}
            {/* Un-nest target, appended below the tree so showing it while
                dragging never shifts the rows the user is aiming at. */}
            {canDropToRoot && (
              <div
                data-layer-drop="__root__"
                className={`mx-1 mt-1 rounded-sm border border-dashed px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
                  hoverId === '__root__'
                    ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                    : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                }`}
              >
                Drop here for top level
              </div>
            )}
          </>
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Characters section ───────────────────────────────────────────────────────

export function CharactersSection({
  characters,
  snapshots,
  allMarkers,
  activeEventId,
  worldId,
  scalePixelsPerUnit,
  scaleUnit,
  onDragStart,
  onDragEnd,
  onFocus,
  placingCharacterId,
  onPlace,
}: {
  characters: Character[]
  snapshots: CharacterSnapshot[]
  allMarkers: LocationMarker[]
  activeEventId: string | null
  worldId: string
  scalePixelsPerUnit: number | null
  scaleUnit: string | null
  onDragStart: () => void
  onDragEnd: () => void
  onFocus: (characterId: string) => void
  placingCharacterId: string | null
  onPlace: (characterId: string) => void
}) {
  // Dragging a card onto the map places a character, which is a write — so it
  // goes away while reading, like the buttons that do the same thing.
  const gate = useGate()
  const movements = useEventMovements(worldId, activeEventId)
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? characters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : characters

  /*
    MW-3: the list put all 45 characters at equal weight while only a handful
    carried a location, so "who is here now" — the question this screen exists
    to answer — was a minority of the rows and looked like the rest of them.

    With a cursor the two are separated; without one there is no moment for a
    placement to belong to, so it stays one list. The groups only appear when
    both are non-empty, because a heading over the whole list says nothing.
  */
  const { placed, unplaced } = useMemo(
    () => splitMapCast(filtered, activeEventId ? snapshots : [], allMarkers),
    [filtered, snapshots, allMarkers, activeEventId],
  )
  const groups = activeEventId && placed.length > 0 && unplaced.length > 0
    ? [
        { label: `On the map (${placed.length})`, rows: placed },
        { label: `Not placed (${unplaced.length})`, rows: unplaced },
      ]
    : [{ label: null, rows: [...placed, ...unplaced] }]

  return (
    <SidebarSection title="Characters" icon={Users} count={characters.length}>
      {!activeEventId && (
        <p className="px-3 pb-2 text-[10px] italic text-[hsl(var(--muted-foreground))]">
          Select a scene from the timeline bar below to place characters onto the map.
        </p>
      )}
      {characters.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col gap-1 px-2 pb-2">
        {characters.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No characters yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          groups.flatMap((group) => [
            group.label !== null ? (
              <p
                key={`h-${group.label}`}
                className="px-1 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
              >
                {group.label}
              </p>
            ) : null,
            ...group.rows.map(({ character: c, locationName }) => {
            const movement = movements.find((m) => m.characterId === c.id)
            const color = characterColor(c.id)
            const isPlacing = placingCharacterId === c.id
            return (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div
                  draggable={!!activeEventId && !gate.active}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('characterId', c.id)
                    e.dataTransfer.effectAllowed = 'move'
                    onDragStart()
                  }}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-2 rounded-md border bg-[hsl(var(--muted))] pr-2 select-none ${
                    isPlacing ? 'border-[hsl(var(--ring))] ring-1 ring-[hsl(var(--ring))]' : activeEventId ? 'hover:border-[hsl(var(--ring))]' : 'opacity-60'
                  }`}
                  style={{ borderColor: isPlacing ? undefined : movement ? color : 'hsl(var(--border))' }}
                >
                  {/*
                    SB-4: the row itself carries the drag, because the drag
                    source is the nearest draggable ancestor and it should be
                    the whole row — but the *click* belongs to a real control.
                    The place-on-map button below cannot be nested inside it,
                    so the name is the button and the crosshair is its sibling.
                  */}
                  <button
                    type="button"
                    onClick={() => onFocus(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  >
                    <PortraitImage
                      imageId={c.portraitImageId}
                      className="h-6 w-6 rounded-full object-cover shrink-0"
                      fallbackClassName="h-6 w-6 rounded-full shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      {/* SB-2: a name wide enough to be cut is worth having in
                          full somewhere, and two Witch-kings truncate alike. */}
                      <span className="block truncate text-xs font-medium" title={c.name}>{c.name}</span>
                      {/* SB-3: every row says where it stands, so a blank second
                          line means "nowhere" rather than "not loaded yet". */}
                      {activeEventId && (
                        <span className={`block truncate text-[10px] ${locationName ? 'text-[hsl(var(--muted-foreground))]' : 'italic text-[hsl(var(--muted-foreground))/0.7]'}`}>
                          {locationName ?? 'Not placed'}
                        </span>
                      )}
                    </span>
                  </button>
                  {/*
                    Not while reading: tapping this and then a location writes
                    the character's snapshot and a waypoint, which is the
                    author's record of where they were.
                  */}
                  {activeEventId && !gate.active && (
                    <button
                      type="button"
                      aria-label={isPlacing ? `Cancel placing ${c.name}` : `Place ${c.name} on the map`}
                      aria-pressed={isPlacing}
                      title={isPlacing ? 'Tap a location on the map, or tap here to cancel' : 'Place on map: tap here, then tap a location'}
                      onClick={() => onPlace(c.id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                        isPlacing
                          ? 'bg-[hsl(var(--ring))] text-[hsl(var(--background))]'
                          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <Crosshair className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {movement && movement.waypoints.length >= 2 && activeEventId && (
                  <div className="flex items-center gap-1 pl-2">
                    <span className="h-1 w-3 rounded-full shrink-0" style={{ background: color }} />
                    <p className="flex-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                      {movement.waypoints.length} stops
                      {scalePixelsPerUnit && scaleUnit && (() => {
                        const pts = movement.waypoints
                          .map((id) => allMarkers.find((m) => m.id === id))
                          .filter(Boolean)
                          .map((m) => [m!.x, m!.y] as [number, number])
                        if (pts.length < 2) return null
                        return ` · ${formatDistance(pathPixelLength(pts), scalePixelsPerUnit, scaleUnit)}`
                      })()}
                    </p>
                    <button
                      title="Undo last stop"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      onClick={() => removeLastWaypoint(c.id, activeEventId)}
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                    <button
                      title="Clear path"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                      onClick={() => clearMovement(c.id, activeEventId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
            }),
          ])
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Locations section ────────────────────────────────────────────────────────

export function LocationsSection({
  markers,
  selectedId,
  onSelect,
  onFocus,
}: {
  markers: LocationMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
  onFocus: (marker: LocationMarker) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? markers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : markers

  return (
    <SidebarSection title="Locations" icon={MapPin} count={markers.length} defaultOpen={false}>
      {markers.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {markers.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No locations on this map.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); onFocus(m) }}
              className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-sm mx-1 ${
                selectedId === m.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: ICON_COLORS[m.iconType] ?? '#94a3b8' }}
              />
              <span className="flex-1 truncate text-xs" title={m.name}>{m.name}</span>
              {m.linkedMapLayerId && (
                <MapIcon className="h-3 w-3 shrink-0 opacity-50" />
              )}
            </button>
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Items section ────────────────────────────────────────────────────────────


function ItemRow({
  item,
  activeEventId,
  worldId,
  locationName,
  isCrossTimeline,
  onFocus,
}: {
  item: Item
  activeEventId: string | null
  worldId: string
  locationName: string | null
  isCrossTimeline: boolean
  onFocus: () => void
}) {
  const snap = useItemSnapshot(item.id, worldId, activeEventId)
  const [expanded, setExpanded] = useState(false)
  const condition = snap?.condition ?? 'intact'

  return (
    <div className="mx-1 rounded-sm border border-transparent hover:border-[hsl(var(--border))] transition-colors">
      {/*
        X-7 again, in the one place it never reached. This row, the route row
        and the region row were `div`s with click handlers: no role, no tab
        stop, no key handler — so the region panel could not be opened from the
        keyboard at all, which section 16 of the review records in prose rather
        than as a finding. The location markers immediately above them were
        already buttons, so the same sidebar was navigable in some rows and not
        others.
      */}
      <button
        type="button"
        aria-expanded={activeEventId ? expanded : undefined}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
        onClick={() => { onFocus(); setExpanded((v) => !v) }}
      >
        <PortraitImage
          imageId={item.imageId}
          fallbackIcon={Package}
          className="h-5 w-5 rounded object-cover shrink-0"
          fallbackClassName="h-5 w-5 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="truncate text-xs" title={item.name}>{item.name}</p>
            {isCrossTimeline && (
              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-400">echo era</span>
            )}
          </div>
          {/* SB-3, as for characters: every row states where it is. */}
          {activeEventId && (
            <p className={`truncate text-[10px] ${locationName ? 'opacity-60' : 'italic opacity-40'}`}>
              {locationName ?? 'Not placed'}
            </p>
          )}
        </div>
        {activeEventId && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: CONDITION_COLORS[condition] ?? '#94a3b8' }}
            title={condition}
          />
        )}
        {activeEventId && (
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {expanded && activeEventId && (
        <div className="flex flex-col gap-1.5 border-t border-[hsl(var(--border))] px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] w-16 shrink-0">Condition</span>
            <select
              className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--foreground))]"
              value={condition}
              onChange={(e) =>
                upsertItemSnapshot({
                  worldId,
                  itemId: item.id,
                  eventId: activeEventId,
                  condition: e.target.value,
                  notes: snap?.notes ?? '',
                })
              }
            >
              {ITEM_CONDITIONS.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-1 text-[10px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            rows={2}
            placeholder="Chapter notes..."
            value={snap?.notes ?? ''}
            onChange={(e) =>
              upsertItemSnapshot({
                worldId,
                itemId: item.id,
                eventId: activeEventId,
                condition: snap?.condition ?? 'intact',
                notes: e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

export function ItemsSection({
  worldId,
  activeEventId,
  allMarkers,
  snapshots,
  characters,
  onFocus,
}: {
  worldId: string
  activeEventId: string | null
  allMarkers: LocationMarker[]
  snapshots: CharacterSnapshot[]
  /** Needed to name whoever is carrying an item — see `resolveItemWhereabouts`. */
  characters: Character[]
  onFocus: (itemId: string) => void
}) {
  const items = useItems(worldId)
  const placements = useEventItemPlacements(activeEventId)
  const artifacts = useCrossTimelineArtifacts(worldId)
  const crossTimelineItemIds = useMemo(() => new Set(artifacts.map((a) => a.itemId)), [artifacts])
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  // Shared with the Items roster, which had no answer to "where is it" at all
  // until IT-2 — see `src/lib/itemWhereabouts.ts`.
  function getItemLocation(itemId: string): string | null {
    return resolveItemWhereabouts({
      itemId, placements, snapshots, markers: allMarkers, characters,
    }).location
  }

  return (
    <SidebarSection title="Items" icon={Package} count={items.length} defaultOpen={false}>
      {items.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No items yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              activeEventId={activeEventId}
              worldId={worldId}
              locationName={getItemLocation(item.id)}
              isCrossTimeline={crossTimelineItemIds.has(item.id)}
              onFocus={() => onFocus(item.id)}
            />
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Route type display helpers ───────────────────────────────────────────────

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  road: 'Road', river: 'River', trail: 'Trail',
  sea_route: 'Sea route', border: 'Border', custom: 'Custom',
}
export const ROUTE_TYPE_COLORS: Record<RouteType, string> = {
  road: '#a78bfa', river: '#60a5fa', trail: '#34d399',
  sea_route: '#22d3ee', border: '#fb923c', custom: '#94a3b8',
}

// ─── Routes section ───────────────────────────────────────────────────────────

export function RoutesSection({
  mapLayerId,
  worldId: _worldId,
  selectedRouteId,
  onSelectRoute,
  drawingRoute,
  onStartDraw,
  onCancelDraw,
}: {
  mapLayerId: string
  worldId: string
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
  drawingRoute: boolean
  onStartDraw: () => void
  onCancelDraw: () => void
}) {
  const routes = useMapRoutes(mapLayerId)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmRoute = confirmId ? routes.find((r) => r.id === confirmId) : null

  return (
    <SidebarSection title="Routes" icon={Route} count={routes.length} defaultOpen={false}>
      <div className="px-2 pb-1.5 pt-0.5">
        {drawingRoute ? (
          <button
            onClick={onCancelDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] px-2 py-1 text-[10px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--ring)/0.2)]"
          >
            <X className="h-3 w-3" /> Cancel drawing
          </button>
        ) : (
          <button
            onClick={onStartDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus className="h-3 w-3" /> New route
          </button>
        )}
      </div>
      <div className="flex flex-col py-1">
        {routes.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No routes yet. Click 'New route' above, or right-click the map to start drawing.</p>
        ) : (
          routes.map((route) => (
            <div
              key={route.id}
              className={`group flex items-center rounded-sm mx-1 pr-2 transition-colors ${
                selectedRouteId === route.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <button
                type="button"
                aria-pressed={selectedRouteId === route.id}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                onClick={() => onSelectRoute(selectedRouteId === route.id ? null : route.id)}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: route.color ?? ROUTE_TYPE_COLORS[route.routeType] }}
                />
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="truncate text-xs leading-tight" title={route.name}>{route.name}</span>
                  <span className="text-[9px] capitalize text-[hsl(var(--muted-foreground))] leading-tight">
                    {ROUTE_TYPE_LABELS[route.routeType]} · {route.waypoints.length} stops
                  </span>
                </span>
              </button>
              {/*
                LORE-1 measured this exact shape and found it worse than a
                permanent icon: `opacity-0` with pointer events still live hit-
                tests to itself, so on a touch device — where the resting state
                is the only state — a tap on apparently blank row deletes the
                thing. It keeps its hover reveal, but it cannot be tapped while
                invisible, it shows itself on keyboard focus, and it has a name.
              */}
              <button
                type="button"
                aria-label={`Delete route ${route.name}`}
                onClick={() => setConfirmId(route.id)}
                className="shrink-0 opacity-0 pointer-events-none transition-colors group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto text-[hsl(var(--muted-foreground))] hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => { if (!v) setConfirmId(null) }}
        title="Delete route"
        description={`Delete "${confirmRoute?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => { if (confirmId) deleteMapRoute(confirmId); setConfirmId(null) }}
      />
    </SidebarSection>
  )
}

// ─── Region status helpers ────────────────────────────────────────────────────

export const REGION_STATUS_COLORS: Record<MapRegionStatus, string> = {
  active: '#34d399', occupied: '#fb923c', contested: '#ef4444',
  abandoned: '#94a3b8', destroyed: '#dc2626', rebuilt: '#4ade80', unknown: '#a78bfa',
}
export const ALL_REGION_STATUSES: MapRegionStatus[] = ['active', 'occupied', 'contested', 'abandoned', 'destroyed', 'rebuilt', 'unknown']

// ─── Regions section ──────────────────────────────────────────────────────────

export function RegionsSection({
  mapLayerId,
  worldId,
  activeEventId,
  selectedRegionId,
  onSelectRegion,
  drawingRegion,
  onStartDraw,
  onCancelDraw,
}: {
  mapLayerId: string
  worldId: string
  activeEventId: string | null
  selectedRegionId: string | null
  onSelectRegion: (id: string | null) => void
  drawingRegion: boolean
  onStartDraw: () => void
  onCancelDraw: () => void
}) {
  const regions = useMapRegions(mapLayerId)
  const regionSnaps = useBestRegionSnapshots(worldId, activeEventId)
  const snapByRegionId = useMemo(() => new Map(regionSnaps.map((s) => [s.regionId, s])), [regionSnaps])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmRegion = confirmId ? regions.find((r) => r.id === confirmId) : null

  /*
    RG-1: the status pills and the per-event notes used to live here, in an
    editor that unfolded under the selected row — which is exactly when the
    region panel is open, so the same region had two homes side by side. They
    are in the panel now, next to the name, colour, notes and faction they
    belong with. The row keeps *showing* the status, which is what a list is
    for.
  */

  return (
    <SidebarSection title="Regions" icon={Hexagon} count={regions.length} defaultOpen={false}>
      <div className="px-2 pb-1.5 pt-0.5">
        {drawingRegion ? (
          <button
            onClick={onCancelDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] px-2 py-1 text-[10px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--ring)/0.2)]"
          >
            <X className="h-3 w-3" /> Cancel drawing
          </button>
        ) : (
          <button
            onClick={onStartDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus className="h-3 w-3" /> New region
          </button>
        )}
      </div>
      <div className="flex flex-col py-1">
        {regions.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No regions yet. Click 'New region' above, or right-click the map to start drawing.</p>
        ) : (
          regions.map((region) => {
            const snap = snapByRegionId.get(region.id)
            const status: MapRegionStatus = snap?.status ?? 'active'
            const isSelected = selectedRegionId === region.id
            return (
              <div key={region.id} className="flex flex-col">
                {/* Region row */}
                <div
                  className={`group flex items-center rounded-sm mx-1 pr-2 transition-colors ${
                    isSelected
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                    onClick={() => onSelectRegion(isSelected ? null : region.id)}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0 ring-1 ring-black/20"
                      style={{ background: region.fillColor }}
                    />
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="truncate text-xs leading-tight" title={region.name}>{region.name}</span>
                        {region.linkedMapLayerId && (
                          <Link className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--muted-foreground))] opacity-60" />
                        )}
                      </span>
                      {activeEventId && (
                        <span className="flex items-center gap-1 mt-0.5">
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ background: REGION_STATUS_COLORS[status] }}
                          />
                          <span className="text-[9px] capitalize text-[hsl(var(--muted-foreground))] leading-tight">
                            {status}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete region ${region.name}`}
                    onClick={() => setConfirmId(region.id)}
                    className="shrink-0 opacity-0 pointer-events-none transition-colors group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto text-[hsl(var(--muted-foreground))] hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

              </div>
            )
          })
        )}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => { if (!v) setConfirmId(null) }}
        title="Delete region"
        description={`Delete "${confirmRegion?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => { if (confirmId) deleteMapRegion(confirmId); setConfirmId(null) }}
      />
    </SidebarSection>
  )
}
