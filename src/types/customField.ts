import type { InWorldDate } from './world'

/*
  Custom fields on characters, places and items (issue #699,
  docs/records/custom-fields-plan.md). A writer's own typed field — a mage's
  school, a ship's class, a suspect's alibi — defined once for a kind of
  entity and filled in on each one.

  A field is fixed or over time (D-1). A fixed value is on the entity record,
  in `customValues`, one per entity. A value over time is said at a scene, in a
  `FieldValue` row of its own (D-4), and read at the cursor from the last row
  at or before it.
*/

/** The kind of entity a field is on. */
export type CustomFieldKind = 'character' | 'place' | 'item'

/** What a field holds (D-6). */
export type CustomFieldType =
  | 'text'
  | 'longText'
  | 'number'
  | 'choice'
  | 'choices'
  | 'yesNo'
  | 'link'
  | 'date'

/** What a link field points to. */
export type FieldLinkKind = 'character' | 'place' | 'item' | 'faction'

/** One option of a choice field. The id is what a value stores, so renaming the label keeps every value. */
export interface FieldOption {
  id: string
  label: string
}

/** A date: in the world's calendar where it has one, or an ISO `YYYY-MM-DD` where it has none. */
export type FieldDate = InWorldDate | string

/**
 * A value as stored, by the field's type:
 * - text and long text: a string; one line for text
 * - number: a finite number
 * - choice: an option id; several choices: option ids, without repeats
 * - yes/no: a boolean
 * - link: an id of the field's link kind
 * - date: a `FieldDate`
 */
export type CustomValue = string | number | boolean | string[] | InWorldDate

export interface CustomFieldDef {
  id: string
  /** In a series, the series' id, as its characters, places and items are (D-5). */
  worldId: string
  kind: CustomFieldKind
  name: string
  type: CustomFieldType
  /** Said at a scene and read at the cursor, rather than one value per entity (D-1). */
  overTime: boolean
  /** Its place among the kind's fields. */
  order: number
  /** A choice field's options. */
  options?: FieldOption[]
  /** A number field's unit: *souls*, *leagues*. */
  unit?: string
  /** A link field's kind of entity. */
  linkKind?: FieldLinkKind
  createdAt: number
  updatedAt: number
  /** Journal version; read as `?? 1`. */
  version?: number
}

/**
 * A field's value for one entity at one scene (D-4): id
 * `fv:<defId>:<entityId>:<eventId>`. A `null` value is cleared there — "no
 * longer" — which is not the same as no row, where an earlier value carries.
 */
export interface FieldValue {
  id: string
  /** The book's: a value over time belongs to a scene, which is a book's (D-5). */
  worldId: string
  defId: string
  entityId: string
  eventId: string
  sortKey: number | null
  value: CustomValue | null
  createdAt: number
  updatedAt: number
  /** Journal version; read as `?? 1`. */
  version?: number
}

/** Fixed values on an entity record, by field id. Absent, as on every record that predates it, means none. */
export type CustomValues = Record<string, CustomValue>
