import { describe, it, expect } from 'vitest'
import { navItems, visibleNavItems } from '../navItems'

const labels = (args: { readingMode: boolean; hasProse: boolean }) =>
  visibleNavItems(args).map((n) => n.label)
const paths = (args: { readingMode: boolean; hasProse: boolean }) =>
  visibleNavItems(args).map((n) => n.to)

/**
 * Reading mode takes the writing screens away and gives the book back.
 *
 * The pairing matters in both directions: a reader with a book must get the
 * Read screen, and a reader of one of the seven structural-only worlds must
 * not — those have no text, and their catalogue entries say so. A test that
 * only checked the presence would pass on a nav that always showed it.
 */
describe('visibleNavItems', () => {
  it('changes nothing for a writer', () => {
    expect(visibleNavItems({ readingMode: false, hasProse: true })).toEqual(navItems)
    expect(visibleNavItems({ readingMode: false, hasProse: false })).toEqual(navItems)
  })

  it('gives a reader the book, under a reader’s name for it', () => {
    const shown = visibleNavItems({ readingMode: true, hasProse: true })
    expect(shown.map((n) => n.to)).toContain('manuscript')
    expect(shown.find((n) => n.to === 'manuscript')?.label).toBe('Read')
    expect(labels({ readingMode: true, hasProse: true })).not.toContain('Manuscript')
  })

  it('offers no book when the world has no prose', () => {
    expect(paths({ readingMode: true, hasProse: false })).not.toContain('manuscript')
  })

  it('still takes away the writing screens that have no reader’s version', () => {
    for (const hasProse of [true, false]) {
      const shown = paths({ readingMode: true, hasProse })
      expect(shown).not.toContain('corkboard')
      expect(shown).not.toContain('structure')
    }
  })

  it('keeps the reading screens either way', () => {
    const shown = paths({ readingMode: true, hasProse: false })
    for (const p of ['timeline', 'characters', 'maps', 'lore']) expect(shown).toContain(p)
  })

  it('does not mutate the shared list while renaming', () => {
    visibleNavItems({ readingMode: true, hasProse: true })
    expect(navItems.find((n) => n.to === 'manuscript')?.label).toBe('Manuscript')
  })
})
