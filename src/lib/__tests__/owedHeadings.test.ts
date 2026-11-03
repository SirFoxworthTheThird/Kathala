import { beforeEach, describe, expect, it } from 'vitest'
import { oweHeadings, owedHeadings, paidHeadings } from '@/lib/owedHeadings'

describe('owedHeadings', () => {
  beforeEach(() => localStorage.clear())

  it('remembers heading lines until they are made, per world', () => {
    expect(owedHeadings('w1')).toBeNull()
    oweHeadings('w1', ['## The archive', '# The Far Refuge'], { pasted: true, atEnd: true })
    oweHeadings('w2', ['## Elsewhere'], { pasted: false })
    expect(owedHeadings('w1')).toEqual({ lines: ['## The archive', '# The Far Refuge'], pasted: true, atEnd: true })
    expect(owedHeadings('w2')).toEqual({ lines: ['## Elsewhere'], pasted: false, atEnd: false })

    // One made: the other is still owed.
    paidHeadings('w1', ['## The archive'])
    expect(owedHeadings('w1')).toEqual({ lines: ['# The Far Refuge'], pasted: true, atEnd: true })
    paidHeadings('w1', ['# The Far Refuge'])
    expect(owedHeadings('w1')).toBeNull()
    // The other world's is still owed, until all of it is paid.
    expect(owedHeadings('w2')).not.toBeNull()
    paidHeadings('w2')
    expect(localStorage.getItem('kathala-owed-headings')).toBeNull()
  })

  it('a second lot before the first is made adds its lines, and keeps where a paste ended', () => {
    oweHeadings('w1', ['## One'], { pasted: true, atEnd: true })
    oweHeadings('w1', ['## One', '## Two'], { pasted: false })
    expect(owedHeadings('w1')).toEqual({ lines: ['## One', '## Two'], pasted: true, atEnd: true })
    // None given is nothing owed.
    oweHeadings('w3', [], { pasted: false })
    expect(owedHeadings('w3')).toBeNull()
  })

  it('reads nothing from storage it cannot parse, and does not throw', () => {
    localStorage.setItem('kathala-owed-headings', '{not json')
    expect(owedHeadings('w1')).toBeNull()
    oweHeadings('w1', ['## One'], { pasted: false })
    expect(owedHeadings('w1')).toEqual({ lines: ['## One'], pasted: false, atEnd: false })
  })
})
