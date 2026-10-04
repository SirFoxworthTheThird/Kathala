import { describe, it, expect } from 'vitest'
import { formatSceneHeader, parseSceneHeader, splitSceneDraft, splitSceneHeader, sceneBody, planHeader, planIsClean } from '@/lib/sceneHeader'

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
    /*
      This line used to assert the opposite — that `[she thought]` *is* a
      header — inside a test named for leaving prose alone. It was the leak,
      written down as intent: a bracket naming nobody and nowhere was read as
      a declaration, which emptied the scene and pushed the real line into the
      book.
    */
    expect(splitSceneHeader('[she thought]').header).toBeNull()
    expect(splitSceneHeader('[check: low water, or after it?]').header).toBeNull()
    // Shape is not enough; naming somebody is.
    expect(splitSceneHeader('[@@Wren]').header).toBe('[@@Wren]')
    expect(splitSceneHeader('[#Kitchen]').header).toBe('[#Kitchen]')
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

describe('the line the box was given', () => {
  const rendered = '[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]'

  it('lifts the rendered line back out when a note is typed above it', () => {
    /*
      The whole H-1 loss, and the half `splitSceneHeader` cannot see on its
      own. A margin note above the line pushes it to row two, where a cold read
      has to call it prose — and it exported as prose, as a paragraph of
      somebody's book.

      Knowing what we rendered is what settles it: the note stays, as the prose
      it is, and the line stays the line.
    */
    const typed = `[check: low water?]\n${rendered}\n\nThe stair went down in eleven steps.`
    const { header, body } = splitSceneDraft(typed, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('[check: low water?]\n\nThe stair went down in eleven steps.')
    expect(body).not.toContain('@@')
  })

  it('lifts it out when the note is typed on the same line, with no newline', () => {
    const typed = `[check: low water?]${rendered}\n\nThe stair went down.`
    const { header, body } = splitSceneDraft(typed, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('[check: low water?]\nThe stair went down.')
  })

  it('reads the line normally when it is still the first thing in the box', () => {
    // The presence half: displacement is the exception, not the path.
    const { header, body } = splitSceneDraft(`${rendered}\n\nThe stair went down.`, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('The stair went down.')
  })

  it('is splitSceneHeader when the records say nothing', () => {
    /*
      A scene with no cast and no place renders no line, so a bracket in the box
      is the writer's own — which is exactly where a note-to-self goes, and
      exactly where the old reading emptied a scene that had nothing to empty
      and stored nothing of what was typed.
    */
    const { header, body } = splitSceneDraft('[check: who is in this room?]\n\nThe stair went down.', '')
    expect(header).toBeNull()
    expect(body).toBe('[check: who is in this room?]\n\nThe stair went down.')
  })

  it('keeps a bracketed note that is not the line, even when a line exists', () => {
    // Not every bracket is the rendered one, and the others are prose.
    const { header, body } = splitSceneDraft('[she thought]\n\nThe stair went down.', rendered)
    expect(header).toBeNull()
    expect(body).toBe('[she thought]\n\nThe stair went down.')
  })
})

describe('a single @ inside the brackets', () => {
  it('names a character, where it used to vanish into the place', () => {
    /*
      `[#Court @Sella]` read "Court" as the place — the name ran to the next
      sigil, and `@` was not one — and dropped Sella entirely. That is a silent
      no-op on the gesture the picker's own notice recommends.
    */
    expect(parseSceneHeader('[#The Salt Court @Sella]')).toEqual({
      place: 'The Salt Court', characters: ['Sella'],
    })
    // And the pair: two sigils are still one token, not an empty name and a real one.
    expect(parseSceneHeader('[#The Salt Court @@Sella]')).toEqual({
      place: 'The Salt Court', characters: ['Sella'],
    })
  })
})

describe('what a header line does to the scene', () => {
  const world = {
    characters: [
      { id: 'wren', name: 'Wren Halloway', aliases: ['Wren'] },
      { id: 'sal', name: "Sal'ka" },
    ],
    places: [{ id: 'kitchen', name: 'The Kitchen' }, { id: 'yard', name: 'The Yard' }],
  }
  const scene = { involved: ['sal'], mentioned: ['wren'], place: 'yard' }

  it('sets the cast and the setting it names, by name or alias, and takes the named off the mentioned list', () => {
    const plan = planHeader('[#the kitchen @@Wren]', world, scene)
    expect(plan.update).toEqual({ involvedCharacterIds: ['wren'], mentionedCharacterIds: [], locationMarkerId: 'kitchen' })
    expect(planIsClean(plan)).toBe(true)
  })

  it('answers to a name the character changes to, as well as their own and their aliases', () => {
    const named = {
      ...world,
      characters: [...world.characters, { id: 'gandalf', name: 'Gandalf', nameChanges: [{ eventId: 'e9', name: 'Gandalf the White' }] }],
    }
    expect(planHeader('[@@Gandalf the White]', named, scene).update?.involvedCharacterIds).toEqual(['gandalf'])
    // Paired: a name nobody goes by is still unknown.
    expect(planHeader('[@@Gandalf the Blue]', named, scene).unknown.names).toEqual(['Gandalf the Blue'])
  })

  it('changes nothing when it says what the scene already holds', () => {
    expect(planHeader("[#The Yard @@Sal'ka]", world, scene).update).toBeNull()
  })

  it('no header is no change: deleting the line clears the screen, not the cast', () => {
    expect(planHeader(null, world, scene)).toEqual({ unknown: { names: [], place: null }, update: null })
  })

  it('a name nothing answers leaves the cast alone and is named; a place nothing answers keeps the setting', () => {
    const plan = planHeader('[#The Kichen @@Wren @@Juno]', world, scene)
    expect(plan.unknown).toEqual({ names: ['Juno'], place: 'The Kichen' })
    expect(plan.update).toBeNull()
    expect(planIsClean(plan)).toBe(false)
  })

  it('a header with no place clears the setting', () => {
    expect(planHeader("[@@Sal'ka]", world, scene).update).toEqual({ involvedCharacterIds: ['sal'], mentionedCharacterIds: ['wren'], locationMarkerId: null })
  })
})
