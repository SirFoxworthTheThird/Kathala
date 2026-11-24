import { describe, expect, it } from 'vitest'
import { timelineDeleteSays } from '../timelineDelete'

describe('timelineDeleteSays', () => {
  it('counts what goes, and says Undo brings it back rather than "permanently"', () => {
    expect(timelineDeleteSays(20, 143)).toBe('Its 20 chapters and 143 scenes go with it, prose and all. Undo brings them back.')
    expect(timelineDeleteSays(1, 1)).toBe('Its 1 chapter and 1 scene go with it, prose and all. Undo brings them back.')
    expect(timelineDeleteSays(3, 0)).toBe('Its 3 chapters go with it, prose and all. Undo brings them back.')
    expect(timelineDeleteSays(0, 0)).toBe('It has no chapters yet. Undo brings it back.')
    expect(timelineDeleteSays(20, 143)).not.toMatch(/permanent/i)
  })
})
