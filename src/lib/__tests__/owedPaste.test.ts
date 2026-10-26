import { beforeEach, describe, expect, it } from 'vitest'
import { owePaste, owedPaste, paidPaste } from '@/lib/owedPaste'

describe('owedPaste', () => {
  beforeEach(() => localStorage.clear())

  it('remembers the heading lines of a paste until they are paid, per world', () => {
    expect(owedPaste('w1')).toBeNull()
    owePaste('w1', ['## The archive', '# The Far Refuge'], true)
    owePaste('w2', ['## Elsewhere'], false)
    expect(owedPaste('w1')).toEqual({ lines: ['## The archive', '# The Far Refuge'], atEnd: true })
    expect(owedPaste('w2')).toEqual({ lines: ['## Elsewhere'], atEnd: false })

    paidPaste('w1')
    expect(owedPaste('w1')).toBeNull()
    // The other world's is still owed.
    expect(owedPaste('w2')).toEqual({ lines: ['## Elsewhere'], atEnd: false })
    paidPaste('w2')
    expect(localStorage.getItem('kathala-owed-paste')).toBeNull()
  })

  it('a second paste before the first is made adds its lines, and keeps where the first ended', () => {
    owePaste('w1', ['## One'], true)
    owePaste('w1', ['## One', '## Two'], false)
    expect(owedPaste('w1')).toEqual({ lines: ['## One', '## Two'], atEnd: true })
  })

  it('reads nothing from storage it cannot parse, and does not throw', () => {
    localStorage.setItem('kathala-owed-paste', '{not json')
    expect(owedPaste('w1')).toBeNull()
    owePaste('w1', ['## One'], false)
    expect(owedPaste('w1')).toEqual({ lines: ['## One'], atEnd: false })
  })
})
