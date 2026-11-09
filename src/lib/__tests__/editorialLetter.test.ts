import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { chapterNumbers, lettersTasks, makeHeading, mergeWithPrevious, splitLetter, suggestLinks, type LetterItem } from '@/lib/editorialLetter'

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
    expect(mergeWithPrevious(merged, 2)[1]).toMatchObject({ text: 'Shorten the chase. By a third. Best, Ines', heading: false, keep: true })
  })
})

describe('a writer run’s letters (round-trip-plan.md, T3)', () => {
  const letter = (n: 1 | 2) => splitLetter(readFileSync(path.join(__dirname, `fixtures/docx/run-2026-11-09/letter-${n}.txt`), 'utf8'))
  const sections = (items: LetterItem[]) => items.filter((i) => i.heading && !i.intro).map((i) => i.text)
  const unkept = (items: LetterItem[]) => items.filter((i) => !i.heading && !i.keep).map((i) => i.text)

  it('letter 1: its numbered headings are headings; its title, greeting, sign-off and signature are not work', () => {
    const items = letter(1)
    expect(sections(items)).toEqual([
      'WHAT\'S WORKING', 'THE CLOCK', 'WHO KNOWS WHAT, AND WHEN', 'STRUCTURE: THE FLASHBACK IN CH. 3', 'THE ENDING',
      'CORIN\'S TURN (CH. 5)', 'CHARACTERS', 'POINT OF VIEW', 'CONTINUITY: SMALLER THINGS', 'PROSE', 'WHAT I\'D DO NEXT, IN ORDER',
    ])
    expect(unkept(items)).toEqual([
      'THE SALT LEDGER: editorial letter, first draft Margit Hale to Ruth Callan, 9 November 2026',
      'Dear Ruth,', 'With best wishes,', 'Margit', 'Margit Hale Fiction editor',
    ])
    // The paragraph after the storm's three points is the ending's again, not the sentence that introduced them.
    const tasks = lettersTasks(items)
    expect(tasks.find((t) => t.text.startsWith('The coda is lovely'))?.group).toBe('THE ENDING')
    expect(tasks.find((t) => t.text.startsWith('The storm isn\'t planted'))?.group).toMatch(/^The storm is where it feels rushed/)
    expect(tasks.find((t) => t.text.startsWith('Corin knows about the sticks'))?.group).toBe('WHO KNOWS WHAT, AND WHEN')
  })

  it('letter 2: its questions in capitals are headings; its title, greeting, sign-off and name are not work', () => {
    const items = letter(2)
    expect(sections(items)).toEqual([
      'DOES THE CLOCK HOLD?', 'DOES THE CHASE WORK AS THE OPENING OF CH. 3?', 'DOES THE PARAGRAPH AFTER THE WRECK GIVE ILSE ENOUGH?',
      'NEW THINGS THE FIXES HAVE MADE', 'THE LINES YOU DIDN\'T TAKE', 'SMALL THINGS', 'WHERE THIS LEAVES THE BOOK',
    ])
    expect(unkept(items)).toEqual(['THE SALT LEDGER: second read Margit Hale to Ruth Callan, 9 November 2026', 'Dear Ruth,', 'With best wishes,', 'Margit'])
  })
})

describe('headings, greetings and sign-offs (round-trip-plan.md, T3)', () => {
  it('a numbered line over prose is a heading; numbered points, and a numbered line over another point, are points', () => {
    expect(pairs(splitLetter('1. Pacing\n\nThe middle sags.\n\n2. Character\n\nTomas needs a reason.'))).toEqual([
      ['#', 'Pacing'], ['+', 'The middle sags.'], ['#', 'Character'], ['+', 'Tomas needs a reason.'],
    ])
    expect(pairs(splitLetter('1. Cut the prologue.\n2. Rename Tom\n3. Tighten ch. 3'))).toEqual([['+', 'Cut the prologue.'], ['+', 'Rename Tom'], ['+', 'Tighten ch. 3']])
    expect(pairs(splitLetter('1. Pacing\n\n2. Rename Tom'))).toEqual([['+', 'Pacing'], ['+', 'Rename Tom']])
  })

  it('a question in capitals is a heading; one in ordinary case is a point', () => {
    expect(pairs(splitLetter('DOES IT HOLD?\n\nYes.'))).toEqual([['#', 'DOES IT HOLD?'], ['+', 'Yes.']])
    expect(pairs(splitLetter('Does the chase work?\n\nYes.'))).toEqual([['+', 'Does the chase work?'], ['+', 'Yes.']])
  })

  it('the greeting is found under a title, and everything above it is not work; a greeting further down is a point', () => {
    expect(pairs(splitLetter('Notes on the draft\n\nDear Mira,\n\nCut the prologue.'))).toEqual([['-', 'Notes on the draft'], ['-', 'Dear Mira,'], ['+', 'Cut the prologue.']])
    expect(pairs(splitLetter('Cut the prologue.\n\nThe chase is long.\n\nRename Tom.\n\nThe ending works.\n\nDear me, the ending.'))[4]).toEqual(['+', 'Dear me, the ending.'])
  })

  it('a sign-off with "With", and a signature of more than one line under it, are not work; a sentence after it keeps it a point', () => {
    expect(pairs(splitLetter('Cut the prologue.\n\nWith love,\n\nInes\n\nInes Varga\nEditor'))).toEqual([['+', 'Cut the prologue.'], ['-', 'With love,'], ['-', 'Ines'], ['-', 'Ines Varga Editor']])
    expect(pairs(splitLetter('Cut the prologue.\n\nThanks for the chase scene.\n\nIt is the best thing in the book.'))).toEqual([
      ['+', 'Cut the prologue.'], ['+', 'Thanks for the chase scene.'], ['+', 'It is the best thing in the book.'],
    ])
  })

  it('a point made a heading stands over the points after it', () => {
    const items = splitLetter('Pacing is slow.\n\nThe chase runs long.\n\nThe middle sags.')
    expect(lettersTasks(makeHeading(items, 0))).toEqual([{ text: 'The chase runs long.', group: 'Pacing is slow.' }, { text: 'The middle sags.', group: 'Pacing is slow.' }])
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
