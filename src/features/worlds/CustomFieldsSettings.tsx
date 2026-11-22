import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  addTemplate, createFieldDef, deleteFieldDef, fieldUse, reorderFieldDefs, updateFieldDef, useCustomFieldDefs,
} from '@/db/hooks/useCustomFields'
import { FIELD_KINDS, FIELD_TYPES, LINK_KINDS, TEMPLATES } from '@/lib/customFields'
import type { CustomFieldDef, CustomFieldKind, CustomFieldType, FieldLinkKind } from '@/types'

/*
  The Custom fields section of World settings (issue #699, part 2): a writer's
  own fields on characters, places and items — added, renamed, reordered,
  typed, deleted with a count of what goes with them — and four templates to
  start from (custom-fields-plan.md, D-2).
*/

const typeLabel = (t: CustomFieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t
const linkLabel = (k: FieldLinkKind | undefined) => LINK_KINDS.find((x) => x.kind === k)?.label.replace(/^(A|An) /, '') ?? ''

interface Draft {
  name: string
  type: CustomFieldType
  overTime: boolean
  /** One choice a line, each keeping its id where it had one. */
  options: Array<{ id?: string; label: string }>
  unit: string
  linkKind: FieldLinkKind | ''
}

const EMPTY: Draft = { name: '', type: 'text', overTime: false, options: [], unit: '', linkKind: '' }

const draftOf = (d: CustomFieldDef): Draft => ({
  name: d.name, type: d.type, overTime: d.overTime, options: d.options ?? [], unit: d.unit ?? '', linkKind: d.linkKind ?? '',
})

/** The lines of the choices box, back to options: a line kept where it was keeps its option's id. */
function optionsFrom(text: string, before: Draft['options']): Draft['options'] {
  return text.split('\n').map((line, k) => ({ id: before[k]?.label.trim() === line.trim() ? before[k].id : before.find((o) => o.label.trim() === line.trim())?.id, label: line }))
}

function FieldForm({ kind, initial, locked, onSave, onCancel }: {
  kind: CustomFieldKind
  initial: Draft
  /** The field holds values: its type and whether it is over time are fixed (D-1). */
  locked: boolean
  onSave: (d: Draft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [choices, setChoices] = useState(initial.options.map((o) => o.label).join('\n'))
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const choice = draft.type === 'choice' || draft.type === 'choices'
  const kindWord = FIELD_KINDS.find((k) => k.kind === kind)!.label.toLowerCase()

  async function save() {
    setError(null)
    try {
      await onSave({ ...draft, options: choice ? optionsFrom(choices, initial.options).filter((o) => o.label.trim()) : [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3" role="group" aria-label={initial.name ? `Edit ${initial.name}` : `New field for ${kindWord}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Field name">
          <Input className="h-8 text-xs" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onCancel() }} />
        </Field>
        <Field label="Type">
          <Select value={draft.type} onValueChange={(v) => set({ type: v as CustomFieldType })}>
            <SelectTrigger className="h-8 text-xs" disabled={locked}><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t.type} value={t.type} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {choice && (
        <Field label="Choices, one a line">
          <Textarea className="min-h-[4.5rem] text-xs" value={choices} onChange={(e) => setChoices(e.target.value)} />
        </Field>
      )}
      {draft.type === 'number' && (
        <Field label="Unit (optional)">
          <Input className="h-8 text-xs" placeholder="souls, leagues…" value={draft.unit} onChange={(e) => set({ unit: e.target.value })} />
        </Field>
      )}
      {draft.type === 'link' && (
        <Field label="Links to">
          <Select value={draft.linkKind} onValueChange={(v) => set({ linkKind: v as FieldLinkKind })}>
            <SelectTrigger className="h-8 text-xs" disabled={locked}><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {LINK_KINDS.map((k) => <SelectItem key={k.kind} value={k.kind} className="text-xs">{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={draft.overTime} disabled={locked} onChange={(e) => set({ overTime: e.target.checked })} />
        <span>
          <span className="font-medium">Changes over time</span>
          <span className="block text-[hsl(var(--muted-foreground))]">Said at a scene and read at the cursor, like a rank or a loyalty. Otherwise one value each, like eye colour.</span>
        </span>
      </label>
      {locked && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          It holds values, so its type{draft.type === 'link' ? ', what it links to' : ''} and whether it changes over time stay as they are. Its name and choices can change.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()}>{initial.name ? 'Save field' : 'Add field'}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function FieldRow({ def, first, last, onMove }: { def: CustomFieldDef; first: boolean; last: boolean; onMove: (dir: -1 | 1) => void }) {
  const [editing, setEditing] = useState<{ locked: boolean } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  if (editing) {
    return (
      <li>
        <FieldForm kind={def.kind} initial={draftOf(def)} locked={editing.locked} onCancel={() => setEditing(null)}
          onSave={async (d) => {
            await updateFieldDef(def.id, {
              name: d.name, type: d.type, overTime: d.overTime, options: d.options, unit: d.unit,
              linkKind: d.linkKind || undefined,
            })
            setEditing(null)
          }} />
      </li>
    )
  }

  const said = [typeLabel(def.type), def.type === 'link' && def.linkKind ? `to ${linkLabel(def.linkKind).toLowerCase()}` : '', def.unit ? `in ${def.unit}` : '']
    .filter(Boolean).join(' ')
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="font-medium">{def.name}</span>
      <span className="text-[hsl(var(--muted-foreground))]">{said}{def.overTime ? ' · over time' : ''}</span>
      {(def.type === 'choice' || def.type === 'choices') && (
        <span className="truncate text-[hsl(var(--muted-foreground))]">({(def.options ?? []).map((o) => o.label).join(', ')})</span>
      )}
      <span className="ml-auto flex shrink-0 items-center">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Move ${def.name} up`} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Move ${def.name} down`} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Edit field ${def.name}`}
          onClick={async () => { const use = await fieldUse(def.id); setEditing({ locked: use.fixed + use.overTime > 0 }) }}>
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Delete field ${def.name}`}
          onClick={async () => {
            const use = await fieldUse(def.id)
            const n = use.fixed + use.overTime
            setConfirm(n === 0
              ? 'It holds no values yet.'
              : `Its ${n} value${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} with it: ${use.fixed} on ${def.kind === 'character' ? 'characters' : def.kind === 'place' ? 'places' : 'items'} and ${use.overTime} said at scenes. Undo brings them back.`)
          }}>
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      </span>
      <ConfirmDialog open={confirm !== null} onOpenChange={(v) => { if (!v) setConfirm(null) }}
        title={`Delete the field “${def.name}”?`} description={confirm ?? undefined} confirmLabel="Delete field"
        onConfirm={() => { void deleteFieldDef(def.id) }} />
    </li>
  )
}

function KindFields({ worldId, kind, label, defs }: { worldId: string; kind: CustomFieldKind; label: string; defs: CustomFieldDef[] }) {
  const [adding, setAdding] = useState(false)
  const move = (k: number, dir: -1 | 1) => {
    const ids = defs.map((d) => d.id)
    ;[ids[k], ids[k + dir]] = [ids[k + dir], ids[k]]
    void reorderFieldDefs(ids)
  }
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold">{label}</h3>
      {defs.length === 0 && !adding && <p className="text-xs italic text-[hsl(var(--muted-foreground))]">None yet.</p>}
      <ul className="space-y-1">
        {defs.map((d, k) => <FieldRow key={d.id} def={d} first={k === 0} last={k === defs.length - 1} onMove={(dir) => move(k, dir)} />)}
      </ul>
      {adding ? (
        <FieldForm kind={kind} initial={EMPTY} locked={false} onCancel={() => setAdding(false)}
          onSave={async (d) => {
            await createFieldDef(worldId, kind, { name: d.name, type: d.type, overTime: d.overTime, options: d.options.map((o) => o.label), unit: d.unit, linkKind: d.linkKind || undefined })
            setAdding(false)
          }} />
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" aria-label={`Add a field to ${label.toLowerCase()}`} onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3 w-3" aria-hidden="true" /> Add field
        </Button>
      )}
    </div>
  )
}

export function CustomFieldsSettings({ worldId }: { worldId: string }) {
  const defs = useCustomFieldDefs(worldId)
  const [added, setAdded] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold">Start from a template</h3>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <Button key={t.id} size="sm" variant="outline" className="h-7 text-xs" aria-label={`Add the ${t.label} fields`}
              onClick={async () => {
                const made = await addTemplate(worldId, t.id)
                setAdded(made.length
                  ? `Added ${made.map((d) => d.name).join(', ')} to ${FIELD_KINDS.find((k) => k.kind === t.kind)!.label.toLowerCase()}.`
                  : `The ${t.label} fields are here already.`)
              }}>
              {t.label}
            </Button>
          ))}
        </div>
        {added && <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">{added}</p>}
      </div>
      {FIELD_KINDS.map((k) => (
        <KindFields key={k.kind} worldId={worldId} kind={k.kind} label={k.label} defs={defs.filter((d) => d.kind === k.kind)} />
      ))}
    </div>
  )
}
