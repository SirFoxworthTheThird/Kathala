import { describe, it, expect } from 'vitest'
import { formatSceneHeader, parseSceneHeader, splitSceneHeader, sceneBody } from '@/lib/sceneHeader'

/**
 * `[#The Kitchen @@Wren @@Sal'ka]` — where the scene happens and who is in it,
 * said in the act of writing rather than in a panel beside it.
 *
 * The header is rendered from the records and parsed back, never stored, so
 * these two functions are the whole seam. A round trip that loses a name loses
 * a character from somebody's book.
 */
describe('the scene header', () => {
  it('survives a round trip, names with spaces and all', () => {
    // 68% of the names in the shipped library are not one word, so this is the
    // ordinary case rather than the awkward one.
    const header = { place: 'The Kitchen', characters: ['Wren Halloway', "Sal'ka"] }
    expect(parseSceneHeader(formatSceneHeader(header))).toEqual(header)
  })

  it('renders nothing when there is nothing to say', () => {
    expect(formatSceneHeader({ place: null, characters: [] })).toBe('')
  })

  it('reads a place or a cast on their own', () => {
    expect(parseSceneHeader('[#The Kitchen]')).toEqual({ place: 'The Kitchen', characters: [] })
    expect(parseSceneHeader('[@@Wren]')).toEqual({ place: null, characters: ['Wren'] })
  })

  it('takes the first place and ignores a second', () => {
    // A scene happens in one place. Two is a writer mid-edit, not a claim.
    expect(parseSceneHeader('[#Kitchen #Hallway]').place).toBe('Kitchen')
  })

  it('does not record the same character twice', () => {
    expect(parseSceneHeader('[@@Wren @@Wren]').characters).toEqual(['Wren'])
  })

  it('reads a half-typed line as far as it goes', () => {
    // The normal state of a line somebody is typing. Returning nulls beats
    // throwing, and beats guessing at what the rest was going to say.
    expect(parseSceneHeader('[#Kit')).toEqual({ place: null, characters: [] })
    expect(parseSceneHeader('[#Kitchen @@]')).toEqual({ place: 'Kitchen', characters: [] })
  })
})

describe('telling a header from prose that starts with a bracket', () => {
  it('takes a complete first line', () => {
    const { header, body } = splitSceneHeader('[#Kitchen @@Wren]\nShe put the kettle on.')
    expect(header).toBe('[#Kitchen @@Wren]')
    expect(body).toBe('She put the kettle on.')
  })

  it('leaves prose alone, including prose in brackets', () => {
    /*
      The pair, and the half that matters: prose opens with a bracket often
      enough — a stage direction, an aside, an editorial note to self — and
      swallowing the first line of somebody's scene would be unforgivable.
    */
    expect(splitSceneHeader('[she thought]').header).toBe('[she thought]')
    expect(splitSceneHeader('[an unclosed thought\nand the next line').header).toBeNull()
    /*
      The one that matters, and the one my first version missed: a bracket
      opened on the first line and closed further down the scene. A header
      that may span newlines swallows everything between — a paragraph of
      somebody's book, silently, into a cast list.
    */
    expect(splitSceneHeader('[she thought, and did not say\nso the kettle sang] alone.').header).toBeNull()
    expect(splitSceneHeader('She put the kettle on.').header).toBeNull()
    expect(splitSceneHeader('She put the kettle on.\n[#Kitchen]').header).toBeNull()
  })

  it('strips the header for everything downstream', () => {
    /*
      What the manuscript, the exports, search and the word count all see —
      and the blank line that separated the header from the prose goes with
      it, so a scene does not compile with a stray leading newline.
    */
    expect(sceneBody('[#Kitchen @@Wren]\n\nShe put the kettle on.')).toBe('She put the kettle on.')
    expect(sceneBody('[#Kitchen]\nShe put the kettle on.')).toBe('She put the kettle on.')
    expect(sceneBody('She put the kettle on.')).toBe('She put the kettle on.')
  })
})
