import { describe, it, expect } from 'vitest'
import { createAllLabel, keptByPaste, toMake, withKeptByPaste } from '@/lib/keptHeaderLines'

/*
  Create all, and its note (round-trip-plan-4.md, T21.1, D-15; the writer's
  W3-10 and W3-11). It makes the people a header names, as it always did,
  though its comment and the guide said it did not; now its button names them
  before the click. And the note no longer says the headers "were not
  applied" after they were.
*/

const unknown = (u: Partial<{ people: string[]; place: string | null; items: string[]; facts: string[] }>) => ({ names: [], place: null, ...u })

describe('what Create all will make', () => {
  it('each name once, in the order met, from every waiting header', () => {
    expect(toMake([
      unknown({ people: ['Anna Brisk', 'Bo Tallis'], place: 'The Tower' }),
      unknown({ people: ['Anna Brisk', 'Cara Lind'], place: 'The Belfry', items: ['the lamp'] }),
      unknown({ place: 'The Tower', facts: ['The gate is shut'] }),
    ])).toEqual({ people: ['Anna Brisk', 'Bo Tallis', 'Cara Lind'], places: ['The Tower', 'The Belfry'], items: ['the lamp'], facts: ['The gate is shut'] })
  })

  it('its label names the people and counts the rest', () => {
    const m = { people: ['Anna Brisk', 'Bo Tallis', 'Cara Lind'], places: ['The Tower', 'The Belfry'], items: [], facts: [] }
    expect(createAllLabel(m)).toBe('Create Anna Brisk, Bo Tallis and Cara Lind, and 2 places')
    expect(createAllLabel({ ...m, people: ['Anna Brisk'], places: ['The Tower'], items: ['the lamp'], facts: ['a', 'b'] })).toBe('Create Anna Brisk, and 1 place, 1 item and 2 facts')
    expect(createAllLabel({ ...m, people: [] })).toBe('Create 2 places')
    expect(createAllLabel({ ...m, places: [] })).toBe('Create Anna Brisk, Bo Tallis and Cara Lind')
    expect(createAllLabel({ people: [], places: [], items: [], facts: [] })).toBeNull()
  })
})

describe('the note after it', () => {
  const said = keptByPaste(['Alpha', 'Beta'])!
  it('no longer says the headers wait where none still does; what the paste made stays', () => {
    expect(withKeptByPaste(`The pasted headings made 2 scenes. ${said}`, [])).toBe('The pasted headings made 2 scenes.')
    expect(withKeptByPaste(said, [])).toBeNull()
  })
  it('says again of those still waiting, and leaves a note that never said it as it was', () => {
    expect(withKeptByPaste(`Made 3. ${keptByPaste(['Alpha', 'Beta', 'Gamma'])}`, ['Beta', 'Gamma'])).toBe(`Made 3. ${keptByPaste(['Beta', 'Gamma'])}`)
    // One still waiting: the note under it speaks for it, as a paste of one says nothing more.
    expect(withKeptByPaste(`Made 2. ${said}`, ['Beta'])).toBe('Made 2.')
    expect(withKeptByPaste('Something else entirely.', [])).toBe('Something else entirely.')
    expect(withKeptByPaste(null, ['Alpha', 'Beta'])).toBeNull()
  })
})
