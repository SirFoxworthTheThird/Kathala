import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BlockingReason } from '@/components/BlockingReason'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'
import type { LocationIconType, LocationMarker } from '@/types'

const ICON_TYPES: { value: LocationIconType; label: string }[] = [
  { value: 'city', label: 'City' },
  { value: 'town', label: 'Town' },
  { value: 'dungeon', label: 'Dungeon' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'building', label: 'Building' },
  { value: 'region', label: 'Region' },
  { value: 'custom', label: 'Custom' },
]

interface AddLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  mapLayerId: string
  position: { x: number; y: number }
  subtitle?: string
  onCreated?: (marker: LocationMarker) => void
}

export function AddLocationDialog({
  open, onOpenChange, worldId, mapLayerId, position, subtitle, onCreated,
}: AddLocationDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconType, setIconType] = useState<LocationIconType>('city')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const marker = await createLocationMarker({
      worldId,
      mapLayerId,
      name: name.trim(),
      description: description.trim(),
      x: position.x,
      y: position.y,
      iconType,
    })
    setSaving(false)
    setName('')
    setDescription('')
    setIconType('city')
    onOpenChange(false)
    onCreated?.(marker)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
          {subtitle && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={<>Name <span className="text-[hsl(var(--muted-foreground))]">(required)</span></>} className="flex flex-col gap-1.5">
            {/* OP-6: three fields, one of them required, and nothing said which. */}
            <Input
              placeholder="e.g. Thornwall City"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Type" className="flex flex-col gap-1.5">
            <Select value={iconType} onValueChange={(v) => setIconType(v as LocationIconType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" className="flex flex-col gap-1.5">
            <Textarea
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <DialogFooter className="items-center">
            <BlockingReason className="mr-auto" checks={[{ met: !!name.trim(), need: 'a name' }]} />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : 'Add Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
