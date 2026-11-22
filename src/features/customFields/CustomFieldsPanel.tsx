import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Field, FieldName } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InWorldDatePicker } from '@/components/InWorldDatePicker'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useWorld } from '@/db/hooks/useWorlds'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useFactions } from '@/db/hooks/useFactions'
import { fieldAtKey, sayFieldValue, setFixedValue, unsayFieldValue, useCustomFieldDefs, useFieldsAt } from '@/db/hooks/useCustomFields'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useActiveEventId } from '@/store'
import { showValue, type ShowContext } from '@/lib/customFields'
import type { CustomFieldDef, CustomFieldKind, CustomValue, CustomValues, FieldLinkKind, InWorldDate, WorldCalendar } from '@/types'

/*
  Custom fields on an entity's page (issue #699, part 2): its fixed values,
  and its values over time at the cursor, each where it was said. A writer
  edits them in place; a reader sees what the book has shown them (D-7): a
  value over time at their position, and a link to someone not met yet as
  *not met yet*.
*/

const NOT_MET = 'not met yet'

/** What the page names a link by: the records the screen may show, and the gate for the rest. */
function useLinkNames(bookId: string): ShowContext['nameOf'] {
  const gate = useGate()
  const characters = useCharacters(bookId)
  const items = useItems(bookId)
  const places = useAllLocationMarkers(bookId)
  const factions = useFactions(bookId)
  return useMemo(() => {
    const by: Record<FieldLinkKind, Map<string, string>> = {
      character: new Map(gate.names(characters).map((c) => [c.id, c.name])),
      item: new Map(items.map((i) => [i.id, i.name])),
      place: new Map(places.map((p) => [p.id, p.name])),
      faction: new Map(factions.map((f) => [f.id, f.name])),
    }
    return (kind, id) => by[kind].get(id) ?? (gate.active && kind !== 'faction' && !gate.isRevealed(id) ? NOT_MET : undefined)
  }, [gate, characters, items, places, factions])
}

/** The records a link may pick, by name. */
function useLinkOptions(bookId: string, kind: FieldLinkKind | undefined): Array<{ id: string; name: string }> {
  const characters = useCharacters(bookId)
  const items = useItems(bookId)
  const places = useAllLocationMarkers(bookId)
  const factions = useFactions(bookId)
  const list = kind === 'character' ? characters : kind === 'item' ? items : kind === 'place' ? places : kind === 'faction' ? factions : []
  return [...list].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))
}

const NONE = '__none__'

/** One value's editor, by its field's type. `onSay` writes, and throws with why where the value is refused. */
function ValueEditor({ def, value, bookId, calendar, onSay }: {
  def: CustomFieldDef
  value: CustomValue | null
  bookId: string
  calendar: WorldCalendar | null
  onSay: (v: unknown) => Promise<void>
}) {
  const links = useLinkOptions(bookId, def.type === 'link' ? def.linkKind : undefined)
  const shown = value === null ? '' : typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  const [text, setText] = useState(shown)
  useEffect(() => { setText(shown) }, [shown])

  switch (def.type) {
    case 'text':
    case 'number':
      return (
        <Input className="h-8 text-xs" type={def.type === 'number' ? 'number' : 'text'} step="any" value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text !== shown) void onSay(def.type === 'number' ? (text.trim() === '' ? null : Number(text)) : text) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      )
    case 'longText':
      return <Textarea className="min-h-[3.5rem] text-xs" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== shown) void onSay(text) }} />
    case 'choice':
    case 'yesNo':
    case 'link': {
      const options = def.type === 'choice' ? (def.options ?? []).map((o) => ({ id: o.id, name: o.label }))
        : def.type === 'yesNo' ? [{ id: 'yes', name: 'Yes' }, { id: 'no', name: 'No' }]
          : links
      const current = def.type === 'yesNo' ? (value === true ? 'yes' : value === false ? 'no' : NONE) : typeof value === 'string' ? value : NONE
      return (
        <Select value={current} onValueChange={(v) => void onSay(v === NONE ? null : def.type === 'yesNo' ? v === 'yes' : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="text-xs">—</SelectItem>
            {options.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    case 'choices': {
      const picked = new Set(Array.isArray(value) ? value : [])
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(def.options ?? []).map((o) => (
            <label key={o.id} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={picked.has(o.id)}
                onChange={(e) => {
                  const next = (def.options ?? []).map((x) => x.id).filter((id) => (id === o.id ? e.target.checked : picked.has(id)))
                  void onSay(next)
                }} />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    case 'date':
      return calendar ? (
        <InWorldDatePicker calendar={calendar} value={value && typeof value === 'object' && !Array.isArray(value) ? value as InWorldDate : null}
          onChange={(d) => void onSay(d)} setLabel={`Set ${def.name}`} />
      ) : (
        <Input className="h-8 text-xs" type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => void onSay(e.target.value || null)} />
      )
  }
}

/** The book's scenes, and what each is called on this page. */
function useScenes(bookId: string) {
  const events = useWorldEvents(bookId)
  const chapters = useWorldChapters(bookId)
  return useMemo(() => {
    const number = new Map(chapters.map((c) => [c.id, c.number]))
    const byId = new Map(events.map((e) => [e.id, e]))
    return {
      get: (id: string | null) => (id ? byId.get(id) : undefined),
      label: (ev: { chapterId: string; title: string }) => `Ch. ${number.get(ev.chapterId) ?? '?'} — ${ev.title || 'untitled'}`,
    }
  }, [events, chapters])
}

/** Runs a write, and keeps what it was refused for to say under the field. */
function useSay() {
  const [error, setError] = useState<Record<string, string>>({})
  const say = (defId: string, write: () => Promise<void>) => async () => {
    try {
      await write()
      setError((e) => { const { [defId]: _gone, ...rest } = e; void _gone; return rest })
    } catch (err) {
      setError((e) => ({ ...e, [defId]: err instanceof Error ? err.message : String(err) }))
    }
  }
  return { error, say }
}

export function CustomFieldsPanel({ kind, entity, bookId }: {
  kind: CustomFieldKind
  entity: { id: string; customValues?: CustomValues }
  /** The book open: its calendar, its scenes and, in a series, its values over time. */
  bookId: string
}) {
  const gate = useGate()
  const defs = useCustomFieldDefs(bookId, kind)
  const cursor = useActiveEventId()
  const at = useFieldsAt(bookId, cursor)
  const world = useWorld(bookId)
  const calendar = world?.calendar ?? null
  const nameOf = useLinkNames(bookId)
  const scenes = useScenes(bookId)
  const { error, say } = useSay()
  const reading = gate.active
  if (defs.length === 0) return null

  const fixed = defs.filter((d) => !d.overTime)
  const overTime = defs.filter((d) => d.overTime)
  const ctx: ShowContext = { nameOf, calendar }
  const scene = scenes.get(cursor)
  const sceneLabel = (id: string) => {
    const ev = scenes.get(id)
    return ev ? scenes.label(ev) : id.startsWith('opening:') ? 'the end of the book before' : 'a scene no longer in the book'
  }

  return (
    <section aria-label="Custom fields" className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Custom fields</h3>
      {fixed.length > 0 && (
        reading ? (
          <dl className="flex flex-col gap-1.5 text-xs">
            {fixed.map((d) => {
              const shown = showValue(d, entity.customValues?.[d.id], ctx)
              return shown && (
                <div key={d.id} className="flex gap-2">
                  <dt className="shrink-0 text-[hsl(var(--muted-foreground))]">{d.name}</dt>
                  <dd className="whitespace-pre-wrap">{shown}</dd>
                </div>
              )
            })}
          </dl>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fixed.map((d) => (
              <div key={d.id} className={d.type === 'longText' || d.type === 'choices' ? 'sm:col-span-2' : ''}>
                {d.type === 'choices' || d.type === 'date' ? (
                  <div className="flex flex-col gap-1.5" role="group" aria-label={d.name}>
                    <FieldName>{d.name}</FieldName>
                    <ValueEditor def={d} value={entity.customValues?.[d.id] ?? null} bookId={bookId} calendar={calendar}
                      onSay={(v) => say(d.id, () => setFixedValue(bookId, d.id, entity.id, v))()} />
                  </div>
                ) : (
                  <Field label={d.type === 'number' && d.unit ? `${d.name} (${d.unit})` : d.name}>
                    <ValueEditor def={d} value={entity.customValues?.[d.id] ?? null} bookId={bookId} calendar={calendar}
                      onSay={(v) => say(d.id, () => setFixedValue(bookId, d.id, entity.id, v))()} />
                  </Field>
                )}
                {error[d.id] && <p role="alert" className="mt-1 text-xs text-[hsl(var(--destructive))]">{error[d.id]}</p>}
              </div>
            ))}
          </div>
        )
      )}
      {overTime.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {scene ? <>Over time, at <span className="text-[hsl(var(--foreground))]">{scenes.label(scene)}</span></> : 'Over time, as the book ends'}
          </p>
          {overTime.map((d) => {
            const row = at.get(fieldAtKey(d.id, entity.id))
            const value = row?.value ?? null
            const shown = showValue(d, value, ctx)
            const here = !!row && row.eventId === cursor
            const source = row ? (here ? 'said here' : `since ${sceneLabel(row.eventId)}`) : null
            if (reading) {
              return shown && (
                <div key={d.id} className="flex gap-2 text-xs">
                  <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{d.name}</span>
                  <span>{shown}</span>
                </div>
              )
            }
            return (
              <div key={d.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <FieldName>{d.name}</FieldName>
                  {source && <span className="text-[hsl(var(--muted-foreground))]">{source}</span>}
                </div>
                {scene ? (
                  <div className="flex items-start gap-2" role="group" aria-label={`${d.name} at this scene`}>
                    <div className="min-w-0 flex-1">
                      <ValueEditor def={d} value={value} bookId={bookId} calendar={calendar}
                        onSay={(v) => say(d.id, () => sayFieldValue(bookId, d.id, entity.id, scene.id, v))()} />
                    </div>
                    {here && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" aria-label={`Take back ${d.name} here`}
                        onClick={say(d.id, () => unsayFieldValue(d.id, entity.id, scene.id))}>
                        Take back
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs">{shown ?? <span className="italic text-[hsl(var(--muted-foreground))]">Not said.</span>}</p>
                )}
                {error[d.id] && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error[d.id]}</p>}
              </div>
            )
          })}
          {!scene && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Choose a scene in the top bar to say a value there.</p>
          )}
        </div>
      )}
      {!reading && (
        <Link to={`/worlds/${bookId}/settings#settings-custom-fields`} className="self-start text-xs text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline">
          Edit the fields in World settings
        </Link>
      )}
    </section>
  )
}
