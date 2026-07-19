import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import type { MapLayer } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'

/**
 * Vertical floor selector pinned to the map's right edge. Floors are stacked
 * bottom-to-top like a real building (top floor first), the current one is
 * highlighted, and a "+" adds another level. Each floor can be renamed inline
 * (double-click or the pencil) or removed.
 */
export function FloorSwitcher({
  floors,
  activeId,
  onSwitch,
  onAddLevel,
  onDeleteFloor,
  onRenameFloor,
}: {
  /** Floors in the group, ordered bottom → top (lowest levelIndex first). */
  floors: MapLayer[]
  activeId: string
  onSwitch: (id: string) => void
  onAddLevel: () => void
  onDeleteFloor: (id: string) => void
  onRenameFloor: (id: string, label: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const confirmFloor = confirmId ? floors.find((f) => f.id === confirmId) : null

  function startEdit(f: MapLayer) {
    setEditingId(f.id)
    setDraft(f.levelLabel || '')
  }
  function commitEdit() {
    if (editingId) onRenameFloor(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className="pointer-events-none absolute right-2 top-1/2 z-[1000] -translate-y-1/2">
      <div className="pointer-events-auto flex flex-col items-stretch gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-1 shadow-lg backdrop-blur-sm">
        <button
          onClick={onAddLevel}
          title="Add a level above"
          className="flex items-center justify-center rounded-md px-2 py-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {/* Top floor first. */}
        {[...floors].reverse().map((f) => {
          const active = f.id === activeId
          if (editingId === f.id) {
            return (
              <input
                key={f.id}
                autoFocus
                aria-label="Rename level"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  else if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-[9rem] rounded-md border border-[hsl(var(--ring))] bg-[hsl(var(--background))] px-1.5 py-1 text-[11px] text-[hsl(var(--foreground))] focus:outline-none"
              />
            )
          }
          return (
            <div key={f.id} className="group/floor relative">
              <button
                onClick={() => onSwitch(f.id)}
                onDoubleClick={() => startEdit(f)}
                title={`${f.levelLabel || 'Level'} — double-click to rename`}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full min-w-[4rem] max-w-[9rem] items-center rounded-md py-1 pl-2 pr-10 text-left text-[11px] transition-colors ${
                  active
                    ? 'bg-[hsl(var(--ring))] font-medium text-[hsl(var(--background))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <span className="flex-1 truncate">{f.levelLabel || 'Level'}</span>
              </button>
              <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover/floor:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(f) }}
                  title="Rename this level"
                  className={`rounded p-0.5 ${active ? 'text-[hsl(var(--background))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {floors.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmId(f.id) }}
                    title="Delete this level"
                    className={`rounded p-0.5 ${active ? 'text-[hsl(var(--background))]' : 'text-[hsl(var(--muted-foreground))] hover:text-red-400'}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => { if (!v) setConfirmId(null) }}
        title={`Delete "${confirmFloor?.levelLabel || 'this level'}"?`}
        description="This removes the level's image and all locations on it. This cannot be undone."
        onConfirm={() => { if (confirmId) onDeleteFloor(confirmId); setConfirmId(null) }}
      />
    </div>
  )
}
