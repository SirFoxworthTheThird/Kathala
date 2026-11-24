import { useState, useRef } from 'react'
import {
  Plus, Type, Ruler, Route, Sparkles, ImageUp, Layers, Download, Eraser,
  MoreHorizontal, PanelLeft,
} from 'lucide-react'
import type { MapLayer } from '@/types'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { cn } from '@/lib/utils'
import { useMenuKeyboard } from '@/components/ui/useMenuKeyboard'
import { scaleLabel } from '@/lib/mapScale'

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
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors focus-visible:bg-[hsl(var(--muted))] focus-visible:outline-none',
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
  // A reader still gets the two commands that read the map — measuring a
  // journey and exporting the picture. Everything else here changes the map.
  const authoring = !useGate().active

  // The menu to the keyboard (UX-3-5): it ignored Escape and the arrows, and did not take focus.
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const keys = useMenuKeyboard({ open: menuOpen, setOpen: setMenuOpen, rootRef: menuRef, triggerRef, popupRef })

  // Closing the menu on selection keeps the canvas clear for whatever the
  // command is about to do (place a label, open a dialog, start a measure).
  const run = (fn: () => void) => () => { keys.close(); fn() }

  return (
    <div className={cn('pointer-events-auto flex items-center gap-0.5 p-1', FLOAT_PANEL)}>
      {authoring && (
        <>
          <ToolButton icon={Plus} label="Location" title="Add a location marker" onClick={onAddLocation} />
          <ToolButton
            icon={Type}
            label="Label"
            title="Place a text label on the map"
            active={annotateMode}
            onClick={onToggleAnnotate}
          />
        </>
      )}

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

      {(authoring || hasScale) && (
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[hsl(var(--border))]" />
      )}

      <div ref={menuRef} className="relative">
        <button
          ref={triggerRef}
          onClick={() => setMenuOpen((v) => !v)}
          onKeyDown={keys.onTriggerKeyDown}
          aria-label="Map tools"
          aria-haspopup="menu"
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
          <div ref={popupRef} role="menu" aria-label="Map tools" onKeyDown={keys.onPopupKeyDown} className={cn('absolute right-0 top-full z-[1200] mt-1 min-w-[190px] py-1', FLOAT_PANEL)}>
            {authoring && (
              <>
                <div className="px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Scale
                  </span>
                </div>
                <MenuItem
                  icon={Ruler}
                  label={hasScale ? `Recalibrate (${scaleLabel(layer.scalePixelsPerUnit!, layer.scaleUnit!)})` : 'Set map scale'}
                  active={scaleMode}
                  onClick={run(onToggleScale)}
                />
                {/*
                  An item with its name, under Recalibrate (UX-3-5). It was a
                  12px ✕ in the menu's top corner, where a menu's close button
                  goes, named only by its title, and one click lost the
                  calibration with no word and no undo. It goes through the
                  journal now, and says so.
                */}
                {hasScale && (
                  <MenuItem icon={Eraser} label="Clear scale" onClick={run(onClearScale)} />
                )}
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
              </>
            )}
            <MenuItem icon={Download} label="Export as PNG" onClick={run(onExport)} />

            {authoring && (
              <>
                <div className="mt-1 border-t border-[hsl(var(--border))] px-3 pb-1 pt-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    AI
                  </span>
                </div>
                <MenuItem icon={Sparkles} label="AI Locations" hint="Generate a tree of locations with AI" onClick={run(onGenerateLocations)} />
                <MenuItem icon={Sparkles} label="AI Moves" hint="Extract location moves from prose with AI" onClick={run(onAIMoves)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The drawer handle for the map's side panels, floated top-left on phones.
 *
 * Which layer is open and its scale live in the TopBar breadcrumb on `lg`+, so
 * nothing but this button needs to sit on the canvas; below `lg` the breadcrumb
 * is hidden and the sidebar drawer carries the layer name instead.
 */
export function MapInfoChip({ onOpenPanels }: { onOpenPanels: () => void }) {
  return (
    <div className={cn('pointer-events-auto p-1 lg:hidden', FLOAT_PANEL)}>
      <button
        onClick={onOpenPanels}
        aria-label="Open map panels"
        title="Map panels"
        className="pw-tap flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
