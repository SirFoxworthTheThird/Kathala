import { useState } from 'react'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useSeriesOf } from '@/db/hooks/useSeries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'

/*
  Reading mode in a series (issue #698, D-3): a reader of book two may not have
  read book one. They say so once, on opening a later book; until they do, and
  if they say they have, everyone and everything the earlier books met is known
  from this book's first page. Said not, this book hides them until it meets
  them itself, as a first book does.
*/

/** Whether a book asks: reading, in a series, after its first book. */
function asks(world: { readingMode?: boolean; seriesId?: string; seriesIndex?: number } | undefined): boolean {
  return !!world?.readingMode && !!world.seriesId && (world.seriesIndex ?? 0) > 1
}

/** The question, once, on opening a later book of a series in reading mode. */
export function EarlierBooksQuestion({ worldId }: { worldId: string | null }) {
  const world = useWorld(worldId)
  const series = useSeriesOf(worldId)
  const open = asks(world) && world?.readEarlierBooks === undefined && !!series
  if (!open || !world || !series) return null
  const answer = (readEarlierBooks: boolean) => void updateWorld(world.id, { readEarlierBooks })
  return (
    <Dialog open onOpenChange={(v) => { if (!v) answer(true) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Have you read the earlier books?</DialogTitle>
          <DialogDescription>
            “{world.name}” is book {world.seriesIndex} of {series.name}. If you have read the books before it, everyone and
            everything they met is shown from this book’s first page. If not, this book keeps them back until it meets them
            itself, so nothing from the earlier books gives their endings away. You can change this in Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => answer(false)}>Not yet</Button>
          <Button onClick={() => answer(true)}>I have read them</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The same answer, in reading mode's settings, for a later book of a series. */
export function EarlierBooksSetting({ worldId }: { worldId: string }) {
  const world = useWorld(worldId)
  // What was just ticked, shown at once: the record says so only once the write has come back.
  const [pending, setPending] = useState<boolean | null>(null)
  if (!asks(world) || !world) return null
  const read = pending ?? world.readEarlierBooks !== false
  return (
    <div className="flex items-start gap-2 text-xs">
      <input
        id="read-earlier-books"
        type="checkbox"
        className="mt-0.5"
        checked={read}
        aria-describedby="read-earlier-books-hint"
        disabled={pending !== null}
        onChange={async (e) => {
          const to = e.target.checked
          setPending(to)
          try {
            await updateWorld(world.id, { readEarlierBooks: to })
          } finally {
            setPending(null)
          }
        }}
      />
      <div className="flex flex-col">
        <label htmlFor="read-earlier-books">I have read the earlier books</label>
        <span id="read-earlier-books-hint" className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {read
            ? 'Who and what the earlier books met are shown from the first page.'
            : 'This book keeps back who and what the earlier books met until it meets them itself.'}
        </span>
      </div>
    </div>
  )
}
