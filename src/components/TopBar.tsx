import { useEffect, useState } from 'react'
import { Search, ScrollText, ShieldAlert, HelpCircle, Menu, X, Undo2, Redo2, History } from 'lucide-react'
import faviconUrl from '/favicon.svg'
import { useActiveWorldId, useActiveMapLayerId, useAppStore } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import { useMapLayer } from '@/db/hooks/useMapLayers'
import { useNavigate, NavLink, useMatch } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { TimeCursor } from './TimeCursor'
import { FolderSyncIndicator } from './FolderSyncIndicator'
import { navItems } from './navItems'
import { useUndoNext } from '@/features/history/useUndo'

/**
 * Full-height slide-in navigation for narrow screens. The desktop icon rail
 * (NavIcons) and the top-bar tool buttons don't fit on a phone, so below the
 * `lg` breakpoint they collapse behind a hamburger that opens this drawer with
 * labelled destinations plus the panel tools.
 */
function MobileNavDrawer({ worldId, open, onClose }: { worldId: string; open: boolean; onClose: () => void }) {
  const world = useWorld(worldId)
  const readingMode = !!world?.readingMode
  const { setBriefOpen, setCheckerOpen, setHelpOpen, setHistoryOpen } = useAppStore()

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const tools: { label: string; icon: typeof ScrollText; action: () => void }[] = [
    // Undo has no keyboard shortcut on a phone, so the history list is its only
    // durable home here — first in the list rather than buried under the tools.
    ...(readingMode ? [] : [
      { label: 'Recent changes', icon: History, action: () => setHistoryOpen(true) },
      { label: "Writer's Brief", icon: ScrollText, action: () => setBriefOpen(true) },
      { label: 'Continuity Checker', icon: ShieldAlert, action: () => setCheckerOpen(true) },
    ]),
    { label: 'Help', icon: HelpCircle, action: () => setHelpOpen(true) },
  ]

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
      isActive
        ? 'bg-[hsl(var(--accent))] font-medium text-[hsl(var(--foreground))]'
        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
    )

  return (
    <div className="fixed inset-0 z-[2000] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="pw-anim-fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <nav className="pw-anim-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-4">
          <img src={faviconUrl} alt="" className="h-7 w-7 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold tracking-wide text-[hsl(var(--foreground))]">PlotWeave</div>
            {world && <div className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={world.name}>{world.name}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {navItems.filter((n) => !(readingMode && n.writingOnly)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={`/worlds/${worldId}/${to}`} end={end} onClick={onClose} className={itemClass}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}

          <div className="my-1 border-t border-[hsl(var(--border))]" />

          {tools.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              onClick={() => { action(); onClose() }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

export function TopBar() {
  const worldId = useActiveWorldId()
  const world = useWorld(worldId)
  const navigate = useNavigate()
  const { setSearchOpen, setBriefOpen, setCheckerOpen, setHelpOpen, setHistoryOpen } = useAppStore()
  const [navOpen, setNavOpen] = useState(false)
  const { undo, redo, canUndo, canRedo, nextLabel, redoLabel } = useUndoNext(worldId)
  /**
   * Reading mode drops the authoring tools entirely. Undo and redo have nothing
   * to act on when nobody is editing; Recent changes is a journal of edits that
   * were never made; and the Writer's Brief and Continuity Checker are named
   * for, and built for, the person writing the book rather than reading it.
   *
   * The Continuity Checker is also the one panel that scans the whole world
   * regardless of the cursor, so leaving it reachable would undo the gating.
   */
  const readingMode = !!world?.readingMode
  // On the map, the breadcrumb carries which layer is open and its scale, so
  // the canvas doesn't have to give up a corner to a floating name chip.
  const onMaps = !!useMatch('/worlds/:worldId/maps')
  const activeMapLayerId = useActiveMapLayerId()
  const mapLayer = useMapLayer(onMaps ? activeMapLayerId : null)
  const mapScale = mapLayer?.scalePixelsPerUnit && mapLayer.scaleUnit
    ? `1 ${mapLayer.scaleUnit} = ${Math.round(mapLayer.scalePixelsPerUnit)} px`
    : null

  /*
    `px-2` and `gap-1` below `sm` are the other 8px F-5 needed. This header
    carries seven 32px controls on a phone — menu, brand, two steppers, undo,
    redo, search — and the time-cursor pill is the only thing in it that can
    shrink, so every fixed pixel is taken out of the one label that says where
    in the book you are. Nothing here is removed; the padding is.
  */
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 sm:px-4">
      {/* Left: menu (mobile) + brand + world name + time cursor */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {world && (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            className="pw-tap flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          aria-label="Go to world list"
          className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src={faviconUrl} alt="" className="h-7 w-7 rounded object-cover" />
          <span className="hidden text-sm font-bold tracking-wide text-[hsl(var(--foreground))] lg:inline">
            PlotWeave
          </span>
        </button>
        {world && (
          <>
            <span aria-hidden="true" className="hidden text-[hsl(var(--muted-foreground))] lg:inline">/</span>
            {/*
              The cap grows with the window. It was a flat 120px at every width,
              so "The Weight of Bells" read "The Weight of …" on a 1440px screen
              with roughly 800px of empty bar beside it. `truncate` is still the
              safety net; it just stops being the normal case.
            */}
            <span className="hidden max-w-[120px] truncate text-sm text-[hsl(var(--foreground))] lg:inline xl:max-w-[280px] 2xl:max-w-[420px]" title={world.name}>{world.name}</span>
          </>
        )}
        {world && mapLayer && (
          <>
            <span aria-hidden="true" className="hidden text-[hsl(var(--muted-foreground))] lg:inline">/</span>
            <span
              className="hidden max-w-[160px] truncate text-sm text-[hsl(var(--foreground))] lg:inline xl:max-w-[280px]"
              title={mapScale ? `${mapLayer.name} — ${mapScale}` : mapLayer.name}
            >
              {mapLayer.name}
            </span>
            {mapScale && (
              <span className="hidden shrink-0 text-[11px] text-[hsl(var(--muted-foreground))] xl:inline">
                · {mapScale}
              </span>
            )}
          </>
        )}
        {world && worldId && (
          <>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-[hsl(var(--border))]" />
            <TimeCursor worldId={worldId} />
            <FolderSyncIndicator worldId={worldId} />
          </>
        )}
      </div>

      {/* Right: search + brief + continuity + help */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {world && (
          <>
            {!readingMode && (
              <>
                {/* Undo — shown at every width, since it is the one control a
                    writer reaches for reflexively. Disabled state explains itself
                    rather than looking broken after a bulk import resets history.
                    The accessible name stays short and stable: naming the record in
                    it made every tab-stop announce a whole sentence. The detail
                    lives in the tooltip instead. */}
                <button
                  onClick={() => { void undo() }}
                  disabled={!canUndo}
                  aria-label={canUndo ? 'Undo' : 'Nothing to undo'}
                  title={
                    canUndo
                      ? `Undo: ${nextLabel} (${isMac ? '⌘Z' : 'Ctrl+Z'})`
                      : 'Nothing to undo — importing or generating starts a fresh history'
                  }
                  className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors enabled:hover:bg-[hsl(var(--accent))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-40"
                >
                  <Undo2 className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
                </button>
                {/* Redo sits beside undo rather than behind a menu: one Ctrl+Z too
                    many is exactly when people look for it, and hunting for it in
                    that moment is its own small panic. */}
                <button
                  onClick={() => { void redo() }}
                  disabled={!canRedo}
                  aria-label={canRedo ? 'Redo' : 'Nothing to redo'}
                  title={
                    canRedo
                      ? `Redo: ${redoLabel} (${isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z'})`
                      : 'Nothing to redo — making a new edit clears the redo history'
                  }
                  className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors enabled:hover:bg-[hsl(var(--accent))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-40"
                >
                  <Redo2 className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setHistoryOpen(true)}
                  aria-label="Recent changes"
                  title="Recent changes"
                  className="pw-tap hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
                >
                  <History className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <div className="mx-0.5 hidden h-5 w-px bg-[hsl(var(--border))] lg:block" aria-hidden="true" />
              </>
            )}
            {/* Compact search (mobile) */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:hidden"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* Full search (desktop) */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
              title={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
              className="hidden h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <kbd className="rounded border border-[hsl(var(--border))] px-1 py-0.5 text-[10px]" aria-hidden="true">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            {!readingMode && (
              <>
                <div className="mx-0.5 hidden h-5 w-px bg-[hsl(var(--border))] lg:block" aria-hidden="true" />
                <button
                  onClick={() => setBriefOpen(true)}
                  aria-label="Writer's Brief"
                  title="Writer's Brief"
                  className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
                >
                  <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCheckerOpen(true)}
                  aria-label="Continuity Checker"
                  title="Continuity Checker"
                  className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
                >
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </>
        )}
        <div className="mx-0.5 hidden h-5 w-px bg-[hsl(var(--border))] lg:block" aria-hidden="true" />
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          title="Help"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {world && worldId && <MobileNavDrawer worldId={worldId} open={navOpen} onClose={() => setNavOpen(false)} />}
    </header>
  )
}
