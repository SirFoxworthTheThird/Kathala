import { describe, it, expect } from 'vitest'
import { anchorFrom, placeNote, fold, type NoteAnchor } from '@/lib/noteAnchor'

/** The passage a note is on, as a writer selects it: the first occurrence of `words` in `text`, or the `nth`. */
function noteOn(eventId: string, text: string, words: string, nth = 0): NoteAnchor {
  let at = -1
  for (let i = 0; i <= nth; i++) at = text.indexOf(words, at + 1)
  if (at < 0) throw new Error(`"${words}" is not in the text`)
  return anchorFrom(eventId, text, at, at + words.length)!
}

/** What a note's place reads now. */
const wordsAt = (scenes: Array<{ eventId: string; text: string }>, anchor: NoteAnchor) => {
  const place = placeNote(anchor, scenes)
  if (!place) return null
  return { eventId: place.eventId, words: scenes.find((s) => s.eventId === place.eventId)!.text.slice(place.from, place.to), exact: place.exact }
}

const SCENE = 'The ferry left at dawn. Mira counted the crates twice, and twice the number came out wrong. The captain said nothing.'

describe('anchorFrom', () => {
  it('keeps the words and a little of the text either side, without the spaces at the selection’s ends', () => {
    const at = SCENE.indexOf(' Mira counted')
    // From the space before "Mira" to the space after "twice,".
    const a = anchorFrom('e1', SCENE, at, at + ' Mira counted the crates twice, '.length)!
    expect(a.quote).toBe('Mira counted the crates twice,')
    expect(a.prefix).toBe('The ferry left at dawn. ')
    expect(a.suffix.startsWith(' and twice')).toBe(true)
    expect(a.prefix.length).toBeLessThanOrEqual(32)
    expect(a.suffix.length).toBeLessThanOrEqual(32)
    // A selection of nothing but space is not a passage.
    expect(anchorFrom('e1', SCENE, 3, 4)).toBeNull()
    expect(anchorFrom('e1', SCENE, at, at)).toBeNull()
  })
})

describe('placeNote', () => {
  it('finds its words exactly, where they were', () => {
    const a = noteOn('e1', SCENE, 'twice the number came out wrong')
    expect(wordsAt([{ eventId: 'e1', text: SCENE }], a)).toEqual({ eventId: 'e1', words: 'twice the number came out wrong', exact: true })
  })

  it('follows its words through an edit before them and after them', () => {
    const a = noteOn('e1', SCENE, 'Mira counted the crates twice')
    const edited = 'Fog. ' + SCENE.replace('The captain said nothing.', 'The captain, for once, said nothing at all.')
    expect(wordsAt([{ eventId: 'e1', text: edited }], a)).toEqual({ eventId: 'e1', words: 'Mira counted the crates twice', exact: true })
  })

  it('tells repeats apart by what surrounds them', () => {
    const text = 'She said no. He waited by the door. Later, at the inn, she said no. He left without a word.'
    const second = noteOn('e1', text, 'she said no', 0)
    const first = noteOn('e1', text, 'She said no', 0)
    // Case is set aside, so both passages read the same: only the surroundings tell them apart.
    expect(fold('She said no')).toBe(fold('she said no'))
    expect(placeNote(second, [{ eventId: 'e1', text }])!.from).toBe(text.indexOf('she said no'))
    expect(placeNote(first, [{ eventId: 'e1', text }])!.from).toBe(0)
    // And still after an edit between them.
    const edited = text.replace('He waited by the door.', 'He waited by the door for an hour, then sat.')
    expect(placeNote(second, [{ eventId: 'e1', text: edited }])!.from).toBe(edited.indexOf('she said no'))
  })

  it('follows its words into the scene a split made', () => {
    const a = noteOn('e1', SCENE, 'The captain said nothing')
    // Split before "The captain": the words are now in the new scene, e2.
    const cut = SCENE.indexOf('The captain')
    const book = [{ eventId: 'e1', text: SCENE.slice(0, cut).trim() }, { eventId: 'e2', text: SCENE.slice(cut) }]
    expect(wordsAt(book, a)).toEqual({ eventId: 'e2', words: 'The captain said nothing', exact: true })
  })

  it('follows its words into the scene a join kept', () => {
    const second = 'At the far shore the crates were opened. Three were empty.'
    const a = noteOn('e2', second, 'Three were empty')
    // e2 joined onto e1: e2 is gone, its prose at the end of e1's.
    expect(wordsAt([{ eventId: 'e1', text: `${SCENE}\n\n${second}` }], a)).toEqual({ eventId: 'e1', words: 'Three were empty', exact: true })
  })

  it('follows its words through Replace all, of a name elsewhere and of a word inside them', () => {
    const a = noteOn('e1', SCENE, 'Mira counted the crates twice, and twice the number came out wrong')
    const renamed = SCENE.replace(/captain/g, 'master')
    expect(wordsAt([{ eventId: 'e1', text: renamed }], a)?.exact).toBe(true)
    // A word inside retyped: the same passage, edited, and said to be.
    const inside = SCENE.replace(/crates/g, 'boxes')
    expect(wordsAt([{ eventId: 'e1', text: inside }], a)).toEqual({
      eventId: 'e1', words: 'Mira counted the boxes twice, and twice the number came out wrong', exact: false,
    })
  })

  it('is unplaced once its words are rewritten, and a short passage is found exactly or not at all', () => {
    const a = noteOn('e1', SCENE, 'twice the number came out wrong')
    const rewritten = SCENE.replace('and twice the number came out wrong', 'and each time she got a different total')
    expect(placeNote(a, [{ eventId: 'e1', text: rewritten }])).toBeNull()
    // Where the same edit leaves most of a long passage, it is still that passage.
    const long = noteOn('e1', SCENE, 'Mira counted the crates twice, and twice the number came out wrong')
    expect(placeNote(long, [{ eventId: 'e1', text: SCENE.replace('came out wrong', 'came out off') }])?.exact).toBe(false)
    // Two letters of a one-word note changed: a different word, not the same one edited.
    const word = noteOn('e1', SCENE, 'ferry')
    expect(placeNote(word, [{ eventId: 'e1', text: SCENE.replace('ferry', 'berry') }])).toBeNull()
    // Its first words still there, but well over a quarter of it changed: rewritten, not edited.
    const most = SCENE.replace('Mira counted the crates twice, and twice the number came out wrong', 'Mira counted the sacks once, and each time the sum looked odd')
    expect(placeNote(long, [{ eventId: 'e1', text: most }])).toBeNull()
    // Twelve characters, two changed: under the length that may be edited, so not the same passage.
    const short = noteOn('e1', SCENE, 'crates twice')
    expect(placeNote(short, [{ eventId: 'e1', text: SCENE.replace('crates twice', 'crates thrice') }])).toBeNull()
    expect(placeNote(short, [{ eventId: 'e1', text: SCENE }])?.exact).toBe(true)
    // Its scene gone and its words nowhere else.
    expect(placeNote(a, [{ eventId: 'e9', text: 'Another scene entirely.' }])).toBeNull()
  })

  it('prefers its own scene, with a word retyped, to the same words untouched in a scene it was never in', () => {
    const own = 'At the gate the guard asked for papers she did not have, and waved her through.'
    const a = noteOn('e1', own, 'asked for papers she did not have')
    const book = [
      { eventId: 'e1', text: own.replace('papers', 'passes') },
      { eventId: 'e7', text: 'Years later a clerk asked for papers she did not have. She laughed.' },
    ]
    expect(wordsAt(book, a)).toEqual({ eventId: 'e1', words: 'asked for passes she did not have', exact: false })
    // With its own scene's words gone entirely, the exact words elsewhere are where it is.
    const gone = [{ eventId: 'e1', text: 'At the gate she was waved through.' }, book[1]]
    expect(wordsAt(gone, a)).toEqual({ eventId: 'e7', words: 'asked for papers she did not have', exact: true })
  })

  it('sets aside case, curly quotes and dashes, and keeps the prose’s own offsets', () => {
    const typed = 'He said "wait - not yet" and turned.'
    const a = noteOn('e1', typed, '"wait - not yet"')
    const curly = 'He said “wait — not yet” and turned.'
    const place = placeNote(a, [{ eventId: 'e1', text: curly }])!
    expect(curly.slice(place.from, place.to)).toBe('“wait — not yet”')
    expect(place.exact).toBe(true)
  })
})
