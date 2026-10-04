import { describe, it, expect } from 'vitest'
import { sceneInBand } from '../sceneInBand'

/** Three scenes: two in one chapter, then a heading's gap, then the next chapter's first. */
const scenes = [
  { id: 'a', top: 0, bottom: 400 },
  { id: 'b', top: 400, bottom: 800 },
  { id: 'c', top: 900, bottom: 1300 },
]

describe('sceneInBand', () => {
  it('is the scene in the band, the topmost where two share it', () => {
    expect(sceneInBand(scenes, 100, 200)).toBe('a')
    expect(sceneInBand(scenes, 350, 450)).toBe('a')
    expect(sceneInBand(scenes, 1000, 1100)).toBe('c')
  })

  it('between two scenes — a chapter heading in the band — is the scene below, which the heading starts', () => {
    expect(sceneInBand(scenes, 810, 890)).toBe('c')
  })

  it('above the first scene is the first, and past the last is the last', () => {
    expect(sceneInBand(scenes, -200, -100)).toBe('a')
    expect(sceneInBand(scenes, 1400, 1500)).toBe('c')
  })

  it('is nothing in a book with no scenes', () => {
    expect(sceneInBand([], 0, 100)).toBeNull()
  })
})
