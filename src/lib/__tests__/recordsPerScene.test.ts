import { describe, it, expect } from 'vitest'
import { recordsPerScene, sceneFates } from '@/lib/sceneHeader'

/**
 * Drawing every scene's header at once hands each scene only the records it
 * reads (Part C): those of the people recorded there, with their others for
 * the one before. The fates drawn are the same as from the whole list.
 */

const rec = (characterId: string, eventId: string, isAlive: boolean, sortKey: number, revived = false) => ({ characterId, eventId, isAlive, revived, sortKey })
const records = [
  rec('anna', 'e1', true, 1), rec('anna', 'e3', false, 3),
  rec('bruno', 'e2', false, 2), rec('bruno', 'e4', true, 4, true),
  rec('carla', 'e3', false, 3),
  // Dead already at e1: at e3 there is no new death to draw, which only the record before says.
  rec('dino', 'e1', false, 1), rec('dino', 'e3', false, 3),
]

describe('recordsPerScene', () => {
  it('gives each scene the records of the people recorded there, and nobody else’s', () => {
    const of = recordsPerScene(records)
    expect(of('e3').map((r) => `${r.characterId}@${r.eventId}`).sort()).toEqual(['anna@e1', 'anna@e3', 'carla@e3', 'dino@e1', 'dino@e3'])
    expect(of('e9')).toEqual([])
  })

  it('draws the same fates as the whole list, at every scene', () => {
    const of = recordsPerScene(records)
    for (const e of ['e1', 'e2', 'e3', 'e4']) {
      const cast = ['anna', 'bruno', 'carla', 'dino']
      expect(sceneFates(e, cast, of(e), ['carla'])).toEqual(sceneFates(e, cast, records, ['carla']))
    }
    // Paired: the fates are not empty, so the comparison compares something.
    expect(sceneFates('e3', ['anna', 'carla', 'dino'], of('e3')).dead.sort()).toEqual(['anna', 'carla'])
  })
})
