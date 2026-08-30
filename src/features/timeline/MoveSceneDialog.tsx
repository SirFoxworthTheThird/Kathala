import { useMemo, useState } from 'react'
import { FolderInput } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useChapters, bulkMoveEvents } from '@/db/hooks/useTimeline'

/**
 * Move one scene to another chapter, from the scene's own menu.
 *
 * N13, from a blind writer run: the scene's ⋯ menu contained exactly one item,
 * *Delete scene*. The capability existed in two other places — dragging on the
 * Corkboard, and *Move to chapter* in the Timeline's bulk-selection toolbar —
 * and the drag works well. But the menu a writer opens first had one item and
 * that item was destructive.
 *
 * The chapter list is the app's filterable picker rather than a plain one: a
 * 117-chapter book is the case this is for, and it is the same control the
 * Structure board's scene picker uses (N8).
 */
export function MoveSceneDialog({
  open, onOpenChange, eventId, timelineId, currentChapterId, sceneName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  timelineId: string
  currentChapterId: string
  sceneName: string
}) {
  const chapters = useChapters(timelineId)
  const [target, setTarget] = useState('')

  // The chapter it is already in is not a move, so it is not on offer.
  const options = useMemo(
    () => [...chapters]
      .filter((c) => c.id !== currentChapterId)
      .sort((a, b) => a.number - b.number),
    [chapters, currentChapterId],
  )

  async function handleMove() {
    if (!target) return
    await bulkMoveEvents([eventId], target)
    onOpenChange(false)
    setTarget('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move “{sceneName}”</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            There is nowhere to move this scene — the timeline has only this chapter.
            Add another chapter first.
          </p>
        ) : (
          <Field label="Move to chapter">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a chapter…" />
              </SelectTrigger>
              <SelectContent filterPlaceholder="Filter chapters…" emptyLabel="No chapter matches">
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Ch. {c.number} — {c.title || 'Untitled'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {options.length > 0 && (
            <Button onClick={() => { void handleMove() }} disabled={!target} className="gap-1.5">
              <FolderInput className="h-3.5 w-3.5" aria-hidden="true" /> Move scene
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
