import { useState } from 'react'
import { updateMapLayer } from '@/db/hooks/useMapLayers'
import { formatDistance } from '@/lib/mapScale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const SCALE_UNITS = ['km', 'miles', 'leagues', 'days travel', 'furlongs', 'ft', 'meters']

export function SetScaleDialog({
  open, onOpenChange, pixelDistance, layerId, imageWidth,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pixelDistance: number
  layerId: string
  /** Used only to show what the entered scale would make the whole map. */
  imageWidth?: number
}) {
  const [value, setValue] = useState('100')
  const [unit, setUnit] = useState('km')

  /*
    What this scale would make the whole map.

    The bundled Fellowship map was calibrated at 1.94 px per km, which made
    Middle Earth 822 km across — about a fifth of what its own printed bar says,
    and in the wrong unit besides. Nothing on the way in would have shown that:
    "100 km between two points" looks perfectly reasonable on its own, and only
    the total gives it away.
  */
  const entered = parseFloat(value)
  const extent = imageWidth && entered > 0 && pixelDistance > 0
    ? formatDistance(imageWidth, pixelDistance / entered, unit)
    : null

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
          {extent && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              That makes the whole map <span className="font-semibold text-[hsl(var(--foreground))]">{extent}</span> across.
              If the artwork carries its own scale bar, this is the number to check it against.
            </p>
          )}
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="scale-distance">Distance</Label>
              <Input
                id="scale-distance"
                type="number"
                min="0.1"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5 w-36">
              <Label htmlFor="scale-unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="scale-unit" aria-label="Unit"><SelectValue /></SelectTrigger>
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
