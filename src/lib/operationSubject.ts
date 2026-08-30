import type { Operation, OperationEntity } from '@/types/operation'

/**
 * Which record an operation is *about*, in the words a writer would use.
 *
 * A journalled update stores only the fields it changed, so the record's name
 * is in the payload only when the name is what changed. Every other edit —
 * a scene's cast, a chapter's notes, a character's state — arrived at the
 * Recent changes panel with nothing to identify it, and seventeen consecutive
 * continuity fixes read as seventeen identical rows saying *"Edited scene —
 * involved characters"*. The panel is where you decide what to take back, so
 * rows that cannot be told apart are worse than uninformative.
 *
 * The name is therefore resolved from the store rather than recorded on the
 * operation: it works for the operations already sitting in people's journals,
 * it costs a primary-key read, and it follows a later rename instead of
 * preserving the name the record happened to have at the time. That last part
 * is a deliberate choice — the row is a way to find a record, not a historical
 * quotation.
 *
 * The Dexie side lives in `src/db/hooks/useOperations.ts`; everything here is
 * a plain function over plain data.
 */

/**
 * Fields a record may carry its display name in, best first.
 *
 * `text` is last and is here for map labels, whose whole content is their text
 * — no other journalled group has the field, so it cannot displace a real name.
 */
const NAME_FIELDS = ['name', 'title', 'label', 'text'] as const

/** A record's display name, or null when it has none. */
export function recordName(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null
  for (const field of NAME_FIELDS) {
    const value = (record as Record<string, unknown>)[field]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** One hop: read this foreign key on the record, then read that table's name. */
export interface SubjectOwner {
  table: string
  key: string
}

/**
 * Groups whose name belongs to something else.
 *
 * A `CharacterSnapshot` holds a character's state at one scene and carries no
 * name of its own — the name a writer would recognise is the character's. So
 * these resolve one hop further: read the foreign key, then read that table.
 *
 * Some groups are a *pair* of foreign keys and nothing else, and one name is
 * not enough to tell them apart. A blind writer run recorded twelve knowledge
 * reveals and got twelve rows reading *"Added knowledge reveal"*, in a panel
 * whose only purpose is deciding which change to take back; a reveal is a
 * character and a fact, so both are named. `SUBJECT_JOIN` is what goes between.
 */
export const SUBJECT_JOIN = ' — '

export const SUBJECT_OWNER: Partial<Record<OperationEntity, SubjectOwner[]>> = {
  characterSnapshot: [{ table: 'characters', key: 'characterId' }],
  itemPlacement: [{ table: 'items', key: 'itemId' }],
  itemSnapshot: [{ table: 'items', key: 'itemId' }],
  locationSnapshot: [{ table: 'locationMarkers', key: 'locationMarkerId' }],
  relationshipSnapshot: [{ table: 'relationships', key: 'relationshipId' }],
  mapRegionSnapshot: [{ table: 'mapRegions', key: 'regionId' }],
  knowledgeReveal: [
    { table: 'characters', key: 'characterId' },
    { table: 'knowledgeFacts', key: 'factId' },
  ],
  factionMembership: [
    { table: 'characters', key: 'characterId' },
    { table: 'factions', key: 'factionId' },
  ],
  factionRelationship: [
    { table: 'factions', key: 'factionAId' },
    { table: 'factions', key: 'factionBId' },
  ],
  characterMovement: [{ table: 'characters', key: 'characterId' }],
  crossTimelineArtifact: [{ table: 'items', key: 'itemId' }],
  timelineRelationship: [
    { table: 'timelines', key: 'sourceTimelineId' },
    { table: 'timelines', key: 'targetTimelineId' },
  ],
}

/**
 * Whether the operation's own payload can name it.
 *
 * A create and a delete store the whole record, so they always can — which is
 * why the top-bar button already managed *Undo: Added scene "…"* while the
 * panel below it said nothing. Only updates need the store consulted, and
 * skipping the rest keeps the resolver's reads to the rows that need one.
 */
export function needsSubjectLookup(op: Operation): boolean {
  return recordName(op.payload) === null
}
