import { describe, it, expect } from 'vitest'
import {
  castWithoutState,
  charactersInChapter,
  charactersNotInChapter,
  hasAnyCharacterState,
} from '../chapterCast'

const chars = [
  { id: 'frodo', name: 'Frodo' },
  { id: 'sam', name: 'Sam' },
  { id: 'strider', name: 'Strider' },
  { id: 'arwen', name: 'Arwen' },
  { id: 'bilbo', name: 'Bilbo' },
]

const ev = (id: string, cast: string[]) => ({ id, involvedCharacterIds: cast })
const snap = (eventId: string, characterId: string) => ({ eventId, characterId })

describe('castWithoutState', () => {
  it('names the cast members a scene records nothing about', () => {
    const flight = ev('e1', ['frodo', 'sam', 'strider'])
    const got = castWithoutState(flight, [snap('e1', 'frodo')], chars)
    expect(got.map((c) => c.id)).toEqual(['sam', 'strider'])
  })

  it('is empty when every cast member has state — the panel is not padded', () => {
    const flight = ev('e1', ['frodo', 'sam'])
    const got = castWithoutState(flight, [snap('e1', 'frodo'), snap('e1', 'sam')], chars)
    expect(got).toEqual([])
  })

  it('ignores state recorded at a different scene', () => {
    // The bug this guards: filtering the whole chapter's snapshots instead of
    // this scene's would call Sam covered here because he is covered next door.
    const flight = ev('e1', ['frodo', 'sam'])
    const got = castWithoutState(flight, [snap('e2', 'sam')], chars)
    expect(got.map((c) => c.id)).toEqual(['frodo', 'sam'])
  })

  it('keeps the order the scene lists its cast in', () => {
    const got = castWithoutState(ev('e1', ['strider', 'frodo', 'sam']), [], chars)
    expect(got.map((c) => c.id)).toEqual(['strider', 'frodo', 'sam'])
  })

  it('drops ids that no longer name a character', () => {
    const got = castWithoutState(ev('e1', ['frodo', 'deleted-id']), [], chars)
    expect(got.map((c) => c.id)).toEqual(['frodo'])
  })
})

describe('charactersInChapter', () => {
  it('counts being named in a scene, not only having state there', () => {
    // CD-1 itself: the old panel keyed off snapshots alone, so a named cast
    // member with nothing recorded was listed among the absent.
    const got = charactersInChapter([ev('e1', ['frodo'])], [])
    expect([...got]).toEqual(['frodo'])
  })

  it('unions cast and state across every scene', () => {
    const got = charactersInChapter(
      [ev('e1', ['frodo']), ev('e2', ['sam'])],
      [snap('e2', 'strider')],
    )
    expect([...got].sort()).toEqual(['frodo', 'sam', 'strider'])
  })
})

describe('charactersNotInChapter', () => {
  it('is everyone else, and only everyone else', () => {
    const got = charactersNotInChapter(
      chars,
      [ev('e1', ['frodo', 'sam'])],
      [snap('e1', 'strider')],
    )
    expect(got.map((c) => c.id)).toEqual(['arwen', 'bilbo'])
  })

  it('is empty when the chapter uses the whole cast', () => {
    const all = ev('e1', chars.map((c) => c.id))
    expect(charactersNotInChapter(chars, [all], [])).toEqual([])
  })
})

describe('hasAnyCharacterState', () => {
  it('is false for scenes with no cast and no state — the empty state (EV-2)', () => {
    expect(hasAnyCharacterState([ev('e1', []), ev('e2', [])], [])).toBe(false)
  })

  it('is true on a cast alone, before anything is recorded', () => {
    expect(hasAnyCharacterState([ev('e1', ['frodo'])], [])).toBe(true)
  })

  it('is true on state alone, for a snapshot taken outside any listed cast', () => {
    expect(hasAnyCharacterState([ev('e1', [])], [snap('e1', 'frodo')])).toBe(true)
  })

  it('is false with no scenes at all — that is the "no events yet" state', () => {
    expect(hasAnyCharacterState([], [snap('e1', 'frodo')])).toBe(false)
  })
})
