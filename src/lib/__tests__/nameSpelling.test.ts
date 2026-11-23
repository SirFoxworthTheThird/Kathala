import { describe, it, expect } from 'vitest'
import { bare, corrected, editDistance, nameWords, nearMisses, namesToCheck, NEAR_MISS_RULES, wordUse, worldNames, type NearMissRules } from '@/lib/nameSpelling'

/*
  The world's own names in spelling (issue #705): docs/records/spelling-plan.md.
  The rules' figures on the Library are in scripts/spelling-probe.ts.
*/

const COMMON = new Set(['the', 'door', 'river', 'castle', 'black', 'house', 'there', 'where', 'theory', 'lady', 'grey'])
const isCommon = (w: string) => COMMON.has(w)

/** The check over `text`, with the names given and the book's use of words from `book`. */
function check(text: string, names: string[], book: string[] = [text], rules: NearMissRules = NEAR_MISS_RULES) {
  const use = wordUse(book)
  return nearMisses(text, namesToCheck(names, isCommon, rules), new Set(nameWords(names).map((w) => w.toLowerCase())), isCommon, (l) => use.get(l) ?? 0, rules)
}

describe('the names a world has', () => {
  it('its people with their aliases and earlier names, places, items and factions, each once', () => {
    expect(worldNames({
      characters: [{ name: 'Teodora Vasse', aliases: ['Teo', 'the Widow'], nameChanges: [{ name: 'Teodora Marl' }] }, { name: 'teodora vasse' }],
      places: [{ name: 'Castle Grimward' }],
      items: [{ name: 'The Lantern of Hesk' }],
      factions: [{ name: 'Order of the Ash' }, { name: '  ' }],
    })).toEqual(['Teodora Vasse', 'Teo', 'the Widow', 'Teodora Marl', 'Castle Grimward', 'The Lantern of Hesk', 'Order of the Ash'])
  })

  it('their words, once each, possessives off, as written: what the desktop dictionary is told', () => {
    expect(nameWords(['Teodora Vasse', 'Vasse’s Hall', "O'Brien", 'Ward 9'])).toEqual(['Teodora', 'Vasse', 'Hall', "O'Brien", 'Ward'])
  })

  it('a check is made only of the long name words that are not ordinary words', () => {
    expect(namesToCheck(['Teodora Vasse', 'Castle Grimward', 'Lady Ilse', 'The Black River'], isCommon)).toEqual(['Teodora', 'Vasse', 'Grimward'])
  })
})

describe('edits', () => {
  it('counts letters added, dropped and changed, and a swap of two beside each other as one', () => {
    expect(editDistance('teodora', 'teodora')).toBe(0)
    expect(editDistance('teodroa', 'teodora')).toBe(1)
    expect(editDistance('teodra', 'teodora')).toBe(1)
    expect(editDistance('teoddora', 'teodora')).toBe(1)
    expect(editDistance('teodara', 'teodora')).toBe(1)
    expect(editDistance('tedroa', 'teodora')).toBe(2)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })

  it('gives up past the most it is asked for', () => {
    expect(editDistance('teodora', 'xxxxxxx', 2)).toBe(3)
    expect(editDistance('ab', 'abcdef', 2)).toBe(3)
  })
})

describe('near misses (D-3)', () => {
  const names = ['Teodora Vasse', 'Castle Grimward', 'Ambrose Kettleby']

  it('marks a name one letter wrong, with the name, where it is', () => {
    const text = 'Then Teodroa came to the door.'
    expect(check(text, names)).toEqual([{ start: 5, end: 12, word: 'Teodroa', name: 'Teodora' }])
  })

  it('takes two edits for a long name, one for a shorter', () => {
    expect(check('Ambroes Ketleby waited.', names).map((m) => m.name)).toEqual(['Ambrose', 'Kettleby'])
    expect(check('Kettelbey waited.', names).map((m) => m.name)).toEqual(['Kettleby'])
    // Two edits from a seven-letter name is too many.
    expect(check('Tedroa waited.', names)).toEqual([])
  })

  it('leaves the names themselves, their possessives, and any word the world names', () => {
    expect(check('Teodora and Teodora’s cat; TEODORA’S hat; Vasse.', names)).toEqual([])
    expect(check('Teodor waited.', [...names, 'Teodor Pell'])).toEqual([])
  })

  it('leaves ordinary words, short words and words with no capital', () => {
    // "Grey" is one edit from a four-letter name, and an ordinary word.
    expect(check('Grey dawn.', ['Gray'])).toEqual([])
    expect(check('Theory of it.', ['Theora Lune'])).toEqual([])
    // Under five letters is never a near miss: Vass is one letter from Vasse, and four long.
    expect(check('Vase broke.', ['Vass Hall'])).toEqual([])
    expect(check('Vass broke.', ['Vasse Hall'])).toEqual([])
    expect(check('Vasss broke.', ['Vasse Hall']).map((m) => m.name)).toEqual(['Vasse'])
    expect(check('then teodroa came', names)).toEqual([])
  })

  it('leaves a word the book uses three times or more: the writer means it', () => {
    const scene = 'Teodra spoke.'
    expect(check(scene, names, [scene])).toEqual([{ start: 0, end: 6, word: 'Teodra', name: 'Teodora' }])
    expect(check(scene, names, [scene, 'Teodra again.'])).toHaveLength(1)
    expect(check(scene, names, [scene, 'Teodra again.', 'And Teodra.'])).toEqual([])
  })

  it('needs the name’s first letter', () => {
    expect(check('Meodora spoke.', names)).toEqual([])
    expect(check('Meodora spoke.', names, undefined, { ...NEAR_MISS_RULES, sameFirst: false }).map((m) => m.name)).toEqual(['Teodora'])
  })

  it('leaves a family and a word made from a name', () => {
    expect(check('The Vasses and the Grimwardian walls; a Kettlebyish grin.', [...names, 'Vasse Hollow'])).toEqual([])
    expect(check('The Kettlebyan way.', names)).toEqual([])
  })

  it('takes the nearest name where two are near', () => {
    // Kettlebel is two edits from Kettlewell, listed first, and one from Kettlebell.
    expect(check('Kettlebel rang.', ['Kettlewell Moor', 'Kettlebell Inn']).map((m) => m.name)).toEqual(['Kettlebell'])
    // Marlove is two edits from Marlow, one from Marlowe.
    expect(check('Marlove spoke.', ['Marlow Fen', 'Marlowe Gate']).map((m) => m.name)).toEqual(['Marlowe'])
  })
})

describe('putting it right', () => {
  it('the name, in capitals where the word was', () => {
    expect(corrected('Teodroa', 'Teodora')).toBe('Teodora')
    expect(corrected('TEODROA', 'Teodora')).toBe('TEODORA')
  })

  it('a word bare of a possessive or a run-on ’d or ’ll', () => {
    expect(['Medlock’d', "Medlock'll", 'MURRAY’S', 'Vasse’s', 'Vasses'].map(bare)).toEqual(['Medlock', 'Medlock', 'MURRAY', 'Vasse', 'Vasses'])
  })

  it('counts a book’s words whatever their case and possessives', () => {
    expect(Object.fromEntries(wordUse(['Teodroa came.', 'teodroa’s hat'])).teodroa).toBe(2)
  })
})
