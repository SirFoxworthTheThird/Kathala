import type {
  CustomFieldDef, CustomFieldKind, CustomFieldType, CustomValue, CustomValues, FieldLinkKind, FieldOption, InWorldDate, WorldCalendar,
} from '@/types'
import { dateToDayNumber, formatInWorldDate, monthLength } from './calendar'

/*
  Custom fields (issue #699, docs/records/custom-fields-plan.md): what a value
  may be for its field's type, how it is shown, and the starter templates.
  Pure; the tables are written by `src/db/hooks/useCustomFields.ts`, and a
  value over time is read at a scene by `stateAt` (`fieldsAt`).
*/

/** A field value over time's id: one per field, entity and scene (D-4). */
export function fieldValueId(defId: string, entityId: string, eventId: string): string {
  return `fv:${defId}:${entityId}:${eventId}`
}

export const FIELD_TYPES: ReadonlyArray<{ type: CustomFieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'longText', label: 'Long text' },
  { type: 'number', label: 'Number' },
  { type: 'choice', label: 'Choice' },
  { type: 'choices', label: 'Several choices' },
  { type: 'yesNo', label: 'Yes or no' },
  { type: 'link', label: 'Link' },
  { type: 'date', label: 'Date' },
]

export const LINK_KINDS: ReadonlyArray<{ kind: FieldLinkKind; label: string }> = [
  { kind: 'character', label: 'A character' },
  { kind: 'place', label: 'A place' },
  { kind: 'item', label: 'An item' },
  { kind: 'faction', label: 'A faction' },
]

export const FIELD_KINDS: ReadonlyArray<{ kind: CustomFieldKind; label: string }> = [
  { kind: 'character', label: 'Characters' },
  { kind: 'place', label: 'Places' },
  { kind: 'item', label: 'Items' },
]

/** What a write is refused for, in the writer's words; or the value as it is kept, `null` for none. */
export type Checked = { ok: true; value: CustomValue | null } | { ok: false; reason: string }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Whether an ISO date names a real day: 2026-02-30 does not. */
function realIsoDay(s: string): boolean {
  const m = ISO.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

const isInWorldDate = (v: unknown): v is InWorldDate =>
  !!v && typeof v === 'object' && !Array.isArray(v)
  && Number.isInteger((v as InWorldDate).year) && Number.isInteger((v as InWorldDate).month) && Number.isInteger((v as InWorldDate).day)

/**
 * A value checked against its field's type (D-6). An empty one — no text, no
 * choice, nothing picked — is `null`: the field says nothing for it, and the
 * write clears it. Anything that is not the type is refused, with why.
 *
 * A date is an in-world date where the world has a calendar, and an ISO
 * `YYYY-MM-DD` where it has none. A link is checked for its shape here; that
 * the entity exists is the writer's to check, since it reads the tables.
 */
export function checkValue(def: Pick<CustomFieldDef, 'type' | 'options' | 'name'>, value: unknown, calendar?: WorldCalendar | null): Checked {
  if (value === null || value === undefined) return { ok: true, value: null }
  const no = (why: string): Checked => ({ ok: false, reason: `${def.name}: ${why}` })
  switch (def.type) {
    case 'text':
    case 'longText': {
      if (typeof value !== 'string') return no('a value must be text.')
      const text = def.type === 'text' ? value.trim() : value.replace(/\s+$/, '')
      if (def.type === 'text' && /[\r\n]/.test(text)) return no('this field takes one line.')
      return { ok: true, value: text.trim() ? text : null }
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return no('a value must be a number.')
      return { ok: true, value }
    case 'choice': {
      if (value === '') return { ok: true, value: null }
      if (typeof value !== 'string' || !(def.options ?? []).some((o) => o.id === value)) return no('that is not one of its choices.')
      return { ok: true, value }
    }
    case 'choices': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return no('a value must be a list of its choices.')
      const known = new Set((def.options ?? []).map((o) => o.id))
      if (value.some((v) => !known.has(v))) return no('that is not one of its choices.')
      if (new Set(value).size !== value.length) return no('a choice is picked twice.')
      return { ok: true, value: value.length ? [...value] : null }
    }
    case 'yesNo':
      if (typeof value !== 'boolean') return no('a value must be yes or no.')
      return { ok: true, value }
    case 'link':
      if (value === '') return { ok: true, value: null }
      if (typeof value !== 'string' || /\s/.test(value)) return no('a value must be one of the world’s records.')
      return { ok: true, value }
    case 'date': {
      if (calendar) {
        if (!isInWorldDate(value)) return no('a value must be a date in the world’s calendar.')
        const month = calendar.months[value.month]
        if (!month) return no('that month is not in the calendar.')
        if (value.day < 1 || value.day > monthLength(calendar, value.month, value.year)) return no(`${month.name} has no day ${value.day} that year.`)
        return { ok: true, value: { year: value.year, month: value.month, day: value.day } }
      }
      if (value === '') return { ok: true, value: null }
      if (typeof value !== 'string' || !realIsoDay(value)) return no('a value must be a date, as YYYY-MM-DD.')
      return { ok: true, value }
    }
  }
}

/** What the reader and the screens need to name a value: who a link points at, and the world's calendar. */
export interface ShowContext {
  /** A link's name, or undefined where it points at nothing there is (deleted, or not met yet: the caller says which). */
  nameOf?: (kind: FieldLinkKind, id: string) => string | undefined
  calendar?: WorldCalendar | null
}

const labelOf = (options: FieldOption[] | undefined, id: string) => options?.find((o) => o.id === id)?.label

/**
 * A value as the writer reads it, or null where it says nothing: no value, a
 * choice whose option has been taken out, a link to a record that is gone.
 */
export function showValue(def: Pick<CustomFieldDef, 'type' | 'options' | 'unit' | 'linkKind'>, value: CustomValue | null | undefined, ctx: ShowContext = {}): string | null {
  if (value === null || value === undefined) return null
  switch (def.type) {
    case 'text':
    case 'longText':
      return typeof value === 'string' && value.trim() ? value : null
    case 'number': {
      if (typeof value !== 'number') return null
      const n = value.toLocaleString('en-US', { maximumFractionDigits: 6 })
      return def.unit?.trim() ? `${n} ${def.unit.trim()}` : n
    }
    case 'choice':
      return typeof value === 'string' ? labelOf(def.options, value) ?? null : null
    case 'choices': {
      if (!Array.isArray(value)) return null
      const labels = value.map((v) => labelOf(def.options, v)).filter((l): l is string => !!l)
      return labels.length ? labels.join(', ') : null
    }
    case 'yesNo':
      return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : null
    case 'link':
      return typeof value === 'string' && def.linkKind ? ctx.nameOf?.(def.linkKind, value) ?? null : null
    case 'date':
      return showDate(value, ctx.calendar)
  }
}

function showDate(value: CustomValue, calendar: WorldCalendar | null | undefined): string | null {
  if (isInWorldDate(value)) {
    if (!calendar || !calendar.months[value.month]) return `${value.year}-${value.month + 1}-${value.day}`
    return formatInWorldDate(calendar, dateToDayNumber(calendar, value))
  }
  if (typeof value === 'string' && realIsoDay(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  return null
}

/** The words a value is found by in Search: what it shows, as the writer reads it. */
export function searchText(def: Pick<CustomFieldDef, 'type' | 'options' | 'unit' | 'linkKind'>, value: CustomValue | null | undefined, ctx: ShowContext = {}): string {
  return showValue(def, value, ctx) ?? ''
}

/** Whether a fixed value set is empty: absent, as on every record before #699, or with no keys. */
export function hasFixedValues(values: CustomValues | undefined): boolean {
  return !!values && Object.keys(values).length > 0
}

/** A field's starting shape, before it has an id: what a template, or the editor, makes. */
export interface FieldShape {
  name: string
  type: CustomFieldType
  overTime: boolean
  options?: string[]
  unit?: string
  linkKind?: FieldLinkKind
}

export interface FieldTemplate {
  id: string
  label: string
  kind: CustomFieldKind
  fields: FieldShape[]
}

/** The four starter sets (D-2). Each field is an ordinary field once added. */
export const TEMPLATES: readonly FieldTemplate[] = [
  {
    id: 'fantasy-characters', label: 'Fantasy characters', kind: 'character',
    fields: [
      { name: 'Race', type: 'choice', overTime: false, options: ['Human', 'Elf', 'Dwarf', 'Halfling'] },
      { name: 'Magic', type: 'text', overTime: false },
      { name: 'Allegiance', type: 'link', overTime: true, linkKind: 'faction' },
    ],
  },
  {
    id: 'mystery-suspects', label: 'Mystery suspects', kind: 'character',
    fields: [
      { name: 'Alibi', type: 'longText', overTime: false },
      { name: 'Motive', type: 'longText', overTime: false },
      { name: 'Means', type: 'text', overTime: false },
      { name: 'Suspicion', type: 'choice', overTime: true, options: ['Unsuspected', 'Suspected', 'Prime suspect', 'Cleared'] },
    ],
  },
  {
    id: 'ships', label: 'Ships', kind: 'item',
    fields: [
      { name: 'Class', type: 'choice', overTime: false, options: ['Sloop', 'Brig', 'Frigate', 'Galleon'] },
      { name: 'Crew', type: 'number', overTime: false, unit: 'souls' },
      { name: 'Captain', type: 'link', overTime: true, linkKind: 'character' },
    ],
  },
  {
    id: 'settlements', label: 'Settlements', kind: 'place',
    fields: [
      { name: 'Population', type: 'number', overTime: false },
      { name: 'Ruler', type: 'link', overTime: true, linkKind: 'character' },
      { name: 'Founded', type: 'date', overTime: false },
    ],
  },
]

/** A field name as it is compared: two that differ only in case or spacing are one name. */
export const fieldKey = (name: string) => name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The fields a template adds to a kind that already has `existing`: those
 * whose names the kind does not have yet, so adding a template twice adds
 * nothing the second time.
 */
export function templateFields(template: FieldTemplate, existing: ReadonlyArray<Pick<CustomFieldDef, 'name' | 'kind'>>): FieldShape[] {
  const have = new Set(existing.filter((d) => d.kind === template.kind).map((d) => fieldKey(d.name)))
  return template.fields.filter((f) => !have.has(fieldKey(f.name)))
}

/** What is wrong with a field's shape, or null: a name, options for a choice, a kind for a link. */
export function shapeProblem(shape: Pick<FieldShape, 'name' | 'type' | 'linkKind'> & { options?: ReadonlyArray<string | FieldOption> }): string | null {
  if (!shape.name.trim()) return 'A field needs a name.'
  if (/[\r\n]/.test(shape.name)) return 'A field’s name is one line.'
  if (!FIELD_TYPES.some((t) => t.type === shape.type)) return 'That is not a type a field can be.'
  if (shape.type === 'choice' || shape.type === 'choices') {
    const labels = (shape.options ?? []).map((o) => (typeof o === 'string' ? o : o.label).trim())
    if (labels.length === 0 || labels.some((l) => !l)) return 'A choice field needs its choices, each with a name.'
    if (new Set(labels.map(fieldKey)).size !== labels.length) return 'Two choices have the same name.'
  }
  if (shape.type === 'link' && !LINK_KINDS.some((k) => k.kind === shape.linkKind)) return 'A link field needs the kind of record it links to.'
  return null
}
