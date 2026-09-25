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
    expect(at('She wrote @')).toEqual({ start: 10, end: 11, query: '', intent: 'mention' })
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

/**
 * The doubled sigil: `@@Marn` asserts that he is in the room.
 *
 * Writing is the gesture a writer is already making, so the one thing they
 * most want to state mid-sentence — *she is here* — should not cost a trip to
 * another panel. What makes it safe is that the keystroke is an assertion and
 * nothing reads the prose to infer one: fiction is full of *"Vey was not
 * there"* and *"he imagined Marn in the Ossuary"*, and a rule that read those
 * as records would be wrong exactly where the writing is most interesting.
 */
describe('the doubled sigil', () => {
  const cast: MentionCandidate[] = [
    { id: 'marn', kind: 'character', name: 'Isko Marn' },
    { id: 'key', kind: 'item', name: 'Ossuary Key' },
    { id: 'bay', kind: 'location', name: 'Bay Nineteen' },
  ]

  it('reads one "@" as a mention and two as presence', () => {
    expect(findMentionToken('He saw @Isko', 12, cast)?.intent).toBe('mention')
    expect(findMentionToken('He saw @@Isko', 13, cast)?.intent).toBe('present')
  })

  it('starts the token at the first sigil, so neither is left in the prose', () => {
    /*
      `lastIndexOf('@')` lands on the *second* one. Splicing from there would
      leave a stray "@" in the manuscript — which is the whole class of bug
      this picker exists to prevent.
    */
    const token = findMentionToken('He saw @@Isko', 13, cast)
    expect(token?.start).toBe(7)
    expect(token?.query).toBe('Isko')
  })

  it('refuses a run of three or more', () => {
    // Punctuation, emphasis or a typo. Guessing which would be the app
    // deciding what the writer meant.
    expect(findMentionToken('He saw @@@Isko', 14, cast)).toBeNull()
  })

  it('still ignores an address', () => {
    // The pair for the rule above: the guard has to look back past the whole
    // run, not just one character.
    expect(findMentionToken('write to me@@home', 17, cast)).toBeNull()
  })

  it('offers only characters for presence, and everyone for a mention', () => {
    const everyone = mentionSuggestions('', cast, { canCreateLocation: true })
    expect(everyone.map((s) => s.kind)).toEqual(['character', 'item', 'location'])

    const people = mentionSuggestions('', cast, { canCreateLocation: true, kinds: ['character'] })
    expect(people.map((s) => s.kind)).toEqual(['character'])
  })

  it('never offers to invent somebody to assert is present', () => {
    /*
      Asserting that a person is in the room is a claim about a person who
      exists. Conjuring one from a half-typed word is how a cast list grows a
      phantom — which Enter-on-a-create-row did once already. A new character
      is still one `@` away.
    */
    const withCreate = mentionSuggestions('Wenmere', cast, { canCreateLocation: true })
    expect(withCreate.some((s) => s.type === 'create')).toBe(true)

    const noCreate = mentionSuggestions('Wenmere', cast, {
      canCreateLocation: true, kinds: ['character'], allowCreate: false,
    })
    expect(noCreate).toEqual([])
  })
})

/**
 * The prose gets the words the writer was typing, not the record's filing name.
 *
 * `rank` has always searched aliases; only `select` ignored them. A writer
 * whose book never says a character's surname gave her the alias *Wren*, typed
 * `@@Wren`, and got *"Wren Halloway"* — then deleted nine characters by hand
 * every time. They named it the single thing that most made writing the
 * bookkeeping feel like filing.
 */
describe('what the picker puts in the sentence', () => {
  const wren: MentionCandidate = {
    id: 'w', kind: 'character', name: 'Wren Halloway', aliases: ['Wren', 'the surveyor'],
  }
  const insertFor = (query: string) => {
    const [first] = mentionSuggestions(query, [wren], { canCreateLocation: false })
    return first?.type === 'existing' ? first.insert : null
  }

  it('uses the alias the query is heading for', () => {
    expect(insertFor('Wren')).toBe('Wren')
    expect(insertFor('the sur')).toBe('the surveyor')
  })

  it('and the record\'s own name when the query is heading for that', () => {
    /*
      The pair, and the ordering that makes it work: a fully typed "Wren
      Halloway" is not a prefix of the alias "Wren", so it falls through. The
      writer gets whichever they were already writing.
    */
    expect(insertFor('Wren Hall')).toBe('Wren Halloway')
    expect(insertFor('Halloway')).toBe('Wren Halloway')
  })

  it('leaves a record with no aliases alone', () => {
    const plain: MentionCandidate = { id: 'p', kind: 'item', name: 'Ash Ledger' }
    const [first] = mentionSuggestions('Ash', [plain], { canCreateLocation: false })
    expect(first?.type === 'existing' && first.insert).toBe('Ash Ledger')
  })
})

/*
  The reachability the editor's "nobody called that" notice depends on.

  It shows whenever the picker comes up empty, without testing which sigil was
  typed — because a single `@` cannot come up empty: a query nothing matches
  still gets create rows, and a query that matches exactly is, by definition,
  matched. Written as a test rather than a comment so that making `@` able to
  return nothing fails here, next to the reasoning, instead of quietly
  changing what the notice means.
*/
describe('a single @ always has something to offer', () => {
  const cast: MentionCandidate[] = [{ id: 'a', kind: 'character', name: 'Isko Marn' }]

  it('offers create rows for a name nothing answers', () => {
    expect(mentionSuggestions('Wenmere', cast, { canCreateLocation: false }).length).toBeGreaterThan(0)
  })

  it('and the record itself for a name that is already taken', () => {
    expect(mentionSuggestions('Isko Marn', cast, { canCreateLocation: false }).length).toBeGreaterThan(0)
  })
})
