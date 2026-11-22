import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, deleteCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { createRelationship } from '@/db/hooks/useRelationships'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { undoLast } from '@/db/hooks/useOperations'
import { makeSeries } from '@/db/hooks/useSeries'
import { createSequelWorld } from '@/db/hooks/useSequel'
import { addParent, addPartner, changeKinKind, orderChildren, partnershipAt, removeKin } from '@/db/hooks/useKinship'
import { createSuccession, deleteSuccession, updateSuccession } from '@/db/hooks/useSuccessions'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'
import { childrenOf, parentLinks } from '@/lib/kinship'

/**
 * A family in the store (issue #702): parents and partners written onto
 * relationships, a cycle refused, partnerships over time, children in birth
 * order, successions with their cascades, and all of it journalled, carried by
 * a backup and a merge, kept by a series and remapped by a sequel.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function family() {
  const world = await createWorld({ name: 'The Heights', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ev = (k: number) => createEvent({ worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `S${k}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: k })
  const s1 = await ev(0)
  const s2 = await ev(1)
  const person = (name: string) => createCharacter({ worldId: world.id, name, description: '' })
  const earnshaw = await person('Mr Earnshaw')
  const hindley = await person('Hindley')
  const catherine = await person('Catherine')
  const frances = await person('Frances')
  const hareton = await person('Hareton')
  return { world, s1, s2, earnshaw, hindley, catherine, frances, hareton }
}

const rels = () => db.relationships.toArray()

describe('parents (D-1, D-4)', () => {
  it('a parent link made for itself names its parent, and the children keep their order', async () => {
    const { world, earnshaw, hindley, catherine } = await family()
    const a = await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    const b = await addParent(world.id, earnshaw.id, catherine.id, 'birth')
    expect(a).toMatchObject({ characterAId: earnshaw.id, characterBId: hindley.id, label: 'parent and child', kinship: { kind: 'parent', parentId: earnshaw.id, parent: 'birth', order: 0, own: true } })
    expect(b.kinship).toMatchObject({ order: 1 })
    expect(childrenOf(earnshaw.id, parentLinks(await rels())).map((l) => l.childId)).toEqual([hindley.id, catherine.id])

    // Catherine is the elder: one undo puts them back.
    await orderChildren(world.id, earnshaw.id, [catherine.id, hindley.id])
    expect(childrenOf(earnshaw.id, parentLinks(await rels())).map((l) => l.childId)).toEqual([catherine.id, hindley.id])
    await undoLast(world.id)
    expect(childrenOf(earnshaw.id, parentLinks(await rels())).map((l) => l.childId)).toEqual([hindley.id, catherine.id])
  })

  it('goes on the relationship the writer already has, whichever way round it was written, keeping its words', async () => {
    const { world, earnshaw, hindley } = await family()
    // Written child first, as *son and father* is in the Library six times.
    const theirs = await createRelationship({ worldId: world.id, characterAId: hindley.id, characterBId: earnshaw.id, label: 'son and father', strength: 'strong', sentiment: 'complex', description: 'A cold house.', isBidirectional: true })
    await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    expect(await rels()).toHaveLength(1)
    expect(await db.relationships.get(theirs.id)).toMatchObject({ label: 'son and father', description: 'A cold house.', kinship: { kind: 'parent', parentId: earnshaw.id } })
    expect(parentLinks(await rels())).toEqual([expect.objectContaining({ parentId: earnshaw.id, childId: hindley.id })])
    // Taking the kinship away leaves the writer's relationship, as it was.
    await removeKin(theirs.id)
    expect(await db.relationships.get(theirs.id)).toMatchObject({ label: 'son and father' })
    expect((await db.relationships.get(theirs.id))?.kinship).toBeUndefined()
    await undoLast(world.id)
    expect((await db.relationships.get(theirs.id))?.kinship).toMatchObject({ kind: 'parent' })
  })

  it('one made for the kinship goes with it, and undo brings it back', async () => {
    const { world, earnshaw, hindley } = await family()
    const r = await addParent(world.id, earnshaw.id, hindley.id, 'adoptive')
    await changeKinKind(r.id, 'birth')
    expect((await db.relationships.get(r.id))?.kinship).toMatchObject({ parent: 'birth' })
    await removeKin(r.id)
    expect(await rels()).toHaveLength(0)
    await undoLast(world.id)
    expect(await db.relationships.get(r.id)).toMatchObject({ kinship: { parent: 'birth' } })
  })

  it('refuses a cycle, a link already there, and partners, each saying why', async () => {
    const { world, earnshaw, hindley, hareton, frances } = await family()
    await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    await addParent(world.id, hindley.id, hareton.id, 'birth')
    await expect(addParent(world.id, hindley.id, hindley.id, 'birth')).rejects.toThrow('Hindley cannot be their own parent.')
    await expect(addParent(world.id, earnshaw.id, hindley.id, 'step')).rejects.toThrow('Mr Earnshaw is already Hindley’s parent.')
    await expect(addParent(world.id, hindley.id, earnshaw.id, 'birth')).rejects.toThrow('Mr Earnshaw is Hindley’s parent, so Hindley cannot be theirs.')
    await expect(addParent(world.id, hareton.id, earnshaw.id, 'adoptive')).rejects.toThrow('Mr Earnshaw is one of Hareton’s ancestors')
    await addPartner(world.id, hindley.id, frances.id, 'married')
    await expect(addParent(world.id, frances.id, hindley.id, 'step')).rejects.toThrow('already family, as partners')
    await expect(addPartner(world.id, frances.id, hindley.id, 'married')).rejects.toThrow('Frances and Hindley are already partners.')
    await expect(addPartner(world.id, earnshaw.id, hindley.id, 'married')).rejects.toThrow('already family, as parent and child')
    // Nothing was written by any of them.
    expect(await rels()).toHaveLength(3)
  })
})

describe('partners over time (D-4)', () => {
  it('betrothed, then married, then over: each a state at its scene', async () => {
    const { world, s1, s2, hindley, frances } = await family()
    const r = await addPartner(world.id, hindley.id, frances.id, 'betrothed', s1.id)
    expect(r).toMatchObject({ startEventId: s1.id, label: 'betrothed', kinship: { kind: 'partner', partner: 'betrothed' } })
    await partnershipAt(world.id, r.id, s2.id, { partner: 'married' })
    let states = await db.relationshipSnapshots.where('relationshipId').equals(r.id).toArray()
    // Married is a change though nothing else is: it was not taken for a repeat.
    expect(states).toEqual([expect.objectContaining({ eventId: s2.id, partner: 'married', isActive: true })])
    await partnershipAt(world.id, r.id, s2.id, { ended: true })
    states = await db.relationshipSnapshots.where('relationshipId').equals(r.id).toArray()
    expect(states).toEqual([expect.objectContaining({ eventId: s2.id, partner: 'married', isActive: false })])
    await undoLast(world.id)
    expect((await db.relationshipSnapshots.where('relationshipId').equals(r.id).first())?.isActive).toBe(true)
  })

  it('a state is written only for a partnership', async () => {
    const { world, s1, earnshaw, hindley } = await family()
    const r = await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    expect(await partnershipAt(world.id, r.id, s1.id, { ended: true })).toBeUndefined()
    expect(await db.relationshipSnapshots.count()).toBe(0)
  })
})

describe('never on stage (D-5)', () => {
  it('is a field of the character, journalled', async () => {
    const { world, earnshaw } = await family()
    await updateCharacter(earnshaw.id, { offStage: true })
    expect((await db.characters.get(earnshaw.id))?.offStage).toBe(true)
    await undoLast(world.id)
    expect((await db.characters.get(earnshaw.id))?.offStage).toBeUndefined()
  })
})

describe('successions (D-3)', () => {
  it('are made, changed and deleted, each one undo, and refused without a name', async () => {
    const { world, earnshaw, hindley, catherine } = await family()
    await expect(createSuccession(world.id, { title: '  ', founderId: earnshaw.id })).rejects.toThrow('A succession needs a name')
    const s = await createSuccession(world.id, { title: ' The Heights ', founderId: earnshaw.id })
    expect(s).toMatchObject({ title: 'The Heights', rule: 'eldest', line: [] })
    // The founder is never in their own line.
    await updateSuccession(s.id, { rule: 'byHand', line: [earnshaw.id, catherine.id, hindley.id] })
    expect(await db.successions.get(s.id)).toMatchObject({ rule: 'byHand', line: [catherine.id, hindley.id] })
    await undoLast(world.id)
    expect(await db.successions.get(s.id)).toMatchObject({ rule: 'eldest', line: [] })
    await deleteSuccession(s.id)
    expect(await db.successions.count()).toBe(0)
    await undoLast(world.id)
    expect(await db.successions.get(s.id)).toMatchObject({ title: 'The Heights' })
  })

  it('a founder’s delete takes their successions; anyone else’s takes them out of a line; one undo brings both back', async () => {
    const { world, earnshaw, hindley, catherine, hareton } = await family()
    const heights = await createSuccession(world.id, { title: 'The Heights', founderId: earnshaw.id, rule: 'byHand', line: [hindley.id, catherine.id] })
    const grange = await createSuccession(world.id, { title: 'The Grange', founderId: catherine.id, line: [hareton.id] })
    await deleteCharacter(catherine.id)
    expect(await db.successions.get(grange.id)).toBeUndefined()
    expect(await db.successions.get(heights.id)).toMatchObject({ line: [hindley.id] })
    await undoLast(world.id)
    expect(await db.successions.get(grange.id)).toMatchObject({ founderId: catherine.id })
    expect(await db.successions.get(heights.id)).toMatchObject({ line: [hindley.id, catherine.id] })
  })
})

describe('a family in a backup, a merge, a series and a sequel', () => {
  it('travels in a .pwk, kinship and successions; a file before them imports as none', async () => {
    const { world, earnshaw, hindley, frances } = await family()
    await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    await addPartner(world.id, hindley.id, frances.id, 'married')
    await createSuccession(world.id, { title: 'The Heights', founderId: earnshaw.id })
    const file = JSON.parse(await serializeWorldForSync(world.id))
    expect(file.version).toBe(24)
    expect(file.successions).toHaveLength(1)
    expect(file.relationships.filter((r: { kinship?: unknown }) => r.kinship)).toHaveLength(2)

    await db.delete()
    await db.open()
    await importWorldFromJson(JSON.stringify(file))
    expect(parentLinks(await rels())).toEqual([expect.objectContaining({ parentId: earnshaw.id, childId: hindley.id, parent: 'birth' })])
    expect(await db.successions.toArray()).toEqual([expect.objectContaining({ title: 'The Heights', founderId: earnshaw.id })])

    const older = { ...file, version: 23 }
    delete older.successions
    await importWorldFromJson(JSON.stringify(older))
    expect(await db.successions.count()).toBe(0)
  })

  it('merge: a succession made there arrives, and one deleted here is not brought back', async () => {
    const { world, earnshaw, hindley } = await family()
    const kept = await createSuccession(world.id, { title: 'The Heights', founderId: earnshaw.id })
    const gone = await createSuccession(world.id, { title: 'The Mill', founderId: hindley.id })
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    theirs.successions.push({ ...kept, id: 'from-there', title: 'The Grange' })
    await deleteSuccession(gone.id)
    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    expect((await db.successions.toArray()).map((s) => s.title).sort()).toEqual(['The Grange', 'The Heights'])
  })

  it('in a series, successions are the series’', async () => {
    const { world, earnshaw } = await family()
    const s = await createSuccession(world.id, { title: 'The Heights', founderId: earnshaw.id })
    const series = await makeSeries(world.id, 'The Earnshaws')
    expect((await db.successions.get(s.id))?.worldId).toBe(series.id)
    const later = await createSuccession(world.id, { title: 'The Grange', founderId: earnshaw.id })
    expect(later.worldId).toBe(series.id)
  })

  it('a sequel points kinship and successions at its own people, and leaves out who did not come', async () => {
    const { world, s2, earnshaw, hindley, frances, hareton } = await family()
    await addParent(world.id, earnshaw.id, hindley.id, 'birth')
    const wed = await addPartner(world.id, hindley.id, frances.id, 'betrothed')
    await partnershipAt(world.id, wed.id, s2.id, { partner: 'married' })
    await createSuccession(world.id, { title: 'The Heights', founderId: earnshaw.id, rule: 'byHand', line: [hindley.id, hareton.id] })
    await createSuccession(world.id, { title: 'The Grange', founderId: frances.id })
    const twoId = await createSequelWorld(world.id, { characterIds: [earnshaw.id, hindley.id, frances.id], itemIds: [], factionIds: [], mapLayerIds: [] }, { name: 'Two' })
    const two = await db.characters.where('worldId').equals(twoId).toArray()
    const id = (name: string) => two.find((c) => c.name === name)!.id
    const theirs = await db.relationships.where('worldId').equals(twoId).toArray()
    expect(parentLinks(theirs)).toEqual([expect.objectContaining({ parentId: id('Mr Earnshaw'), childId: id('Hindley') })])
    // The partnership as the book ended it.
    expect(theirs.find((r) => r.kinship?.kind === 'partner')?.kinship).toMatchObject({ partner: 'married' })
    const successions = await db.successions.where('worldId').equals(twoId).toArray()
    expect(successions.map((s) => ({ title: s.title, founderId: s.founderId, line: s.line })).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
      { title: 'The Grange', founderId: id('Frances'), line: [] },
      { title: 'The Heights', founderId: id('Mr Earnshaw'), line: [id('Hindley')] },
    ])
  })
})
