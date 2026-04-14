import { useState } from 'react'
import { Plus, Trash2, Pencil, Network } from 'lucide-react'
import type { Character } from '@/types'
import { useCharacterRelationships, createRelationship, updateRelationship, deleteRelationship } from '@/db/hooks/useRelationships'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useActiveEventId } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { RelationshipStrength, RelationshipSentiment } from '@/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'

const SENTIMENT_COLORS: Record<RelationshipSentiment, string> = {
  positive: 'text-green-400',
  neutral: 'text-[hsl(var(--muted-foreground))]',
  negative: 'text-red-400',
  complex: 'text-yellow-400',
}

import type { Relationship } from '@/types'

interface RelationshipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  character: Character
  otherCharacters: Character[]
  startEventId: string | null
  startChapterLabel: string | null
  /** When set, the dialog is in edit mode for this relationship */
  editing?: Relationship
}

function RelationshipDialog({ open, onOpenChange, character, otherCharacters, startEventId, startChapterLabel, editing }: RelationshipDialogProps) {
  const [targetId, setTargetId] = useState(editing?.characterAId === character.id ? (editing?.characterBId ?? '') : (editing?.characterAId ?? ''))
  const [label, setLabel] = useState(editing?.label ?? '')
  const [strength, setStrength] = useState<RelationshipStrength>(editing?.strength ?? 'moderate')
  const [sentiment, setSentiment] = useState<RelationshipSentiment>(editing?.sentiment ?? 'neutral')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [saving, setSaving] = useState(false)

  // Reset fields when dialog opens for a different relationship
  const key = editing?.id ?? 'new'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    if (editing) {
      await updateRelationship(editing.id, { label: label.trim(), strength, sentiment, description })
    } else {
      if (!targetId) return
      await createRelationship({
        worldId: character.worldId,
        characterAId: character.id,
        characterBId: targetId,
        label: label.trim(),
        strength,
        sentiment,
        description,
        isBidirectional: true,
        startEventId,
      })
    }
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={key}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Relationship' : 'Add Relationship'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!editing && (
            <div className="flex flex-col gap-1.5">
              <Label>With Character</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Select character..." /></SelectTrigger>
                <SelectContent>
                  {otherCharacters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Relationship Label</Label>
            <Input placeholder="e.g. mentor, rival, sibling" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus={!!editing} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Strength</Label>
              <Select value={strength} onValueChange={(v) => setStrength(v as RelationshipStrength)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['weak', 'moderate', 'strong', 'bond'] as RelationshipStrength[]).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sentiment</Label>
              <Select value={sentiment} onValueChange={(v) => setSentiment(v as RelationshipSentiment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['positive', 'neutral', 'negative', 'complex'] as RelationshipSentiment[]).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {!editing && startChapterLabel && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              This relationship will start at <span className="font-medium text-[hsl(var(--foreground))]">{startChapterLabel}</span> and won't appear in earlier chapters.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={(!editing && !targetId) || !label.trim() || saving}>
              {saving ? 'Saving...' : editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface RelationshipsTabProps {
  character: Character
}

export function RelationshipsTab({ character }: RelationshipsTabProps) {
  const relationships = useCharacterRelationships(character.id)
  const allChars = useCharacters(character.worldId)
  const allChapters = useWorldChapters(character.worldId)
  const allEvents = useWorldEvents(character.worldId)
  const activeEventId = useActiveEventId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRel, setEditingRel] = useState<Relationship | null>(null)

  const chapterById = new Map(allChapters.map((c) => [c.id, c]))
  const eventById = new Map(allEvents.map((e) => [e.id, e]))

  // Global ordering: position of an event across all timelines/chapters
  const globalOrder = (() => {
    const sorted = allEvents
      .map((e) => ({ id: e.id, chapterNum: chapterById.get(e.chapterId)?.number ?? 0, sort: e.sortOrder }))
      .sort((a, b) => a.chapterNum - b.chapterNum || a.sort - b.sort)
    const order = new Map(sorted.map((e, i) => [e.id, i]))
    return (id: string) => order.get(id) ?? -1
  })()

  const activeOrder = activeEventId ? globalOrder(activeEventId) : null
  const activeEvent = activeEventId ? eventById.get(activeEventId) : undefined
  const activeChapter = activeEvent ? chapterById.get(activeEvent.chapterId) : undefined

  const otherChars = allChars.filter((c) => c.id !== character.id)

  const visibleRelationships = activeOrder === null
    ? relationships
    : relationships.filter((r) => {
        if (!r.startEventId) return true
        const startOrder = globalOrder(r.startEventId)
        return startOrder === -1 || activeOrder >= startOrder
      })

  const startChapterLabel = activeChapter
    ? `Ch. ${activeChapter.number} — ${activeChapter.title}${activeEvent ? ` / ${activeEvent.title}` : ''}`
    : null

  function getOtherChar(rel: typeof relationships[0]) {
    const otherId = rel.characterAId === character.id ? rel.characterBId : rel.characterAId
    return allChars.find((c) => c.id === otherId)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={otherChars.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Add Relationship
        </Button>
      </div>

      {visibleRelationships.length === 0 ? (
        <EmptyState
          icon={Network}
          title={activeEventId ? 'No relationships at this point' : 'No relationships yet'}
          description={activeEventId ? 'No relationship states recorded up to this event.' : 'Add a relationship to start tracking connections between characters.'}
          className="py-4"
        />
      ) : (
        visibleRelationships.map((rel) => {
          const other = getOtherChar(rel)
          const startEvent = rel.startEventId ? eventById.get(rel.startEventId) : undefined
          const startCh = startEvent ? chapterById.get(startEvent.chapterId) : undefined
          return (
            <div key={rel.id} className="flex items-start justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{other?.name ?? 'Unknown'}</span>
                  <span className={cn('text-xs capitalize font-medium', SENTIMENT_COLORS[rel.sentiment])}>
                    {rel.label}
                  </span>
                  {startCh && (
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded px-1">
                      from Ch. {startCh.number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize mt-0.5">
                  {rel.strength} · {rel.sentiment}
                </p>
                {rel.description && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{rel.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditingRel(rel)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-red-400"
                  onClick={() => deleteRelationship(rel.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })
      )}

      <RelationshipDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        character={character}
        otherCharacters={otherChars}
        startEventId={activeEventId}
        startChapterLabel={startChapterLabel}
      />
      {editingRel && (
        <RelationshipDialog
          open
          onOpenChange={(open) => { if (!open) setEditingRel(null) }}
          character={character}
          otherCharacters={otherChars}
          startEventId={activeEventId}
          startChapterLabel={startChapterLabel}
          editing={editingRel}
        />
      )}
    </div>
  )
}
