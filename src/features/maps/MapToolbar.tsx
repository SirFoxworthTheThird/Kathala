import { useState, useRef, useEffect } from 'react'
import {
  Plus, Type, Ruler, Route, Sparkles, ImageUp, Layers, Download, X,
  MoreHorizontal, PanelLeft,
} from 'lucide-react'
import type { MapLayer } from '@/types'
import { cn } from '@/lib/utils'

/**
 * The map's own controls, floated over the canvas rather than stacked above it.
 *
 * A map view is mostly canvas, so permanent header rows are expensive: three of
 * them cost ~120px of a ~820px window. Only two commands ("+ Location" and
 * "Label") are reached for while actually working a map — the rest are
 * set-up-once (scale, replace image) or occasional (AI, export, levels), so they
 * live behind an overflow menu instead of holding prime real estate.
 */

/**
 * Shared pill styling for the floating clusters. Opaque rather than translucent:
 * a detailed fantasy map behind a see-through panel makes the controls hard to
 * read, and the panel is small enough that hiding the map under it costs little.
 */
export const FLOAT_PANEL =
  'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl shadow-black/30'

function ToolButton({
  icon: Icon, label, active, disabled, title, onClick, children,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        disabled && 'opacity-40',
        !disabled && (active
          ? 'bg-[hsl(var(--ring))] text-[hsl(var(--background))]'
          : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'),
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {/* Phones get icon-only buttons — the title attribute carries the name. */}
      <span className="hidden sm:inline">{label}</span>
      {children}
    </button>
  )
}

function MenuItem({
  icon: Icon, label, hint, disabled, active, onClick,
}: {
  icon: React.ElementType
  label: string
  hint?: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        disabled ? 'opacity-40' : 'hover:bg-[hsl(var(--muted))]',
        active && 'text-[hsl(var(--ring))]',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

export interface MapToolbarProps {
  layer: MapLayer
  scaleMode: boolean
  measureMode: boolean
  annotateMode: boolean
  onToggleScale: () => void
  onToggleMeasure: () => void
  onToggleAnnotate: () => void
  onClearScale: () => void
  onAddLocation: () => void
  onGenerateLocations: () => void
  onAIMoves: () => void
  onReplaceImage: () => void
  onAddLevel: () => void
  onExport: () => void
}

export function MapToolbar({
  layer, scaleMode, measureMode, annotateMode,
  onToggleScale, onToggleMeasure, onToggleAnnotate, onClearScale,
  onAddLocation, onGenerateLocations, onAIMoves, onReplaceImage, onAddLevel, onExport,
}: MapToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasScale = !!layer.scalePixelsPerUnit && !!layer.scaleUnit

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Closing the menu on selection keeps the canvas clear for whatever the
  // command is about to do (place a label, open a dialog, start a measure).
  const run = (fn: () => void) => () => { setMenuOpen(false); fn() }

  return (
    <div className={cn('pointer-events-auto flex items-center gap-0.5 p-1', FLOAT_PANEL)}>
      <ToolButton icon={Plus} label="Location" title="Add a location marker" onClick={onAddLocation} />
      <ToolButton
        icon={Type}
        label="Label"
        title="Place a text label on the map"
        active={annotateMode}
        onClick={onToggleAnnotate}
      />

      {/* Measure earns a spot only once the map has a scale to measure against. */}
      {hasScale && (
        <ToolButton
          icon={Route}
          label={measureMode ? 'Measuring' : 'Measure'}
          title="Measure distance between two points"
          active={measureMode}
          onClick={onToggleMeasure}
        />
      )}

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[hsl(var(--border))]" />

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Map tools"
          aria-expanded={menuOpen}
          title="More map tools"
          className={cn(
            'flex items-center rounded-md px-1.5 py-1.5 transition-colors',
            menuOpen
              ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className={cn('absolute right-0 top-full z-[1200] mt-1 min-w-[190px] py-1', FLOAT_PANEL)}>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Scale
              </span>
              {hasScale && (
                <button
                  onClick={run(onClearScale)}
                  title="Clear scale"
                  className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <MenuItem
              icon={Ruler}
              label={hasScale ? `Recalibrate (1 ${layer.scaleUnit} = ${Math.round(layer.scalePixelsPerUnit!)} px)` : 'Set map scale'}
              active={scaleMode}
              onClick={run(onToggleScale)}
            />
            {!hasScale && (
              <MenuItem
                icon={Route}
                label="Measure distance"
                hint="Set a map scale first to enable distance measurement"
                disabled
                onClick={() => {}}
              />
            )}

            <div className="mt-1 border-t border-[hsl(var(--border))] px-3 pb-1 pt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                This map
              </span>
            </div>
            <MenuItem icon={Layers} label="Add level" hint="Add a floor/level to this map" onClick={run(onAddLevel)} />
            <MenuItem icon={ImageUp} label="Replace image" hint="Replace this map's image, keeping its locations" onClick={run(onReplaceImage)} />
            <MenuItem icon={Download} label="Export as PNG" onClick={run(onExport)} />

            <div className="mt-1 border-t border-[hsl(var(--border))] px-3 pb-1 pt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                AI
              </span>
            </div>
            <MenuItem icon={Sparkles} label="AI Locations" hint="Generate a tree of locations with AI" onClick={run(onGenerateLocations)} />
            <MenuItem icon={Sparkles} label="AI Moves" hint="Extract location moves from prose with AI" onClick={run(onAIMoves)} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Map identity, floated top-left. Replaces the old header row's name/scale
 * block — the sidebar already highlights the active layer, so this stays small.
 */
export function MapInfoChip({
  layer, onOpenPanels,
}: {
  layer: MapLayer
  onOpenPanels: () => void
}) {
  const hasScale = !!layer.scalePixelsPerUnit && !!layer.scaleUnit
  return (
    <div className={cn('pointer-events-auto flex items-center gap-2 py-1 pl-1 pr-2.5', FLOAT_PANEL)}>
      <button
        onClick={onOpenPanels}
        aria-label="Open map panels"
        title="Map panels"
        className="pw-tap flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] lg:hidden"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-[hsl(var(--foreground))]">{layer.name}</p>
        <p className="truncate text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">
          {hasScale
            ? `1 ${layer.scaleUnit} = ${Math.round(layer.scalePixelsPerUnit!)} px`
            : `${layer.imageWidth} × ${layer.imageHeight}`}
        </p>
      </div>
    </div>
  )
}
