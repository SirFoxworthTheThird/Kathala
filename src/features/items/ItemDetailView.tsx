import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Check, X, Plus, Layers } from 'lucide-react'
import { useItem, updateItem, deleteItem } from '@/db/hooks/useItems'
import { storeBlob } from '@/db/hooks/useBlobs'
import { useCrossTimelineArtifactsForItem, createCrossTimelineArtifact, deleteCrossTimelineArtifact } from '@/db/hooks/useTimelineRelationships'
import { useTimelines } from '@/db/hooks/useTimeline'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package } from 'lucide-react'

export default function ItemDetailView() {
  const { worldId, itemId } = useParams<{ worldId: string; itemId: string }>()
  const navigate = useNavigate()
  const item = useItem(itemId ?? null)
  const artifacts = useCrossTimelineArtifactsForItem(itemId ?? null)
  const timelines = useTimelines(worldId ?? null)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconType, setIconType] = useState('')

  // Cross-timeline artifact form state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addingArtifact, setAddingArtifact] = useState(false)
  const [artifactOriginId, setArtifactOriginId] = useState('')
  const [artifactEncounterId, setArtifactEncounterId] = useState('')
  const [artifactNotes, setArtifactNotes] = useState('')

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Item not found.
      </div>
    )
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !worldId) return
    const blob = await storeBlob(worldId, file)
    await updateItem(item!.id, { imageId: blob.id })
  }

  async function handleDelete() {
    await deleteItem(item!.id)
    navigate(`/worlds/${worldId}/items`)
  }

  async function save() {
    await updateItem(item!.id, {
      name: name.trim(),
      description: description.trim(),
      iconType: iconType.trim(),
    })
    setEditing(false)
  }

  async function saveArtifact() {
    if (!worldId || !itemId || !artifactOriginId || !artifactEncounterId) return
    await createCrossTimelineArtifact({
      worldId,
      itemId,
      originTimelineId: artifactOriginId,
      encounterTimelineId: artifactEncounterId,
      encounterNotes: artifactNotes.trim(),
    })
    setAddingArtifact(false)
    setArtifactOriginId('')
    setArtifactEncounterId('')
    setArtifactNotes('')
  }

  function startEditing() {
    setName(item!.name)
    setDescription(item!.description)
    setIconType(item!.iconType)
    setEditing(true)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Image */}
        <div className="relative">
          <PortraitImage
            imageId={item.imageId}
            alt={item.name}
            className="h-12 w-12 rounded-md object-cover"
            fallbackClassName="h-12 w-12 rounded-md"
            fallbackIcon={Package}
          />
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[hsl(var(--accent))] p-1 hover:bg-[hsl(var(--secondary))]">
            <Upload className="h-3 w-3 text-[hsl(var(--foreground))]" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{item.name}</h2>
          {item.iconType && (
            <p className="text-xs capitalize text-[hsl(var(--muted-foreground))]">{item.iconType}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 hover:text-red-400"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${item.name}"?`}
        description="This will permanently remove the item and all its snapshots."
        onConfirm={handleDelete}
      />

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
        {!editing ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{item.name}</h3>
                {item.iconType && (
                  <p className="text-xs capitalize text-[hsl(var(--muted-foreground))]">{item.iconType}</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={startEditing}>
                Edit
              </Button>
            </div>
            {item.description ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">{item.description}</p>
            ) : (
              <p className="text-sm italic text-[hsl(var(--muted-foreground))]">No description.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type / Category</Label>
              <Input
                value={iconType}
                onChange={(e) => setIconType(e.target.value)}
                placeholder="e.g. weapon, artifact, key item"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={!name.trim()}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cross-timeline appearances */}
        {timelines.length >= 2 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Cross-Timeline Appearances
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 px-2 text-xs"
                onClick={() => setAddingArtifact((v) => !v)}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {addingArtifact && (
              <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Originates in</Label>
                  <Select value={artifactOriginId} onValueChange={setArtifactOriginId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Timeline…" />
                    </SelectTrigger>
                    <SelectContent>
                      {timelines.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Found / encountered in</Label>
                  <Select value={artifactEncounterId} onValueChange={setArtifactEncounterId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Timeline…" />
                    </SelectTrigger>
                    <SelectContent>
                      {timelines.filter((t) => t.id !== artifactOriginId).map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Encounter notes</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder='e.g. "found in archive box 14"'
                    value={artifactNotes}
                    onChange={(e) => setArtifactNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={saveArtifact}
                    disabled={!artifactOriginId || !artifactEncounterId || artifactOriginId === artifactEncounterId}
                  >
                    <Check className="h-3 w-3" /> Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setAddingArtifact(false)}>
                    <X className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            )}

            {artifacts.length === 0 && !addingArtifact && (
              <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
                No cross-timeline appearances recorded.
              </p>
            )}

            {artifacts.map((artifact) => {
              const origin = timelines.find((t) => t.id === artifact.originTimelineId)
              const encounter = timelines.find((t) => t.id === artifact.encounterTimelineId)
              return (
                <div
                  key={artifact.id}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                      {origin?.name ?? '?'} → {encounter?.name ?? '?'}
                    </p>
                    {artifact.encounterNotes && (
                      <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))] italic">{artifact.encounterNotes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteCrossTimelineArtifact(artifact.id)}
                    className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
