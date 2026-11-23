import { describe, it, expect } from 'vitest'
import { wordChange, netChange } from '@/lib/wordChange'
import { wordCount } from '@/lib/manuscript'

/*
  What a save added and cut (issue #706, sprints-plan.md, D-4).
*/

describe('wordChange', () => {
  it('words typed at the end are added, words taken off the end are cut', () => {
    expect(wordChange('The gate was shut.', 'The gate was shut. Teodora waited.')).toEqual({ added: 2, cut: 0 })
    expect(wordChange('The gate was shut. Teodora waited.', 'The gate was shut.')).toEqual({ added: 0, cut: 2 })
  })

  it('a word rewritten in the middle is one added and one cut, so the net, nothing, is not all it did', () => {
    expect(wordChange('She walked to the gate alone.', 'She ran to the gate alone.')).toEqual({ added: 1, cut: 1 })
    expect(wordChange('She walked to the gate alone.', 'She hurried, at last, to the gate alone.')).toEqual({ added: 3, cut: 1 })
  })

  it('a sentence cut from the middle is all cut; the words around it are not counted', () => {
    const before = 'One. Two words here. Three.'
    expect(wordChange(before, 'One. Three.')).toEqual({ added: 0, cut: 3 })
  })

  it('a word moved within the changed stretch is neither', () => {
    // Swapped in place: the middle holds the same words, in another order.
    expect(wordChange('Then came Ambrose and Teodora late.', 'Then came Teodora and Ambrose late.')).toEqual({ added: 0, cut: 0 })
    expect(wordChange('a b c d', 'a c b d')).toEqual({ added: 0, cut: 0 })
    // A word is as the count counts it, its punctuation with it: *Teodora,* is not *Teodora*.
    expect(wordChange('Then came Ambrose and Teodora, late.', 'Then came Teodora and Ambrose, late.')).toEqual({ added: 2, cut: 2 })
  })

  it('from nothing and to nothing', () => {
    expect(wordChange('', 'Three new words')).toEqual({ added: 3, cut: 0 })
    expect(wordChange('Three old words', '')).toEqual({ added: 0, cut: 3 })
    expect(wordChange('', '')).toEqual({ added: 0, cut: 0 })
  })

  it('space and line ends alone change no word', () => {
    expect(wordChange('One two.\n\nThree.', 'One  two.\nThree.  ')).toEqual({ added: 0, cut: 0 })
  })

  it('a word repeated is counted for each time it is there', () => {
    expect(wordChange('the cat', 'the the cat')).toEqual({ added: 1, cut: 0 })
    expect(wordChange('no no no', 'no')).toEqual({ added: 0, cut: 2 })
  })

  it('added less cut is the change in the count, always', () => {
    const texts = [
      '', 'One.', 'One two three.', 'The gate was shut, and Teodora waited by it.',
      'Teodora waited by the gate, which was shut.', 'shut shut shut', 'Waited.\n\nThe gate.',
    ]
    for (const a of texts) for (const b of texts) {
      const c = wordChange(a, b)
      expect(c.added - c.cut).toBe(wordCount(b) - wordCount(a))
      expect(c.added).toBeGreaterThanOrEqual(0)
      expect(c.cut).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('netChange', () => {
  it('a restructuring by its net: what it put in is added, what it took out is cut', () => {
    expect(netChange(12)).toEqual({ added: 12, cut: 0 })
    expect(netChange(-5)).toEqual({ added: 0, cut: 5 })
    expect(netChange(0)).toEqual({ added: 0, cut: 0 })
  })
})
