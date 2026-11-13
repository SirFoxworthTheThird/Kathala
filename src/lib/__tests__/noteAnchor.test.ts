import { describe, it, expect } from 'vitest'
import { anchorFrom, placeNote, placeNotes, fold, type NoteAnchor } from '@/lib/noteAnchor'

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

  it('takes a retyped word whole: a passage starts and ends at the edge of a word, as its quote does', () => {
    const text = 'She did not look back.'
    const a = noteOn('e1', text, 'She did not look back.')
    // "look b" changes four characters of the quote, "look behind." five: the shorter one stops inside a word.
    expect(wordsAt([{ eventId: 'e1', text: 'She did not look behind.' }], a)).toEqual({ eventId: 'e1', words: 'She did not look behind.', exact: false })
    const mid = noteOn('e1', SCENE, 'counted the crates twice')
    expect(wordsAt([{ eventId: 'e1', text: SCENE.replace('counted', 'recounted') }], mid)?.words).toBe('recounted the crates twice')
    // Exactly, too: a note on a word is not found in the middle of another.
    const art = noteOn('e1', 'They spoke of art all night.', 'art')
    expect(placeNote(art, [{ eventId: 'e1', text: 'They spoke of the party all night.' }])).toBeNull()
    // Unless the writer chose half a word to begin with.
    const half = noteOn('e1', 'They spoke of the party all night.', 'art')
    expect(wordsAt([{ eventId: 'e1', text: 'They spoke of the party all night.' }], half)?.words).toBe('art')
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

  it('does not take a sentence in another scene that only reads alike for its words (round-trip-plan-2.md, T7.2; R2-3)', () => {
    const own = 'They came down the slipway at a run into the rain. The tide was going out. It had been out when they arrived.'
    const a = noteOn('e5', own, 'The tide was going out')
    const elsewhere = { eventId: 'e4', text: 'At Cray’s End the foreman shook his head. The tide was coming in. Nobody would row tonight.' }
    // Its words rewritten in its own scene: unplaced, not on Cray’s End's correct sentence four chapters off.
    expect(wordsAt([{ eventId: 'e5', text: 'They came down the slipway at a run into the rain, and the water rose behind them.' }, elsewhere], a)).toBeNull()
    // Its words retyped in its own scene are still found there; and its exact words, moved to another scene, are followed.
    expect(wordsAt([{ eventId: 'e5', text: own.replace('going out', 'going outward') }, elsewhere], a)).toMatchObject({ eventId: 'e5', exact: false })
    expect(wordsAt([{ eventId: 'e5', text: 'They ran.' }, { eventId: 'e6', text: 'Later. The tide was going out. Gulls.' }], a)).toEqual({ eventId: 'e6', words: 'The tide was going out', exact: true })
  })

  it('words put into its passage: placed by its surroundings in its own scene, the words either side still standing (round-trip-plan-3.md, T11.3)', () => {
    // The second loop's note: five words put into the middle of its nine, as the run's .pwk has the note and the scene.
    const went = 'She stood with the hat in her hands while the water came up over her boots, over the letter folded small inside the left one, and did not move until it was at her shins.'
    const a = noteOn('e9', went, 'over the letter folded small inside the left one')
    expect([a.prefix, a.suffix]).toEqual(['e water came up over her boots, ', ', and did not move until it was '])
    const now = went.replace('folded small inside', 'folded small in its scrap of oilcloth inside')
    expect(wordsAt([{ eventId: 'e9', text: now }], a)).toEqual({ eventId: 'e9', words: 'over the letter folded small in its scrap of oilcloth inside the left one', exact: false })
    // What is between rewritten, not added to: unplaced, as before.
    expect(wordsAt([{ eventId: 'e9', text: went.replace('over the letter folded small inside the left one', 'with nothing in them but the cold') }], a)).toBeNull()
    // Rewritten between surroundings that stand, sharing letters but not words: unplaced. A run's note, on the
    // sum its writer then changed; counted by letters, it was placed.
    const sum = 'The fine, she said, would be twenty-two thousand crowns, paid in silver by the end of the month.'
    const s = noteOn('e9', sum, 'twenty-two thousand crowns')
    expect(wordsAt([{ eventId: 'e9', text: sum.replace('twenty-two thousand', 'a hundred and forty thousand') }], s)).toBeNull()
    // Words put in, more than a retyped word: placed.
    expect(wordsAt([{ eventId: 'e9', text: sum.replace('twenty-two thousand crowns', 'twenty-two thousand good gold crowns') }], s)).toMatchObject({ exact: false })
    // More than twice its length between them: not that passage.
    expect(wordsAt([{ eventId: 'e9', text: went.replace('folded small inside', 'folded small, which she had written and rewritten for three nights by the lamp in the loft, inside') }], a)).toBeNull()
    // The words after it gone too: unplaced.
    expect(wordsAt([{ eventId: 'e9', text: now.replace(', and did not move until it was', '. She ran') }], a)).toBeNull()
    // Its words, exactly, in another scene: followed there, not placed here by surroundings.
    const elsewhere = { eventId: 'e10', text: 'Later. Over the letter folded small inside the left one. Gulls.' }
    expect(wordsAt([{ eventId: 'e9', text: now }, elsewhere], a)).toMatchObject({ eventId: 'e10', exact: true })
    // Not in another scene by its surroundings: a near-match there is another sentence.
    expect(wordsAt([{ eventId: 'e9', text: 'She ran.' }, { eventId: 'e10', text: now }], a)).toBeNull()
    // A change is to the words as they stood: not placed by its surroundings, strictly or for its mark on the Page.
    expect(placeNote(a, [{ eventId: 'e9', text: now }], true)).toBeNull()
    expect(placeNote(a, [{ eventId: 'e9', text: now }], false, false)).toBeNull()
  })

  it('by its surroundings: between two places as good, neither; an edge of the scene is surroundings', () => {
    const went = 'At the quay. Mira counted the crates and went home. At the quay. Mira counted the crates and went home.'
    // Surroundings that stand twice, with the same words put in at both: neither place.
    const short = { eventId: 'e1', quote: 'counted the crates', prefix: 'At the quay. Mira ', suffix: ' and went home.' }
    expect(wordsAt([{ eventId: 'e1', text: went.replaceAll('counted the crates', 'counted all the wet crates') }], short)).toBeNull()
    // Put in at one only: there.
    const one = went.replace('counted the crates', 'counted all the wet crates')
    expect(wordsAt([{ eventId: 'e1', text: one.replace('counted the crates', 'slept') }], short)).toEqual({ eventId: 'e1', words: 'counted all the wet crates', exact: false })
    // A short passage with words put in: placed, as a long one is. One retyped: not (the test above, *ferry*).
    const two = noteOn('e1', SCENE, 'crates twice')
    expect(wordsAt([{ eventId: 'e1', text: SCENE.replace('crates twice', 'crates all twice') }], two)).toEqual({ eventId: 'e1', words: 'crates all twice', exact: false })
    expect(wordsAt([{ eventId: 'e1', text: SCENE.replace('crates twice', 'crates once') }], two)).toBeNull()
    // A scene of one sentence, its surroundings a name and a stop: placed, the words kept deciding.
    const single = 'Mira counted the crates.'
    const c = noteOn('e1', single, 'counted the crates')
    expect([c.prefix, c.suffix]).toEqual(['Mira ', '.'])
    expect(wordsAt([{ eventId: 'e1', text: 'Mira counted all the crates.' }], c)).toEqual({ eventId: 'e1', words: 'counted all the crates', exact: false })
    // At the scene's start, nothing before it: the start stands for the words before.
    const first = 'Mira counted the crates twice, and twice the number came out wrong. The captain said nothing.'
    const a = noteOn('e1', first, 'Mira counted the crates twice')
    expect(a.prefix).toBe('')
    expect(wordsAt([{ eventId: 'e1', text: first.replace('the crates twice', 'the wet crates on the quay twice') }], a)).toEqual({ eventId: 'e1', words: 'Mira counted the wet crates on the quay twice', exact: false })
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

describe('placeNotes', () => {
  it('places each of a book’s notes as placeNote would, and says which are unplaced', () => {
    const second = 'At the far shore the crates were opened. Three were empty.'
    const stays = { id: 'n1', ...noteOn('e1', SCENE, 'The captain said nothing') }
    const moved = { id: 'n2', ...noteOn('e2', second, 'Three were empty') }
    const retyped = { id: 'n3', ...noteOn('e1', SCENE, 'Mira counted the crates twice, and twice') }
    const gone = { id: 'n4', ...noteOn('e1', SCENE, 'twice the number came out wrong') }
    // e2 joined onto e1, a word retyped, a clause rewritten.
    const text = `${SCENE}\n\n${second}`.replace('crates twice', 'boxes twice').replace('twice the number came out wrong', 'each total differed')
    const book = [{ eventId: 'e1', text }]
    const places = placeNotes([stays, moved, retyped, gone], book)
    for (const n of [stays, moved, retyped, gone]) expect(places.get(n.id)).toEqual(placeNote(n, book))
    expect(places.get('n1')?.exact).toBe(true)
    expect(places.get('n2')).toMatchObject({ eventId: 'e1', exact: true })
    expect(places.get('n3')?.exact).toBe(false)
    expect(places.get('n4')).toBeNull()
  })
})
