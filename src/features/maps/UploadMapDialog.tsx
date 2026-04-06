import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { storeBlob } from '@/db/hooks/useBlobs'
import { createMapLayer } from '@/db/hooks/useMapLayers'

interface UploadMapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  parentMapId?: string | null
  onCreated?: (layerId: string) => void
}

export function UploadMapDialog({ open, onOpenChange, worldId, parentMapId = null, onCreated }: UploadMapDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) return
    setSaving(true)
    const blob = await storeBlob(worldId, file)
    const layer = await createMapLayer({
      worldId,
      parentMapId,
      name: name.trim(),
      description: description.trim(),
      imageId: blob.id,
      imageWidth: blob.width,
      imageHeight: blob.height,
      scalePixelsPerUnit: null,
      scaleUnit: null,
    })
    setSaving(false)
    setName('')
    setDescription('')
    setFile(null)
    setPreview(null)
    onOpenChange(false)
    onCreated?.(layer.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{parentMapId ? 'Add Sub-Map' : 'Upload Map'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-6 transition-colors hover:border-[hsl(var(--ring))]"
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-40 rounded object-contain" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Click to upload map image</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">PNG, JPG, WebP</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="map-name">Map Name</Label>
            <Input
              id="map-name"
              placeholder="e.g. Continent of Velmoor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="map-desc">Description</Label>
            <Textarea
              id="map-desc"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!file || !name.trim() || saving}>
              {saving ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
