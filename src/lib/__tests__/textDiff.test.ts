import { describe, it, expect } from 'vitest'
import { tokenize, diffWords, diffStats } from '@/lib/textDiff'

describe('tokenize', () => {
  it('keeps words and whitespace as separate tokens', () => {
    expect(tokenize('a  b')).toEqual(['a', '  ', 'b'])
    expect(tokenize('')).toEqual([])
  })
})

describe('diffWords', () => {
  it('marks unchanged text as equal', () => {
    const d = diffWords('the cat sat', 'the cat sat')
    expect(d).toEqual([{ op: 'equal', text: 'the cat sat' }])
  })

  it('detects an inserted word', () => {
    const d = diffWords('the cat sat', 'the black cat sat')
    const added = d.filter((t) => t.op === 'add').map((t) => t.text.trim()).join('')
    expect(added).toContain('black')
    // Reconstructing the "b" side (equal + add) yields the new text.
    const bSide = d.filter((t) => t.op !== 'remove').map((t) => t.text).join('')
    expect(bSide).toBe('the black cat sat')
  })

  it('detects a removed word', () => {
    const d = diffWords('the black cat sat', 'the cat sat')
    const removed = d.filter((t) => t.op === 'remove').map((t) => t.text.trim()).join('')
    expect(removed).toContain('black')
    const aSide = d.filter((t) => t.op !== 'add').map((t) => t.text).join('')
    expect(aSide).toBe('the black cat sat')
  })

  it('handles a replacement as a remove + add', () => {
    const d = diffWords('the cat sat', 'the dog sat')
    const ops = d.map((t) => t.op)
    expect(ops).toContain('remove')
    expect(ops).toContain('add')
    // Both sides reconstruct correctly.
    expect(d.filter((t) => t.op !== 'add').map((t) => t.text).join('')).toBe('the cat sat')
    expect(d.filter((t) => t.op !== 'remove').map((t) => t.text).join('')).toBe('the dog sat')
  })

  it('merges adjacent same-op runs', () => {
    const d = diffWords('one two three', 'one four five three')
    // No two consecutive tokens should share an op.
    for (let i = 1; i < d.length; i++) expect(d[i].op).not.toBe(d[i - 1].op)
  })

  it('treats empty→text as all additions', () => {
    const d = diffWords('', 'hello world')
    expect(d.every((t) => t.op === 'add')).toBe(true)
  })
})

describe('diffStats', () => {
  it('counts added and removed words, ignoring whitespace tokens', () => {
    const d = diffWords('the cat sat', 'the big brave dog sat')
    const { added, removed } = diffStats(d)
    expect(added).toBe(3)   // big, brave, dog
    expect(removed).toBe(1) // cat
  })
})
