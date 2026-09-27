import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createChapterAt } from '@/db/hooks/useTimeline'
import {
  describeShift, nextChapterNumber, parseChapterNumber, planChapterInsert, type NumberedChapter,
} from '@/lib/chapterNumbering'

interface AddChapterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  timelineId: string
  /** This timeline's chapters — for the suggestion, and to say who moves. */
  chapters: readonly NumberedChapter[]
  onCreated?: (chapterId: string) => void
}

export function AddChapterDialog({
  open, onOpenChange, worldId, timelineId, chapters, onCreated,
}: AddChapterDialogProps) {
  const [title, setTitle] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [saving, setSaving] = useState(false)
  /*
    The number is the writer's to choose, and the next free one is suggested.
    It was fixed at one past the *count*, which after a deletion is a number
    still in use — and there was no way to put a chapter anywhere but the end.
  */
  const suggested = nextChapterNumber(chapters)
  const [numberText, setNumberText] = useState(String(suggested))
  useEffect(() => { if (open) setNumberText(String(suggested)) }, [open])  // eslint-disable-line react-hooks/exhaustive-deps
  const number = parseChapterNumber(numberText)
  const moves = number === null ? '' : describeShift(planChapterInsert(chapters, number))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || number === null) return
    setSaving(true)
    const ch = await createChapterAt({ worldId, timelineId, number, title: title.trim(), synopsis: synopsis.trim() })
    setSaving(false)
    setTitle('')
    setSynopsis('')
    onOpenChange(false)
    onCreated?.(ch.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Chapter</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/*
            WRUN-9: `htmlFor`/`id`, so the field carries its label rather than
            sitting next to it. A placeholder is not a name — it disappears the
            moment you type — and this is the first dialog a new writer meets.
          */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chapter-title">Title</Label>
            <Input id="chapter-title" placeholder="Chapter title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chapter-number">Number</Label>
            <Input
              id="chapter-number"
              inputMode="numeric"
              className="w-24"
              value={numberText}
              onChange={(e) => setNumberText(e.target.value)}
              aria-describedby="chapter-number-note"
              aria-invalid={number === null}
            />
            {/*
              Said before anything is written. A taken number is not an error —
              it is how a chapter goes in between two others — but the writer
              should know what moves before it does.
            */}
            <p id="chapter-number-note" className="text-xs text-[hsl(var(--muted-foreground))]">
              {number === null
                ? 'A whole number — 0 for a prologue.'
                : moves
                  ? `Goes in at ${number}. ${moves}.`
                  : number === suggested
                    ? 'The next free number.'
                    : `Goes in at ${number}.`}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chapter-synopsis">Synopsis</Label>
            <Textarea id="chapter-synopsis" placeholder="Brief synopsis..." value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || number === null || saving}>
              {saving ? 'Saving...' : 'Add Chapter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
