import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Globe, Download, Loader2, ChevronDown, Files, BookCopy, BookMarked, Users } from 'lucide-react'
import type { World } from '@/types'
import { Button } from '@/components/ui/button'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { StartSequelDialog } from './StartSequelDialog'
import { deleteWorld } from '@/db/hooks/useWorlds'
import { useReadingProgress } from '@/db/hooks/useReading'
import { useWorldSummary } from '@/db/hooks/useWorldSummary'
import { worldActivity } from '@/lib/worldActivity'
import { exportWorld, exportWorldSplit } from '@/lib/exportImport'

/** A date a reader cannot misread: the month is named, not numbered (X-6). */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

interface WorldCardProps {
  world: World
}

export function WorldCard({ world }: WorldCardProps) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sequelOpen, setSequelOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const progress = useReadingProgress(world.id)
  const summary = useWorldSummary(world.id)
  const activity = worldActivity(world, summary.lastOperationAt)

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

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmOpen(true)
  }

  async function doDelete() {
    await deleteWorld(world.id)
  }

  async function handleExport(fn: (id: string, onProgress: (done: number, total: number) => void) => Promise<void>) {
    setMenuOpen(false)
    setExporting(true)
    setExportProgress(null)
    try {
      await fn(world.id, (done, total) => setExportProgress({ done, total }))
    } finally {
      setExporting(false)
      setExportProgress(null)
    }
  }

  return (
    <div
      onClick={() => navigate(`/worlds/${world.id}`)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <PortraitImage
            imageId={world.coverImageId}
            alt=""
            className="h-9 w-9 shrink-0 rounded-md bg-[hsl(var(--muted))] object-contain"
            fallbackClassName="h-9 w-9 shrink-0 rounded-md"
            fallbackIcon={Globe}
          />
          <div>
            <h3 className="font-semibold text-[hsl(var(--foreground))]">{world.name}</h3>
            {/*
              SEL-3 and X-6: this was a bare `4/1/2026` — created or edited?
              April or January? The month is named rather than numbered, and the
              line says which of the two it is. The counts are the other half:
              the card a writer sees a hundred times told them less about the
              world than the Library card they saw once.

              It now answers "which of these did I last touch", which is the
              question a returning writer with several worlds actually has — but
              only where it can. See `worldActivity`: the operation journal is
              what knows, and an imported world's journal is deliberately empty,
              so such a card goes on saying "Created" rather than printing a
              date the app cannot stand behind.
            */}
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {activity.label} {formatDate(activity.at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {/* Export split-button */}
          <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 rounded-r-none hover:text-blue-400 ${exporting && exportProgress ? 'w-12 px-1' : 'w-6'}`}
                onClick={() => handleExport(exportWorld)}
                disabled={exporting}
                title="Export world (single file)"
              >
                {exporting && exportProgress
                  ? <span className="text-[10px] tabular-nums">{exportProgress.done}/{exportProgress.total}</span>
                  : exporting
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
                // Not "More export options": this menu also starts a sequel,
                // and a name that advertises only exports is a menu a writer
                // has no reason to open unless they want to export.
                title="More actions"
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
                <div className="border-t border-[hsl(var(--border))]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                  onClick={() => { setMenuOpen(false); setSequelOpen(true) }}
                >
                  <BookCopy className="h-3.5 w-3.5 shrink-0" />
                  <div>
                    <div>Start a sequel</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">new book from this one</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/*
            HB-2a / LORE-1: `opacity-0` with pointer events still live hit-tests
            to itself, and this one deletes the world. On a touch device there
            is no hover, so the resting state is the only state and a tap on
            apparently blank card chrome reached it.

            The gate is on **this button alone**, not the cluster it sits in.
            Gating the whole row took Export with it, and a control that is
            merely hidden until wanted should not be hard to reach — only the
            destructive one is worth costing a deliberate hover. `importExport`
            caught that within one run.
          */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 pointer-events-none hover:text-red-400 group-hover:pointer-events-auto focus-visible:pointer-events-auto"
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

      {(summary.chapters > 0 || summary.characters > 0) && (
        <p className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <BookCopy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {summary.chapters} {summary.chapters === 1 ? 'chapter' : 'chapters'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {summary.characters} {summary.characters === 1 ? 'character' : 'characters'}
          </span>
        </p>
      )}

      {/*
        Where this book was left. Shown only for a world being read that has a
        real position — not for a draft, and not for a reader who asked to see
        all chapters, which is not a place in the book.
      */}
      {progress && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <BookMarked className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Chapter {progress.chapter} of {progress.total}</span>
          </div>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]"
            role="progressbar"
            aria-label={`Reading progress: chapter ${progress.chapter} of ${progress.total}`}
            aria-valuenow={progress.chapter}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full rounded-full bg-[hsl(var(--ring))]"
              style={{ width: `${Math.min(100, (progress.chapter / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${world.name}"?`}
        description="This will permanently delete the world and all its data. This cannot be undone."
        onConfirm={doDelete}
      />
      <div onClick={(e) => e.stopPropagation()}>
        <StartSequelDialog
          open={sequelOpen}
          onOpenChange={setSequelOpen}
          world={world}
          onCreated={(id) => navigate(`/worlds/${id}`)}
        />
      </div>
    </div>
  )
}
