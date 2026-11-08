import { describe, it, expect } from 'vitest'
import { chapterNumbers, lettersTasks, mergeWithPrevious, splitLetter, suggestLinks } from '@/lib/editorialLetter'

/** An editorial letter split into tasks (editorial-plan.md, R5). */

const LETTER = `Dear Mira,

Thank you for the new draft. The book is much stronger, and these notes are about the last stretch.

Pacing
- The chase in chapter 3 runs long; cut it by a third.
- Chapters 7–9 sag. Consider folding 8 into 7,
  and moving the storm earlier.

Characters:
1. Tomas needs a reason to stay after the fire.
2) Ana's letter in ch. 12 gives the ending away.

The prologue could go entirely. I would start at the quay.

Best,
Ines`

const pairs = (items: ReturnType<typeof splitLetter>) => items.map((i) => [i.heading ? '#' : i.keep ? '+' : '-', i.text])

describe('splitLetter', () => {
  it('splits at bullets, numbered points and paragraphs, with headings standing over their points', () => {
    expect(pairs(splitLetter(LETTER))).toEqual([
      ['-', 'Dear Mira,'],
      ['+', 'Thank you for the new draft. The book is much stronger, and these notes are about the last stretch.'],
      ['#', 'Pacing'],
      ['+', 'The chase in chapter 3 runs long; cut it by a third.'],
      // A point's wrapped line is the same point.
      ['+', 'Chapters 7–9 sag. Consider folding 8 into 7, and moving the storm earlier.'],
      ['#', 'Characters'],
      ['+', 'Tomas needs a reason to stay after the fire.'],
      ['+', 'Ana’s letter in ch. 12 gives the ending away.'.replace('’', "'")],
      ['+', 'The prologue could go entirely. I would start at the quay.'],
      // A sign-off and the name under it are one paragraph, and not work.
      ['-', 'Best, Ines'],
    ])
  })

  it('each kept point is a task under the heading before it', () => {
    expect(lettersTasks(splitLetter(LETTER))).toEqual([
      { text: 'Thank you for the new draft. The book is much stronger, and these notes are about the last stretch.' },
      { text: 'The chase in chapter 3 runs long; cut it by a third.', group: 'Pacing' },
      { text: 'Chapters 7–9 sag. Consider folding 8 into 7, and moving the storm earlier.', group: 'Pacing' },
      { text: 'Tomas needs a reason to stay after the fire.', group: 'Characters' },
      { text: "Ana's letter in ch. 12 gives the ending away.", group: 'Characters' },
      // A heading's points run until the next heading: the editor's next paragraph is still under it.
      { text: 'The prologue could go entirely. I would start at the quay.', group: 'Characters' },
    ])
  })

  it('a sentence ending in a colon heads the points under it; a heading with nothing under it is a point', () => {
    const items = splitLetter('Three things on pace:\n* Shorten the chase.\n* Move the storm.\n\n## Smaller things\n\nCut the prologue')
    expect(pairs(items)).toEqual([
      ['#', 'Three things on pace'],
      ['+', 'Shorten the chase.'],
      ['+', 'Move the storm.'],
      ['#', 'Smaller things'],
      // Looks like a heading, but stands over nothing: it is a point.
      ['+', 'Cut the prologue'],
    ])
    expect(pairs(splitLetter('A few things to look at:'))).toEqual([['+', 'A few things to look at:']])
    // An introducing sentence too long to read as a heading still heads its points.
    expect(pairs(splitLetter('There are a few things I would look at again in the middle of the book:\n- The storm.\n- The fire.'))).toEqual([
      ['#', 'There are a few things I would look at again in the middle of the book'],
      ['+', 'The storm.'],
      ['+', 'The fire.'],
    ])
  })

  it('a paragraph is one point however its lines wrap; Windows line ends and blank-line runs change nothing', () => {
    expect(pairs(splitLetter('The middle drags\r\nbecause the storm\r\ncomes too late.\r\n\r\n\r\n\r\nMove it.'))).toEqual([
      ['+', 'The middle drags because the storm comes too late.'],
      ['+', 'Move it.'],
    ])
    expect(splitLetter('   \n\n  ')).toEqual([])
  })

  it('a sign-off is unkept only at the end, and a greeting only at the start', () => {
    expect(pairs(splitLetter('Thanks, Ana'))).toEqual([['-', 'Thanks, Ana']])
    // A sign-off on its own line, and the name on the next, after a blank line.
    expect(pairs(splitLetter('Move the storm.\n\nWarmly,\n\nInes'))).toEqual([['+', 'Move the storm.'], ['-', 'Warmly,'], ['-', 'Ines']])
    // A short last point is not a name: nothing signs off above it.
    expect(pairs(splitLetter('Move the storm.\n\nCut the prologue'))).toEqual([['+', 'Move the storm.'], ['+', 'Cut the prologue']])
    expect(pairs(splitLetter('Hi Mira — here goes.\n\nThanks for the map in chapter 2; keep it.\n\nCut the prologue.'))).toEqual([
      ['-', 'Hi Mira — here goes.'],
      ['+', 'Thanks for the map in chapter 2; keep it.'],
      ['+', 'Cut the prologue.'],
    ])
  })
})

describe('mergeWithPrevious', () => {
  it('joins a point onto the one before it, kept if either was; never across a heading', () => {
    const items = splitLetter('Pacing\n- Shorten the chase.\n- By a third.\n\nBest,\nInes')
    const merged = mergeWithPrevious(items, 2)
    expect(pairs(merged)).toEqual([['#', 'Pacing'], ['+', 'Shorten the chase. By a third.'], ['-', 'Best, Ines']])
    expect(mergeWithPrevious(items, 1)).toEqual(items)
    expect(mergeWithPrevious(items, 0)).toEqual(items)
    // A point merged into an unkept one before it is kept.
    const greeted = splitLetter('Dear Mira,\n\nCut the prologue.')
    expect(mergeWithPrevious(greeted, 1)).toEqual([{ text: 'Dear Mira, Cut the prologue.', heading: false, keep: true }])
    // A sign-off merged into a point keeps the point.
    expect(mergeWithPrevious(merged, 2)[1]).toEqual({ text: 'Shorten the chase. By a third. Best, Ines', heading: false, keep: true })
  })
})

describe('suggested links', () => {
  it('chapter numbers: single, abbreviated, listed, ranged, and in words', () => {
    expect(chapterNumbers('The chase in chapter 3 runs long.')).toEqual([3])
    expect(chapterNumbers('Ana’s letter in ch. 12, and in Ch 13')).toEqual([12, 13])
    expect(chapterNumbers('Chapters 7–9 sag, and chapters 4 and 6 repeat.')).toEqual([7, 8, 9, 4, 6])
    expect(chapterNumbers('Chapter three, and chapters five to seven.')).toEqual([3, 5, 6, 7])
    expect(chapterNumbers('The chapter is long. 12 chapters in all.')).toEqual([])
  })

  it('links the chapters by number and the characters named, as the prose matcher finds them', () => {
    const book = {
      chapters: [{ id: 'c3', number: 3 }, { id: 'c12', number: 12 }],
      characters: [
        { id: 'tomas', name: 'Tomas Varga', aliases: [] },
        { id: 'ana', name: 'Ana Varga', aliases: ['the clerk'] },
        { id: 'will', name: 'Will', aliases: [] },
      ],
    }
    expect(suggestLinks('In chapter 12 Tomas meets the clerk; will Ana see it?', book)).toEqual([
      { kind: 'chapter', id: 'c12' },
      { kind: 'character', id: 'tomas' },
      { kind: 'character', id: 'ana' },
    ])
    // A name inside another word is not the name.
    expect(suggestLinks('Anatole and Tomasina leave.', book)).toEqual([])
    // "Varga" is two people's: it names neither. A chapter not in the book links nothing.
    expect(suggestLinks('Varga, in chapter 40, should be kinder.', book)).toEqual([])
  })
})
