import { describe, it, expect } from 'vitest'
import { childrenOf, parentLinks, parentProblem, partnerProblem } from '@/lib/kinship'
import { familyAt, familyLayout, forReader, successionAt, successionLine, type FamilyInput, type PersonStatus } from '@/lib/family'
import type { Kinship, Relationship } from '@/types'

/*
  The family tree's logic (issue #702): kinship read from relationships, a
  cycle refused, the family as of a scene, what a reader may see, the layout,
  and succession. The decisions are `docs/records/family-tree-plan.md`.
*/

let made = 0
type Rel = Pick<Relationship, 'id' | 'characterAId' | 'characterBId' | 'kinship' | 'startEventId' | 'createdAt'>
const rel = (a: string, b: string, kinship: Kinship | undefined, startEventId: string | null = null): Rel => ({ id: `r${++made}`, characterAId: a, characterBId: b, kinship, startEventId, createdAt: made })
const parent = (p: string, c: string, kind: 'birth' | 'adoptive' | 'step' = 'birth', start: string | null = null, order?: number) =>
  rel(p, c, { kind: 'parent', parentId: p, parent: kind, order }, start)
const partners = (a: string, b: string, start: string | null = null) => rel(a, b, { kind: 'partner', partner: 'married' }, start)
const name = (id: string) => id[0].toUpperCase() + id.slice(1)

/** Wuthering Heights, enough of it: the Earnshaws over three generations, and the Lintons marrying in. */
const HEIGHTS: Rel[] = [
  partners('earnshaw', 'mrsEarnshaw'),
  parent('earnshaw', 'hindley', 'birth', null, 0), parent('mrsEarnshaw', 'hindley'),
  parent('earnshaw', 'catherine', 'birth', null, 1), parent('mrsEarnshaw', 'catherine'),
  parent('earnshaw', 'heathcliff', 'adoptive', 's1'),
  partners('hindley', 'frances', 's2'),
  parent('hindley', 'hareton', 'birth', 's3'), parent('frances', 'hareton', 'birth', 's3'),
  partners('catherine', 'edgar', 's4'),
  parent('catherine', 'cathy', 'birth', 's5'), parent('edgar', 'cathy', 'birth', 's5'),
]
const PEOPLE = ['earnshaw', 'mrsEarnshaw', 'hindley', 'catherine', 'heathcliff', 'frances', 'hareton', 'edgar', 'cathy', 'lockwood'].map((id) => ({ id, name: name(id) }))
const SCENES = ['s1', 's2', 's3', 's4', 's5', 's6']

function at(scene: string | null, more: Partial<FamilyInput> = {}) {
  const upTo = scene ? SCENES.indexOf(scene) : SCENES.length - 1
  return familyAt({
    people: PEOPLE,
    relationships: HEIGHTS,
    reached: (id) => SCENES.indexOf(id) <= upTo,
    alive: () => true,
    partnerState: () => undefined,
    ...more,
  })
}

describe('kinship (D-1, D-4)', () => {
  it('a parent link names its parent whichever way round the relationship was written, and a broken one is not read', () => {
    const backwards = rel('child', 'mother', { kind: 'parent', parentId: 'mother', parent: 'birth' })
    const broken = rel('a', 'b', { kind: 'parent', parentId: 'nobody', parent: 'birth' })
    expect(parentLinks([backwards, broken])).toEqual([expect.objectContaining({ parentId: 'mother', childId: 'child' })])
  })

  it('children in birth order: their order, then the order they were entered', () => {
    const rels = [parent('m', 'c', 'birth', null, 1), parent('m', 'a', 'birth', null, 0), parent('m', 'late'), parent('m', 'later')]
    expect(childrenOf('m', parentLinks(rels)).map((l) => l.childId)).toEqual(['a', 'c', 'late', 'later'])
  })

  it('refuses someone their own parent, a link twice, a cycle near or far, and partners; allows the rest', () => {
    const rels = [parent('gran', 'mum'), parent('mum', 'kid'), partners('mum', 'dad')]
    expect(parentProblem('kid', 'kid', rels, name)).toBe('Kid cannot be their own parent.')
    expect(parentProblem('mum', 'kid', rels, name)).toBe('Mum is already Kid’s parent.')
    expect(parentProblem('kid', 'mum', rels, name)).toBe('Mum is Kid’s parent, so Kid cannot be theirs.')
    expect(parentProblem('kid', 'gran', rels, name)).toBe('Gran is one of Kid’s ancestors, so Kid cannot be their parent: someone would be their own ancestor.')
    expect(parentProblem('dad', 'mum', rels, name)).toBe('Dad and Mum are already family, as partners.')
    expect(parentProblem('dad', 'kid', rels, name)).toBeNull()
    expect(parentProblem('gran', 'dad', rels, name)).toBeNull()
  })

  it('partners: not oneself, not twice, not parent and child', () => {
    const rels = [parent('mum', 'kid'), partners('mum', 'dad')]
    expect(partnerProblem('mum', 'mum', rels, name)).toBe('Mum cannot be their own partner.')
    expect(partnerProblem('dad', 'mum', rels, name)).toBe('Dad and Mum are already partners.')
    expect(partnerProblem('kid', 'mum', rels, name)).toBe('Kid and Mum are already family, as parent and child.')
    expect(partnerProblem('kid', 'dad', rels, name)).toBeNull()
  })
})

describe('the family at a scene (D-2, D-4)', () => {
  it('someone is born at their birth link’s scene; before it, not born; with no birth link, always born', () => {
    expect(at('s2').people.get('hareton')).toMatchObject({ born: false })
    expect(at('s3').people.get('hareton')).toMatchObject({ born: true })
    expect(at('s1').people.get('hindley')).toMatchObject({ born: true })
    // Adopted at s1, born before the story: born, and his link there from s1.
    expect(at('s1').people.get('heathcliff')).toMatchObject({ born: true })
  })

  it('an adoption and a partnership are there from their scene; with no one else, the person is not in the family yet', () => {
    expect(at('s1').partners.some((p) => p.aId === 'hindley')).toBe(false)
    expect(at('s2').partners.some((p) => p.aId === 'hindley')).toBe(true)
    const before = familyAt({ people: PEOPLE, relationships: [parent('earnshaw', 'heathcliff', 'adoptive', 's2')], reached: (id) => id === 's1', alive: () => true, partnerState: () => undefined })
    expect(before.people.has('heathcliff')).toBe(false)
    expect(at('s1').parents.find((l) => l.childId === 'heathcliff')).toMatchObject({ parent: 'adoptive' })
  })

  it('the dead, and a partnership ended or changed, as of the cursor; no one outside the family', () => {
    const wed = HEIGHTS.find((r) => r.characterAId === 'catherine' && r.kinship?.kind === 'partner')!
    const fam = at(null, {
      alive: (id) => id !== 'catherine',
      partnerState: (id) => (id === wed.id ? { isActive: false, partner: 'married' } : undefined),
    })
    expect(fam.people.get('catherine')).toMatchObject({ alive: false })
    expect(fam.partners.find((p) => p.relationshipId === wed.id)).toMatchObject({ active: false })
    expect(fam.people.has('lockwood')).toBe(false)
  })
})

describe('what a reader sees (D-6)', () => {
  it('no one not yet born, no one not met, and no link to either; nobody left hanging', () => {
    const fam = forReader(at('s2'), (id) => id !== 'edgar')
    expect(fam.people.has('hareton')).toBe(false)
    expect(fam.people.has('edgar')).toBe(false)
    expect(fam.parents.some((l) => l.childId === 'hareton' || l.parentId === 'edgar')).toBe(false)
    expect(fam.people.has('hindley')).toBe(true)
    // Frances, met, married to Hindley at s2: there.
    expect(fam.people.has('frances')).toBe(true)
    // Not met: Frances; then Hindley's partnership goes, and with nothing else, so does she.
    const without = forReader(at('s2'), (id) => id !== 'frances')
    expect(without.partners.some((p) => p.bId === 'frances')).toBe(false)
  })
})

const byId = (nodes: ReturnType<typeof familyLayout>['nodes']) => new Map(nodes.map((n) => [n.id, n]))

describe('the layout (D-7)', () => {
  it('a row a generation: children below parents, partners level, an in-law at their partner’s', () => {
    const n = byId(familyLayout(at(null)).nodes)
    expect(n.get('earnshaw')!.generation).toBe(0)
    expect(n.get('mrsEarnshaw')!.generation).toBe(0)
    expect(['hindley', 'catherine', 'heathcliff'].map((id) => n.get(id)!.generation)).toEqual([1, 1, 1])
    expect(n.get('frances')!.generation).toBe(1)
    expect(n.get('edgar')!.generation).toBe(1)
    expect(['hareton', 'cathy'].map((id) => n.get(id)!.generation)).toEqual([2, 2])
    expect(n.get('hindley')!.y).toBe(120)
  })

  it('no two in a row overlap; siblings in birth order; partners side by side; parents over their children', () => {
    const { nodes } = familyLayout(at(null))
    const rows = new Map<number, typeof nodes>()
    for (const node of nodes) rows.set(node.generation, [...(rows.get(node.generation) ?? []), node])
    for (const row of rows.values()) {
      const xs = row.map((r) => r.x).sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(180)
    }
    const n = byId(nodes)
    expect(n.get('hindley')!.x).toBeLessThan(n.get('catherine')!.x)
    expect(Math.abs(n.get('hindley')!.x - n.get('frances')!.x)).toBe(180)
    // Hareton under the middle of Hindley and Frances.
    expect(n.get('hareton')!.x).toBe((n.get('hindley')!.x + n.get('frances')!.x) / 2)
  })

  it('a founder with no parents sits just above their child, not at the top of the page', () => {
    const rels = [parent('a', 'b'), parent('b', 'c'), parent('late', 'c')]
    const n = byId(familyLayout(familyAt({ people: ['a', 'b', 'c', 'late'].map((id) => ({ id, name: id })), relationships: rels, reached: () => true, alive: () => true, partnerState: () => undefined })).nodes)
    expect(n.get('late')!.generation).toBe(1)
    expect(n.get('c')!.generation).toBe(2)
  })

  it('around a person: as many generations each way as asked, with partners; the whole family when none are', () => {
    const one = familyLayout(at(null), { focusId: 'hindley', up: 1, down: 0 }).nodes.map((x) => x.id).sort()
    expect(one).toEqual(['earnshaw', 'frances', 'hindley', 'mrsEarnshaw'])
    const down = familyLayout(at(null), { focusId: 'hindley', up: 0, down: 1 }).nodes.map((x) => x.id).sort()
    expect(down).toEqual(['frances', 'hareton', 'hindley'])
    const all = familyLayout(at(null), { focusId: 'hindley' }).nodes.length
    expect(all).toBe(at(null).people.size)
  })

  it('a folded branch hides everyone below, says how many, and takes partners kept only by them', () => {
    const { nodes, edges } = familyLayout(at(null), { collapsed: new Set(['catherine']) })
    const n = byId(nodes)
    expect(n.has('cathy')).toBe(false)
    expect(n.get('catherine')).toMatchObject({ folded: 1, hasChildren: true })
    // Edgar is Catherine's partner and Cathy's father: kept, by Catherine.
    expect(n.has('edgar')).toBe(true)
    expect(edges.some((e) => e.to === 'cathy')).toBe(false)
    const deeper = byId(familyLayout(at(null), { collapsed: new Set(['earnshaw']) }).nodes)
    expect(deeper.get('earnshaw')).toMatchObject({ folded: 5 })
    // Everyone below goes; Mrs Earnshaw stays as his partner, the in-laws with nobody to hold them go.
    expect([...deeper.keys()].sort()).toEqual(['earnshaw', 'mrsEarnshaw'])
  })

  it('edges: each parent link and partnership drawn, with its kind', () => {
    const { edges } = familyLayout(at(null))
    expect(edges.filter((e) => e.kind === 'parent')).toHaveLength(9)
    expect(edges.find((e) => e.to === 'heathcliff')).toMatchObject({ kind: 'parent', parent: 'adoptive' })
    expect(edges.filter((e) => e.kind === 'partner')).toHaveLength(3)
  })

  it('lays out 200 people quickly', () => {
    // Ten generations of couples with two children each, until there are 200.
    const rels: Rel[] = []
    const people = [{ id: 'p0', name: 'p0' }, { id: 'q0', name: 'q0' }]
    rels.push(partners('p0', 'q0'))
    let couples: Array<[string, string]> = [['p0', 'q0']]
    let k = 1
    while (people.length < 200) {
      const next: Array<[string, string]> = []
      for (const [a, b] of couples) {
        for (let c = 0; c < 2 && people.length < 200; c++) {
          const kid = `p${k}`, spouse = `q${k++}`
          people.push({ id: kid, name: kid }, { id: spouse, name: spouse })
          rels.push(parent(a, kid), parent(b, kid), partners(kid, spouse))
          next.push([kid, spouse])
        }
      }
      couples = next
    }
    const fam = familyAt({ people, relationships: rels, reached: () => true, alive: () => true, partnerState: () => undefined })
    expect(fam.people.size).toBe(200)
    const t = performance.now()
    const { nodes } = familyLayout(fam)
    const ms = performance.now() - t
    expect(nodes).toHaveLength(200)
    expect(ms).toBeLessThan(LAYOUT_200_MS)
  })
})

/**
 * Measured here (Vitest, jsdom), seven runs each: 200 people 7.3 ms median and
 * 16.9 ms at worst; 500, 24 ms; 1,000, 95 ms. The ceiling is well above 200's
 * worst, so a slower machine does not fail it, and at 100 ms it is about where a
 * pause is noticed. The drawing's own cost is measured in the e2e.
 */
const LAYOUT_200_MS = 100

describe('succession (D-3)', () => {
  const rels = [
    parent('king', 'elder', 'birth', null, 0), parent('king', 'younger', 'birth', null, 1),
    parent('elder', 'grandson'), parent('king', 'ward', 'adoptive'), parent('king', 'stepson', 'step'),
  ]
  const living = (dead: string[] = [], unborn: string[] = [], hidden: string[] = []): PersonStatus => (id) =>
    hidden.includes(id) ? null : { born: !unborn.includes(id), alive: !dead.includes(id) }

  it('eldest first: each child in birth order with their own line before the next; adopted in, stepchildren out', () => {
    expect(successionLine({ founderId: 'king', rule: 'eldest', line: [] }, rels)).toEqual(['king', 'elder', 'grandson', 'younger', 'ward'])
  })

  it('by hand: the writer’s order, the founder first and once', () => {
    expect(successionLine({ founderId: 'king', rule: 'byHand', line: ['ward', 'king', 'younger'] }, rels)).toEqual(['king', 'ward', 'younger'])
  })

  it('at the cursor: the first born and alive holds it; a death moves everyone up; the unborn wait', () => {
    const line = successionLine({ founderId: 'king', rule: 'eldest', line: [] }, rels)
    expect(successionAt(line, living())).toEqual({ holder: 'king', heirs: ['elder', 'grandson', 'younger', 'ward'] })
    expect(successionAt(line, living(['king']))).toEqual({ holder: 'elder', heirs: ['grandson', 'younger', 'ward'] })
    expect(successionAt(line, living(['king'], ['grandson']))).toEqual({ holder: 'elder', heirs: ['younger', 'ward'] })
    expect(successionAt(line, living(['king', 'elder', 'grandson', 'younger', 'ward']))).toEqual({ holder: null, heirs: [] })
  })

  it('someone hidden from a reader is passed over without a gap', () => {
    const line = successionLine({ founderId: 'king', rule: 'eldest', line: [] }, rels)
    expect(successionAt(line, living([], [], ['grandson']))).toEqual({ holder: 'king', heirs: ['elder', 'younger', 'ward'] })
  })
})
