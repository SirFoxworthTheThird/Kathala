import { describe, it, expect } from 'vitest'
import { inlineMarkdown, markdownExcerpt } from '@/lib/loreMarkdown'

describe('inlineMarkdown (writer run 9)', () => {
  it('reads bold, emphasis and code, and leaves the rest as it is', () => {
    expect(inlineMarkdown('The **Tithe Exchange** weighs *hours*, not `coin`.')).toEqual([
      { text: 'The ' }, { text: 'Tithe Exchange', strong: true }, { text: ' weighs ' },
      { text: 'hours', em: true }, { text: ', not ' }, { text: 'coin', code: true }, { text: '.' },
    ])
    expect(inlineMarkdown('__strong__ and _soft_')).toEqual([{ text: 'strong', strong: true }, { text: ' and ' }, { text: 'soft', em: true }])
  })

  it('is not fooled by arithmetic, snake_case or a lone asterisk', () => {
    expect(inlineMarkdown('2 * 3 * 4')).toEqual([{ text: '2 * 3 * 4' }])
    expect(inlineMarkdown('a snake_case_name')).toEqual([{ text: 'a snake_case_name' }])
    // An underscore after a letter opens nothing, even with a closer to find.
    expect(inlineMarkdown('the pre_fix_ stays')).toEqual([{ text: 'the pre_fix_ stays' }])
    expect(inlineMarkdown('f*** that')).toEqual([{ text: 'f*** that' }])
  })
})

describe('markdownExcerpt (writer run 9)', () => {
  it('keeps the hyphens in words, and takes off the marks', () => {
    expect(markdownExcerpt('# Salt-frost\n\n**Salt-frost** is the *tithe-mark* of a\n- working paid in hours.', 200))
      .toBe('Salt-frost Salt-frost is the tithe-mark of a working paid in hours.')
  })
  it('stops at the length asked for', () => {
    expect(markdownExcerpt('one two three', 7)).toBe('one two')
  })
})
