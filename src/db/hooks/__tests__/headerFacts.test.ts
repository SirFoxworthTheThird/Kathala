import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createHeaderFact, createKnowledgeFact, recordFactChanges } from '@/db/hooks/useKnowledge'
import { sceneFacts } from '@/lib/sceneHeader'

/**
 * The Facts line in a scene's header (docs/records/scene-header-block-plan.md,
 * part 4): the reveals and the fact fields it writes, and takes back.
 */

const none = { learn: [], unlearn: [], readerHere: [], readerOff: [], originHere: [], originOff: [] }
let notary = ''

beforeEach(async () => {
  await db.delete()
  await db.open()
  notary = (await createKnowledgeFact({ worldId: 'w', title: 'Dask is the Grey Notary', description: '', tags: [] })).id
})
afterAll(async () => { await db.delete() })

const drawn = async (eventId: string) => sceneFacts(eventId, await db.knowledgeReveals.toArray(), await db.knowledgeFacts.toArray())

describe('the Facts line, written', () => {
  it('a learner, the reader, and the fact becoming true: each at this scene, and drawn there', async () => {
    await recordFactChanges('w', 'e2', { ...none, learn: [{ factId: notary, characterId: 'sab' }], readerHere: [notary], originHere: [notary] })
    expect(await db.knowledgeReveals.toArray()).toMatchObject([{ worldId: 'w', factId: notary, characterId: 'sab', eventId: 'e2' }])
    expect(await db.knowledgeFacts.get(notary)).toMatchObject({ readerLearnsAtEventId: 'e2', originEventId: 'e2' })
    expect(await drawn('e2')).toEqual({ learned: [{ factId: notary, characterId: 'sab' }], before: [], reader: [notary], origin: [notary] })
    expect(await drawn('e1')).toEqual({ learned: [], before: [], reader: [], origin: [] })
  })

  it('makes no second reveal at a scene that has one, and takes one back from this scene only', async () => {
    await recordFactChanges('w', 'e2', { ...none, learn: [{ factId: notary, characterId: 'sab' }] })
    await recordFactChanges('w', 'e2', { ...none, learn: [{ factId: notary, characterId: 'sab' }] })
    await recordFactChanges('w', 'e5', { ...none, learn: [{ factId: notary, characterId: 'sab' }] })
    expect(await db.knowledgeReveals.count()).toBe(2)
    await recordFactChanges('w', 'e2', { ...none, unlearn: [{ factId: notary, characterId: 'sab' }], readerOff: [notary] })
    expect((await db.knowledgeReveals.toArray()).map((r) => r.eventId)).toEqual(['e5'])
    expect(await db.knowledgeFacts.get(notary)).toMatchObject({ readerLearnsAtEventId: null })
  })

  it('several records are one act, for undo', async () => {
    await recordFactChanges('w', 'e2', { ...none, learn: [{ factId: notary, characterId: 'sab' }, { factId: notary, characterId: 'pell' }], readerHere: [notary] })
    const ops = (await db.operations.orderBy('seq').toArray()).filter((o) => o.groupLabel === 'Facts at this scene')
    expect(ops).toHaveLength(3)
    expect(new Set(ops.map((o) => o.groupId)).size).toBe(1)
  })

  it('a fact made from the note is made once, whatever its case', async () => {
    const a = await createHeaderFact('w', 'The ledger is forged')
    const b = await createHeaderFact('w', ' the Ledger is Forged ')
    expect(a).toBe(b)
    expect(await createHeaderFact('w', 'Dask is the Grey Notary')).toBe(notary)
    expect(await db.knowledgeFacts.count()).toBe(2)
  })

  it('known before the story: filed at the first scene and marked so, wherever it was typed, and said where (writer run 9)', async () => {
    const ev = (id: string, sortOrder: number) => ({ id, worldId: 'w', chapterId: 'c1', timelineId: 't', title: id === 'e1' ? 'Flat 114' : 'Corn Street', description: '', sortOrder, tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0 })
    await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 't', number: 1, title: 'Cold Room', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 } as never)
    await db.events.bulkAdd([ev('e2', 2), ev('e1', 1)] as never)

    // Typed at the second scene: filed at the first, and the caller is told so.
    expect(await recordFactChanges('w', 'e2', { ...none, knownBefore: [{ factId: notary, characterId: 'nell' }] })).toEqual({ filedAt: 'e1' })
    expect(await db.knowledgeReveals.toArray()).toMatchObject([{ factId: notary, characterId: 'nell', eventId: 'e1', beforeStory: true }])
    expect((await drawn('e1')).before).toEqual([{ factId: notary, characterId: 'nell' }])
    // Said again, nothing more is made; typed at the first scene itself, nothing to say.
    expect(await recordFactChanges('w', 'e1', { ...none, knownBefore: [{ factId: notary, characterId: 'nell' }] })).toEqual({ filedAt: null })
    expect(await db.knowledgeReveals.count()).toBe(1)
    // Taken off the first scene's line: gone.
    await recordFactChanges('w', 'e1', { ...none, knownBeforeOff: [{ factId: notary, characterId: 'nell' }] })
    expect(await db.knowledgeReveals.count()).toBe(0)
  })
})
