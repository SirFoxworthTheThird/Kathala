import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createChapter } from '@/db/hooks/useTimeline'

interface AddChapterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  timelineId: string
  nextNumber: number
  onCreated?: (chapterId: string) => void
}

export function AddChapterDialog({
  open, onOpenChange, worldId, timelineId, nextNumber, onCreated,
}: AddChapterDialogProps) {
  const [title, setTitle] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const ch = await createChapter({ worldId, timelineId, number: nextNumber, title: title.trim(), synopsis: synopsis.trim() })
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
          <DialogTitle>Add Chapter {nextNumber}</DialogTitle>
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
            <Label htmlFor="chapter-synopsis">Synopsis</Label>
            <Textarea id="chapter-synopsis" placeholder="Brief synopsis..." value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? 'Saving...' : 'Add Chapter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
