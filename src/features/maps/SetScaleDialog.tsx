import { useState } from 'react'
import { updateMapLayer } from '@/db/hooks/useMapLayers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const SCALE_UNITS = ['km', 'miles', 'leagues', 'days travel', 'furlongs', 'ft', 'meters']

export function SetScaleDialog({
  open, onOpenChange, pixelDistance, layerId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pixelDistance: number
  layerId: string
}) {
  const [value, setValue] = useState('100')
  const [unit, setUnit] = useState('km')

  async function handleSave() {
    const dist = parseFloat(value)
    if (!dist || dist <= 0) return
    await updateMapLayer(layerId, {
      scalePixelsPerUnit: pixelDistance / dist,
      scaleUnit: unit,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Map Scale</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The two points you selected are <span className="font-semibold text-[hsl(var(--foreground))]">{Math.round(pixelDistance)} px</span> apart. How far is that in the real world?
          </p>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Distance</Label>
              <Input
                type="number"
                min="0.1"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5 w-36">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCALE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!value || parseFloat(value) <= 0}>Save Scale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
