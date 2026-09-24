import { describe, it, expect } from 'vitest'
import { atLeastStatus } from '@/lib/eventStatus'

/**
 * "Only the finished scenes" is a threshold on a progression, not a set of
 * tick-boxes — so a draft can be sent out without the scenes that are not
 * ready, and the rule keeps meaning the same thing if a stage is ever added.
 */
describe('atLeastStatus', () => {
  it('counts the stage itself and everything past it', () => {
    expect(atLeastStatus('revised', 'revised')).toBe(true)
    expect(atLeastStatus('final', 'revised')).toBe(true)
  })

  it('and nothing before it', () => {
    // The pair. A rule that always said yes would satisfy the half above.
    expect(atLeastStatus('draft', 'revised')).toBe(false)
    expect(atLeastStatus('outline', 'revised')).toBe(false)
    expect(atLeastStatus('idea', 'revised')).toBe(false)
  })

  /*
    A status the app does not recognise ranks below everything. For an export
    that is the safe reading: nobody declared such a scene finished, and leaving
    it out of a submission draft is recoverable where including it is not.
    `indexOf` returning -1 is exactly the trap this guards — without the `>= 0`
    it would compare as lower than every real stage *and* pass a `min` of idea.
  */
  it('treats a status it does not know as below every stage', () => {
    expect(atLeastStatus(undefined, 'idea')).toBe(false)
    expect(atLeastStatus('', 'idea')).toBe(false)
    expect(atLeastStatus('polished', 'idea')).toBe(false)
  })
})
