import { describe, it, expect } from 'vitest'
import {
  escapeRegExp, buildQueryRegex, countMatches, replaceAll, matchSnippets, nameMatchesQuery,
  type FindOptions,
} from '@/lib/findReplace'

const plain: FindOptions = { caseSensitive: false, wholeWord: false }
const cs: FindOptions = { caseSensitive: true, wholeWord: false }
const ww: FindOptions = { caseSensitive: false, wholeWord: true }

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so the query is literal', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c')
    // A literal query with special chars matches itself, not as a pattern.
    expect(countMatches('the cost is $5 (approx.)', '$5', plain)).toBe(1)
    expect(countMatches('a.b and axb', 'a.b', plain)).toBe(1) // '.' is literal, not "any char"
  })
})

describe('buildQueryRegex', () => {
  it('returns null for an empty query', () => {
    expect(buildQueryRegex('', plain)).toBeNull()
  })
})

describe('countMatches', () => {
  it('counts case-insensitively by default', () => {
    expect(countMatches('Cat cat CAT', 'cat', plain)).toBe(3)
  })
  it('respects case sensitivity', () => {
    expect(countMatches('Cat cat CAT', 'cat', cs)).toBe(1)
  })
  it('respects whole-word', () => {
    expect(countMatches('cat category cats', 'cat', ww)).toBe(1) // only the standalone "cat"
    expect(countMatches('cat category cats', 'cat', plain)).toBe(3) // substring
  })
})

describe('replaceAll', () => {
  it('replaces every match and reports the count', () => {
    expect(replaceAll('cat cat', 'cat', 'dog', plain)).toEqual({ text: 'dog dog', count: 2 })
  })
  it('treats the replacement literally (no $ expansion)', () => {
    expect(replaceAll('a b', 'b', '$&!', plain)).toEqual({ text: 'a $&!', count: 1 })
  })
  it('whole-word replace leaves substrings alone', () => {
    expect(replaceAll('cat cats', 'cat', 'dog', ww)).toEqual({ text: 'dog cats', count: 1 })
  })
  it('supports deletion (empty replacement)', () => {
    expect(replaceAll('a-b-c', '-', '', plain)).toEqual({ text: 'abc', count: 2 })
  })
  it('is a no-op for an empty query', () => {
    expect(replaceAll('abc', '', 'x', plain)).toEqual({ text: 'abc', count: 0 })
  })
})

describe('matchSnippets', () => {
  it('returns context around matches, capped', () => {
    const text = 'The quick brown fox jumps over the lazy fox again'
    const snips = matchSnippets(text, 'fox', plain, 5, 1)
    expect(snips).toHaveLength(1)
    expect(snips[0].match).toBe('fox')
    expect(snips[0].before.endsWith('own ')).toBe(true)
  })
})

describe('nameMatchesQuery', () => {
  it('matches a character name under the case option', () => {
    expect(nameMatchesQuery('Aragorn', 'aragorn', plain)).toBe(true)
    expect(nameMatchesQuery('Aragorn', 'aragorn', cs)).toBe(false)
    expect(nameMatchesQuery('Aragorn', 'ara', plain)).toBe(false) // exact only
  })
})
