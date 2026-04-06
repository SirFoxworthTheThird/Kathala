import { useState, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  chapterId: string
  timelineId: string
  nextSortOrder: number
}

export function AddEventDialog({ open, onOpenChange, worldId, chapterId, timelineId, nextSortOrder }: AddEventDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [involvedIds, setInvolvedIds] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const characters = useCharacters(worldId)
  const availableChars = characters.filter((c) => !involvedIds.includes(c.id))
  const selectedChars = characters.filter((c) => involvedIds.includes(c.id))

  function addCharacter(id: string) {
    if (!involvedIds.includes(id)) setInvolvedIds((prev) => [...prev, id])
  }

  function removeCharacter(id: string) {
    setInvolvedIds((prev) => prev.filter((x) => x !== id))
  }

  function commitTag() {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag])
    setTagInput('')
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitTag() }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  function reset() {
    setTitle('')
    setDescription('')
    setInvolvedIds([])
    setTags([])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await createEvent({
      worldId,
      chapterId,
      timelineId,
      title: title.trim(),
      description: description.trim(),
      locationMarkerId: null,
      involvedCharacterIds: involvedIds,
      involvedItemIds: [],
      tags,
      sortOrder: nextSortOrder,
    })
    setSaving(false)
    reset()
    onOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea placeholder="What happened..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {characters.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Characters involved</Label>
              {selectedChars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {selectedChars.map((c) => (
                    <span key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs">
                      {c.name}
                      <button type="button" onClick={() => removeCharacter(c.id)} className="hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableChars.length > 0 && (
                <Select onValueChange={addCharacter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Add character…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChars.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 min-h-[2.25rem] cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs">
                  #{tag}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                placeholder={tags.length === 0 ? 'battle, revelation… (Enter to add)' : ''}
                className="flex-1 min-w-[10rem] bg-transparent text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? 'Saving...' : 'Add Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
