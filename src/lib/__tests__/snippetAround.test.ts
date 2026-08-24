import { describe, it, expect } from 'vitest'
import { snippetAround } from '../snippet'

const SCENE =
  'The towpath was slick with the morning and Mira kept to the inside of it, ' +
  'where the reeds gave a little cover. Above the counting-house a shutter ' +
  'knocked twice against its frame, and she counted eleven names without ' +
  'meaning to, the way you count stairs in the dark.'

describe('snippetAround', () => {
  it('shows the part of the scene the query matched', () => {
    const out = snippetAround(SCENE, 'shutter')!
    expect(out.toLowerCase()).toContain('shutter')
    // …and not merely the opening, which is what the old preview would give.
    expect(out).not.toContain('The towpath was slick')
  })

  it('marks that the preview started mid-scene', () => {
    expect(snippetAround(SCENE, 'shutter')!.startsWith('…')).toBe(true)
  })

  it('does not lead with an ellipsis when the match is at the start', () => {
    const out = snippetAround(SCENE, 'towpath')!
    expect(out.startsWith('…')).toBe(false)
    expect(out.toLowerCase()).toContain('towpath')
  })

  it('keeps a match near the end visible', () => {
    const out = snippetAround(SCENE, 'stairs')!
    expect(out.toLowerCase()).toContain('stairs')
  })

  it('stays inside the limit it was given', () => {
    for (const q of ['shutter', 'towpath', 'eleven', 'stairs']) {
      expect(snippetAround(SCENE, q, 60)!.length).toBeLessThanOrEqual(60)
    }
  })

  it('flattens the line breaks a draft is full of', () => {
    const out = snippetAround('one\n\ntwo   three\nfour', 'three', 40)!
    expect(out).not.toMatch(/\n/)
    expect(out).toContain('two three')
  })

  it('falls back to a plain preview when the query is not in the text', () => {
    expect(snippetAround(SCENE, 'zeppelin', 30)).toBe(snippetAround(SCENE, '', 30))
  })

  it('returns nothing for empty prose, so a caller need not check', () => {
    expect(snippetAround('', 'x')).toBeUndefined()
    expect(snippetAround(null, 'x')).toBeUndefined()
    expect(snippetAround('   ', 'x')).toBeUndefined()
  })

  it('returns the whole thing when it already fits', () => {
    expect(snippetAround('a shutter knocked', 'shutter', 60)).toBe('a shutter knocked')
  })
})
