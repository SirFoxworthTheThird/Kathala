import { useState, type DragEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useBlobUrl } from '@/db/hooks/useBlobs'
import { attachResearch, reorderResearch, useResearchItems } from '@/db/hooks/useResearch'
import { isAttached, isImage, moved } from '@/lib/research'
import type { ResearchItem, ResearchLink } from '@/types'
import { AddResearchDialog } from './AddResearchDialog'
import { ResearchCard } from './ResearchCard'
import { useOpenResearch } from './useOpenResearch'
import { useResearchTargets } from './useResearchNames'

/*
  A scene's, place's, character's or item's research (issue #700): its images
  as a mood board (D-1), dragged into order, and everything attached to it,
  with the means to add more or attach what is already kept. The writer's: in
  reading mode there is nothing here (D-6).
*/

function BoardTile({ item, onOpen, onDrop, onDragStart }: {
  item: ResearchItem
  onOpen: () => void
  onDragStart: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}) {
  const url = useBlobUrl(item.blobId ?? null)
  return (
    <li draggable onDragStart={onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} data-board-tile={item.title}
      className="group relative aspect-[4/3] overflow-hidden rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
      <button type="button" className="h-full w-full" onClick={onOpen} aria-label={`Open ${item.title}`}>
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{item.title}</span>
    </li>
  )
}

export function ResearchPanel({ bookId, here, hereLabel }: {
  bookId: string
  here: ResearchLink
  /** What `here` is called: *the quay*, *Ch. 2 — The Ford*. */
  hereLabel: string
}) {
  const gate = useGate()
  const all = useResearchItems(bookId)
  const targets = useResearchTargets(bookId)
  const { open, problem, lightbox } = useOpenResearch()
  const [adding, setAdding] = useState(false)
  const [dragged, setDragged] = useState<string | null>(null)
  if (gate.active) return null

  const mine = all.filter((i) => isAttached(i, here))
  const board = mine.filter((i) => i.kind === 'file' && isImage(i.mimeType))
  const others = all.filter((i) => !isAttached(i, here))

  function drop(onto: string) {
    if (!dragged || dragged === onto) return
    const to = board.findIndex((i) => i.id === onto)
    void reorderResearch(moved(board, dragged, to).map((i) => i.id))
    setDragged(null)
  }

  return (
    <section aria-label="Research" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Research</h3>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{mine.length}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {others.length > 0 && (
            <div className="w-44">
              <Select value="" onValueChange={(id) => void attachResearch(id, here)}>
                <SelectTrigger className="h-7 text-xs" aria-label="Attach research you have…"><SelectValue placeholder="Attach research you have…" /></SelectTrigger>
                <SelectContent>{others.map((i) => <SelectItem key={i.id} value={i.id} className="text-xs">{i.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" aria-hidden="true" /> Add research
          </Button>
        </div>
      </div>
      {problem && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{problem}</p>}
      {board.length > 0 && (
        <ul aria-label="Mood board" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {board.map((i) => (
            <BoardTile key={i.id} item={i} onOpen={() => void open(i)} onDragStart={() => setDragged(i.id)} onDrop={() => drop(i.id)} />
          ))}
        </ul>
      )}
      {mine.length === 0 ? (
        <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No research on {hereLabel} yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((i) => <ResearchCard key={i.id} item={i} targets={targets.all} label={targets.label} onOpen={(x) => void open(x)} here={here} />)}
        </div>
      )}
      <AddResearchDialog open={adding} onOpenChange={setAdding} worldId={bookId} attachTo={here} attachLabel={hereLabel} />
      {lightbox}
    </section>
  )
}
