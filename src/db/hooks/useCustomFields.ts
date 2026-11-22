import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { EntityTable } from 'dexie'
import { db, bibleOf } from '@/db/database'
import { journalCreate, journalDelete, journalGroup, journalUpdate, type JournalledRecord } from './useOperations'
import { inOneWrite } from './useSceneStructure'
import { useOpening, withOpening } from './useOpening'
import { loadStory, useStory } from './useStory'
import { useItems } from './useItems'
import { computeSortKey } from '@/lib/sortKey'
import { generateId } from '@/lib/id'
import { checkValue, fieldValueId, shapeProblem, TEMPLATES, templateFields, type FieldShape } from '@/lib/customFields'
import { fieldCarries, fieldsAt, recordBefore } from '@/lib/stateAt'
import type { CustomFieldDef, CustomFieldKind, CustomValue, CustomValues, FieldLinkKind, FieldOption, FieldValue } from '@/types'
import type { OperationEntity } from '@/types/operation'

/*
  Custom fields (issue #699, docs/records/custom-fields-plan.md): the fields a
  writer defines, their fixed values on the entity records, and their values
  over time, one row per entity, field and scene (D-4). Every write is
  journalled, so undo takes it back; an act that writes several records —
  deleting a field and its values, adding a template — is one transaction and
  one undo.

  The values are checked against their field's type (`checkValue`, D-6), and
  anything else is refused with why.
*/

const NO_DEFS: CustomFieldDef[] = []
const NO_VALUES: FieldValue[] = []

/** What each kind of entity is stored as, and how the journal names it. */
const ENTITY: Record<CustomFieldKind, { entity: OperationEntity; table: () => EntityTable<JournalledRecord & { customValues?: CustomValues }, 'id'> }> = {
  character: { entity: 'character', table: () => db.characters as never },
  place: { entity: 'location', table: () => db.locationMarkers as never },
  item: { entity: 'item', table: () => db.items as never },
}

/** Where a link of each kind points. */
const LINKED: Record<FieldLinkKind, () => EntityTable<{ id: string }, 'id'>> = {
  character: () => db.characters as never,
  place: () => db.locationMarkers as never,
  item: () => db.items as never,
  faction: () => db.factions as never,
}

const byOrder = (a: CustomFieldDef, b: CustomFieldDef) => a.order - b.order || a.createdAt - b.createdAt

/** A world's custom fields, in order: a series' for a book of one (D-5). With `kind`, that kind's only. */
export function useCustomFieldDefs(worldId: string | null | undefined, kind?: CustomFieldKind): CustomFieldDef[] {
  return useLiveQuery(
    async () => {
      if (!worldId) return NO_DEFS
      const defs = await db.customFieldDefs.where('worldId').equals(bibleOf(worldId)).toArray()
      return defs.filter((d) => !kind || d.kind === kind).sort(byOrder)
    },
    [worldId, kind],
    NO_DEFS,
  )
}

/** Every value over time said in a book. */
export function useFieldValueRows(worldId: string | null | undefined): FieldValue[] {
  return useLiveQuery(() => (worldId ? db.fieldValues.where('worldId').equals(worldId).toArray() : NO_VALUES), [worldId], NO_VALUES)
}

/**
 * Each value over time that holds at `cursor`, by `defId|entityId`: the last
 * said by then, by the entity's carry rule; after the book's opening, in a
 * series. A value cleared there is not in the map. No cursor, each one's last
 * in the book.
 */
export function useFieldsAt(worldId: string | null | undefined, cursor: string | null): Map<string, FieldValue> {
  const defs = useCustomFieldDefs(worldId)
  const rows = withOpening(useFieldValueRows(worldId), useOpening(worldId).fields)
  const story = useStory(worldId ?? null)
  const items = useItems(worldId ?? null)
  return useMemo(() => {
    const kindOf = new Map(defs.filter((d) => d.overTime).map((d) => [d.id, d.kind]))
    const keptInEra = new Set(items.filter((i) => i.staysInEra).map((i) => i.id))
    const out = new Map<string, FieldValue>()
    for (const v of fieldsAt({ rows, kindOf, keptInEra }, cursor, story)) if (v.value !== null) out.set(`${v.defId}|${v.entityId}`, v)
    return out
  }, [defs, rows, story, items, cursor])
}

/** The key `useFieldsAt` reads a value by. */
export const fieldAtKey = (defId: string, entityId: string) => `${defId}|${entityId}`

// ── Fields ───────────────────────────────────────────────────────────────────

async function defsOf(worldId: string): Promise<CustomFieldDef[]> {
  return db.customFieldDefs.where('worldId').equals(bibleOf(worldId)).toArray()
}

/** A choice field's options, each with an id: a new one is given one, and a kept one keeps its own. */
function withIds(options: ReadonlyArray<string | { id?: string; label: string }> | undefined): FieldOption[] | undefined {
  if (!options) return undefined
  return options.map((o) => (typeof o === 'string' ? { id: generateId(), label: o.trim() } : { id: o.id ?? generateId(), label: o.label.trim() }))
}

/** Add a field to `kind` in `worldId` (its series', for a book of one), after the kind's others. */
export async function createFieldDef(worldId: string, kind: CustomFieldKind, shape: FieldShape): Promise<CustomFieldDef> {
  const problem = shapeProblem(shape)
  if (problem) throw new Error(problem)
  const siblings = (await defsOf(worldId)).filter((d) => d.kind === kind)
  const now = Date.now()
  const def: CustomFieldDef = {
    id: generateId(),
    worldId,
    kind,
    name: shape.name.trim(),
    type: shape.type,
    overTime: shape.overTime,
    order: siblings.reduce((n, d) => Math.max(n, d.order), -1) + 1,
    ...(shape.type === 'choice' || shape.type === 'choices' ? { options: withIds(shape.options) } : {}),
    ...(shape.type === 'number' && shape.unit?.trim() ? { unit: shape.unit.trim() } : {}),
    ...(shape.type === 'link' ? { linkKind: shape.linkKind } : {}),
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('customFieldDef', db.customFieldDefs, def)
}

/** How many values a field holds: fixed, on its kind's records, and over time, in every book. */
export async function fieldUse(defId: string): Promise<{ fixed: number; overTime: number }> {
  const def = await db.customFieldDefs.get(defId)
  if (!def) return { fixed: 0, overTime: 0 }
  const records = await ENTITY[def.kind].table().where('worldId').equals(def.worldId).toArray()
  return {
    fixed: records.filter((r) => r.customValues && defId in r.customValues).length,
    overTime: await db.fieldValues.where('defId').equals(defId).count(),
  }
}

export interface FieldPatch {
  name?: string
  type?: CustomFieldDef['type']
  overTime?: boolean
  options?: ReadonlyArray<string | { id?: string; label: string }>
  unit?: string
  linkKind?: FieldLinkKind
}

/**
 * Change a field. Its type, its link kind and whether it is over time change
 * only while it holds no values (D-1): a value of one shape is not one of
 * another. An option taken out is taken out of every value that picked it, in
 * the same undo.
 */
export async function updateFieldDef(defId: string, patch: FieldPatch): Promise<void> {
  const def = await db.customFieldDefs.get(defId)
  if (!def) return
  const next = {
    name: patch.name ?? def.name,
    type: patch.type ?? def.type,
    overTime: patch.overTime ?? def.overTime,
    linkKind: patch.linkKind ?? def.linkKind,
    options: patch.options ? withIds(patch.options) : def.options,
  }
  const problem = shapeProblem(next)
  if (problem) throw new Error(problem)
  const reshaped = next.type !== def.type || next.overTime !== def.overTime || (next.type === 'link' && next.linkKind !== def.linkKind)
  if (reshaped) {
    const use = await fieldUse(defId)
    if (use.fixed + use.overTime > 0) throw new Error(`${def.name} holds values: its type, and whether it is over time, change only while it is empty.`)
  }
  const choice = next.type === 'choice' || next.type === 'choices'
  const fields: Record<string, unknown> = {
    name: next.name.trim(),
    type: next.type,
    overTime: next.overTime,
    options: choice ? next.options : undefined,
    unit: next.type === 'number' ? (patch.unit ?? def.unit)?.trim() || undefined : undefined,
    linkKind: next.type === 'link' ? next.linkKind : undefined,
    updatedAt: Date.now(),
  }
  const gone = new Set((def.options ?? []).map((o) => o.id).filter((id) => !(next.options ?? []).some((o) => o.id === id)))
  await inOneWrite(async () => {
    await journalGroup(async () => {
      await journalUpdate('customFieldDef', db.customFieldDefs, defId, fields)
      if (!choice || gone.size === 0) return
      const without = (v: CustomValue | null): CustomValue | null =>
        typeof v === 'string' ? (gone.has(v) ? null : v) : Array.isArray(v) ? (v.filter((x) => !gone.has(x)).length ? v.filter((x) => !gone.has(x)) : null) : v
      const { entity, table } = ENTITY[def.kind]
      for (const r of await table().where('worldId').equals(def.worldId).toArray()) {
        const v = r.customValues?.[defId]
        if (v === undefined || JSON.stringify(without(v)) === JSON.stringify(v)) continue
        await journalUpdate(entity, table(), r.id, { customValues: setKey(r.customValues, defId, without(v)), updatedAt: Date.now() })
      }
      for (const row of await db.fieldValues.where('defId').equals(defId).toArray()) {
        if (JSON.stringify(without(row.value)) === JSON.stringify(row.value)) continue
        await journalUpdate('fieldValue', db.fieldValues, row.id, { value: without(row.value), updatedAt: Date.now() })
      }
    }, { label: `Changed the field “${def.name}”` })
  })
}

/** Put a kind's fields in the order of `ids`. */
export async function reorderFieldDefs(ids: readonly string[]): Promise<void> {
  await journalGroup(async () => {
    for (const [order, id] of ids.entries()) {
      const def = await db.customFieldDefs.get(id)
      if (def && def.order !== order) await journalUpdate('customFieldDef', db.customFieldDefs, id, { order, updatedAt: Date.now() })
    }
  }, { label: 'Reordered custom fields' })
}

/**
 * Delete a field and every value it holds — the fixed ones on its records,
 * and those over time in every book — in one transaction and one undo, with
 * tombstones, so a merge on another device deletes them too.
 */
export async function deleteFieldDef(defId: string): Promise<void> {
  const def = await db.customFieldDefs.get(defId)
  if (!def) return
  const { entity, table } = ENTITY[def.kind]
  await inOneWrite(async () => {
    await journalGroup(async () => {
      for (const r of await table().where('worldId').equals(def.worldId).toArray()) {
        if (!r.customValues || !(defId in r.customValues)) continue
        await journalUpdate(entity, table(), r.id, { customValues: setKey(r.customValues, defId, null), updatedAt: Date.now() })
      }
      for (const row of await db.fieldValues.where('defId').equals(defId).toArray()) {
        await journalDelete('fieldValue', db.fieldValues, row.id, async () => { await db.fieldValues.delete(row.id) })
      }
      await journalDelete('customFieldDef', db.customFieldDefs, defId, async () => { await db.customFieldDefs.delete(defId) })
    }, { label: `Deleted the field “${def.name}”` })
  })
}

/** Add a starter set's fields (D-2): those whose names its kind has not got. Returns the fields added. */
export async function addTemplate(worldId: string, templateId: string): Promise<CustomFieldDef[]> {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error('That is not one of the templates.')
  const fields = templateFields(template, await defsOf(worldId))
  return inOneWrite(async () => journalGroup(async () => {
    const made: CustomFieldDef[] = []
    for (const f of fields) made.push(await createFieldDef(worldId, template.kind, f))
    return made
  }, { label: `Added the ${template.label} fields` }))
}

// ── Values ───────────────────────────────────────────────────────────────────

/** A value set, with `key` set to `value`, or taken out for null; undefined where nothing is left. */
function setKey(values: CustomValues | undefined, key: string, value: CustomValue | null): CustomValues | undefined {
  const out: CustomValues = { ...(values ?? {}) }
  if (value === null) delete out[key]
  else out[key] = value
  return Object.keys(out).length ? out : undefined
}

/** `value` checked for `def`, and a link checked to point at something of its kind; throws with why, if not. */
async function checked(def: CustomFieldDef, worldId: string, value: unknown): Promise<CustomValue | null> {
  const calendar = (await db.worlds.get(worldId))?.calendar ?? null
  const c = checkValue(def, value, calendar)
  if (!c.ok) throw new Error(c.reason)
  if (def.type === 'link' && typeof c.value === 'string' && def.linkKind) {
    if (!(await LINKED[def.linkKind]().get(c.value))) throw new Error(`${def.name}: that is not one of the world’s records.`)
  }
  return c.value
}

/**
 * Set a fixed field's value on an entity, or clear it with `null` or an empty
 * value. `worldId` is the book it is set in, whose calendar a date is in.
 */
export async function setFixedValue(worldId: string, defId: string, entityId: string, value: unknown): Promise<void> {
  const def = await db.customFieldDefs.get(defId)
  if (!def) throw new Error('That field is not there.')
  if (def.overTime) throw new Error(`${def.name} is over time: its value is said at a scene.`)
  const v = await checked(def, worldId, value)
  const { entity, table } = ENTITY[def.kind]
  const record = await table().get(entityId)
  if (!record) throw new Error('That record is not there.')
  if (JSON.stringify(record.customValues?.[defId] ?? null) === JSON.stringify(v)) return
  await journalUpdate(entity, table(), entityId, { customValues: setKey(record.customValues, defId, v), updatedAt: Date.now() })
}

/** The row said at a scene for an entity and field: found by what it is, since a join keeps the id of the scene it came from. */
async function rowAt(defId: string, entityId: string, eventId: string): Promise<FieldValue | undefined> {
  return (await db.fieldValues.where('eventId').equals(eventId).toArray()).find((r) => r.defId === defId && r.entityId === entityId)
}

/**
 * Say an over-time field's value for an entity at a scene of book `worldId`:
 * from there on, until a later scene says another. `null`, or an empty
 * value, says it is cleared there: "no longer". A value that repeats what
 * holds before the scene, where the scene says nothing yet, is not written:
 * nothing changes there.
 */
export async function sayFieldValue(worldId: string, defId: string, entityId: string, eventId: string, value: unknown): Promise<void> {
  const def = await db.customFieldDefs.get(defId)
  if (!def) throw new Error('That field is not there.')
  if (!def.overTime) throw new Error(`${def.name} is fixed: its value is on the record, not at a scene.`)
  const v = await checked(def, worldId, value)
  const here = await rowAt(defId, entityId, eventId)
  const same = (a: CustomValue | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(v)
  const now = Date.now()
  if (here) {
    if (!same(here.value)) await journalUpdate('fieldValue', db.fieldValues, here.id, { value: v, updatedAt: now })
    return
  }
  const story = await loadStory(worldId)
  const rows = (await db.fieldValues.where('worldId').equals(worldId).toArray()).filter((r) => r.defId === defId && r.entityId === entityId)
  if (same(recordBefore(rows, eventId, story)?.value)) return
  await journalCreate('fieldValue', db.fieldValues, {
    id: fieldValueId(defId, entityId, eventId), worldId, defId, entityId, eventId,
    sortKey: await computeSortKey(eventId), value: v, createdAt: now, updatedAt: now,
  })
}

/** Take back what a scene says of an entity's field: the value before it holds there again. */
export async function unsayFieldValue(defId: string, entityId: string, eventId: string): Promise<void> {
  const here = await rowAt(defId, entityId, eventId)
  if (here) await journalDelete('fieldValue', db.fieldValues, here.id, async () => { await db.fieldValues.delete(here.id) })
}

/** The carry rule of an entity's value over time, for a reader outside the hooks. */
export async function carryOf(def: Pick<CustomFieldDef, 'kind'>, entityId: string) {
  return fieldCarries(def.kind, def.kind === 'item' ? !!(await db.items.get(entityId))?.staysInEra : false)
}
