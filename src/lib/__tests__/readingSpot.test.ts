import { describe, it, expect } from 'vitest'
import { spotFor, scrollFor, readSpot, spotStillApplies, type SceneExtent } from '@/lib/readingSpot'

const spot = (eventId: string, offset: number, cursorAt: string | null = 'cur') =>
  ({ eventId, offset, cursorAt })

const SCENES: SceneExtent[] = [
  { id: 'a', top: 0, height: 1000 },
  { id: 'b', top: 1000, height: 500 },
  { id: 'c', top: 1500, height: 2000 },
]

describe('spotFor', () => {
  it('names the scene the reader is inside, and how far in', () => {
    expect(spotFor(0, SCENES)).toEqual({ eventId: 'a', offset: 0 })
    expect(spotFor(1200, SCENES)).toEqual({ eventId: 'b', offset: 200 })
    expect(spotFor(1500, SCENES)).toEqual({ eventId: 'c', offset: 0 })
    expect(spotFor(9999, SCENES)).toEqual({ eventId: 'c', offset: 8499 })
  })

  it('has nothing to say about a book with no scenes', () => {
    expect(spotFor(400, [])).toBeNull()
  })
})

describe('scrollFor', () => {
  it('puts the reader back where they were', () => {
    expect(scrollFor(spot('b', 200), SCENES)).toBe(1200)
    expect(scrollFor(spot('a', 0), SCENES)).toBe(0)
  })

  it('gives up on a scene that is no longer there', () => {
    expect(scrollFor(spot('gone', 10), SCENES)).toBeNull()
    expect(scrollFor(null, SCENES)).toBeNull()
  })

  /*
    The direction that matters. A spot is stored in pixels inside one scene, and
    the reader can change the type size between visits — so the offset can be
    larger than the scene now is. Landing past the end of it means landing in
    prose they have not read.
  */
  it('never carries the reader past the end of the scene they were in', () => {
    expect(scrollFor(spot('b', 4000), SCENES)).toBe(1500)
    expect(scrollFor(spot('b', 4000), SCENES)).toBeLessThanOrEqual(SCENES[2].top)
  })

  it('and never above it', () => {
    expect(scrollFor(spot('b', -300), SCENES)).toBe(1000)
  })

  it('round-trips a spot it just took', () => {
    for (const scrollTop of [0, 250, 1000, 1499, 1500, 3400]) {
      expect(scrollFor(spotFor(scrollTop, SCENES), SCENES), `at ${scrollTop}`).toBe(scrollTop)
    }
  })
})

describe('readSpot', () => {
  it('reads back what was written', () => {
    expect(readSpot(JSON.stringify(spot('b', 12)))).toEqual({ eventId: 'b', offset: 12, cursorAt: 'cur' })
  })

  it('refuses anything that is not a spot, rather than restoring nonsense', () => {
    for (const raw of [null, '', 'not json', '[]', '{}', '{"eventId":"b"}', '{"offset":3}',
      '{"eventId":"","offset":3}', '{"eventId":"b","offset":"3"}', '{"eventId":"b","offset":null}']) {
      expect(readSpot(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('spotStillApplies', () => {
  /*
    A reader who scrolled back to chapter two and one who has just pressed
    **Read to here** on chapter ninety both leave a spot that sits behind the
    cursor. Position cannot tell them apart; whether the cursor moved while they
    were away can.
  */
  it('honours the spot when the cursor has not moved since', () => {
    expect(spotStillApplies(spot('b', 10, 'ch40'), 'ch40')).toBe(true)
    expect(spotStillApplies(spot('b', 10, null), null)).toBe(true)
  })

  it('stands aside when the reader has said where they are by another route', () => {
    expect(spotStillApplies(spot('b', 10, 'ch40'), 'ch90')).toBe(false)
    expect(spotStillApplies(spot('b', 10, 'ch40'), null)).toBe(false)
    expect(spotStillApplies(spot('b', 10, null), 'ch90')).toBe(false)
  })

  it('has nothing to honour without a spot', () => {
    expect(spotStillApplies(null, 'ch40')).toBe(false)
  })
})
