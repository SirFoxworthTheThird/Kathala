import { describe, it, expect } from 'vitest'
import { mentionSuggestions, type MentionCandidate } from '@/lib/mentionPicker'

const CAST: MentionCandidate[] = [
  { id: 'c1', kind: 'character', name: 'Marren Vale', aliases: ['the courier'] },
  { id: 'c2', kind: 'character', name: 'Old Hask' },
  { id: 'i1', kind: 'item', name: 'Marren’s Letter' },
  { id: 'l1', kind: 'location', name: 'Marrowgate' },
  { id: 'l2', kind: 'location', name: 'Thornfield' },
]

const opts = { canCreateLocation: true }
const names = (q: string, o = opts) => mentionSuggestions(q, CAST, o).map((s) => `${s.type}:${s.kind}:${s.name}`)

describe('mentionSuggestions', () => {
  it('offers everything, characters first, when nothing is typed yet', () => {
    const all = mentionSuggestions('', CAST, opts)
    expect(all.map((s) => s.kind).slice(0, 2)).toEqual(['character', 'character'])
    // And nothing to create: there is no name yet to create anything under.
    expect(all.every((s) => s.type === 'existing')).toBe(true)
  })

  it('matches on name, on the first word, and on an alias', () => {
    expect(names('marren')).toContain('existing:character:Marren Vale')
    expect(names('hask')).toContain('existing:character:Old Hask')
    expect(names('the cou')).toContain('existing:character:Marren Vale')
  })

  it('ranks a whole-name match above a first-word one, and characters above places', () => {
    // All three match on the name itself, so the tie is broken by kind, and
    // the kind order is the one the picker was built around: people first.
    expect(names('marr').slice(0, 3)).toEqual([
      'existing:character:Marren Vale',
      'existing:item:Marren’s Letter',
      'existing:location:Marrowgate',
    ])
  })

  it('offers to create all three kinds for a name nothing answers', () => {
    expect(names('Ashford')).toEqual([
      'create:character:Ashford',
      'create:item:Ashford',
      'create:location:Ashford',
    ])
  })

  it('puts existing records above the offer to create', () => {
    const out = mentionSuggestions('marren', CAST, opts)
    expect(out[0]).toMatchObject({ type: 'existing' })
    expect(out.some((s) => s.type === 'create')).toBe(true)
  })

  it('withholds the location row in a world with no map', () => {
    // A location is a pin; there is nowhere to put one.
    expect(names('Ashford', { canCreateLocation: false })).toEqual([
      'create:character:Ashford',
      'create:item:Ashford',
    ])
  })

  it('does not offer to create a name that already exists', () => {
    // This is how a cast list ends up with two of everybody.
    expect(names('Thornfield')).toEqual(['existing:location:Thornfield'])
    expect(names('  thornfield  ')).toEqual(['existing:location:Thornfield'])
  })

  it('keeps the create rows even when the limit is full of matches', () => {
    // Six matches and a novel name would otherwise push every create row off
    // the end, which is the case a writer naming something new is in.
    const many: MentionCandidate[] = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`, kind: 'character', name: `Mar${i}`,
    }))
    const out = mentionSuggestions('Mar', many, opts)
    expect(out.filter((s) => s.type === 'create')).toHaveLength(3)
  })

  it('caps a long list of matches', () => {
    const many: MentionCandidate[] = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`, kind: 'character', name: `Name ${i}`,
    }))
    expect(mentionSuggestions('', many, opts)).toHaveLength(6)
  })

  it('creates under the name as typed, not as lowercased for matching', () => {
    const out = mentionSuggestions('Ashford Hall', CAST, opts)
    expect(out[0]).toMatchObject({ type: 'create', name: 'Ashford Hall' })
  })
})
