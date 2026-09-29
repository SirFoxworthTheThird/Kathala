import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { X, UserMinus, PackageMinus, MapPin, Tag, Package, Eye, History, Flame, Milestone, AtSign, Spline, Sparkle } from 'lucide-react'
import { TENSION_LEVELS, tensionColor, tensionLabel } from '@/lib/tension'
import { STORY_BEATS, beatById, beatActColor } from '@/lib/storyBeats'
import { EVENT_STATUSES, eventStatusConfig } from '@/lib/eventStatus'
import { charColor } from '@/lib/characterColor'
import { normalizeTag } from '@/lib/sceneFields'
import type { Character, EventStatus, Item, LocationMarker, PlotThread, Motif } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortraitImage } from '@/components/PortraitImage'

/*
  A scene's fields, one component each: its setting, tags, cast, mentions,
  threads, motifs, items, point of view, time, flashback, beat, tension and
  status.

  They were written inline in the scene's card, which was the only thing that
  edited a scene's details. The panel beside the Page edits them too now, so
  they are here, and hold no opinion about *when* a change is saved: each takes
  its value and says what the writer asked for. The card routes some of those
  into its edit session; the panel writes every one straight away.
*/

const LABEL = 'text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide'

function FieldLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <span className={icon ? `${LABEL} flex items-center gap-1` : LABEL}>{icon}{children}</span>
}

/** Where the scene happens: a map place, or nowhere in particular. */
export function SettingField({ markers, value, onChange }: {
  markers: LocationMarker[]
  value: string | null
  onChange: (markerId: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<MapPin className="h-3 w-3" />}>Setting</FieldLabel>
      <Select value={value ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Nowhere in particular…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">Nowhere in particular</SelectItem>
          {markers.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Free tags, typed: Enter or leaving the box adds one, Backspace in an empty box takes the last off. */
export function TagsField({ tags, onChange }: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  function commit() {
    const tag = normalizeTag(input)
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setInput('')
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<Tag className="h-3 w-3" />}>Tags</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 min-h-[2rem] cursor-text"
        onClick={() => inputRef.current?.focus()}>
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-0.5 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px]">
            #{tag}
            <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="ml-0.5 hover:text-red-400">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          aria-label="Add a tag to this scene"
          placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
          className="flex-1 min-w-[8rem] bg-transparent text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
        />
      </div>
    </div>
  )
}

/** Who is in the scene. */
export function CastField({ present, available, onAdd, onRemove }: {
  present: Character[]
  available: Character[]
  onAdd: (characterId: string) => void
  onRemove: (characterId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Characters</FieldLabel>
      {present.length > 0 ? (
        <div className="flex flex-col gap-1">
          {present.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
              <PortraitImage
                imageId={c.portraitImageId}
                className="h-5 w-5 rounded-full object-cover"
                fallbackClassName="h-5 w-5 rounded-full"
              />
              <span className="flex-1 text-xs">{c.name}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400"
                aria-label={`Remove ${c.name} from this scene`} title={`Remove ${c.name}`}
                onClick={() => onRemove(c.id)}>
                <UserMinus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : available.length === 0 ? (
        /* X-4 rule 3: with the picker below, a sentence announcing the
           absence says nothing the picker does not. Without one — no
           characters exist yet — the section would be blank, so it says
           why there is nothing to pick. */
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No characters in this world yet.</p>
      ) : null}
      {available.length > 0 && (
        <Select onValueChange={onAdd} value="">
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ Add character…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** Who is referred to in the scene without being in it. */
export function MentionsField({ mentioned, available, onAdd, onRemove }: {
  mentioned: Character[]
  /** Everyone who could be mentioned: neither in the scene nor mentioned already. */
  available: Character[]
  onAdd: (characterId: string) => void
  onRemove: (characterId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<AtSign className="h-3 w-3" />}>Mentioned</FieldLabel>
      {mentioned.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {mentioned.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] pl-0.5 pr-1 py-0.5">
              <PortraitImage
                imageId={c.portraitImageId}
                className="h-4 w-4 rounded-full object-cover"
                fallbackClassName="h-4 w-4 rounded-full"
              />
              <span className="text-[10px] text-[hsl(var(--foreground))]">{c.name}</span>
              <button onClick={() => onRemove(c.id)} className="ml-0.5 hover:text-red-400" aria-label={`Remove mention of ${c.name}`}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {available.length > 0
            ? 'Type @ in the scene draft to mention someone.'
            : 'No characters in this world yet.'}
        </p>
      )}
      {available.length > 0 && (
        <Select onValueChange={onAdd} value="">
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ Mention character…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** Coloured chips for records made elsewhere — plot threads and motifs — tagged on the scene here. */
function ColouredTagsField({ label, icon, assigned, available, placeholder, removeLabel, onAdd, onRemove }: {
  label: string
  icon: ReactNode
  assigned: Array<{ id: string; name: string; color: string }>
  available: Array<{ id: string; name: string }>
  placeholder: string
  removeLabel: (name: string) => string
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={icon}>{label}</FieldLabel>
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((t) => (
            <span key={t.id} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: `${t.color}22`, border: `1px solid ${t.color}55` }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
              <span className="text-[hsl(var(--foreground))]">{t.name}</span>
              <button onClick={() => onRemove(t.id)} className="ml-0.5 hover:text-red-400" aria-label={removeLabel(t.name)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <Select onValueChange={onAdd} value="">
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {available.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** The plot threads the scene advances (made on the dashboard; tagged here). */
export function ThreadsField({ assigned, available, onAdd, onRemove }: {
  assigned: PlotThread[]
  available: PlotThread[]
  onAdd: (threadId: string) => void
  onRemove: (threadId: string) => void
}) {
  return (
    <ColouredTagsField
      label="Plot Threads"
      icon={<Spline className="h-3 w-3" />}
      assigned={assigned}
      available={available}
      placeholder="+ Tag a thread…"
      removeLabel={(name) => `Remove thread ${name}`}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  )
}

/** The motifs the scene carries (made on the dashboard; tagged here). */
export function MotifsField({ assigned, available, onAdd, onRemove }: {
  assigned: Motif[]
  available: Motif[]
  onAdd: (motifId: string) => void
  onRemove: (motifId: string) => void
}) {
  return (
    <ColouredTagsField
      label="Motifs"
      icon={<Sparkle className="h-3 w-3" />}
      assigned={assigned}
      available={available}
      placeholder="+ Tag a motif…"
      removeLabel={(name) => `Remove motif ${name}`}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  )
}

/** The items the scene involves. */
export function ItemsField({ involved, available, onAdd, onRemove }: {
  involved: Item[]
  available: Item[]
  onAdd: (itemId: string) => void
  onRemove: (itemId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Items</FieldLabel>
      {involved.length > 0 ? (
        <div className="flex flex-col gap-1">
          {involved.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
              <PortraitImage
                imageId={it.imageId}
                className="h-5 w-5 rounded object-cover"
                fallbackClassName="h-5 w-5 rounded"
                fallbackIcon={Package}
              />
              <span className="flex-1 text-xs">{it.name}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400"
                aria-label={`Remove ${it.name} from this scene`} title={`Remove ${it.name}`}
                onClick={() => onRemove(it.id)}>
                <PackageMinus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {/* No "no items yet" fallback: a caller offers this section only when
          there are items involved or available, so an empty list here
          guarantees the picker below. */}
      {available.length > 0 && (
        <Select onValueChange={onAdd} value="">
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ Add item…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((it) => (
              <SelectItem key={it.id} value={it.id} className="text-xs">{it.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function CharacterOption({ c }: { c: Character }) {
  return (
    <SelectItem value={c.id} className="text-xs">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(c) }} />
        {c.name}
      </span>
    </SelectItem>
  )
}

/** Whose eyes the scene is seen through: the scene's own cast first, then everyone else. */
export function PovField({ value, present, others, onChange }: {
  value: string | null
  present: Character[]
  others: Character[]
  onChange: (characterId: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<Eye className="h-3 w-3" />}>Point of View</FieldLabel>
      <Select
        value={value ?? '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? null : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="No POV character…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No POV character</SelectItem>
          {present.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide">In this scene</SelectLabel>
              {present.map((c) => <CharacterOption key={c.id} c={c} />)}
            </SelectGroup>
          )}
          {others.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide">All characters</SelectLabel>
              {others.map((c) => <CharacterOption key={c.id} c={c} />)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Days since the previous scene, and an exact in-world day that overrides the derived clock. Raw text out; see `parseTravelDays`. */
export function TimeField({ travelDays, inWorldTime, onTravelDays, onInWorldTime }: {
  travelDays: number | null
  inWorldTime: number | null
  onTravelDays: (raw: string) => void
  onInWorldTime: (raw: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<History className="h-3 w-3" />}>Elapsed Time</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step="any"
          aria-label="Days since the previous scene"
          className="h-8 w-24 text-xs"
          placeholder="0"
          value={travelDays ?? ''}
          onChange={(e) => onTravelDays(e.target.value)}
        />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">days since the previous scene</span>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Builds the in-world clock and powers the travel-time continuity check.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          step="any"
          aria-label="Exact in-world day for this scene"
          className="h-8 w-24 text-xs"
          placeholder="auto"
          value={inWorldTime ?? ''}
          onChange={(e) => onInWorldTime(e.target.value)}
        />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">pin to an exact in-world day</span>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Overrides the derived clock — use for flashbacks or scenes out of narrative order.
      </p>
    </div>
  )
}

/** Whether the scene looks back: it suppresses present-state continuity checks. */
export function FlashbackField({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
          value
            ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
        }`}
        title="Mark as flashback or retrospective — suppresses present-state continuity checks for this scene"
      >
        <History className="h-3 w-3" />
        Flashback / Retrospective
      </button>
    </div>
  )
}

/** The story-structure beat the scene lands on. */
export function BeatField({ value, onChange }: { value: string | null; onChange: (beatId: string | null) => void }) {
  const beat = beatById(value)
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<Milestone className="h-3 w-3" />}>Story Beat</FieldLabel>
      <Select value={value ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="No beat…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No beat</SelectItem>
          {[1, 2, 3].map((act) => (
            <SelectGroup key={act}>
              <SelectLabel className="text-[10px] uppercase tracking-wide">Act {act}</SelectLabel>
              {STORY_BEATS.filter((b) => b.act === act).map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: beatActColor(b.act) }} />
                    {b.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {beat && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{beat.hint}</p>
      )}
    </div>
  )
}

/** Dramatic tension, 1–5, for the pacing curve. Says which level was clicked; see `nextTension`. */
export function TensionField({ value, onPick }: { value: number | null; onPick: (level: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={<Flame className="h-3 w-3" />}>Dramatic Tension</FieldLabel>
      <div className="flex gap-1">
        {TENSION_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onPick(level)}
            className="flex-1 rounded py-1 text-[10px] font-medium tabular-nums transition-opacity hover:opacity-90"
            style={
              value === level
                ? { background: tensionColor(level), color: '#fff' }
                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
            }
            title={`${tensionLabel(level)} (${level}/5)`}
            aria-pressed={value === level}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {value !== null
          ? `${tensionLabel(value)} — click the same level again to clear.`
          : 'Rate the intensity to plot this scene on the pacing curve.'}
      </p>
    </div>
  )
}

/** How far along the scene is, draft to final. */
export function StatusField({ value, onChange }: { value: EventStatus; onChange: (status: EventStatus) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Status</FieldLabel>
      <div className="flex gap-1">
        {EVENT_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className="flex-1 rounded py-1 text-[10px] font-medium transition-opacity hover:opacity-90"
            style={
              value === s
                ? { background: eventStatusConfig(s).color, color: eventStatusConfig(s).textColor }
                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
            }
            aria-pressed={value === s}
          >
            {eventStatusConfig(s).label}
          </button>
        ))}
      </div>
    </div>
  )
}
