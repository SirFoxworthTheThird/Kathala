import { describe, it, expect } from 'vitest'
import { wordCount, detectMentions, nameAliases, castAliases } from '@/lib/manuscript'
import type { Character } from '@/types'

function char(id: string, name: string): Character {
  return { id, worldId: 'w', name } as unknown as Character
}

describe('wordCount', () => {
  it('counts whitespace-delimited words', () => {
    expect(wordCount('The quick brown fox')).toBe(4)
  })
  it('is zero for empty / whitespace', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   \n\t ')).toBe(0)
  })
  it('collapses irregular spacing and newlines', () => {
    expect(wordCount('one   two\n\nthree\tfour')).toBe(4)
  })
})

describe('detectMentions', () => {
  const cast = [char('a', 'Kael Stormwind'), char('b', 'Mira'), char('c', 'Will Hunter')]

  it('finds characters by first name as a proper noun', () => {
    const m = detectMentions('Kael drew his sword as Mira watched.', cast)
    const ids = m.map((x) => x.characterId)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('counts occurrences and sorts by frequency', () => {
    const m = detectMentions('Kael. Kael. Kael. Mira.', cast)
    expect(m[0].characterId).toBe('a')
    expect(m[0].count).toBe(3)
    expect(m[1].characterId).toBe('b')
  })

  it('does not match a common-word name in lowercase (verb "will")', () => {
    const m = detectMentions('She will go, but Will stayed behind.', cast)
    const will = m.find((x) => x.characterId === 'c')
    // Only the capitalized proper-noun "Will" counts, not the verb "will".
    expect(will?.count).toBe(1)
  })

  it('does not match substrings of longer words', () => {
    // "Miracle" contains "Mira" but should not match as a whole word.
    const m = detectMentions('It was a miracle, a Miracle indeed.', cast)
    expect(m.find((x) => x.characterId === 'b')).toBeUndefined()
  })

  it('returns nothing for empty prose', () => {
    expect(detectMentions('', cast)).toEqual([])
  })
})

/**
 * F-4, the over-firing half. `detectMentions` keyed on the first word of a
 * name, which for anyone with a title meant it keyed on the title: 21 of the
 * 760 characters in the shipped library are called "Mrs Something", and pasting
 * *Pride and Prejudice*'s opening — which names Mrs Bennet, who is cast, and
 * Mrs Long, who is not a character — put seven chips on the screen.
 */
describe('nameAliases', () => {
  it('drops a title so the name underneath is what gets looked for', () => {
    expect(nameAliases('Mrs Bennet')).toEqual(['Mrs Bennet', 'Bennet'])
  })

  it('handles the abbreviated form with its full stop', () => {
    expect(nameAliases('Dr. Henry Jekyll'))
      .toEqual(['Dr. Henry Jekyll', 'Henry Jekyll', 'Jekyll', 'Henry'])
  })

  it('never offers the title on its own', () => {
    for (const name of ['Mrs Bennet', 'Captain Ahab', 'Lord Voldemort', 'Master of Laketown']) {
      expect(nameAliases(name), name).not.toContain(name.split(' ')[0])
    }
  })

  /*
    An epithet gives up its article and nothing else. Splitting a first word off
    "The Sorting Hat" would put *Sorting* into the matcher — an ordinary word in
    the prose that character appears in, and matching on words that identify
    nobody is the whole fault being fixed.
  */
  it('keeps an epithet whole, minus the article', () => {
    expect(nameAliases('The Sorting Hat')).toEqual(['The Sorting Hat', 'Sorting Hat'])
    expect(nameAliases('The Watcher in the Water')).toEqual([
      'The Watcher in the Water', 'Watcher in the Water',
    ])
  })

  it('offers both ends of an ordinary name', () => {
    // The last word is a candidate, not a decision — `castAliases` is what
    // decides whether "Sarn" identifies anybody.
    expect(nameAliases('Teodor Sarn')).toEqual(['Teodor Sarn', 'Teodor', 'Sarn'])
    expect(nameAliases('Mira')).toEqual(['Mira'])
  })

  /*
    The pre-existing three-character floor, kept: a very short first word is not
    distinctive enough to hunt for on its own.
  */
  it('keeps the three-character floor, word by word', () => {
    // "Jo" is too short to hunt for; "March" is not.
    expect(nameAliases('Jo March')).toEqual(['Jo March', 'March'])
  })

  /*
    And on the far side of a title, which is a separate line of the rule: the
    first mutation sweep on this file found the floor untested there, because
    every fixture that exercised it had no title to strip.
  */
  it('keeps that floor after a title too', () => {
    expect(nameAliases('Dr Jo March')).toEqual(['Dr Jo March', 'Jo March', 'March'])
  })

  it('leaves a name that is only a title alone', () => {
    // Nothing remains to strip to, so the name stands as itself.
    expect(nameAliases('Captain')).toEqual(['Captain'])
  })

  it('survives a blank name', () => {
    expect(nameAliases('   ')).toEqual([])
  })
})

describe('detectMentions with titled names', () => {
  const bennet = char('a', 'Mrs Bennet')
  const others = [
    char('b', 'Mrs Forster'), char('c', 'Mrs Gardiner'), char('d', 'Mrs Hill'),
    char('e', 'Mrs Jenkinson'), char('f', 'Mrs Philips'), char('g', 'Mrs Reynolds'),
    char('h', 'Mrs Younge'),
  ]

  /* Austen's opening, which is what the writer run actually pasted. */
  const OPENING =
    'It is a truth universally acknowledged, that a single man in possession of a good ' +
    'fortune, must be in want of a wife. “My dear Mr. Bennet,” said his lady to him one ' +
    'day, “have you heard that Netherfield Park is let at last?” Mr. Bennet replied that ' +
    'he had not. “But it is,” returned she; “for Mrs. Long has just been here.”'

  it('no longer nudges seven strangers because one of them is a Mrs', () => {
    // The sentence that did it: a "Mrs." belonging to nobody in the cast.
    const mrsLong = 'For Mrs. Long has just been here, and she told me all about it.'
    expect(detectMentions(mrsLong, [bennet, ...others])).toEqual([])
  })

  /*
    The presence half, on Austen's actual opening: the fix must not be "match
    nothing". One chip, hers, and none of the seven.

    **What she is matched on is worth stating, because it is the cost of this
    rule.** The prose above never writes "Mrs Bennet" — it writes "Mr. Bennet",
    twice — and stripping the title exposes the surname, which a husband and
    wife share. So a family name nudges the relative. That is inherent to
    matching on the name under the title, it is what "Mrs Bennet keys on Bennet"
    means, and it is a far smaller wrong than seven strangers. Separating
    relatives needs a token to be judged distinctive against the rest of the
    cast, which is a different rule and is filed as its own finding.
  */
  it('finds her, and only her, in the opening that used to find seven', () => {
    const found = detectMentions(OPENING, [bennet, ...others])
    expect(found.map((m) => m.name)).toEqual(['Mrs Bennet'])
    expect(found[0].count, 'both "Mr. Bennet"s, which share her surname').toBe(2)
  })

  it('counts "Mrs Bennet" as one mention, not two', () => {
    const found = detectMentions('Mrs Bennet crossed the room.', [bennet])
    expect(found[0].count).toBe(1)
  })

  /*
    A name that wraps across a line still matches — and the fixture has to be a
    name with **no single-word alias**, or the test proves nothing: with
    "Mrs Bennet" the surname alone matches the second line and the count is 1
    either way. That is how this test first passed against a mutant with the
    whitespace flexibility taken out. An epithet has only multi-word forms, so
    it is the shape that can tell the difference.
  */
  it('matches a name broken across a line', () => {
    const hat = char('x', 'The Sorting Hat')
    expect(detectMentions('The Sorting\nHat spoke first.', [hat])[0]?.count).toBe(1)
    expect(detectMentions('The  Sorting  Hat spoke first.', [hat])[0]?.count).toBe(1)
  })

  /*
    Stated as a test because it is a deliberate limit, not an oversight: option 1
    matches the full name and the first word, so a scene that refers to someone
    by surname alone still finds nothing. It is filed rather than fixed.
  */
  /*
    The miss the finding reported, now closed — and its safety net in the same
    test, because a surname that identifies one person and a surname two people
    share are the two halves of one rule.
  */
  it('matches a surname alone when it belongs to one person', () => {
    const found = detectMentions('Sarn watched the door.', [char('i', 'Teodor Sarn')])
    expect(found.map((m) => m.name)).toEqual(['Teodor Sarn'])
  })

  it('and stops matching it the moment two people share it', () => {
    const cast = [char('i', 'Teodor Sarn'), char('j', 'Elsa Sarn')]
    expect(detectMentions('Sarn watched the door.', cast)).toEqual([])
    // The full name still finds the right one, which is why dropping the bare
    // surname loses nothing that identified anybody.
    expect(detectMentions('Elsa Sarn watched the door.', cast).map((m) => m.name))
      .toEqual(['Elsa Sarn'])
  })
})

/**
 * The second half of F-4, after the first shipped: stripping titles removed one
 * subset of the shared-word problem — *Mrs*, *The*, *Master* — and left the
 * rest. Measured on the shipped library after that fix, **47 characters across
 * 14 worlds** still shared a derived single word with a castmate: `John` in
 * *Jane Eyre*, `Bill` in *Fellowship* and *Two Towers*, `Hawkins` and `Tom` in
 * *Treasure Island*.
 */
describe('castAliases', () => {
  const withAliases = (id: string, name: string, aliases: string[]) =>
    ({ id, worldId: 'w', name, aliases }) as unknown as Character

  it('honours what the author wrote in "Also known as"', () => {
    // The library's own case: Barliman Butterbur, who the prose calls Butterbur.
    const [butterbur] = [withAliases('a', 'Barliman Butterbur', ['Butterbur'])]
    expect(castAliases([butterbur]).get('a')).toContain('Butterbur')
  })

  it('drops a derived word two characters would both answer to', () => {
    const cast = [char('a', 'Mrs Bennet'), char('b', 'Mr Bennet')]
    const out = castAliases(cast)
    expect(out.get('a')).not.toContain('Bennet')
    expect(out.get('b')).not.toContain('Bennet')
    // Their full names are not guesses and are never dropped.
    expect(out.get('a')).toContain('Mrs Bennet')
    expect(out.get('b')).toContain('Mr Bennet')
  })

  it('keeps it when only one character claims it', () => {
    expect(castAliases([char('a', 'Mrs Bennet')]).get('a')).toContain('Bennet')
  })

  /*
    *Fellowship* has both. The author said "Bill" means the pony; Bill Ferny does
    not get to take it by having that first name.
  */
  it('lets an author alias beat a derived word that collides with it', () => {
    const cast = [
      withAliases('pony', 'Bill the Pony', ['Bill']),
      char('ferny', 'Bill Ferny'),
    ]
    const out = castAliases(cast)
    expect(out.get('pony')).toContain('Bill')
    expect(out.get('ferny')).not.toContain('Bill')
    expect(out.get('ferny')).toContain('Ferny')
  })

  /*
    Isolating the rule that an author's alias *occupies* the word — which the
    Bill test above cannot do, because those two also collide by derivation and
    would come out the same either way. Here only one side states it.
  */
  it('an author alias blocks another character deriving the same word', () => {
    const cast = [
      withAliases('a', 'Aragorn', ['Strider']),
      char('b', 'Strider Vance'),
    ]
    const out = castAliases(cast)
    expect(out.get('a')).toContain('Strider')
    expect(out.get('b'), 'the derived word yields to the stated one').not.toContain('Strider')
    expect(out.get('b')).toContain('Vance')
  })

  it('leaves two author aliases alone even when they collide', () => {
    // Saying the same thing twice is a statement, not a guess.
    const cast = [
      withAliases('a', 'Aragorn', ['Strider']),
      withAliases('b', 'Someone Else', ['Strider']),
    ]
    expect(castAliases(cast).get('a')).toContain('Strider')
    expect(castAliases(cast).get('b')).toContain('Strider')
  })

  /*
    Stated out loud because it is the cost of this rule: the same character and
    the same prose can match differently after an unrelated edit somewhere else
    in the cast.
  */
  it('is relative to the cast — adding a relative quiets the surname', () => {
    const alone = castAliases([char('a', 'Teodor Sarn')]).get('a')
    const withKin = castAliases([char('a', 'Teodor Sarn'), char('b', 'Elsa Sarn')]).get('a')
    expect(alone).toContain('Sarn')
    expect(withKin).not.toContain('Sarn')
  })

  it('survives a character with no aliases field at all', () => {
    const legacy = { id: 'x', worldId: 'w', name: 'Mira' } as unknown as Character
    expect(castAliases([legacy]).get('x')).toEqual(['Mira'])
  })
})

describe('detectMentions and the aliases the author wrote', () => {
  const withAliases = (id: string, name: string, aliases: string[]) =>
    ({ id, worldId: 'w', name, aliases }) as unknown as Character

  it('finds a character by the name the author said the prose uses', () => {
    const cast = [withAliases('a', 'Barliman Butterbur', ['Butterbur'])]
    expect(detectMentions('Butterbur brought the beer.', cast).map((m) => m.name))
      .toEqual(['Barliman Butterbur'])
  })

  it('counts one mention when an alias sits inside the full name', () => {
    const cast = [withAliases('a', 'Barliman Butterbur', ['Butterbur'])]
    expect(detectMentions('Barliman Butterbur brought the beer.', cast)[0].count).toBe(1)
  })

  it('matches a title with or without its full stop', () => {
    const cast = [char('a', 'Mr Bennet'), char('b', 'Mrs Bennet')]
    // Both are cast, so bare "Bennet" identifies neither; the full name must
    // still match the form Austen actually writes.
    const found = detectMentions('Mr. Bennet replied that he had not.', cast)
    expect(found.map((m) => m.name)).toEqual(['Mr Bennet'])
  })
})
