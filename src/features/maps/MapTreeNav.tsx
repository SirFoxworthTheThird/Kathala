import { useState } from 'react'
import { ChevronRight, ChevronDown, Map, MapPin, Trash2 } from 'lucide-react'
import { useMapLayers, deleteMapLayer } from '@/db/hooks/useMapLayers'
import { useAppStore, useMapLayerHistory } from '@/store'
import type { MapLayer } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface TreeNodeProps {
  layer: MapLayer
  allLayers: MapLayer[]
  activeLayerId: string | null
  depth: number
  onSelect: (id: string) => void
  onDeleted: (id: string) => void
}

function TreeNode({ layer, allLayers, activeLayerId, depth, onSelect, onDeleted }: TreeNodeProps) {
  const children = allLayers.filter((l) => l.parentMapId === layer.id)
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = layer.id === activeLayerId
  const childCount = allLayers.filter((l) => l.parentMapId === layer.id).length

  async function handleDelete() {
    await deleteMapLayer(layer.id)
    onDeleted(layer.id)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer select-none transition-colors ${
          isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(layer.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children.length > 0 ? (
          <button
            className="shrink-0 p-0"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {open
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <MapPin className="h-3 w-3 shrink-0 opacity-50" />
        )}
        {depth === 0 && <Map className="h-3 w-3 shrink-0" />}
        <span className="text-xs truncate flex-1">{layer.name}</span>
        {hovered && (
          <button
            className="shrink-0 p-0.5 rounded hover:text-red-400 transition-colors"
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
        <TreeNode
          key={child.id}
          layer={child}
          allLayers={allLayers}
          activeLayerId={activeLayerId}
          depth={depth + 1}
          onSelect={onSelect}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}

interface MapTreeNavProps {
  worldId: string
}

export function MapTreeNav({ worldId }: MapTreeNavProps) {
  const allLayers = useMapLayers(worldId)
  const history = useMapLayerHistory()
  const { resetMapHistory, setActiveMapLayerId } = useAppStore()
  const activeLayerId = history[history.length - 1] ?? null

  const roots = allLayers.filter((l) => l.parentMapId === null)

  function handleSelect(id: string) {
    resetMapHistory(id)
  }

  function handleDeleted(deletedId: string) {
    // If the deleted layer (or an ancestor of it) was active, navigate to first remaining root
    if (history.includes(deletedId)) {
      const remaining = allLayers.filter((l) => l.id !== deletedId && l.parentMapId === null)
      if (remaining.length > 0) {
        resetMapHistory(remaining[0].id)
      } else {
        setActiveMapLayerId('')
      }
    }
  }

  if (roots.length === 0) return null

  return (
    <div className="flex w-48 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="border-b border-[hsl(var(--border))] px-3 py-2">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Maps</p>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {roots.map((root) => (
          <TreeNode
            key={root.id}
            layer={root}
            allLayers={allLayers}
            activeLayerId={activeLayerId}
            depth={0}
            onSelect={handleSelect}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  )
}
