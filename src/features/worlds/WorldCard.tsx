import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Globe, Download, Loader2, ChevronDown, Files } from 'lucide-react'
import type { World } from '@/types'
import { Button } from '@/components/ui/button'
import { deleteWorld } from '@/db/hooks/useWorlds'
import { exportWorld, exportWorldSplit } from '@/lib/exportImport'

interface WorldCardProps {
  world: World
}

export function WorldCard({ world }: WorldCardProps) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the export dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`Delete "${world.name}" and all its data? This cannot be undone.`)) {
      await deleteWorld(world.id)
    }
  }

  async function handleExport(fn: (id: string) => Promise<void>) {
    setMenuOpen(false)
    setExporting(true)
    try {
      await fn(world.id)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      onClick={() => navigate(`/worlds/${world.id}`)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-[hsl(var(--muted))] p-2">
            <Globe className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </div>
          <div>
            <h3 className="font-semibold text-[hsl(var(--foreground))]">{world.name}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {new Date(world.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Export split-button */}
          <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-6 rounded-r-none hover:text-blue-400"
                onClick={() => handleExport(exportWorld)}
                disabled={exporting}
                title="Export world (single file)"
              >
                {exporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-4 rounded-l-none border-l border-[hsl(var(--border))] px-0 hover:text-blue-400"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={exporting}
                title="More export options"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                  onClick={() => handleExport(exportWorld)}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>Single file</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                  onClick={() => handleExport(exportWorldSplit)}
                >
                  <Files className="h-3.5 w-3.5 shrink-0" />
                  <div>
                    <div>Split into .pwk + .pwb</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">data file + images file</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-red-400"
            onClick={handleDelete}
            title="Delete world"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {world.description && (
        <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
          {world.description}
        </p>
      )}
    </div>
  )
}
