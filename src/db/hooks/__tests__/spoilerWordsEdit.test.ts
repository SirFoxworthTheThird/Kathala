import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createKnowledgeFact, editSpoilerWords } from '@/db/hooks/useKnowledge'

/**
 * A fact's spoiler words, changed from what is stored: a suggestion clicked
 * and a word typed straight after both land, where the second used to write
 * over the first from the list as it was before.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

describe('editSpoilerWords', () => {
  it('keeps both of two edits made at once', async () => {
    const fact = await createKnowledgeFact({ worldId: 'w', title: 'Ilse Varga flew Deck Nine down', description: '', tags: [], originEventId: null })
    await Promise.all([
      editSpoilerWords(fact.id, (w) => [...w, 'Ilse Varga']),
      editSpoilerWords(fact.id, (w) => [...w, 'the Opener']),
    ])
    expect((await db.knowledgeFacts.get(fact.id))?.spoilerWords).toEqual(['Ilse Varga', 'the Opener'])
    await editSpoilerWords(fact.id, (w) => w.filter((x) => x !== 'Ilse Varga'))
    expect((await db.knowledgeFacts.get(fact.id))?.spoilerWords).toEqual(['the Opener'])
  })
})
