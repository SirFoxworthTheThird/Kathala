import { describe, it, expect } from 'vitest'
import {
  levelsInGroup, groupRepresentativeId, isTreeVisible, treeVisibleLayers, nextLevelIndexAbove,
  type LevelLayer,
} from '@/lib/mapLevels'

// A world: standalone map S; a castle group G with dungeons(-1), ground(0), first(1).
const S: LevelLayer = { id: 'S', levelGroupId: null, levelIndex: 0 }
const G_dungeon: LevelLayer = { id: 'Gd', levelGroupId: 'G', levelIndex: -1 }
const G_ground: LevelLayer = { id: 'Gg', levelGroupId: 'G', levelIndex: 0 }
const G_first: LevelLayer = { id: 'G1', levelGroupId: 'G', levelIndex: 1 }
const layers = [S, G_first, G_dungeon, G_ground]

describe('levelsInGroup', () => {
  it('orders a group bottom → top', () => {
    expect(levelsInGroup(layers, 'G').map((l) => l.id)).toEqual(['Gd', 'Gg', 'G1'])
  })
  it('is empty for null or an unknown group', () => {
    expect(levelsInGroup(layers, null)).toEqual([])
    expect(levelsInGroup(layers, 'nope')).toEqual([])
  })
})

describe('groupRepresentativeId', () => {
  it('is the ground floor (index 0)', () => {
    expect(groupRepresentativeId(layers, 'G')).toBe('Gg')
  })
  it('falls back to the member nearest index 0', () => {
    const noGround = [G_dungeon, G_first]
    // |−1| < |1| → dungeon represents.
    expect(groupRepresentativeId(noGround, 'G')).toBe('Gd')
  })
})

describe('isTreeVisible / treeVisibleLayers', () => {
  it('shows standalone maps and only the representative floor of a group', () => {
    expect(isTreeVisible(layers, S)).toBe(true)
    expect(isTreeVisible(layers, G_ground)).toBe(true)   // representative
    expect(isTreeVisible(layers, G_first)).toBe(false)   // hidden floor
    expect(isTreeVisible(layers, G_dungeon)).toBe(false) // hidden floor
    expect(treeVisibleLayers(layers).map((l) => l.id).sort()).toEqual(['Gg', 'S'])
  })
})

describe('nextLevelIndexAbove', () => {
  it('is one above the top floor', () => {
    expect(nextLevelIndexAbove(layers, 'G')).toBe(2)
  })
})
