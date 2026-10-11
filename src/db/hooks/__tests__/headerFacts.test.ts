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
    expect(await drawn('e2')).toEqual({ learned: [{ factId: notary, characterId: 'sab' }], reader: [notary], origin: [notary] })
    expect(await drawn('e1')).toEqual({ learned: [], reader: [], origin: [] })
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
})
