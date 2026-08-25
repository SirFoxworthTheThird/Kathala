import { useMemo, useState } from 'react'
import { Heart, Skull, MapPin, ExternalLink, History } from 'lucide-react'
import { useResolvedCharacterSnapshot, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { draftFromSnapshot, isCarriedForward, quickStateWrite, type QuickStateDraft } from '@/lib/quickState'

/**
 * Record where somebody is, without leaving the chapter.
 *
 * The cost both blind writer runs named — seven interactions across three
 * screens to say where one character is in one scene — was not a bug anywhere;
 * it was that the panel which *knows* the state is missing could only send you
 * somewhere else to supply it. This is that panel taking the answer.
 *
 * Three questions, because they are the ones a writer walking down a scene's
 * cast is answering: are they alive, where are they, and is there anything to
 * note. Inventory, travel mode and coming back from the dead stay on the full
 * editor, which this still offers — a form that asked everything would be the
 * character page again, in a 320px column.
 */
export function RecordStateInline({
  worldId, characterId, characterName, eventId, onDone, onOpenFullEditor,
}: {
  worldId: string
  characterId: string
  characterName: string
  eventId: string
  onDone: () => void
  onOpenFullEditor: () => void
}) {
  const prev = useResolvedCharacterSnapshot(characterId, worldId, eventId)
  const markers = useAllLocationMarkers(worldId)
  const [draft, setDraft] = useState<QuickStateDraft | null>(null)
  const [saving, setSaving] = useState(false)

  /*
    The live query settles a tick after mount, so the form is built from the
    first resolved value rather than held in state from before it arrived —
    otherwise it opens blank and the prefill, which is the whole point, never
    lands. `draft` stays null until the writer touches something.
  */
  const current = draft ?? draftFromSnapshot(prev)
  const carried = isCarriedForward(prev, eventId)
  const options = useMemo(() => markers, [markers])

  function edit(patch: Partial<QuickStateDraft>) {
    setDraft({ ...current, ...patch })
  }

  async function save() {
    setSaving(true)
    try {
      await upsertSnapshot(quickStateWrite({
        draft: current, prev, worldId, characterId, eventId, markers: options,
      }))
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--ring))] bg-[hsl(var(--background))] p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{characterName}</span>
        <button
          onClick={onOpenFullEditor}
          className="pw-tap ml-auto inline-flex shrink-0 items-center gap-1 rounded text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" /> Full editor
        </button>
      </div>

      {carried && (
        <p className="flex items-start gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          <History className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Filled in from where they were last recorded. Saving pins it to this scene.
        </p>
      )}

      <div className="flex gap-1.5" role="group" aria-label={`Status of ${characterName}`}>
        <Button
          size="sm" variant={current.isAlive ? 'default' : 'outline'}
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => edit({ isAlive: true })}
        >
          <Heart className="h-3 w-3" aria-hidden="true" /> Alive
        </Button>
        <Button
          size="sm" variant={!current.isAlive ? 'destructive' : 'outline'}
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => edit({ isAlive: false })}
        >
          <Skull className="h-3 w-3" aria-hidden="true" /> Deceased
        </Button>
      </div>

      <Field
        label={<><MapPin className="h-3 w-3" aria-hidden="true" /> Where</>}
        labelClassName="flex items-center gap-1 text-xs"
        className="gap-1"
      >
        <Select
          value={current.locationMarkerId ?? 'none'}
          onValueChange={(v) => edit({ locationMarkerId: v === 'none' ? null : v })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Unknown / not set" />
          </SelectTrigger>
          <SelectContent
            filterPlaceholder={options.length > 8 ? 'Filter places…' : undefined}
            emptyLabel="No place matches"
          >
            <SelectItem value="none">Unknown / not set</SelectItem>
            {options.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Note" labelClassName="text-xs" className="gap-1">
        <Input
          className="h-7 text-xs"
          placeholder="Condition, disguise, mood…"
          value={current.statusNotes}
          onChange={(e) => edit({ statusNotes: e.target.value })}
        />
      </Field>

      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 flex-1 text-xs" disabled={saving} onClick={() => { void save() }}>
          {saving ? 'Saving…' : 'Record state'}
        </Button>
      </div>
    </div>
  )
}
