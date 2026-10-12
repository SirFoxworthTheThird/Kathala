import { describe, it, expect } from 'vitest'
import { relationshipsAtEnd } from '@/lib/relationshipsAtEnd'

/** Scenes e1…e5 in reading order. */
const order = (id: string) => ({ e1: 1, e2: 2, e3: 3, e4: 4, e5: 5 } as Record<string, number>)[id] ?? null
const rel = (id: string, startEventId: string | null) => ({ id, startEventId })

describe('relationshipsAtEnd (writer run 7, W7-4)', () => {
  it('lists every relationship begun by the moment, with its state where one is recorded and without where none is', () => {
    const rows = relationshipsAtEnd({
      relationships: [rel('host', 'e1'), rel('protector', 'e4'), rel('before', null), rel('later', 'e5')],
      states: [{ relationshipId: 'host', label: 'Suspicion' }],
      at: order('e4'),
      order,
    })
    expect(rows.map((r) => [r.relationship.id, r.state?.label ?? null])).toEqual([
      ['host', 'Suspicion'],
      // Began in this very scene and never changed: there, as it began.
      ['protector', null],
      // Began before the story.
      ['before', null],
    ])
  })

  it('lists nothing where there is no moment, and leaves out one that begins at a scene it does not know', () => {
    expect(relationshipsAtEnd({ relationships: [rel('host', 'e1')], states: [], at: null, order })).toEqual([])
    expect(relationshipsAtEnd({ relationships: [rel('lost', 'gone')], states: [], at: order('e5'), order })).toEqual([])
  })
})
