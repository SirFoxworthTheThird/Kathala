import { describe, it, expect } from 'vitest'
import { wordCount, detectMentions, nameAliases } from '@/lib/manuscript'
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
    expect(nameAliases('Dr. Henry Jekyll')).toEqual(['Dr. Henry Jekyll', 'Henry Jekyll', 'Henry'])
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

  it('is unchanged for an ordinary name', () => {
    expect(nameAliases('Teodor Sarn')).toEqual(['Teodor Sarn', 'Teodor'])
    expect(nameAliases('Mira')).toEqual(['Mira'])
  })

  /*
    The pre-existing three-character floor, kept: a very short first word is not
    distinctive enough to hunt for on its own.
  */
  it('keeps the three-character floor on a first word', () => {
    expect(nameAliases('Jo March')).toEqual(['Jo March'])
  })

  /*
    And on the far side of a title, which is a separate line of the rule: the
    first mutation sweep on this file found the floor untested there, because
    every fixture that exercised it had no title to strip.
  */
  it('keeps that floor after a title too', () => {
    expect(nameAliases('Dr Jo March')).toEqual(['Dr Jo March', 'Jo March'])
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
  it('does not match a surname alone for an untitled name', () => {
    expect(detectMentions('Sarn watched the door.', [char('i', 'Teodor Sarn')])).toEqual([])
  })
})
