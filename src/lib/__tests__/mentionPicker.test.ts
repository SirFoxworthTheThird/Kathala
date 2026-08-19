import { describe, it, expect } from 'vitest'
import { findMentionToken, mentionSuggestions, type MentionCandidate } from '@/lib/mentionPicker'

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

/*
  The token, which is a separate job from the ranking above. The editor used to
  read `/@(\w*)$/`, one `\w` run, so typing a surname closed the picker and left
  a literal "@Ysolde Vane" in the manuscript with nothing created. Most names in
  the shipped library are not a single `\w` run.

  The interesting half is not that spaces are allowed — it is where the token
  stops. While it is open the picker owns the Enter key, so a token that ran on
  through a sentence would turn a paragraph break into a silent commit.
*/
describe('findMentionToken', () => {
  const at = (text: string, candidates: MentionCandidate[] = CAST) =>
    findMentionToken(text, text.length, candidates)
  const q = (text: string, candidates: MentionCandidate[] = CAST) => at(text, candidates)?.query ?? null

  it('opens on a bare "@" with everything still to type', () => {
    expect(at('She wrote @')).toEqual({ start: 10, end: 11, query: '' })
  })

  it('reads a one-word name, as it always did', () => {
    expect(q('She wrote @Marren')).toBe('Marren')
  })

  it('reads a two-word name, which is the whole point', () => {
    // The reported failure verbatim: the picker closed at the space and the
    // "@" was left in the prose.
    expect(q('and every clerk knew. @Ysolde Vane')).toBe('Ysolde Vane')
  })

  it('holds the picker open across the space between forename and surname', () => {
    // The moment after the space is when the picker blinking out is worst.
    expect(q('@Ysolde ')).toBe('Ysolde')
  })

  it('keeps a hyphen and an apostrophe inside the name', () => {
    expect(q('@Barrow-wight')).toBe('Barrow-wight')
    expect(q('@O’Brien')).toBe('O’Brien')
    expect(q("@O'Brien")).toBe("O'Brien")
  })

  it('closes at the first lowercase word, so prose does not become a name', () => {
    // This is what keeps Enter a paragraph break. Without it the token runs on
    // and the picker commits a suggestion instead.
    expect(at('@Ysolde Vane rang')).toBeNull()
    expect(at('@Ysolde Vane r')).toBeNull()
  })

  it('carries a lowercase particle when it still spells a record that exists', () => {
    const withParticle: MentionCandidate[] = [
      ...CAST, { id: 'c9', kind: 'character', name: 'Renée de Saint-Méran' },
    ]
    expect(q('@Renée de', withParticle)).toBe('Renée de')
    expect(q('@Renée de Saint-Méran', withParticle)).toBe('Renée de Saint-Méran')
    // …and not when it spells nothing: the same shape with no such record.
    expect(at('@Renée de', CAST)).toBeNull()
  })

  it('closes at punctuation and at a newline', () => {
    expect(at('@Ysolde Vane.')).toBeNull()
    expect(at('@Marren,')).toBeNull()
    expect(at('@Marren\nShe')).toBeNull()
  })

  it('stops before a run of capitals becomes a sentence', () => {
    expect(q('@One Two Three Four')).toBe('One Two Three Four')
    expect(at('@One Two Three Four Five')).toBeNull()
    expect(at(`@${'A'.repeat(60)}`)).toBeNull()
  })

  it('ignores an "@" inside a word, which is an address', () => {
    expect(at('write to kvothe@university')).toBeNull()
    // The presence half: the same "@" after a space is a mention.
    expect(q('write to kvothe @university')).toBe('university')
  })

  it('reads only the token the caret is in', () => {
    const text = '@Marren met @Hask'
    expect(findMentionToken(text, text.length)?.query).toBe('Hask')
    expect(findMentionToken(text, 7)?.query).toBe('Marren')
  })

  it('spans exactly the text the editor will replace', () => {
    const text = 'she saw @Ysolde Vane'
    const t = at(text)!
    expect(text.slice(t.start, t.end)).toBe('@Ysolde Vane')
  })

  it('hands a multi-word name to the picker as something creatable', () => {
    // The two halves joined: the token the editor reads, fed to the ranking.
    const token = at('@Ysolde Vane')!
    expect(mentionSuggestions(token.query, CAST, opts)).toContainEqual(
      { type: 'create', kind: 'character', name: 'Ysolde Vane' },
    )
  })
})
