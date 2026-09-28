import { describe, it, expect } from 'vitest'
import { navItems, visibleNavItems } from '../navItems'

const paths = (readingMode: boolean) => visibleNavItems({ readingMode }).map((n) => n.to)

/**
 * Reading mode takes the writing screens away, and gives the book its reader's
 * name.
 *
 * The book is one screen now — the Manuscript, which was the Timeline and the
 * Manuscript — so a reader has it whether or not the world holds prose: its
 * chapters and scenes are where they set their place, and a structural-only
 * world is nothing but chapters and scenes.
 */
describe('visibleNavItems', () => {
  it('changes nothing for a writer', () => {
    expect(visibleNavItems({ readingMode: false })).toEqual(navItems)
  })

  it('has the book once, as the Manuscript', () => {
    const books = navItems.filter((n) => n.to === 'manuscript')
    expect(books).toHaveLength(1)
    expect(books[0].label).toBe('Manuscript')
    expect(navItems.map((n) => n.to)).not.toContain('timeline')
  })

  it('gives a reader the book, under a reader’s name for it', () => {
    const shown = visibleNavItems({ readingMode: true })
    expect(shown.find((n) => n.to === 'manuscript')?.label).toBe('Book')
    expect(shown.map((n) => n.label)).not.toContain('Manuscript')
  })

  it('takes away the writing screens, and keeps the reading ones', () => {
    const shown = paths(true)
    expect(shown).not.toContain('structure')
    for (const p of ['manuscript', 'characters', 'maps', 'lore']) expect(shown).toContain(p)
    // The pairing: the writer has the ones the reader lost.
    expect(paths(false)).toContain('structure')
  })

  it('does not mutate the shared list while renaming', () => {
    visibleNavItems({ readingMode: true })
    expect(navItems.find((n) => n.to === 'manuscript')?.label).toBe('Manuscript')
  })
})
