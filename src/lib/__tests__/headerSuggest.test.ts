import { describe, it, expect } from 'vitest'
import { accountedFor, speakers, suggestCast, withCast, SPEAKS_MIN } from '@/lib/headerSuggest'
import { parseSceneHeader, splitSceneHeader } from '@/lib/sceneHeader'

/**
 * A header line suggested from the prose (Part D1): who is in the scene, read
 * from who speaks in it, twice or more — the one kind that was right often
 * enough on the Library's books to offer (`scripts/suggest-probe.ts`).
 */

const people = [
  { id: 'bruno', name: 'Bruno Vale', aliases: [] },
  { id: 'ann', name: 'Ann Bell', aliases: [] },
  { id: 'cass', name: 'Cass Orrin', aliases: [] },
]

const prose = [
  '“The tide is turning,” said Bruno.',
  'Ann looked at the water. “Then we go now,” she said.',
  '“Not yet,” Bruno replied.',
  'Ann asked whether the boat would hold.',
  'They thought of Cass, who was in Lisbon, and Cass would have known.',
].join('\n')

describe('who speaks in a scene', () => {
  it('counts speech said of somebody named beside it, and not a name alone', () => {
    const said = speakers(prose, people)
    expect(said.get('bruno')).toBe(2)
    // "Ann looked … she said" is not said of Ann by name; "Ann asked" is.
    expect(said.get('ann')).toBe(1)
    // Named twice, said to speak never: talked about, not there.
    expect(said.has('cass')).toBe(false)
  })

  it(`offers whoever speaks ${SPEAKS_MIN} times or more, and the header does not account for`, () => {
    expect(suggestCast(prose, people, [])).toEqual(['bruno'])
    // In the cast, mentioned or there from elsewhere: accounted for, and not offered again.
    expect(suggestCast(prose, people, ['bruno'])).toEqual([])
    const more = `${prose}\n“Hold on,” Ann cried.`
    expect(suggestCast(more, people, [])).toEqual(['bruno', 'ann'])
  })
})

describe('whom the header accounts for', () => {
  const scene = { involvedCharacterIds: ['a'], mentionedCharacterIds: ['b'], remoteCharacterIds: ['c'], povCharacterId: 'd' }
  it('is the cast, the mentioned, those there from elsewhere, the point of view, and those set aside', () => {
    expect(accountedFor(scene, [], people, ['e']).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('and whoever the line names, applied or not, by name in any case', () => {
    expect(accountedFor({ involvedCharacterIds: [] }, ['bruno vale', 'Nobody Known'], people)).toEqual(['bruno'])
    // So typing them on the line takes the offer away before the line is left.
    expect(suggestCast(prose, people, accountedFor({ involvedCharacterIds: [] }, ['Bruno Vale'], people))).toEqual([])
    expect(suggestCast(prose, people, accountedFor({ involvedCharacterIds: [] }, [], people))).toEqual(['bruno'])
  })
})

describe('adding the suggestion to the header', () => {
  const names = ['Bruno Vale', 'Ann Bell']
  const cast = (header: string) => parseSceneHeader(splitSceneHeader(`${header}\n\nProse.`).header!).characters

  it('makes a line where there is no header', () => {
    expect(withCast(null, names)).toBe('[@@Bruno Vale @@Ann Bell]')
    expect(cast(withCast(null, names))).toEqual(names)
  })

  it('adds to a one-line header, keeping what it said', () => {
    const line = withCast('[#The Quay @@Cass Orrin ^The Ledger]', names)
    expect(line).toBe('[#The Quay @@Cass Orrin ^The Ledger @@Bruno Vale @@Ann Bell]')
    const read = parseSceneHeader(splitSceneHeader(`${line}\n\nProse.`).header!)
    expect(read.place).toBe('The Quay')
    expect(read.characters).toEqual(['Cass Orrin', ...names])
    expect(read.items?.map((i) => i.name)).toEqual(['The Ledger'])
  })

  it('adds to a block’s Characters line, or makes one after its Place', () => {
    const withLine = withCast('[\n  Place: #The Quay\n  Characters: @@Cass Orrin\n]', names)
    expect(withLine).toBe('[\n  Place: #The Quay\n  Characters: @@Cass Orrin @@Bruno Vale @@Ann Bell\n]')
    expect(cast(withLine)).toEqual(['Cass Orrin', ...names])
    const without = withCast('[\n  Place: #The Quay\n  Items: ^The Ledger\n]', names)
    expect(without).toBe('[\n  Place: #The Quay\n  Characters: @@Bruno Vale @@Ann Bell\n  Items: ^The Ledger\n]')
    expect(cast(without)).toEqual(names)
  })
})

/*
  Someone only quoted is not offered as speaking (round-trip-plan-3.md, T12.2;
  writer run F8). The second loop's writer was offered @@Pell for "The
  tide-book", where Pell is only talked about, inside Tamsin's and Mallory's
  speech. The passage is the run's own.
*/
describe('a name inside somebody’s speech', () => {
  const tide = [
    '"I think I saw her. On the sixth. In the inner basin."',
    'Mallory said nothing for long enough that she turned round to look at him. His eyes were on the line of red ink.',
    '"You think," he said.',
    '"There was a heron on the bow. A bad one. Pell said it looked like his aunt."',
    '"Pell says everything looks like his aunt. Pell\'s aunt is the most widely resembled woman in Saltgate." But he did not laugh, and he did not move away.',
  ].join('\n\n')
  const cast = [
    { id: 'pell', name: 'Pell', aliases: [] },
    { id: 'mallory', name: 'Mallory', aliases: [] },
    { id: 'tamsin', name: 'Tamsin', aliases: [] },
  ]

  it('the run’s scene: Pell is talked about, not speaking, and is not offered', () => {
    expect(speakers(tide, cast).has('pell')).toBe(false)
    expect(suggestCast(tide, cast, [])).toEqual([])
  })

  it('who speaks, outside the quotation, still counts; and a name in another’s speech does not, straight or curly', () => {
    const said = speakers([
      '"Pell\'s aunt," said Tamsin.',
      '“Except Pell,” said Tamsin.',
      '"I saw her," said Pell.',
      'Pell said, "Twice."',
      '“Not Mallory,” Pell answered.',
    ].join('\n\n'), cast)
    expect(said.get('tamsin')).toBe(2)
    expect(said.get('pell')).toBe(3)
    expect(said.has('mallory')).toBe(false)
  })

  it('a quotation runs to its paragraph’s end at most: the next paragraph starts outside one', () => {
    // An unclosed quotation, as a speech running over paragraphs opens each and closes only the last.
    const text = '"Pell said it was nothing. Pell said a great deal.\n\n"Go," said Pell.\n\nPell replied that it was late.'
    expect(speakers(text, cast).get('pell')).toBe(2)
  })
})
