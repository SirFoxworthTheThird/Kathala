import { childrenOf, parentLinks, partnerLinks, type ParentLink } from '@/lib/kinship'
import type { ParentKind, PartnerKind, Relationship, Succession } from '@/types'

/*
  The family at a scene, drawn as a tree, and who inherits (issue #702). Pure:
  the hooks read the store and the gate, and pass in what is true at the
  cursor. The decisions are `docs/records/family-tree-plan.md`.
*/

export interface FamilyPerson {
  id: string
  name: string
  /** D-2: false before their birth scene. Someone with no birth scene is always born. */
  born: boolean
  alive: boolean
  offStage: boolean
}

export interface FamilyParent {
  relationshipId: string
  parentId: string
  childId: string
  parent: ParentKind
  order: number | undefined
  createdAt: number
}

export interface FamilyPartners {
  relationshipId: string
  aId: string
  bId: string
  partner: PartnerKind
  /** False once a state says the partnership is over. */
  active: boolean
}

export interface FamilyAt {
  people: Map<string, FamilyPerson>
  parents: FamilyParent[]
  partners: FamilyPartners[]
}

export interface FamilyInput {
  people: ReadonlyArray<{ id: string; name: string; offStage?: boolean }>
  relationships: ReadonlyArray<Pick<Relationship, 'id' | 'characterAId' | 'characterBId' | 'kinship' | 'startEventId' | 'createdAt'>>
  /** Whether a scene is at or before the cursor. With no cursor, every scene is. */
  reached: (eventId: string) => boolean
  /** Whether each person is alive at the cursor; absent, alive. */
  alive: (personId: string) => boolean
  /** A partnership's state at the cursor, where one has been said. */
  partnerState: (relationshipId: string) => { isActive: boolean; partner?: PartnerKind } | undefined
}

const begun = (start: string | null, reached: (id: string) => boolean) => start === null || reached(start)

/**
 * The family as of the cursor (D-2, D-4). A birth parent's link begins at the
 * birth, so someone whose every birth link begins later is not born yet. An
 * adoption or a step-parent not yet begun, and a partnership not yet begun,
 * are not there. People with no kinship at all are left out.
 */
export function familyAt(input: FamilyInput): FamilyAt {
  const byId = new Map(input.people.map((p) => [p.id, p]))
  const links = parentLinks(input.relationships).filter((l) => byId.has(l.parentId) && byId.has(l.childId))
  const births = new Map<string, ParentLink[]>()
  for (const l of links) if (l.parent === 'birth') births.set(l.childId, [...(births.get(l.childId) ?? []), l])
  const born = (id: string) => {
    const b = births.get(id)
    return !b || b.some((l) => begun(l.startEventId, input.reached))
  }

  const parents: FamilyParent[] = links
    .filter((l) => (l.parent === 'birth' ? true : begun(l.startEventId, input.reached)))
    .map(({ relationshipId, parentId, childId, parent, order, createdAt }) => ({ relationshipId, parentId, childId, parent, order, createdAt }))
  const partners: FamilyPartners[] = partnerLinks(input.relationships)
    .filter((l) => byId.has(l.aId) && byId.has(l.bId) && begun(l.startEventId, input.reached))
    .map((l) => {
      const st = input.partnerState(l.relationshipId)
      return { relationshipId: l.relationshipId, aId: l.aId, bId: l.bId, partner: st?.partner ?? l.partner, active: st?.isActive ?? true }
    })

  const inFamily = new Set<string>()
  for (const l of parents) inFamily.add(l.parentId).add(l.childId)
  for (const l of partners) inFamily.add(l.aId).add(l.bId)
  const people = new Map<string, FamilyPerson>()
  for (const id of inFamily) {
    const p = byId.get(id)!
    people.set(id, { id, name: p.name, born: born(id), alive: input.alive(id), offStage: !!p.offStage })
  }
  return { people, parents, partners }
}

/**
 * The family a reader may see (D-6): only those `visible` says they have met,
 * and no one not yet born; and only links between two people still there.
 */
export function forReader(fam: FamilyAt, visible: (id: string) => boolean): FamilyAt {
  const people = new Map([...fam.people].filter(([id, p]) => p.born && visible(id)))
  const keep = (a: string, b: string) => people.has(a) && people.has(b)
  const parents = fam.parents.filter((l) => keep(l.parentId, l.childId))
  const partners = fam.partners.filter((l) => keep(l.aId, l.bId))
  // Someone left with no link to anyone shown is not in the family as the reader knows it.
  const linked = new Set<string>()
  for (const l of parents) linked.add(l.parentId).add(l.childId)
  for (const l of partners) linked.add(l.aId).add(l.bId)
  return { people: new Map([...people].filter(([id]) => linked.has(id))), parents, partners }
}

const childrenIn = (fam: FamilyAt, id: string) =>
  fam.parents.filter((l) => l.parentId === id).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt - b.createdAt).map((l) => l.childId)
const parentsIn = (fam: FamilyAt, id: string) => fam.parents.filter((l) => l.childId === id).map((l) => l.parentId)
const partnersIn = (fam: FamilyAt, id: string) => fam.partners.flatMap((l) => (l.aId === id ? [l.bId] : l.bId === id ? [l.aId] : []))

export interface LayoutOptions {
  /** Around this person; absent, the whole family. */
  focusId?: string | null
  /** Generations above and below the focus. */
  up?: number
  down?: number
  /** People whose descendants are folded away. */
  collapsed?: ReadonlySet<string>
  /** Room each person takes, and between rows. */
  width?: number
  height?: number
}

export interface LayoutNode {
  id: string
  generation: number
  x: number
  y: number
  /** How many descendants are folded away under them. */
  folded: number
  /** Whether they have children at all, folded or not: whether a fold control means anything. */
  hasChildren: boolean
}

export interface LayoutEdge {
  id: string
  kind: 'parent' | 'partner'
  from: string
  to: string
  parent?: ParentKind
  partner?: PartnerKind
  active?: boolean
}

export interface FamilyLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

/** Who is drawn (D-7): around a person, so many generations each way with partners beside; or everyone joined to them. */
function chosen(fam: FamilyAt, opts: LayoutOptions): Set<string> {
  const focus = opts.focusId && fam.people.has(opts.focusId) ? opts.focusId : null
  if (!focus) {
    return new Set(fam.people.keys())
  }
  if (opts.up === undefined && opts.down === undefined) {
    // The whole family joined to the focus.
    const seen = new Set([focus])
    const todo = [focus]
    while (todo.length) {
      const at = todo.pop()!
      for (const n of [...parentsIn(fam, at), ...childrenIn(fam, at), ...partnersIn(fam, at)]) if (!seen.has(n)) { seen.add(n); todo.push(n) }
    }
    return seen
  }
  const out = new Set([focus])
  let ring = [focus]
  for (let g = 0; g < (opts.up ?? 3); g++) {
    ring = ring.flatMap((id) => parentsIn(fam, id)).filter((id) => !out.has(id))
    ring.forEach((id) => out.add(id))
  }
  ring = [focus]
  for (let g = 0; g < (opts.down ?? 3); g++) {
    ring = ring.flatMap((id) => childrenIn(fam, id)).filter((id) => !out.has(id))
    ring.forEach((id) => out.add(id))
  }
  for (const id of [...out]) for (const p of partnersIn(fam, id)) out.add(p)
  return out
}

/** Everyone below `id`, through children. */
function descendants(fam: FamilyAt, id: string): Set<string> {
  const seen = new Set<string>()
  const todo = [id]
  while (todo.length) for (const c of childrenIn(fam, todo.pop()!)) if (!seen.has(c)) { seen.add(c); todo.push(c) }
  return seen
}

/**
 * The tree's layout (D-7): one row a generation, a child below its parents and
 * partners side by side, each family kept together left to right in birth
 * order, parents over their children. Pure, so the drawing only draws it.
 */
export function familyLayout(fam: FamilyAt, opts: LayoutOptions = {}): FamilyLayout {
  const W = opts.width ?? 180
  const H = opts.height ?? 120
  let shown = chosen(fam, opts)

  // Folded branches: their descendants go, unless someone shown is their parent too (a cousin marriage stays).
  const folded = new Map<string, number>()
  for (const id of opts.collapsed ?? []) {
    if (!shown.has(id)) continue
    const below = descendants(fam, id)
    folded.set(id, [...below].filter((d) => shown.has(d)).length)
  }
  if (folded.size) {
    const hidden = new Set<string>()
    for (const id of folded.keys()) for (const d of descendants(fam, id)) hidden.add(d)
    for (const id of folded.keys()) hidden.delete(id)
    const left = new Set([...shown].filter((id) => !hidden.has(id)))
    // A partner kept only by someone folded away goes too.
    const joined = (id: string) => [...parentsIn(fam, id), ...childrenIn(fam, id), ...partnersIn(fam, id)].some((n) => left.has(n))
    shown = new Set([...left].filter((id) => id === opts.focusId || folded.has(id) || joined(id)))
  }

  const parentsOf = (id: string) => parentsIn(fam, id).filter((p) => shown.has(p))
  const childrenOf2 = (id: string) => childrenIn(fam, id).filter((c) => shown.has(c))
  const partnersOf = (id: string) => partnersIn(fam, id).filter((p) => shown.has(p))

  // Generations: below every parent, level with partners. Kinship has no cycles (D-4); the bound is for partners with their own child.
  const gen = new Map([...shown].map((id) => [id, 0]))
  for (let pass = 0, changed = true; changed && pass < shown.size + 2; pass++) {
    changed = false
    for (const id of shown) {
      let g = gen.get(id)!
      for (const p of parentsOf(id)) g = Math.max(g, gen.get(p)! + 1)
      for (const p of partnersOf(id)) g = Math.max(g, gen.get(p)!)
      if (g !== gen.get(id)) { gen.set(id, g); changed = true }
    }
  }
  // Someone with no parents shown sits just above their highest child, not at the top of the page.
  for (const id of shown) {
    if (parentsOf(id).length) continue
    const kids = childrenOf2(id)
    if (!kids.length) continue
    const want = Math.min(...kids.map((c) => gen.get(c)!)) - 1
    const partnersOk = partnersOf(id).every((p) => parentsOf(p).length === 0)
    if (want > gen.get(id)! && partnersOk) {
      gen.set(id, want)
      for (const p of partnersOf(id)) gen.set(p, Math.max(gen.get(p)!, want))
    }
  }
  const top = Math.min(...[...gen.values()], 0)
  for (const [id, g] of gen) gen.set(id, g - top)

  // Order: a walk from the eldest roots, each person then their partners, then their children in birth order.
  const order: string[] = []
  const placed = new Set<string>()
  const visit = (id: string) => {
    if (placed.has(id)) return
    placed.add(id)
    order.push(id)
    for (const p of partnersOf(id)) if (!placed.has(p) && gen.get(p) === gen.get(id)) { placed.add(p); order.push(p) }
    for (const c of childrenOf2(id)) visit(c)
    for (const p of partnersOf(id)) for (const c of childrenOf2(p)) visit(c)
  }
  const roots = [...shown].filter((id) => !parentsOf(id).length).sort((a, b) => gen.get(a)! - gen.get(b)! || (fam.people.get(a)!.name).localeCompare(fam.people.get(b)!.name))
  // The focus's eldest line leads, so their branch is not pushed to the far side.
  const first = opts.focusId && shown.has(opts.focusId) ? [topAncestor(fam, opts.focusId, shown)] : []
  for (const id of [...first, ...roots]) visit(id)
  for (const id of shown) visit(id)

  // x: slots in each row in walk order, then parents over their children and children under their parents, without overlapping.
  const rows = new Map<number, string[]>()
  for (const id of order) rows.set(gen.get(id)!, [...(rows.get(gen.get(id)!) ?? []), id])
  const x = new Map<string, number>()
  for (const ids of rows.values()) ids.forEach((id, i) => x.set(id, i * W))
  const settle = (ids: string[]) => {
    for (let i = 1; i < ids.length; i++) x.set(ids[i], Math.max(x.get(ids[i])!, x.get(ids[i - 1])! + W))
  }
  const gens = [...rows.keys()].sort((a, b) => a - b)
  for (let round = 0; round < 3; round++) {
    for (const g of gens) {
      const ids = rows.get(g)!
      // Each child under the middle of its parents.
      for (const id of ids) {
        const ps = parentsOf(id)
        if (ps.length) x.set(id, Math.max(x.get(id)!, ps.reduce((n, p) => n + x.get(p)!, 0) / ps.length))
      }
      settle(ids)
    }
    for (const g of [...gens].reverse()) {
      const ids = rows.get(g)!
      // Each couple over the middle of its children.
      for (const id of ids) {
        const kids = childrenOf2(id)
        if (!kids.length) continue
        const mid = (Math.min(...kids.map((c) => x.get(c)!)) + Math.max(...kids.map((c) => x.get(c)!))) / 2
        const partner = partnersOf(id).find((p) => gen.get(p) === g && ids.indexOf(p) === ids.indexOf(id) + 1)
        x.set(id, Math.max(x.get(id)!, partner ? mid - W / 2 : mid))
      }
      settle(ids)
    }
  }

  const nodes: LayoutNode[] = order.map((id) => ({
    id, generation: gen.get(id)!, x: x.get(id)!, y: gen.get(id)! * H,
    folded: folded.get(id) ?? 0,
    hasChildren: childrenIn(fam, id).length > 0,
  }))
  const edges: LayoutEdge[] = [
    ...fam.parents.filter((l) => shown.has(l.parentId) && shown.has(l.childId))
      .map((l) => ({ id: l.relationshipId, kind: 'parent' as const, from: l.parentId, to: l.childId, parent: l.parent })),
    ...fam.partners.filter((l) => shown.has(l.aId) && shown.has(l.bId))
      .map((l) => ({ id: l.relationshipId, kind: 'partner' as const, from: l.aId, to: l.bId, partner: l.partner, active: l.active })),
  ]
  return { nodes, edges }
}

/** The topmost shown ancestor of `id` up its first-listed parents, or `id` itself. */
function topAncestor(fam: FamilyAt, id: string, shown: Set<string>): string {
  let at = id
  const seen = new Set([id])
  for (let up = parentsIn(fam, at).find((p) => shown.has(p)); up && !seen.has(up); up = parentsIn(fam, at).find((p) => shown.has(p))) {
    seen.add(up)
    at = up
  }
  return at
}

/**
 * The line of a succession (D-3), whole: the founder, then for *eldest first*
 * each child in birth order followed by their own line before the next
 * sibling; for *by hand*, the writer's list. A step-parent's stepchildren do
 * not inherit by the rule; an adopted child does.
 */
export function successionLine(s: Pick<Succession, 'founderId' | 'rule' | 'line'>, relationships: Parameters<typeof parentLinks>[0]): string[] {
  if (s.rule === 'byHand') return [s.founderId, ...s.line.filter((id) => id !== s.founderId)]
  const links = parentLinks(relationships).filter((l) => l.parent !== 'step')
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
    for (const l of childrenOf(id, links)) walk(l.childId)
  }
  walk(s.founderId)
  return out
}

/** Each person as of the cursor, for a succession: null for someone not to be shown (D-6). */
export type PersonStatus = (id: string) => { born: boolean; alive: boolean } | null

/**
 * Who holds it and who is next, at the cursor (D-3): the first in the line who
 * is born and alive holds it, and those after, born and alive, are the heirs in
 * order. Someone `status` hides — not met, for a reader — is passed over
 * without a gap, so a hidden heir gives nothing away (D-6).
 */
export function successionAt(line: readonly string[], status: PersonStatus): { holder: string | null; heirs: string[] } {
  const living = line.filter((id) => {
    const st = status(id)
    return !!st && st.born && st.alive
  })
  return { holder: living[0] ?? null, heirs: living.slice(1) }
}
