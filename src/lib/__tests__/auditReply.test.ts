import { describe, it, expect } from 'vitest'
import { parseAuditReply, normalizeForQuote, quoteFragments, placeQuote, prepareScenes, checkAudit } from '@/lib/auditReply'
import { INVALID_JSON_MESSAGE } from '@/lib/codeFence'

const scenes = prepareScenes([
  { eventId: 'e14', text: '“I was twenty-two. A junior. Like you. It was the Bicentennial, and they opened the case.”' },
  { eventId: 'e17', text: '"Because I\'m a coward," said Hal Oduya, "and I\'m _sixty-four_ years old, and I find I’m tired of it."' },
])

describe('parseAuditReply', () => {
  it('reads the findings, from the object or the list alone, in a code fence or not', () => {
    const finding = { title: 'Hal’s age', severity: 'serious', quotes: ['a quote', { text: 'another' }], why: 'Because.' }
    const expected = [{ title: 'Hal’s age', severity: 'serious', quotes: ['a quote', 'another'], why: 'Because.' }]
    expect(parseAuditReply(JSON.stringify({ findings: [finding] }))).toEqual(expected)
    expect(parseAuditReply(JSON.stringify([finding]))).toEqual(expected)
    expect(parseAuditReply('```json\n' + JSON.stringify({ findings: [finding] }) + '\n```')).toEqual(expected)
  })

  it('fills what a finding leaves out, and drops what is not one', () => {
    expect(parseAuditReply('{"findings": [{"quotes": ["x"]}, 7, null]}')).toEqual([
      { title: 'Untitled finding', severity: 'minor', quotes: ['x'], why: '' },
    ])
    expect(parseAuditReply('{"findings": [{"title": "T", "severity": "Catastrophic"}]}')[0].severity).toBe('minor')
  })

  it('says so when the reply is not JSON, or has no findings', () => {
    expect(() => parseAuditReply('Here are the findings: …')).toThrow(INVALID_JSON_MESSAGE)
    expect(() => parseAuditReply('{"errors": []}')).toThrow('The reply has no list of findings.')
  })
})

describe('quotes', () => {
  it('compare as quotes.py compared them: case, curly quotes, dashes, emphasis and spacing set aside', () => {
    expect(normalizeForQuote('“I’m  _Sixty-Four_” — he said')).toBe('"i\'m sixty-four" - he said')
  })

  it('split at an elision, keeping only parts long enough to mean something', () => {
    expect(quoteFragments('I was twenty-two … It was the Bicentennial... ok [sic] and they opened the case.'))
      .toEqual(['i was twenty-two', 'it was the bicentennial', 'and they opened the case'])
  })

  it('are placed in the scene of their first part, and only where every part is in the book', () => {
    expect(placeQuote('I was twenty-two. A junior.', scenes)).toBe('e14')
    expect(placeQuote('I\'m sixty-four years old', scenes)).toBe('e17')
    expect(placeQuote('I was twenty-two … I find I’m tired of it', scenes)).toBe('e14')
    expect(placeQuote('I was twenty-two … I find I am weary of it', scenes)).toBeNull()
    expect(placeQuote('I was sixty-four', scenes)).toBeNull()
    // Nothing long enough to look for is not a quote.
    expect(placeQuote('Hal', scenes)).toBeNull()
  })
})

describe('checkAudit', () => {
  it('keeps a finding every quote of which is in the book, placed; drops one with a quote that is not, or only one side', () => {
    const { kept, dropped } = checkAudit([
      { title: 'Hal cannot have been 22', severity: 'serious', why: 'A century apart.', quotes: ['I was twenty-two', 'I\'m sixty-four years old'] },
      { title: 'Invented', severity: 'minor', why: '', quotes: ['I was twenty-two', 'Hal was born in 246 AL'] },
      { title: 'One-sided', severity: 'minor', why: '', quotes: ['I was twenty-two'] },
    ], [
      { eventId: 'e14', text: '“I was twenty-two. A junior.”' },
      { eventId: 'e17', text: 'I’m sixty-four years old' },
    ])
    expect(kept).toEqual([{
      title: 'Hal cannot have been 22', severity: 'serious', why: 'A century apart.',
      quotes: [{ text: 'I was twenty-two', eventId: 'e14' }, { text: 'I\'m sixty-four years old', eventId: 'e17' }],
    }])
    expect(dropped.map((d) => [d.finding.title, d.reason])).toEqual([
      ['Invented', '“Hal was born in 246 AL” is not in the book.'],
      ['One-sided', 'It quotes only one side.'],
    ])
  })
})
