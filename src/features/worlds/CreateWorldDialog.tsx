import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createWorld } from '@/db/hooks/useWorlds'

interface CreateWorldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (worldId: string) => void
}

export function CreateWorldDialog({ open, onOpenChange, onCreated }: CreateWorldDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const world = await createWorld({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
      onOpenChange(false)
      onCreated?.(world.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create world')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New World</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="world-name">Name</Label>
            <Input
              id="world-name"
              placeholder="e.g. The Shattered Realms"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="world-desc">Description</Label>
            <Textarea
              id="world-desc"
              placeholder="A brief description of this world or story..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Creating...' : 'Create World'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
