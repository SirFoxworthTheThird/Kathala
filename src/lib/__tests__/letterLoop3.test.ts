import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { chapterNumbers, letterName, lettersTasks, splitLetter, suggestLinks } from '@/lib/editorialLetter'

/*
  Revision tasks from the third loop's letters (round-trip-plan-4.md, T20;
  loop-2026-11-14.md, finding 9; the writer's W3-6 to W3-9). Each finding was
  seen in both of Maren Hollis's letters.
*/

const F = path.join(__dirname, 'fixtures/docx')
const read = (f: string) => readFileSync(path.join(F, f), 'utf8')
const LETTERS = ['run-2026-11-14-loop3/round1-editorial-letter.txt', 'run-2026-11-14-loop3/round2-editorial-letter.txt']
const chapters = Array.from({ length: 7 }, (_, i) => ({ id: `c${i + 1}`, number: i + 1 }))
const WORDS = 'one|two|three|four|five|six|seven'
// A chapter named as this editor names one: "Ch3", "Ch5, scene 3", "in Ch6", "Chapter Six".
const NAMES_A_CHAPTER = new RegExp(`\\bch(?:apter)?\\.?\\s*(?:\\d|(?:${WORDS})\\b)`, 'i')

describe('“Ch3” is a chapter (W3-6)', () => {
  it('every task in both letters that names a chapter is linked to it', () => {
    const naming = LETTERS.flatMap((f) => lettersTasks(splitLetter(read(f)))).filter((t) => NAMES_A_CHAPTER.test(t.text))
    // The writer counted 18 in the first letter; 16 of them were linked to none.
    expect(naming.length).toBeGreaterThanOrEqual(18)
    expect(naming.filter((t) => !suggestLinks(t.text, { chapters, characters: [] }).some((l) => l.kind === 'chapter'))).toEqual([])
  })

  it('as the letters write it, and not inside a word', () => {
    expect(chapterNumbers('(Ch3), in Ch6, and Ch5, scene 3')).toEqual([3, 6, 5])
    expect(chapterNumbers('Ilse goes to the Exchange (Ch5, scene 3). One line in Chapter Seven')).toEqual([5, 7])
    expect(chapterNumbers('a branch4 and a much3 and Ch')).toEqual([])
  })
})

describe('a sign-off read by where it is (W3-7)', () => {
  it('in both letters, the sign-off and the name under it are not work', () => {
    for (const f of LETTERS) {
      const items = splitLetter(read(f))
      expect(items.slice(-2).map((i) => [i.text, i.keep]), f).toEqual([[expect.stringMatching(/^With warm good wishes,/), false], ['Maren', false]])
      expect(lettersTasks(items).some((t) => /^With warm|^Maren$/.test(t.text)), f).toBe(false)
    }
  })

  it('a line opening “With” and ending at a comma is one only at the end, with no sentence under it', () => {
    const items = splitLetter('Dear Ana,\n\nWith the ending, I agree,\n\nCut the last page.\n\nWith admiration for the book,\n\nTom')
    expect(items.map((i) => i.keep)).toEqual([false, true, true, false, false])
  })
})

describe('a long numbered heading (W3-8)', () => {
  it('“1. The scheme: told too often…” stands over its points, as the others do', () => {
    const items = splitLetter(read(LETTERS[0]))
    const headings = items.filter((i) => i.heading).map((i) => i.text)
    expect(headings).toEqual(expect.arrayContaining([
      'The scheme: told too often, and never quite pinned down (your question 1)',
      'Days, tides and light (your question 2)',
      'Who knows what: Brennick (your question 3)',
      'The ending (your question 4)',
    ]))
    const tasks = lettersTasks(items)
    expect(tasks.filter((t) => t.group === 'The scheme: told too often, and never quite pinned down (your question 1)')).toHaveLength(7)
  })

  it('only among numbered headings, and not one with a sentence in it', () => {
    const long = '1. The scheme: told too often, and never quite pinned down (your question 1)'
    // Alone, as long as that, it is a point.
    expect(splitLetter(`Dear Ana,\n\n${long}\n\nBoth, I'm afraid.`).find((i) => i.heading)).toBeUndefined()
    // Among shorter numbered headings, a heading; one that holds a sentence stays a point.
    const among = `Dear Ana,\n\n${long}\n\nBoth, I'm afraid.\n\n2. Days and tides\n\nThe calendar holds.`
    expect(splitLetter(among).filter((i) => i.heading).map((i) => i.text)).toEqual(['The scheme: told too often, and never quite pinned down (your question 1)', 'Days and tides'])
    const sentence = `Dear Ana,\n\n1. The scheme is told too often. It is never quite pinned down, as you asked me\n\nBoth.\n\n2. Days and tides\n\nThe calendar holds.`
    expect(splitLetter(sentence).filter((i) => i.heading).map((i) => i.text)).toEqual(['Days and tides'])
  })

  it('the first loop’s first letter, the same: “1. The fraud has to make sense on one sheet of paper…”, 77 characters, a heading', () => {
    const items = splitLetter(read('run-2026-11-10-loop/letter-1.txt'))
    expect(items.find((i) => i.text.startsWith('The fraud has to make sense'))).toMatchObject({ heading: true })
  })
})

describe('which letter (W3-9)', () => {
  const [one, two] = LETTERS.map(read)

  it('whose, and when, from its head; a second from the same hand says it is the second', () => {
    const first = letterName(one, '', [])
    expect(first).toBe('Maren Hollis’s letter of 14 November')
    expect(letterName(two, '', [first])).toBe('Maren Hollis’s second letter, of 14 November')
    // The name typed, as the writer typed it in the run, and a letter named so before.
    expect(letterName(two, 'Maren Hollis', ['Maren Hollis'])).toBe('Maren Hollis’s second letter, of 14 November')
    expect(letterName(two, '', [first, 'Maren Hollis’s second letter, of 14 November'])).toBe('Maren Hollis’s third letter, of 14 November')
  })

  it('a name typed with its date is taken as typed; with none anywhere, an editorial letter', () => {
    expect(letterName(one, 'Ines, 3 November', [])).toBe('Ines, 3 November')
    expect(letterName(one, 'Ines, 3 November', ['Ines, 3 November'])).toBe('Ines, 3 November, the second letter')
    expect(letterName('Some notes.\n\nCut the prologue.', '', [])).toBe('an editorial letter')
    expect(letterName('Dear Ana,\n\nCut it.\n\nBest,\nTom', '', [])).toBe('Tom’s letter')
  })

  it('the earlier runs’ letters: who sent them, from their heads', () => {
    expect(letterName(read('run-2026-11-09/letter-1.txt'), '', [])).toBe('Margit Hale’s letter of 9 November 2026')
    expect(letterName(read('run-2026-11-10-loop/letter-1.txt'), '', [])).toBe('Jonah Pryce’s letter of 10 November 2026')
    expect(letterName(read('run-2026-11-12-loop2/letter-1.txt'), '', [])).toBe('Ines Marlowe’s letter of 11 November 2026')
  })
})
