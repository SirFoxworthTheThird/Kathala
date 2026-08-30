import { describe, it, expect } from 'vitest'
import { draftAfterSave } from '../draftHandoff'

describe('draftAfterSave', () => {
  it('hands back to the stored value when nothing was typed during the save', () => {
    expect(draftAfterSave('The quick brown fox.', 'The quick brown fox.')).toBeNull()
  })

  it('keeps keystrokes made while the save was in flight', () => {
    // The bug: this used to return null, so the box snapped back to the older
    // text and the newer keystrokes were gone — no undo entry, no revision.
    expect(draftAfterSave('The quick red fox.', 'The quick brown fox.'))
      .toBe('The quick red fox.')
  })

  it('keeps an emptied box, which is a real edit and not an absent one', () => {
    expect(draftAfterSave('', 'The quick brown fox.')).toBe('')
  })

  it('leaves an already-cleared slot alone', () => {
    expect(draftAfterSave(null, 'The quick brown fox.')).toBeNull()
  })
})
