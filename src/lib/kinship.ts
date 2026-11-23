import type { Kinship, ParentKind, PartnerKind, Relationship } from '@/types'

/*
  Kinship (issue #702): who is whose parent and partner, read from the
  relationships that carry it. Pure; the hooks write it, the tree draws it.
  The decisions are `docs/records/family-tree-plan.md`.
*/

/** A parent link: `parentId` is `childId`'s parent. */
export interface ParentLink {
  relationshipId: string
  parentId: string
  childId: string
  parent: ParentKind
  /** Birth order among the parent's children; unset sorts last, by when the link was made. */
  order: number | undefined
  startEventId: string | null
  createdAt: number
}

/** A partnership, either way round. */
export interface PartnerLink {
  relationshipId: string
  aId: string
  bId: string
  partner: PartnerKind
  startEventId: string | null
}

type Rel = Pick<Relationship, 'id' | 'characterAId' | 'characterBId' | 'kinship' | 'startEventId' | 'createdAt'>

const otherEnd = (r: Rel, id: string) => (r.characterAId === id ? r.characterBId : r.characterAId)

export function parentLinks(rels: readonly Rel[]): ParentLink[] {
  const out: ParentLink[] = []
  for (const r of rels) {
    const k = r.kinship
    if (k?.kind !== 'parent') continue
    // A parent named by neither end is a broken record, not a parent.
    if (k.parentId !== r.characterAId && k.parentId !== r.characterBId) continue
    out.push({ relationshipId: r.id, parentId: k.parentId, childId: otherEnd(r, k.parentId), parent: k.parent, order: k.order, startEventId: r.startEventId, createdAt: r.createdAt })
  }
  return out
}

export function partnerLinks(rels: readonly Rel[]): PartnerLink[] {
  return rels.flatMap((r) => (r.kinship?.kind === 'partner' ? [{ relationshipId: r.id, aId: r.characterAId, bId: r.characterBId, partner: r.kinship.partner, startEventId: r.startEventId }] : []))
}

/** A parent's children in birth order: `order`, then the order they were entered. */
export function childrenOf(parentId: string, links: readonly ParentLink[]): ParentLink[] {
  return links
    .filter((l) => l.parentId === parentId)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt - b.createdAt)
}

export const parentsOf = (childId: string, links: readonly ParentLink[]): ParentLink[] => links.filter((l) => l.childId === childId)

/** Everyone `id` descends from, by any kind of parent. */
export function ancestorsOf(id: string, links: readonly ParentLink[]): Set<string> {
  const seen = new Set<string>()
  const todo = [id]
  while (todo.length) {
    const at = todo.pop()!
    for (const l of links) {
      if (l.childId === at && !seen.has(l.parentId)) {
        seen.add(l.parentId)
        todo.push(l.parentId)
      }
    }
  }
  return seen
}

/**
 * Why `parentId` cannot be made `childId`'s parent, or null (D-4). Refused:
 * someone their own parent; a link already there; and a cycle, someone made
 * the parent of one of their own ancestors.
 */
export function parentProblem(
  parentId: string,
  childId: string,
  rels: readonly Rel[],
  nameOf: (id: string) => string,
): string | null {
  if (parentId === childId) return `${nameOf(parentId)} cannot be their own parent.`
  const links = parentLinks(rels)
  if (links.some((l) => l.parentId === parentId && l.childId === childId)) return `${nameOf(parentId)} is already ${nameOf(childId)}’s parent.`
  if (ancestorsOf(parentId, links).has(childId)) {
    const direct = links.some((l) => l.parentId === childId && l.childId === parentId)
    return direct
      ? `${nameOf(childId)} is ${nameOf(parentId)}’s parent, so ${nameOf(parentId)} cannot be theirs.`
      : `${nameOf(childId)} is one of ${nameOf(parentId)}’s ancestors, so ${nameOf(parentId)} cannot be their parent: someone would be their own ancestor.`
  }
  const kin = rels.find((r) => pairOf(r, parentId, childId) && r.kinship)
  if (kin?.kinship?.kind === 'partner') return `${nameOf(parentId)} and ${nameOf(childId)} are already family, as partners.`
  return null
}

/** Why two people cannot be made partners, or null. */
export function partnerProblem(aId: string, bId: string, rels: readonly Rel[], nameOf: (id: string) => string): string | null {
  if (aId === bId) return `${nameOf(aId)} cannot be their own partner.`
  const kin = rels.find((r) => pairOf(r, aId, bId) && r.kinship)
  if (kin?.kinship?.kind === 'partner') return `${nameOf(aId)} and ${nameOf(bId)} are already partners.`
  if (kin?.kinship?.kind === 'parent') return `${nameOf(aId)} and ${nameOf(bId)} are already family, as parent and child.`
  return null
}

export const pairOf = (r: Pick<Relationship, 'characterAId' | 'characterBId'>, a: string, b: string) =>
  (r.characterAId === a && r.characterBId === b) || (r.characterAId === b && r.characterBId === a)

export const PARENT_WORDS: Record<ParentKind, string> = { birth: 'Parent', adoptive: 'Adoptive parent', step: 'Step-parent' }
export const PARTNER_WORDS: Record<PartnerKind, string> = { married: 'Married', partnered: 'Partners', betrothed: 'Betrothed' }

/** The label a relationship made for kinship alone is given; the writer can change it on the graph. */
export function kinLabel(k: Kinship): string {
  if (k.kind === 'parent') return { birth: 'parent and child', adoptive: 'adoptive parent and child', step: 'step-parent and stepchild' }[k.parent]
  return { married: 'married', partnered: 'partners', betrothed: 'betrothed' }[k.partner]
}
