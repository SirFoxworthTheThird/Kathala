import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTimeline } from '@/db/hooks/useTimeline'
import type { Timeline } from '@/types'

const TIMELINE_COLORS = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c']

interface NewTimelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  /** How many timelines the world has now — for the new one's colour. */
  count: number
  onCreated: (timeline: Timeline) => void
}

/**
 * A new timeline, named before it is made. **New Timeline** made "Timeline 4"
 * at once, so a stray click left a tab to rename or delete — writer run 10
 * did both.
 */
export function NewTimelineDialog({ open, onOpenChange, worldId, count, onCreated }: NewTimelineDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const timeline = await createTimeline({
        worldId, name: name.trim(), description: '', color: TIMELINE_COLORS[count % TIMELINE_COLORS.length],
      })
      setName('')
      onOpenChange(false)
      onCreated(timeline)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setName(''); onOpenChange(next) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New timeline</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-timeline-name">Timeline name</Label>
            <Input
              id="new-timeline-name"
              placeholder="e.g. The Mercy, 1 BL"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">It goes after the others; drag its tab to put it elsewhere.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving}>Add timeline</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
