import { useLiveQuery } from 'dexie-react-hooks'
import { db, bibleOf, inBook } from '@/db/database'
import { generateId } from '@/lib/id'
import { childrenOf, kinLabel, pairOf, parentLinks, parentProblem, partnerProblem } from '@/lib/kinship'
import type { Kinship, ParentKind, PartnerKind, Relationship, RelationshipSnapshot } from '@/types'
import { journalCreate, journalGroup, journalUpdate } from './useOperations'
import { deleteRelationship } from './useRelationships'
import { upsertRelationshipSnapshot } from './useRelationshipSnapshots'
import { stateBefore } from './useStory'

/*
  Kinship (issue #702, D-4): parents and partners, written onto relationships.
  A pair that already has a relationship — the writer's own *father and son* —
  gets the kinship on it, so the family is one graph with the rest; a pair
  without one gets a relationship made for it (`own`), which goes again when
  the kinship does. Every write is journalled.
*/

const NONE: Relationship[] = []

/** Every relationship in the book's series that is kinship: the family, ungated. The tree gates what it draws. */
export function useKinRelationships(worldId: string | null | undefined): Relationship[] {
  return useLiveQuery(
    async () => (worldId ? (await db.relationships.where('worldId').equals(bibleOf(worldId)).toArray()).filter((r) => !!r.kinship) : NONE),
    [worldId],
    NONE,
  )
}

async function context(worldId: string) {
  const bible = bibleOf(worldId)
  const [rels, people] = await Promise.all([
    db.relationships.where('worldId').equals(bible).toArray(),
    db.characters.where('worldId').equals(bible).toArray(),
  ])
  const names = new Map(people.map((c) => [c.id, c.name]))
  return { bible, rels, nameOf: (id: string) => names.get(id) ?? 'Someone' }
}

async function sayKin(worldId: string, aId: string, bId: string, kinship: Kinship, startEventId: string | null | undefined, rels: Relationship[]): Promise<Relationship> {
  const existing = rels.find((r) => pairOf(r, aId, bId) && !r.kinship)
  if (existing) {
    await journalUpdate('relationship', db.relationships, existing.id, {
      kinship,
      ...(startEventId !== undefined ? { startEventId } : {}),
      updatedAt: Date.now(),
    })
    return (await db.relationships.get(existing.id))!
  }
  const now = Date.now()
  return journalCreate('relationship', db.relationships, {
    id: generateId(),
    worldId: bibleOf(worldId),
    characterAId: aId,
    characterBId: bId,
    label: kinLabel(kinship),
    strength: 'bond',
    sentiment: 'neutral',
    description: '',
    isBidirectional: true,
    startEventId: startEventId ?? null,
    kinship: { ...kinship, own: true },
    createdAt: now,
    updatedAt: now,
  })
}

/**
 * Make `parentId` `childId`'s parent (D-1). Refused with why for a cycle, a
 * link already there, or a pair already partners. `startEventId` is when the
 * link begins: for a birth parent, the birth (D-2); null, before the story.
 * The child goes last among the parent's children.
 */
export async function addParent(worldId: string, parentId: string, childId: string, parent: ParentKind, startEventId?: string | null): Promise<Relationship> {
  const { rels, nameOf } = await context(worldId)
  const problem = parentProblem(parentId, childId, rels, nameOf)
  if (problem) throw new Error(problem)
  const siblings = childrenOf(parentId, parentLinks(rels))
  const order = siblings.reduce((n, l) => Math.max(n, (l.order ?? -1) + 1), siblings.length)
  return sayKin(worldId, parentId, childId, { kind: 'parent', parentId, parent, order }, startEventId, rels)
}

/** Make two people partners (D-4), from `startEventId`. Refused with why for the same person, or a pair already family. */
export async function addPartner(worldId: string, aId: string, bId: string, partner: PartnerKind, startEventId?: string | null): Promise<Relationship> {
  const { rels, nameOf } = await context(worldId)
  const problem = partnerProblem(aId, bId, rels, nameOf)
  if (problem) throw new Error(problem)
  return sayKin(worldId, aId, bId, { kind: 'partner', partner }, startEventId, rels)
}

/** Change what kind of parent or partner a link is, from the start. */
export async function changeKinKind(relationshipId: string, kind: ParentKind | PartnerKind): Promise<void> {
  const r = await db.relationships.get(relationshipId)
  if (!r?.kinship) return
  const kinship: Kinship = r.kinship.kind === 'parent'
    ? { ...r.kinship, parent: kind as ParentKind }
    : { ...r.kinship, partner: kind as PartnerKind }
  await journalUpdate('relationship', db.relationships, relationshipId, { kinship, updatedAt: Date.now() })
}

/**
 * Take a kinship away. A relationship made for it alone goes with it; one the
 * writer made stays, without it.
 */
export async function removeKin(relationshipId: string): Promise<void> {
  const r = await db.relationships.get(relationshipId)
  if (!r?.kinship) return
  if (r.kinship.own) await deleteRelationship(relationshipId)
  else await journalUpdate('relationship', db.relationships, relationshipId, { kinship: undefined, updatedAt: Date.now() })
}

/** Put a parent's children in birth order (D-3), as one undo. */
export async function orderChildren(worldId: string, parentId: string, childIds: readonly string[]): Promise<void> {
  const { rels } = await context(worldId)
  const links = parentLinks(rels).filter((l) => l.parentId === parentId)
  await journalGroup(async () => {
    for (const [order, childId] of childIds.entries()) {
      const link = links.find((l) => l.childId === childId)
      const r = rels.find((x) => x.id === link?.relationshipId)
      if (!link || r?.kinship?.kind !== 'parent' || r.kinship.order === order) continue
      await journalUpdate('relationship', db.relationships, r.id, { kinship: { ...r.kinship, order }, updatedAt: Date.now() })
    }
  }, { label: 'Reordered children' })
}

/**
 * A partnership at a scene (D-4): from here it is `partner` (betrothed, then
 * married), or, with `ended`, over. Written as the relationship's state at that
 * scene, carrying everything else from the state before it.
 */
export async function partnershipAt(worldId: string, relationshipId: string, eventId: string, change: { partner?: PartnerKind; ended?: boolean }): Promise<RelationshipSnapshot | undefined> {
  const r = await db.relationships.get(relationshipId)
  if (r?.kinship?.kind !== 'partner') return undefined
  const states = inBook(await db.relationshipSnapshots.where('relationshipId').equals(relationshipId).toArray(), worldId)
  // What this scene says already, then the state before it: ending a marriage at the scene it began keeps it a marriage.
  const before = states.find((s) => s.eventId === eventId) ?? await stateBefore(states, eventId, worldId)
  return upsertRelationshipSnapshot({
    worldId,
    relationshipId,
    eventId,
    label: before?.label ?? r.label,
    strength: before?.strength ?? r.strength,
    sentiment: before?.sentiment ?? r.sentiment,
    description: before?.description ?? r.description,
    isActive: !change.ended,
    partner: change.partner ?? before?.partner ?? r.kinship.partner,
  })
}
