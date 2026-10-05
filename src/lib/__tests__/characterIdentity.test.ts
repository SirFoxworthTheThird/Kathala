import { describe, it, expect } from 'vitest'
import { revealTargets, revealReached, identityLinks, revealedHeads, presentRoster, resolveCast, resolveRecords, resolvePairs, resolveIds, firstLearned } from '../characterIdentity'

const jekyll = { id: 'jekyll' }
const hyde = { id: 'hyde', revealedAs: { characterId: 'jekyll', eventId: 'reveal' } }
const utterson = { id: 'utterson' }
const keys = new Map([['carew', 4.2], ['reveal', 9.4]])
const sortKeyOf = (id: string) => keys.get(id)

describe('revealTargets', () => {
  it('anyone but themself, and not someone already revealed as someone else', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'utterson').map((c) => c.id)).toEqual(['jekyll'])
  })

  it('nobody, for a head: no chains', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'jekyll')).toEqual([])
  })

  it('the revealed one may be re-pointed, but never at themself', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'hyde').map((c) => c.id)).toEqual(['jekyll', 'utterson'])
  })
})

describe('revealReached', () => {
  it('from the reveal scene on, or for the whole book', () => {
    expect(revealReached(hyde, 4.2, sortKeyOf)).toBe(false)
    expect(revealReached(hyde, 9.4, sortKeyOf)).toBe(true)
    expect(revealReached(hyde, null, sortKeyOf)).toBe(true)
  })

  it('never for a reveal whose scene cannot be placed, nor for one with no link', () => {
    expect(revealReached({ revealedAs: { characterId: 'jekyll', eventId: 'gone' } }, null, sortKeyOf)).toBe(false)
    expect(revealReached({}, null, sortKeyOf)).toBe(false)
  })
})

describe('identityLinks', () => {
  it('both directions, from the roster given', () => {
    expect(identityLinks([jekyll, hyde, utterson], 'hyde')).toEqual({ revealedAs: jekyll, alsoAs: [] })
    expect(identityLinks([jekyll, hyde, utterson], 'jekyll')).toEqual({ revealedAs: null, alsoAs: [hyde] })
    expect(identityLinks([jekyll, hyde, utterson], 'utterson')).toEqual({ revealedAs: null, alsoAs: [] })
  })

  it('nothing to someone not in the roster — a reader who has not met them', () => {
    expect(identityLinks([hyde, utterson], 'hyde')).toEqual({ revealedAs: null, alsoAs: [] })
  })
})

describe('revealedHeads and presentRoster (Part 2b)', () => {
  const person = (id: string, name: string, aliases: string[] = [], revealedAs?: { characterId: string; eventId: string }) =>
    ({ id, name, aliases, ...(revealedAs ? { revealedAs } : {}) })
  const J = person('jekyll', 'Dr Henry Jekyll', ['Harry'])
  const H = person('hyde', 'Edward Hyde', ['Mr Hyde'], { characterId: 'jekyll', eventId: 'reveal' })
  const U = person('utterson', 'Gabriel Utterson')
  const at = (cursor: number | null) => revealedHeads([J, H, U], (c) => revealReached(c, cursor, sortKeyOf))

  it('before the reveal: no heads, and the roster is as it was', () => {
    expect(at(4.2).size).toBe(0)
    expect(presentRoster([J, H, U], at(4.2)).map((c) => c.id)).toEqual(['jekyll', 'hyde', 'utterson'])
  })

  it('from the reveal: one person, carrying the other’s names, and saying who else they are', () => {
    expect([...at(9.4)]).toEqual([['hyde', 'jekyll']])
    const shown = presentRoster([J, H, U], at(9.4))
    expect(shown.map((c) => c.id)).toEqual(['jekyll', 'utterson'])
    expect(shown[0]).toMatchObject({ aliases: ['Harry', 'Edward Hyde', 'Mr Hyde'], alsoAs: [{ id: 'hyde', name: 'Edward Hyde', eventId: 'reveal' }] })
  })

  it('a group of three: two revealed as one head', () => {
    const P = person('poole', 'Poole', [], { characterId: 'jekyll', eventId: 'reveal' })
    const heads = revealedHeads([J, H, P], () => true)
    const shown = presentRoster([J, H, P], heads)
    expect(shown.map((c) => c.id)).toEqual(['jekyll'])
    expect(shown[0].alsoAs!.map((a) => a.id)).toEqual(['hyde', 'poole'])
  })

  it('a head not in the roster keeps the revealed one where they are, rather than nowhere', () => {
    expect(presentRoster([H, U], at(9.4)).map((c) => c.id)).toEqual(['hyde', 'utterson'])
  })
})

describe('resolving what a reader is handed (Part 2b)', () => {
  const identityOf = (id: string) => (id === 'hyde' ? 'jekyll' : id)

  it('a cast: Hyde as Jekyll, the pair once, POV and mentions too', () => {
    expect(resolveCast({ involvedCharacterIds: ['hyde', 'utterson', 'jekyll'], mentionedCharacterIds: ['hyde', 'poole'], povCharacterId: 'hyde' }, identityOf))
      .toEqual({ involvedCharacterIds: ['jekyll', 'utterson'], mentionedCharacterIds: ['poole'], povCharacterId: 'jekyll' })
    // Untouched where nobody is revealed: the very same object.
    const plain = { involvedCharacterIds: ['utterson'], mentionedCharacterIds: [], povCharacterId: null }
    expect(resolveCast(plain, identityOf)).toBe(plain)
  })

  it('records: each says the head; in a shared slot the head’s own is kept', () => {
    const snaps = [
      { id: 's1', characterId: 'hyde', eventId: 'e1' },
      { id: 's2', characterId: 'jekyll', eventId: 'e2' },
      { id: 's3', characterId: 'hyde', eventId: 'e2' },
      { id: 's4', characterId: 'utterson', eventId: 'e2' },
    ]
    const kept = resolveRecords(snaps, identityOf, (s) => s.eventId)
    expect(kept.map((s) => `${s.id}:${s.characterId}`)).toEqual(['s1:jekyll', 's2:jekyll', 's4:utterson'])
    // And the one kept where both were recorded says so, for the Arc grid's mark.
    expect(kept.map((s) => s.alsoRecordedAs ?? [])).toEqual([[], ['hyde'], []])
    // With no slot, all of them.
    expect(resolveRecords(snaps, identityOf).map((s) => s.characterId)).toEqual(['jekyll', 'jekyll', 'jekyll', 'utterson'])
  })

  it('pairs: an edge to Hyde is an edge to Jekyll; one between them is not drawn', () => {
    const rels = [
      { id: 'r1', characterAId: 'utterson', characterBId: 'hyde' },
      { id: 'r2', characterAId: 'hyde', characterBId: 'jekyll' },
      { id: 'r3', characterAId: 'utterson', characterBId: 'poole' },
    ]
    expect(resolvePairs(rels, identityOf)).toEqual([
      { id: 'r1', characterAId: 'utterson', characterBId: 'jekyll' },
      { id: 'r3', characterAId: 'utterson', characterBId: 'poole' },
    ])
  })

  it('ids: resolved, each once, and anything else left alone', () => {
    expect(resolveIds(['hyde', 'jekyll', 'soho', 'utterson'], identityOf)).toEqual(['jekyll', 'soho', 'utterson'])
  })
})

describe('firstLearned (Part 2b)', () => {
  it('each knower once per fact, at the earliest', () => {
    const pos = new Map([['e1', 1], ['e2', 2], ['e3', 3]])
    const reveals = [
      { id: 'a', factId: 'will', characterId: 'jekyll', eventId: 'e3' },
      { id: 'b', factId: 'will', characterId: 'jekyll', eventId: 'e1' },
      { id: 'c', factId: 'will', characterId: 'utterson', eventId: 'e2' },
      { id: 'd', factId: 'door', characterId: 'jekyll', eventId: 'e2' },
    ]
    expect(firstLearned(reveals, pos).map((r) => r.id)).toEqual(['b', 'c', 'd'])
  })
})
